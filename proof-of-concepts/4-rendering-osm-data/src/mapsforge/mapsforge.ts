import {
    coordZToXYZ,
    microDegreesToDegrees,
}
    from "../geom"
import {
    shift,
    decodeString,
    decodeVariableUInt,
    decodeVariableSInt,
}
    from "./decoders"


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

class MapsforgeParser {
    blob: Blob
    header: DataView | null = null
    tile_data: DataView | null = null
    // offset in bytes through the header, skipping the magic bytes and the
    // header length value
    offset = 0

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


    public async readHeader() {
        if (await this.blob.slice(0, 20).text() !== "mapsforge binary OSM") {
            throw new Error("file not mapforge binary format")
        }

        const header_length = new DataView(await this.blob.slice(20, 24).arrayBuffer()).getInt32(0)
        this.header = new DataView(await this.blob.slice(0, header_length + 24).arrayBuffer())

        let offset = shift(24, 4)
        this.version = this.header.getInt32(offset.before)
        if (this.version <= 3 && this.version >= 5) {
            throw new Error("only mapsforge v3-5 files are supported!")
        }

        offset = shift(offset.after, 8)
        this.file_size = this.header.getBigInt64(offset.before)

        // this might be problematic if the timestamp is greater than
        // MAX_SAFE_INTEGER
        offset = shift(offset.after, 8)
        this.creation_date = new Date(Number(this.header.getBigInt64(offset.before)))

        offset = shift(offset.after, 4)
        this.bbox.min_lat = microDegreesToDegrees(this.header.getInt32(offset.before))
        offset = shift(offset.after, 4)
        this.bbox.min_long = microDegreesToDegrees(this.header.getInt32(offset.before))
        offset = shift(offset.after, 4)
        this.bbox.max_lat = microDegreesToDegrees(this.header.getInt32(offset.before))
        offset = shift(offset.after, 4)
        this.bbox.max_long = microDegreesToDegrees(this.header.getInt32(offset.before))

        offset = shift(offset.after, 2)
        this.tile_size = this.header.getInt16(offset.before)

        let result = await decodeString(offset.after, this.header)
        this.projection = result.string_data

        if (this.projection !== "Mercator") {
            throw new Error("only web mercator projected files are supported")
        }

        offset = shift(result.after, 1)
        const flag_byte = this.header.getUint8(offset.before)
        this.flags.has_debug_info = (flag_byte & 128) != 0
        this.flags.has_map_start_position = (flag_byte & 64) != 0
        this.flags.has_start_zoom_level = (flag_byte & 32) != 0
        this.flags.has_language_preference = (flag_byte & 16) != 0
        this.flags.has_comment = (flag_byte & 8) != 0
        this.flags.has_created_by = (flag_byte & 4) != 0

        if (this.flags.has_map_start_position) {
            this.map_start_location = new MapStartLocation()

            offset = shift(offset.after, 4)
            this.map_start_location.lat = this.header.getInt32(offset.before)
            offset = shift(offset.after, 4)
            this.map_start_location.long = this.header.getInt32(offset.before)
        }

        if (this.flags.has_start_zoom_level) {
            this.map_start_location ??= new MapStartLocation()

            offset = shift(offset.after, 1)
            this.map_start_location.zoom = this.header.getInt8(offset.before)
        }

        if (this.flags.has_language_preference) {
            result = await decodeString(offset.after, this.header)
            offset.after = result.after
            this.language_preference = result.string_data
        }

        if (this.flags.has_comment) {
            result = await decodeString(offset.after, this.header)
            offset.after = result.after
            this.comment = result.string_data
        }

        if (this.flags.has_created_by) {

            result = await decodeString(offset.after, this.header)
            offset.after = result.after
            this.created_by = result.string_data
        }

        offset = shift(offset.after, 2)
        this.poi_tag_count = this.header.getUint16(offset.before)
        for (let i = 0; i < this.poi_tag_count; i++) {
            result = await decodeString(offset.after, this.header)
            offset.after = result.after
            this.poi_tags.push(result.string_data)
        }

        offset = shift(offset.after, 2)
        this.way_tag_count = this.header.getUint16(offset.before)
        for (let i = 0; i < this.way_tag_count; i++) {
            result = await decodeString(offset.after, this.header)
            offset.after = result.after
            this.way_tags.push(result.string_data)
        }

        offset = shift(offset.after, 1)
        this.zoom_interval_count = this.header.getUint8(offset.before)
        for (let i = 0; i < this.zoom_interval_count; i++) {
            let zoom_level = new ZoomLevel()

            offset = shift(offset.after, 1)
            zoom_level.base_zoom_level = this.header.getUint8(offset.before)
            offset = shift(offset.after, 1)
            zoom_level.min_zoom_level = this.header.getUint8(offset.before)
            offset = shift(offset.after, 1)
            zoom_level.max_zoom_level = this.header.getUint8(offset.before)
            offset = shift(offset.after, 8)
            zoom_level.sub_file_start_position = this.header.getBigUint64(offset.before)
            offset = shift(offset.after, 8)
            zoom_level.sub_file_length = this.header.getBigUint64(offset.before)

            // calculate the number of tiles, so that can load the correct
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
        console.log(from_block_x, from_block_y, zoom_interval.tile_width)

        // const to_block_x = Math.min(x - zoom_interval.left_tile_x, zoom_interval.tile_width - 1)
        // const to_block_y = Math.min(y - zoom_interval.top_tile_y, zoom_interval.tile_height - 1)

        // TODO: should have a proper loop here but will do for now

        const block_offset = from_block_x + zoom_interval.tile_width * from_block_y
        console.log(block_offset)

        const index_block_position = zoom_interval.sub_file_start_position
            + (BigInt(block_offset) * 5n)
            + (this.flags.has_debug_info ? 16n : 0n) // if there is debug info, skip it

        // console.log(await this.blob.slice(Number(index_block_position), Number(index_block_position + 16n)).text())

        const index_block = this.blob.slice(Number(index_block_position), Number(index_block_position + 5n))
        const data = new Uint8Array(await index_block.arrayBuffer())
        const buffer = new Uint8Array(8)
        buffer.set(data, 3) // should be 8 bytes long

        // FIXME: bit nasty. as this value is 5 bytes long, we need to use a BigUint to store it
        const value = new DataView(buffer.buffer).getBigUint64(0)

        // TODO: optimisation: check if all water here
        console.log(value)

        const block_pointer = value & 0x7FFFFFFFFFn;
        console.log({ "this": index_block_position, "next": index_block_position + 5n })

        // use the next pointer to figure out block length
        // FIXME: handle the last block in the index
        const next_index_block = this.blob.slice(Number(index_block_position + 5n), Number(index_block_position + 5n + 5n))
        const next_data = new Uint8Array(await next_index_block.arrayBuffer())
        const next_buffer = new Uint8Array(8)
        next_buffer.set(next_data, 3) // should be 8 bytes long

        const next_value = new DataView(next_buffer.buffer).getBigUint64(0)
        const next_block_pointer = next_value & 0x7FFFFFFFFFn;

        if (next_block_pointer === block_pointer) {
            // if the tile is empty, the index points to the next tile with data
            throw new Error("empty tiles are not supported!")
        }

        const block_length = next_block_pointer - block_pointer;

        console.log({ block_pointer, next_block_pointer, block_length, value, "test": await index_block.arrayBuffer(), "test2": await next_index_block.arrayBuffer(), next_data })

        const tile_data = new DataView(await this.blob.slice(Number(zoom_interval.sub_file_start_position + block_pointer), Number(zoom_interval.sub_file_start_position + block_pointer + block_length)).arrayBuffer())

        console.log("reading from offset:", (zoom_interval.sub_file_start_position + block_pointer).toString(16))
        // TODO: need to get tile coordinates from z/x/y values here, as the
        // coordinates in the tile are all against this offset
        console.log({ data: await this.blob.slice(Number(zoom_interval.sub_file_start_position + block_pointer), Number(zoom_interval.sub_file_start_position + block_pointer + block_length)).text() })

        // parse out the zoom table
        const covered_zooms = (zoom_interval.max_zoom_level - zoom_interval.min_zoom_level) + 1
        let offset = 0

        if (this.flags.has_debug_info) {
            offset += 32
        }

        let zoom_table: { poi: number, way: number }[] = []
        for (let i = 0; i < covered_zooms; i++) {
            const poi = decodeVariableUInt(offset, tile_data)
            const way = decodeVariableUInt(poi.offset, tile_data)
            offset = poi.offset
            zoom_table.push({ poi: poi.value, way: way.value })
        }

        console.log(zoom_table)

        // should now be at the beginning of PoI data
        let res = decodeVariableUInt(offset, tile_data)
        // console.log(res)

        const start_of_way_data = res.value
        console.log({ start_of_way_data })

        console.log(tile_data.buffer.slice(res.offset))

        if (this.flags.has_debug_info) {
            res.offset += 32
        }

        let more_pois = true
        let i = 0
        while (more_pois) {
            if (i === 2) break

            res = decodeVariableSInt(res.offset, tile_data)
            console.log({ res, i }, tile_data.buffer.slice(res.offset))
            i++
        }
    }
}

export { MapsforgeParser }
