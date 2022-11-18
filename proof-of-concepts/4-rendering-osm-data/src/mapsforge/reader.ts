/**
 * A helper class to read data from a DataView, whilst remembering the current
 * offset throughout the file
 */
class Reader {
    data: DataView
    offset: number = 0

    constructor(buffer: ArrayBuffer) {
        this.data = new DataView(buffer)
    }

    getUint8() {
        return this.data.getInt8(this.offset++)
    }

    getUint16() {
        const value = this.data.getUint16(this.offset)
        this.offset += 2
        return value
    }

    getInt16() {
        const value = this.data.getInt16(this.offset)
        this.offset += 2
        return value
    }

    getInt32() {
        const value = this.data.getInt32(this.offset)
        this.offset += 4
        return value
    }

    getBigUint64() {
        const value = this.data.getBigUint64(this.offset)
        this.offset += 8
        return value
    }

    getBigInt64() {
        const value = this.data.getBigInt64(this.offset)
        this.offset += 8
        return value
    }

    // decode a 5-byte value as a BigInt. used for the index entries
    get5ByteBigInt() {
        return BigInt(this.data.getUint8(this.offset++)) << 64n
            | BigInt(this.data.getUint8(this.offset++)) << 32n
            | BigInt(this.data.getUint8(this.offset++)) << 16n
            | BigInt(this.data.getUint8(this.offset++)) << 8n
            | BigInt(this.data.getUint8(this.offset++))
    }

    // decode a variable length unsigned integer as a number
    getVUint() {
        // if the first bit is 1, need to read the next byte rest of the 7 bits
        // are the numeric value, starting with the least significant
        let value = 0;
        let shift = 0;

        // check if we need to continue
        while ((this.data.getUint8(this.offset) & 0b10000000) != 0) {
            // 128 64 32 16 8 4 2 1
            //   7  6  5  4 3 2 1 0
            // 1st bit has value of 128

            // if this not the first byte we've read, each bit is worth more
            value |= (this.data.getUint8(this.offset) & 0b01111111) << shift
            this.offset++
            shift += 7
        }

        // read the seven bits from the last byte
        value |= (this.data.getUint8(this.offset) << shift)
        this.offset++
        return value
    }

    // decode a variable length signed integer as a number
    getVSint() {
        // if the first bit is 1, need to read the next byte rest of the 7 bits
        // are the numeric value, starting with the least significant
        let value = 0
        let shift = 0

        // check if we need to continue
        while ((this.data.getUint8(this.offset) & 0b10000000) != 0) {
            value |= (this.data.getUint8(this.offset) & 0x7f) << shift
            this.offset++
            shift += 7
        }

        // get the six data bits from the last byte
        value |= ((this.data.getUint8(this.offset) & 0b00111111) << shift)
        this.offset++

        // if 2nd bit is set, it is negative, invert
        if ((this.data.getUint8(this.offset) & 0b01000000) != 0) {
            value = -value
        }
        return value
    }

    // decode a variable length string
    async getVString() {
        const length = this.getVUint()
        const string = await new Blob([this.data.buffer.slice(this.offset, this.offset + length)]).text()
        this.offset += length
        return string
    }

    // decode a fixed length string. used for the debug information of fixed length
    async getFixedString(length: number) {
        const string = await new Blob([this.data.buffer.slice(this.offset, this.offset + length)]).text()

        this.offset += length
        return string
    }

    // debug helper function, prints some bytes from a DataView in binary, hex
    // and text representations
    //
    // doesn't alter the offset
    printBytes(length = 20) {
        let values: string[] = []
        for (let i = this.offset; i < this.offset + length; i++) {
            const value = this.data.getUint8(i)
            values.push(
                `${value.toString(2).padStart(8, "0")}:${value.toString(16).padStart(2, "0")}:${String.fromCharCode(value)}`
            )

        }
        console.log(values)
    }
}

export { Reader }
