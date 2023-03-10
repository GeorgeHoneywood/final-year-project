import {
    coordZToXYZ,
    microDegreesToDegrees,
    projectMercator,
    unprojectMercator,
    zxyToMercatorCoord,
} from "@/map/geom"
import type { ByteRange, Coord } from "@/map/types"
import {
    Tile,
    PoI,
    Way,
    type ZoomTable,
    type TilePosition
} from "./objects"
import { Reader } from "./reader"

class BBox {
    max_lat = 0
    min_lat = 0
    max_long = 0
    min_long = 0
}

class Flags {
    has_debug_info = false
    has_map_start_position = false
    has_start_zoom_level = false
    has_language_preference = false
    has_comment = false
    has_created_by = false
}

class MapStartLocation {
    lat = 0
    long = 0
    zoom = 0
}

class ZoomLevel {
    base_zoom_level = 0
    min_zoom_level = 0
    max_zoom_level = 0

    sub_file_start_position = 0n
    sub_file_length = 0n

    tile_height = 0
    tile_width = 0
    tile_total = 0

    index_end_position = 0n

    right_tile_x = 0
    left_tile_x = 0
    top_tile_y = 0
    bottom_tile_y = 0

    index_cache: ArrayBuffer | null = null
}

const tag_wildcard = /^.*=%([bifhs])$/;

/**
 * Reads some file encoded in the Mapsforge binary map file specification.
 *
 * _NOTE: You must call .readHeader(), before other methods of this class. This
 * populates the index required to read tile data.
 *
 * See here:
 * https://github.com/mapsforge/mapsforge/blob/master/docs/Specification-Binary-Map-File.md
 *
 * In cases where the specification was incomplete or inaccurate, I used the
 * original Java source code as a supplement:
 * https://github.com/mapsforge/mapsforge/tree/master/mapsforge-map-reader/src/main/java/org/mapsforge/map/reader
 *
 * To help remedy these issues for future implementors of the spec, I
 * contributed a PR to clear up some details:
 * https://github.com/mapsforge/mapsforge/pull/1374
 *
 */
class MapsforgeParser {
    blob: Blob | null
    url: URL | null

    version = 0
    file_size = 0n
    creation_date = new Date(0)
    bbox = new BBox()
    tile_size = 0
    projection = ""

    flags = new Flags()

    // optional fields
    map_start_location: MapStartLocation | null = null
    language_preference: string | null = null
    comment: string | null = null
    created_by: string | null = null

    poi_tag_count = 0
    poi_tags: string[] = []
    way_tag_count = 0
    way_tags: string[] = []

    zoom_interval_count = 0
    zoom_intervals: ZoomLevel[] = []

    /**
     * Create a mapsforge file parser. Pass in either a Blob or a URL
     * @param blob a whole, predownloaded blob
     * @param url to fetch data from dynamically
     */
    public constructor(blob: Blob | null = null, url: URL | null = null) {
        if (!blob && !url) {
            throw new Error("either supply a blob or a url to read data from!")
        }

        this.blob = blob
        this.url = url
    }

    /**
     * Helper function to get some bytes, either from the remote URL using range
     * requests, or from the downloaded blob using `.slice()`
     * 
     * @param begin offset to begin read at in bytes
     * @param end offset to end read at in bytes
     * @returns ArrayBuffer containing the requested bytes
     */
    private async fetchBytes(begin: number, end: number): Promise<ArrayBuffer> {
        if (this.blob) {
            return this.blob.slice(begin, end).arrayBuffer()
        } else if (this.url) {
            const resp = await fetch(this.url,
                {
                    headers: {
                        'Range': `bytes=${begin}-${end}`
                    }
                });

            if (!resp.ok) {
                throw new Error(
                    `request failed; error code: ${resp.statusText || resp.status}`
                );
            }

            const blob = await resp.blob()
            return blob.arrayBuffer()
        } else {
            throw new Error("no data source!")
        }
    }

    /**
     * Reads headers from the file. Must be called before you attempt to read
     * any tile data.
     */
    public async readHeader() {
        const magic_bytes = await this.fetchBytes(0, 24)
        if (new TextDecoder().decode(magic_bytes.slice(0, 20)) !== "mapsforge binary OSM") {
            throw new Error("file not in mapforge binary format!")
        }

        const header_length = new DataView(
            magic_bytes.slice(20, 24)
        ).getInt32(0)

        const header = new Reader(
            await this.fetchBytes(
                24, header_length + 24,
            )
        )

        this.version = header.getInt32()
        if (!(this.version >= 3 && this.version <= 5)) {
            throw new Error(`only mapsforge v3-v5 files are supported! you tried to load a v${this.version} file.`)
        }

        this.file_size = header.getBigInt64()

        // this might be problematic if the timestamp is greater than
        // MAX_SAFE_INTEGER
        this.creation_date = new Date(Number(header.getBigInt64()))

        this.bbox.min_lat = microDegreesToDegrees(header.getInt32())
        this.bbox.min_long = microDegreesToDegrees(header.getInt32())
        this.bbox.max_lat = microDegreesToDegrees(header.getInt32())
        this.bbox.max_long = microDegreesToDegrees(header.getInt32())

        this.tile_size = header.getInt16()

        this.projection = header.getVString()

        if (this.projection !== "Mercator") {
            throw new Error("only web mercator projected files are supported!")
        }

        const flag_byte = header.getUint8()
        this.flags.has_debug_info = (flag_byte & 128) != 0
        this.flags.has_map_start_position = (flag_byte & 64) != 0
        this.flags.has_start_zoom_level = (flag_byte & 32) != 0
        this.flags.has_language_preference = (flag_byte & 16) != 0
        this.flags.has_comment = (flag_byte & 8) != 0
        this.flags.has_created_by = (flag_byte & 4) != 0

        if (this.flags.has_map_start_position) {
            this.map_start_location = new MapStartLocation()

            this.map_start_location.lat = microDegreesToDegrees(
                header.getInt32()
            )
            this.map_start_location.long = microDegreesToDegrees(
                header.getInt32()
            )
        }

        if (this.flags.has_start_zoom_level) {
            this.map_start_location ??= new MapStartLocation()

            this.map_start_location.zoom = header.getUint8()
        }

        if (this.flags.has_language_preference) {
            this.language_preference = header.getVString()
        }

        if (this.flags.has_comment) {
            this.comment = header.getVString()
        }

        if (this.flags.has_created_by) {
            this.created_by = header.getVString()
        }

        this.poi_tag_count = header.getUint16()
        for (let i = 0; i < this.poi_tag_count; i++) {
            this.poi_tags.push(header.getVString())
        }

        this.way_tag_count = header.getUint16()
        for (let i = 0; i < this.way_tag_count; i++) {
            this.way_tags.push(header.getVString())
        }

        this.zoom_interval_count = header.getUint8()
        for (let i = 0; i < this.zoom_interval_count; i++) {
            const zoom_level = new ZoomLevel()

            zoom_level.base_zoom_level = header.getUint8()
            zoom_level.min_zoom_level = header.getUint8()
            zoom_level.max_zoom_level = header.getUint8()
            zoom_level.sub_file_start_position = header.getBigUint64()
            zoom_level.sub_file_length = header.getBigUint64()

            // calculate the number of tiles, so that we know how long the tile
            // index section is

            const { x: left_x, y: bottom_y } = coordZToXYZ(
                this.bbox.min_lat,
                this.bbox.min_long,
                zoom_level.base_zoom_level,
            )
            const { x: right_x, y: top_y } = coordZToXYZ(
                this.bbox.max_lat,
                this.bbox.max_long,
                zoom_level.base_zoom_level,
            )

            zoom_level.tile_height = bottom_y - top_y + 1
            zoom_level.tile_width = right_x - left_x + 1
            zoom_level.tile_total = zoom_level.tile_height * zoom_level.tile_width

            zoom_level.right_tile_x = right_x
            zoom_level.left_tile_x = left_x
            zoom_level.top_tile_y = top_y
            zoom_level.bottom_tile_y = bottom_y

            // each index is 5 bytes long
            zoom_level.index_end_position = zoom_level.sub_file_start_position + BigInt(zoom_level.tile_total) * 5n

            this.zoom_intervals.push(zoom_level)
        }

        for (const zoom_interval of this.zoom_intervals) {
            console.log(
                "precaching index for base zoom level",
                zoom_interval.base_zoom_level,
                "at", zoom_interval.sub_file_start_position,
                "to", zoom_interval.index_end_position,
            )

            zoom_interval.index_cache = await this.fetchBytes(
                Number(zoom_interval.sub_file_start_position),
                Number(zoom_interval.index_end_position),
            )
        }
    }

    /**
     * populate the service worker cache, with a number of tiles of data
     * 
     * @param base_tiles should all be the same zoom level, and ordered like so
     * for (x, y) -> [(0, 0), (1, 0), (0, 1), (1, 1)]
     */
    public async fetchBaseTileRange(base_tiles: TilePosition[]) {
        const zoom_interval = this.getBaseZoom(base_tiles[0].z)

        const byte_ranges = []
        for (const base_tile of base_tiles) {
            const byte_range = await this.getTileByteRange(base_tile, zoom_interval)
            if (byte_range) {
                byte_ranges.push(byte_range)
            }
        }

        console.log("fetching byte ranges:", byte_ranges)

        const contiguous_ranges = []
        let current_range = byte_ranges[0]
        for (let i = 1; i < byte_ranges.length; i++) {
            const next_range = byte_ranges[i]
            if (next_range.start === current_range.end) {
                current_range.end = next_range.end
            } else {
                contiguous_ranges.push(current_range)
                current_range = next_range
            }
        }
        contiguous_ranges.push(current_range)

        console.log("fetching contiguous ranges:", contiguous_ranges)

        for (const range of contiguous_ranges) {
            await this.fetchBytes(range.start, range.end)
        }
    }

    /**
     * Read a Tile of data from the mapsforge file
     * 
     * @param zoom level to read at. usually 0-21, but depends on the file
     * @param x tile coord
     * @param y tile coord
     * @returns a Tile containing map data
     */
    public async readBaseTile(base_tile: TilePosition): Promise<Tile | null> {
        const zoom_interval = this.getBaseZoom(base_tile.z)

        console.log(`loading tile z${base_tile.z}/${base_tile.x}/${base_tile.y}`)

        if (base_tile.x < zoom_interval.left_tile_x || base_tile.x > zoom_interval.right_tile_x) {
            console.log("tile not found!")
            return null
        }
        if (base_tile.y < zoom_interval.top_tile_y || base_tile.y > zoom_interval.bottom_tile_y) {
            console.log("tile not found!")
            return null
        }

        const byte_range = await this.getTileByteRange(base_tile, zoom_interval)
        if (!byte_range) {
            console.log("tile not found!")
            return null
        }

        const { start: block_start, end: block_end } = byte_range

        const tile_data = new Reader(
            await this.fetchBytes(
                Number(zoom_interval.sub_file_start_position + block_start),
                Number(zoom_interval.sub_file_start_position + block_end),
            )
        )

        // coordinates in the tile are all against this offset
        const tile_top_left_coord = unprojectMercator(
            zxyToMercatorCoord(base_tile.z, base_tile.x, base_tile.y)
        )

        if (this.flags.has_debug_info) {
            const str = tile_data.getFixedString(32)
            // console.log(`reading tile: ${str}`)
            if (!str.startsWith("###TileStart")) {
                throw new Error("###TileStart debug marker not found!")
            }
        }

        // parse out the zoom table
        const covered_zooms = (zoom_interval.max_zoom_level - zoom_interval.min_zoom_level) + 1

        const zoom_table: ZoomTable = []
        let poi_count = 0
        let way_count = 0
        for (let i = 0; i < covered_zooms; i++) {
            poi_count += tile_data.getVUint()
            way_count += tile_data.getVUint()
            zoom_table.push({ poi_count, way_count })
        }

        // should now be at the beginning of PoI data
        // use this to skip to the beginning of ways if we aren't reading all PoIs
        // const start_of_way_data = \
        tile_data.getVUint()

        const pois: PoI[] = this.readPoIs(zoom_table, tile_top_left_coord, tile_data)

        // should now be at the beginning of way data
        // NOTE: need to add to offset here if we aren't reading all the PoIs

        const ways: Way[] = this.readWays(zoom_table, tile_top_left_coord, tile_data)

        return new Tile(
            base_tile,
            zoom_table,
            pois,
            ways,
        )
    }

    private async getTileByteRange(base_tile: TilePosition, zoom_interval: ZoomLevel): Promise<ByteRange> {
        const index_x = Math.max(base_tile.x - zoom_interval.left_tile_x, 0)
        const index_y = Math.max(base_tile.y - zoom_interval.top_tile_y, 0)

        // index is stored as a table, with x as rows, and y as columns
        const block_offset = index_x + zoom_interval.tile_width * index_y

        const index_block_position = (BigInt(block_offset) * 5n)
            + (this.flags.has_debug_info ? 16n : 0n) // if there is debug info, skip it

        // load two index blocks
        const index = new Reader(
            zoom_interval.index_cache.slice(
                Number(index_block_position),
                Number(index_block_position + 10n)
            )
        )

        // NOTE: EOF condition handled by the previous tile bounds check
        const block_start = index.get5ByteBigInt() & 0x7fffffffffn
        const next_block_start = index.get5ByteBigInt() & 0x7fffffffffn

        if (next_block_start === block_start) {
            // if the tile is empty, the index points to the next tile with data
            return null
        }

        const block_length = next_block_start - block_start;
        return { start: block_start, end: block_length + block_start }
    }

    getBaseZoom(zoom: number) {
        let zoom_interval = this.zoom_intervals[0]

        for (const z of this.zoom_intervals) {
            if (zoom > z.max_zoom_level) {
                continue
            }
            zoom_interval = z
            break
        }

        return zoom_interval
    }

    private readPoIs(zoom_table: ZoomTable, tile_top_left_coord: Coord, tile_data: Reader): PoI[] {
        const pois: PoI[] = []
        // TODO: only retrieve the PoIs for the zoom level
        for (let i = 0; i < zoom_table[zoom_table.length - 1].poi_count; i++) {
            let osm_id: string | null = null
            if (this.flags.has_debug_info) {
                const str = tile_data.getFixedString(32)
                // console.log(`reading poi: ${str}`)
                if (!str.startsWith("***POIStart")) {
                    throw new Error(`***POIStart debug marker not found! got ${str}`)
                }
                osm_id = str.trim().replaceAll("***", "").replace("POIStart", "")
            }

            const lat = microDegreesToDegrees(tile_data.getVSint())
                + tile_top_left_coord.y

            const lon = microDegreesToDegrees(tile_data.getVSint())
                + tile_top_left_coord.x

            const special = tile_data.getUint8()

            const layer = (special >> 4) - 5
            const tag_count = (special & 0b00001111)

            const tags = this.readTags(tag_count, this.poi_tags, tile_data)

            const flags = tile_data.getUint8()

            const has_name = (flags & 0b1000_0000) !== 0
            const has_house_number = (flags & 0b0100_0000) !== 0
            const has_elevation = (flags & 0b0010_0000) !== 0

            let name: string | null = null
            if (has_name) {
                name = tile_data.getVString()
            }

            let house_number: string | null = null
            if (has_house_number) {
                house_number = tile_data.getVString()
            }

            let elevation: number | null = null
            if (has_elevation) {
                elevation = tile_data.getVSint()
            }

            pois.push(new PoI(
                osm_id,
                projectMercator({ y: lat, x: lon }),
                layer,
                name,
                house_number,
                elevation,
                tags
            ))
        }
        return pois
    }

    private readWays(zoom_table: ZoomTable, tile_top_left_coord: Coord, tile_data: Reader): Way[] {
        const ways: Way[] = []
        // TODO: only retrieve the Ways for the zoom level
        for (let i = 0; i < zoom_table[zoom_table.length - 1].way_count; i++) {
            let osm_id: string | null = null
            if (this.flags.has_debug_info) {
                const str = tile_data.getFixedString(32)
                // console.log(`reading way: ${str}`)
                if (!str.startsWith("---WayStart")) {
                    throw new Error("---WayStart debug marker not found!")
                }
                osm_id = str.trim().replaceAll("---", "").replace("WayStart", "")
            }

            // TODO: presumably could be used to skip over a way
            // const way_data_size = \
            tile_data.getVUint()

            // skip over the "sub tile bitmap", unsure what it is for
            tile_data.shiftOffset(2)

            const special = tile_data.getUint8()

            const layer = (special >> 4) - 5
            const tag_count = (special & 0b0000_1111)

            const tags = this.readTags(tag_count, this.way_tags, tile_data)

            const flags = tile_data.getUint8()

            const has_name = (flags & 0b1000_0000) !== 0
            const has_house_number = (flags & 0b0100_0000) !== 0
            const has_ref = (flags & 0b0010_0000) !== 0
            const has_label_position = (flags & 0b0001_0000) !== 0
            // === true means there is a single data block, otherwise multiple
            const has_number_of_way_data_blocks = (flags & 0b0000_1000) !== 0
            // === true means double-delta encoding, false means single-delta
            const coordinate_block_encoding = (flags & 0b0000_0100) !== 0

            let name: string | null = null
            if (has_name) {
                name = tile_data.getVString()
            }

            let house_number: string | null = null
            if (has_house_number) {
                house_number = tile_data.getVString()
            }

            let ref: string | null = null
            if (has_ref) {
                ref = tile_data.getVString()
            }

            let label_position: Coord | null = null
            if (has_label_position) {
                label_position = projectMercator({
                    y: microDegreesToDegrees(tile_data.getVSint()),
                    x: microDegreesToDegrees(tile_data.getVSint()),
                })
            }

            // TODO: I don't understand when number_of_way_data_blocks will be > 1
            let number_of_way_data_blocks = 1
            if (has_number_of_way_data_blocks) {
                number_of_way_data_blocks = tile_data.getVUint()
            }

            const paths: Coord[][] = []
            for (let j = 0; j < number_of_way_data_blocks; j++) {
                // if number_of_coordinate_blocks is > 1, then the way is a
                // multipolygon 

                const number_of_coordinate_blocks = tile_data.getVUint()

                for (let k = 0; k < number_of_coordinate_blocks; k++) {
                    const number_of_nodes = tile_data.getVUint()
                    const path: Coord[] = []

                    if (!coordinate_block_encoding) {
                        // single-delta encoding
                        let previous_lat = tile_top_left_coord.y
                        let previous_lon = tile_top_left_coord.x

                        for (let l = 0; l < number_of_nodes; l++) {
                            const lat = microDegreesToDegrees(tile_data.getVSint())
                                + previous_lat
                            const lon = microDegreesToDegrees(tile_data.getVSint())
                                + previous_lon

                            path.push(projectMercator({
                                y: lat,
                                x: lon,
                            }))

                            previous_lat = lat
                            previous_lon = lon
                        }
                    } else {
                        // double-delta encoding
                        let previous_lat = tile_top_left_coord.y
                        let previous_lon = tile_top_left_coord.x

                        let previous_lat_offset = 0
                        let previous_lon_offset = 0

                        let first_iteration = true

                        for (let l = 0; l < number_of_nodes; l++) {
                            const encoded_lat = tile_data.getVSint()
                            const encoded_lon = tile_data.getVSint()

                            const lat = previous_lat + previous_lat_offset
                                + microDegreesToDegrees(encoded_lat)
                            const lon = previous_lon + previous_lon_offset
                                + microDegreesToDegrees(encoded_lon)

                            if (first_iteration) {
                                first_iteration = false
                            } else {
                                previous_lat_offset = lat - previous_lat
                                previous_lon_offset = lon - previous_lon
                            }

                            path.push(projectMercator({
                                y: lat,
                                x: lon,
                            }))

                            previous_lat = lat
                            previous_lon = lon
                        }
                    }
                    paths.push(path)
                }
            }

            ways.push(
                new Way(
                    osm_id,
                    paths,
                    label_position,
                    layer,
                    name,
                    house_number,
                    ref,
                    tags
                )
            )
        }
        return ways
    }

    private readTags(tag_count: number, tag_list: string[], tile_data: Reader) {
        const tags = []
        for (let j = 0; j < tag_count; j++) {
            // decode each tag
            const tag_id = tile_data.getVUint()
            const tag = tag_list[tag_id]

            if (!tag) {
                throw new Error(`could not read tag with id: ${tag_id}`)
            }

            tags.push(tag)
        }

        // only >v5 files have wildcard tags
        if (this.version >= 5) {
            // wildcard tags are stored after tag ids
            for (let j = 0; j < tag_count; j++) {
                const tag = tags[j]
                const is_wildcard = tag.match(tag_wildcard)
                if (is_wildcard) {
                    // gets the value from the regex capture group
                    const wildcard_type = is_wildcard[1]

                    // FIXME: currently discarding wildcard tag values...
                    // was forced to reference mapsforge library code, as the
                    // specification does not show possible wildcard values and
                    // their meanings:
                    // https://github.com/mapsforge/mapsforge/blob/master/mapsforge-map-reader/src/main/java/org/mapsforge/map/reader/ReadBuffer.java#L221
                    switch (wildcard_type) {
                        case "b": // byte
                            tile_data.getUint8()
                            break
                        case "i": // int
                            tile_data.getInt32()
                            break
                        case "f": // float (same length as int)
                            tile_data.getInt32()
                            break
                        case "h": // short
                            tile_data.getUint16()
                            break
                        case "s": // string
                            tile_data.getVString()
                            break
                        default:
                            throw new Error(`unknown wildcard type: ${wildcard_type}`)
                    }
                }
            }
        }

        return tags
    }
}

export { MapsforgeParser }
