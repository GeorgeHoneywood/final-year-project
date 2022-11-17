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

    // check if the continuation bit is set
    while ((data.getUint8(offset) & 0b10000000) != 0) {
        // 128 64 32 16 8 4 2 1
        //   7  6  5  4 3 2 1 0
        // 1st bit has value of 128

        // if this not the first byte we've read, each bit is worth more
        value |= (data.getUint8(offset++) & 0b01111111) << shift;
        shift += 7;
    }

    // read the seven bits from the last byte
    return { value: value | (data.getUint8(offset++) << shift), offset }
}

function decodeVariableSInt(offset: number, data: DataView) {
    // if the first bit is 1, need to read the next byte rest of the 7 bits
    // are the numeric value, starting with the least significant
    let value = 0
    let depth = 0
    let should_continue = true;

    while (should_continue) {
        let current_byte = data.getUint8(offset + depth);
        // 128 64 32 16 8 4 2 1
        //   7  6  5  4 3 2 1 0
        // 1st bit has value of 128
        should_continue = (current_byte & 128) != 0
        console.log(current_byte, should_continue)

        if (should_continue === false) {
            if ((current_byte & 64) != 0) value = -value
        }

        // if this not the first byte we've read, each bit is worth more
        // TODO: optimise this
        const scale = Math.pow(2, depth * (should_continue ? 7 : 6))
        for (let i = should_continue ? 7 : 6; i >= 0; i--) {
            value += (current_byte & Math.pow(2, i)) * scale
        }

        depth++
    }

    offset += depth
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

export { decodeString, decodeVariableUInt, decodeVariableSInt, shift }