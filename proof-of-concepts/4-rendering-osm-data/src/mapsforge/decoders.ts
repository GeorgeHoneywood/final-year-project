/**
 * shift the offset into the binary file by the specified amount 
 * 
 * @param amount the number of bytes you want to read
 * @returns
 */
function shift(offset: number, amount: number) {
    const before = offset
    const after = amount + before

    return { before, after }
}

function decodeVariableUInt(offset: number, data: DataView) {
    // if the first bit is 1, need to read the next byte rest of the 7 bits
    // are the numeric value, starting with the least significant
    let value = 0;
    let shift = 0;

    // check if we need to continue
    while ((data.getUint8(offset) & 0b10000000) != 0) {
        // 128 64 32 16 8 4 2 1
        //   7  6  5  4 3 2 1 0
        // 1st bit has value of 128

        // if this not the first byte we've read, each bit is worth more
        value |= (data.getUint8(offset) & 0b01111111) << shift
        offset++
        shift += 7
    }

    // read the seven bits from the last byte
    value |= (data.getUint8(offset) << shift)
    offset++
    return { value, offset }
}

function decodeVariableSInt(offset: number, data: DataView) {
    // if the first bit is 1, need to read the next byte rest of the 7 bits
    // are the numeric value, starting with the least significant
    let value = 0
    let shift = 0

    // check if we need to continue
    while ((data.getUint8(offset) & 0b10000000) != 0) {
        value |= (data.getUint8(offset) & 0x7f) << shift
        offset++
        shift += 7
    }

    // get the six data bits from the last byte
    value |= ((data.getUint8(offset) & 0b00111111) << shift)
    offset++

    // if 2nd bit is set, it is negative, invert
    if ((data.getUint8(offset) & 0b01000000) != 0) {
        value = -value
    }
    return { value, offset }
}

async function decodeString(offset: number, data: DataView) {
    const res = decodeVariableUInt(offset, data)
    const move = shift(res.offset, res.value)
    return {
        string_data: await new Blob([data.buffer.slice(move.before, move.after)]).text(),
        after: move.after,
    }
}

async function decodeStringFixed(offset: number, length: number, data: DataView) {
    return {
        string_data: await new Blob([data.buffer.slice(offset, offset + length)]).text(),
        after: offset + length,
    }
}

// debug helper function, prints some bytes from a DataView in binary and hex representations
function printBytes(offset: number, data: DataView, length = 20) {
    let values: string[] = []
    for (let i = offset; i < offset + length; i++) {
        values.push(
            data.getUint8(i).toString(2).padStart(8, "0"),
            data.getUint8(i).toString(16).padStart(2, "0"),
        )

    }
    console.log(values)
}

export {
    decodeString,
    decodeVariableUInt,
    decodeVariableSInt,
    shift,
    decodeStringFixed,
    printBytes,
}