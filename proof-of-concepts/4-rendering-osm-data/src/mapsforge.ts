import { coordZToXYZ } from "./geom.js"

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
}

class MapsforgeParser {
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
        this.readHeader(blob)
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

    private decodeVariableUInt(header: DataView) {
        // if the first bit is 1, need to read the next byte rest of the 7 bits
        // are the numeric value, starting with the least significant
        let value = 0
        let depth = 0
        let should_continue = true;

        while (should_continue) {
            let current_byte = header.getUint8(this.offset + depth);
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

    async decodeString(header: DataView): Promise<string> {
        const length = this.decodeVariableUInt(header)
        return await new Blob([header.buffer.slice(this.shift(length), this.offset)]).text()
    }

    private async readHeader(blob: Blob) {
        // const textDecoder = new TextDecoder("utf-8")
        console.log(await blob.slice(0, 300).text())

        if (await blob.slice(0, 20).text() !== "mapsforge binary OSM") {
            console.log("not a mapsforge file!")
        }

        const header_length = new DataView(await blob.slice(20, 24).arrayBuffer()).getInt32(0)
        const header = new DataView(await blob.slice(0, header_length + 24).arrayBuffer())
        this.offset = 24

        this.version = header.getInt32(this.shift(4))
        this.file_size = header.getBigInt64(this.shift(8))
        this.creation_date = new Date(Number(header.getBigInt64(this.shift(8))))

        this.bbox.min_lat = header.getInt32(this.shift(4))
        this.bbox.min_long = header.getInt32(this.shift(4))
        this.bbox.max_lat = header.getInt32(this.shift(4))
        this.bbox.min_long = header.getInt32(this.shift(4))

        this.tile_size = header.getInt16(this.shift(2))

        this.projection = await this.decodeString(header)

        const flag_byte = header.getUint8(this.shift(1))
        this.flags.has_debug_info = (flag_byte & 128) != 0
        this.flags.has_map_start_position = (flag_byte & 64) != 0
        this.flags.has_start_zoom_level = (flag_byte & 32) != 0
        this.flags.has_language_preference = (flag_byte & 16) != 0
        this.flags.has_comment = (flag_byte & 8) != 0
        this.flags.has_created_by = (flag_byte & 4) != 0

        if (this.flags.has_map_start_position) {
            this.map_start_location = new MapStartLocation()

            this.map_start_location.lat = header.getInt32(this.shift(4))
            this.map_start_location.long = header.getInt32(this.shift(4))
        }

        if (this.flags.has_start_zoom_level) {
            this.map_start_location ??= new MapStartLocation()

            this.map_start_location.zoom = header.getInt8(this.shift(1))
        }

        if (this.flags.has_language_preference) {
            this.language_preference = await this.decodeString(header)
        }

        if (this.flags.has_comment) {
            this.comment = await this.decodeString(header)
        }

        if (this.flags.has_created_by) {
            this.created_by = await this.decodeString(header)
        }

        this.poi_tag_count = header.getUint16(this.shift(2))
        for (let i = 0; i < this.poi_tag_count; i++) {
            this.poi_tags.push(await this.decodeString(header))
        }

        this.way_tag_count = header.getUint16(this.shift(2))
        for (let i = 0; i < this.way_tag_count; i++) {
            this.way_tags.push(await this.decodeString(header))
        }

        this.zoom_interval_count = header.getUint8(this.shift(1))
        for (let i = 0; i < this.zoom_interval_count; i++) {
            let zoom_level = new ZoomLevel()

            zoom_level.base_zoom_level = header.getUint8(this.shift(1))
            zoom_level.min_zoom_level = header.getUint8(this.shift(1))
            zoom_level.max_zoom_level = header.getUint8(this.shift(1))
            zoom_level.sub_file_start_position = header.getBigUint64(this.shift(8))
            zoom_level.sub_file_length = header.getBigUint64(this.shift(8))

            this.zoom_intervals.push(zoom_level)
        }

        for (const zoom_interval of this.zoom_intervals) {
            // calculate the number of tiles, so that can load the correct
            // amount of tile indexes
            console.log(zoom_interval)
            if (this.flags.has_debug_info) {
                console.log("cannot handle debug info!")
            }

            const { x: min_x, y: min_y } = coordZToXYZ(
                this.bbox.min_lat / 10 ** 6,
                this.bbox.min_long / 10 ** 6,
                zoom_interval.base_zoom_level,
            )
            const { x: max_x, y: max_y } = coordZToXYZ(
                this.bbox.max_lat / 10 ** 6,
                this.bbox.max_long / 10 ** 6,
                zoom_interval.base_zoom_level,
            )
            console.log({ min_x, min_y, max_x, max_y })
        }
        console.log(this)
    }
}

export { MapsforgeParser }
