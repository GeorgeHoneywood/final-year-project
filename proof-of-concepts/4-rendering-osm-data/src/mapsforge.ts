import { coordZToXYZ, microDegreesToDegrees } from "./geom"

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
}

class MapsforgeParser {
    blob: Blob
    header: DataView | null = null
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

    /**
     * shift the offset into the binary file by the specified amount 
     * 
     * @param amount the number of bytes you want to read
     * @returns the offset to read data at, in bytes
     */
    private shift(amount: number): number {
        const offset = this.offset
        this.offset += amount

        return offset
    }

    private decodeVariableUInt() {
        if (!this.header) throw new Error("this.header must be set")

        // if the first bit is 1, need to read the next byte rest of the 7 bits
        // are the numeric value, starting with the least significant
        let value = 0
        let depth = 0
        let should_continue = true;

        while (should_continue) {
            let current_byte = this.header.getUint8(this.offset + depth);
            // 128 64 32 16 8 4 2 1
            //   7  6  5  4 3 2 1 0
            // 1st bit has value of 128
            should_continue = (current_byte & 128) != 0

            // if this not the first byte we've read, each bit is worth more
            const scale = Math.pow(2, depth * 7)
            for (let i = 7; i >= 0; i--) {
                value += (current_byte & Math.pow(2, i)) * scale
            }

            depth++
        }

        this.offset += depth
        return value
    }

    private async decodeString(): Promise<string> {
        if (!this.header) throw new Error("this.header must be set")

        const length = this.decodeVariableUInt()
        return await new Blob([this.header.buffer.slice(this.shift(length), this.offset)]).text()
    }

    public async readHeader() {
        if (await this.blob.slice(0, 20).text() !== "mapsforge binary OSM") {
            throw new Error("file not mapforge binary format")
        }

        const header_length = new DataView(await this.blob.slice(20, 24).arrayBuffer()).getInt32(0)
        this.header = new DataView(await this.blob.slice(0, header_length + 24).arrayBuffer())
        this.offset = 24

        this.version = this.header.getInt32(this.shift(4))
        if (this.version <= 3 && this.version >= 5) {
            throw new Error("only mapsforge v3-5 files are supported!")
        }

        this.file_size = this.header.getBigInt64(this.shift(8))

        // this might be problematic if the timestamp is greater than MAX_SAFE_INTEGER
        this.creation_date = new Date(Number(this.header.getBigInt64(this.shift(8))))

        this.bbox.min_lat = microDegreesToDegrees(this.header.getInt32(this.shift(4)))
        this.bbox.min_long = microDegreesToDegrees(this.header.getInt32(this.shift(4)))
        this.bbox.max_lat = microDegreesToDegrees(this.header.getInt32(this.shift(4)))
        this.bbox.max_long = microDegreesToDegrees(this.header.getInt32(this.shift(4)))

        this.tile_size = this.header.getInt16(this.shift(2))

        this.projection = await this.decodeString()

        const flag_byte = this.header.getUint8(this.shift(1))
        this.flags.has_debug_info = (flag_byte & 128) != 0
        this.flags.has_map_start_position = (flag_byte & 64) != 0
        this.flags.has_start_zoom_level = (flag_byte & 32) != 0
        this.flags.has_language_preference = (flag_byte & 16) != 0
        this.flags.has_comment = (flag_byte & 8) != 0
        this.flags.has_created_by = (flag_byte & 4) != 0

        if (this.flags.has_map_start_position) {
            this.map_start_location = new MapStartLocation()

            this.map_start_location.lat = this.header.getInt32(this.shift(4))
            this.map_start_location.long = this.header.getInt32(this.shift(4))
        }

        if (this.flags.has_start_zoom_level) {
            this.map_start_location ??= new MapStartLocation()

            this.map_start_location.zoom = this.header.getInt8(this.shift(1))
        }

        if (this.flags.has_language_preference) {
            this.language_preference = await this.decodeString()
        }

        if (this.flags.has_comment) {
            this.comment = await this.decodeString()
        }

        if (this.flags.has_created_by) {
            this.created_by = await this.decodeString()
        }

        this.poi_tag_count = this.header.getUint16(this.shift(2))
        for (let i = 0; i < this.poi_tag_count; i++) {
            this.poi_tags.push(await this.decodeString())
        }

        this.way_tag_count = this.header.getUint16(this.shift(2))
        for (let i = 0; i < this.way_tag_count; i++) {
            this.way_tags.push(await this.decodeString())
        }

        this.zoom_interval_count = this.header.getUint8(this.shift(1))
        for (let i = 0; i < this.zoom_interval_count; i++) {
            let zoom_level = new ZoomLevel()

            zoom_level.base_zoom_level = this.header.getUint8(this.shift(1))
            zoom_level.min_zoom_level = this.header.getUint8(this.shift(1))
            zoom_level.max_zoom_level = this.header.getUint8(this.shift(1))
            zoom_level.sub_file_start_position = this.header.getBigUint64(this.shift(8))
            zoom_level.sub_file_length = this.header.getBigUint64(this.shift(8))

            // calculate the number of tiles, so that can load the correct
            // amount of tile indexes
            if (this.flags.has_debug_info) {
                throw new Error("cannot handle debug info!")
            }

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

            // each index is 5 bytes long
            zoom_level.index_end_position = zoom_level.sub_file_start_position + BigInt(zoom_level.tile_total) * 5n

            this.zoom_intervals.push(zoom_level)
        }
    }
}

export { MapsforgeParser }
