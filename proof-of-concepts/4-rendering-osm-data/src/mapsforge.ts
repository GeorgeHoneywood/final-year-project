class BBox {
    max_lat = 0
    min_lat = 0
    max_long = 0
    min_long = 0
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
            should_continue = (current_byte & 128) == 1

            // if this not the first byte we've read, each bit is worth more
            const scale = Math.pow(2, depth * 7)
            for (let i = 7; i != 1; i--) {
                value += (current_byte & Math.pow(2, i)) * scale
            }

            depth++
        }

        this.offset += depth * 8

        return value
    }

    private async readHeader(blob: Blob) {
        // const textDecoder = new TextDecoder("utf-8")

        if (await blob.slice(0, 20).text() !== "mapsforge binary OSM") {
            console.log("not a mapsforge file!")
        }

        const header_length = new DataView(await blob.slice(20, 24).arrayBuffer()).getInt32(0)
        const header = new DataView(await blob.slice(24, header_length - 4).arrayBuffer())

        this.version = header.getInt32(this.shift(4))
        this.file_size = header.getBigInt64(this.shift(8))
        this.creation_date = new Date(Number(header.getBigInt64(this.shift(8))))

        this.bbox.min_lat = header.getInt32(this.shift(4))
        this.bbox.min_long = header.getInt32(this.shift(4))
        this.bbox.max_lat = header.getInt32(this.shift(4))
        this.bbox.min_long = header.getInt32(this.shift(4))

        this.tile_size = header.getInt16(this.shift(2))

        console.log(this.decodeVariableUInt(header))

        console.log(this)

    }
}

export { MapsforgeParser }
