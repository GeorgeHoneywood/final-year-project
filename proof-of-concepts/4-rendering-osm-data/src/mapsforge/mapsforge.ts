import {
    coordZToXYZ,
    microDegreesToDegrees,
}
    from "../geom"
import { PoI } from "./objects"
import {
    Reader
}
    from "./reader"


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
}

/**
 * Reads some file encoded in the Mapsforge binary map file specification
 * 
 * See here: https://github.com/mapsforge/mapsforge/blob/master/docs/Specification-Binary-Map-File.md
 */
class MapsforgeParser {
    blob: Blob

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

    public constructor(blob: Blob) {
        this.blob = blob
    }

    /**
     * Reads headers from the file. Must be called before you attempt to read
     * any tile data.
     */
    public async readHeader() {
        if (await this.blob.slice(0, 20).text() !== "mapsforge binary OSM") {
            throw new Error("file not mapforge binary format")
        }

        const header_length = new DataView(
            await this.blob.slice(20, 24).arrayBuffer()
        ).getInt32(0)

        const header = new Reader(
            await this.blob.slice(
                24, header_length + 24,
            ).arrayBuffer()
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

        this.projection = await header.getVString()

        if (this.projection !== "Mercator") {
            throw new Error("only web mercator projected files are supported")
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

            this.map_start_location.lat = header.getInt32()
            this.map_start_location.long = header.getInt32()
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
            let zoom_level = new ZoomLevel()

            zoom_level.base_zoom_level = header.getUint8()
            zoom_level.min_zoom_level = header.getUint8()
            zoom_level.max_zoom_level = header.getUint8()
            zoom_level.sub_file_start_position = header.getBigUint64()
            zoom_level.sub_file_length = header.getBigUint64()

            // calculate the number of tiles, so that we can load the correct
            // amount of tile indexes

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
    }

    public async readTile(zoom: number, x: number, y: number) {
        console.log(`loading tile z${zoom}/${x}/${y}`)

        const zoom_interval = this.zoom_intervals[2]
        const from_block_x = Math.max(x - zoom_interval.left_tile_x, 0)
        const from_block_y = Math.max(y - zoom_interval.top_tile_y, 0)

        // TODO: should support reading a range of multiple tiles in one go
        // const to_block_x = Math.min(x - zoom_interval.left_tile_x, zoom_interval.tile_width - 1)
        // const to_block_y = Math.min(y - zoom_interval.top_tile_y, zoom_interval.tile_height - 1)

        const block_offset = from_block_x + zoom_interval.tile_width * from_block_y

        const index_block_position = zoom_interval.sub_file_start_position
            + (BigInt(block_offset) * 5n)
            + (this.flags.has_debug_info ? 16n : 0n) // if there is debug info, skip it

        // load two index blocks
        const index = new Reader(
            await this.blob.slice(
                Number(index_block_position),
                Number(index_block_position + 10n),
            ).arrayBuffer()
        )

        // FIXME: handle the end of file case, where there aren't any more index blocks
        const block_pointer = index.get5ByteBigInt() & 0x7FFFFFFFFFn;
        const next_block_pointer = index.get5ByteBigInt() & 0x7FFFFFFFFFn;


        if (next_block_pointer === block_pointer) {
            // if the tile is empty, the index points to the next tile with data
            throw new Error("empty tiles are not supported!")
        }

        const block_length = next_block_pointer - block_pointer;

        const tile_data = new Reader(
            await this.blob.slice(
                Number(zoom_interval.sub_file_start_position + block_pointer),
                Number(zoom_interval.sub_file_start_position + block_pointer + block_length),
            ).arrayBuffer()
        )

        console.log("reading from offset:", (zoom_interval.sub_file_start_position + block_pointer).toString(16))

        // TODO: need to get tile coordinates from z/x/y values here, as the
        // coordinates in the tile are all against this offset

        if (this.flags.has_debug_info) {
            const str = tile_data.getFixedString(32)
            console.log(`reading tile: ${str}`)
            if (!str.startsWith("###TileStart")) {
                throw new Error("###TileStart debug marker not found!")
            }
        }

        // parse out the zoom table
        const covered_zooms = (zoom_interval.max_zoom_level - zoom_interval.min_zoom_level) + 1

        let zoom_table: { poi_count: number, way_count: number }[] = []
        let poi_count = 0
        let way_count = 0
        for (let i = 0; i < covered_zooms; i++) {
            poi_count += tile_data.getVUint()
            way_count += tile_data.getVUint()
            zoom_table.push({ poi_count, way_count })
        }

        // should now be at the beginning of PoI data
        const start_of_way_data = tile_data.getVUint()
        console.log({ start_of_way_data })

        const pois: PoI[] = []
        // TODO: only retrieve the PoIs for the zoom level
        for (let i = 0; i < zoom_table[zoom_table.length - 1].poi_count; i++) {
            let osm_id: string | null = null
            if (this.flags.has_debug_info) {
                const str = tile_data.getFixedString(32)
                console.log(`reading poi: ${str}`)
                if (!str.startsWith("***POIStart")) {
                    throw new Error("***POIStart debug marker not found!")
                }
                osm_id = str.trim().replaceAll("***", "").replace("POIStart", "")
            }

            // FIXME: make these diffs absolute
            const lat_diff = tile_data.getVSint()
            const lon_diff = tile_data.getVSint()

            const special = tile_data.getUint8()

            const layer = (special >> 4) - 5
            const tag_count = (special & 0b00001111)

            const tags = []
            for (let j = 0; j < tag_count; j++) {
                // decode each tag
                const tag = this.poi_tags[tile_data.getVUint()]

                // FIXME: handle wildcard tags?

                tags.push(tag)
            }

            const flags = tile_data.getUint8()

            const has_name = (flags & 0b10000000) !== 0
            const has_house_number = (flags & 0b01000000) !== 0
            const has_elevation = (flags & 0b00100000) !== 0

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

            const poi = new PoI(
                osm_id,
                { y: lat_diff, x: lon_diff },
                layer,
                name,
                house_number,
                elevation,
                tags
            )
            pois.push(poi)
        }

        console.log(pois)
    }
}

export { MapsforgeParser }
