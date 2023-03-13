import type { ByteRange } from "@/map/types"

/**
 * Converts a list of byte ranges into a list of contiguous byte ranges.
 * 
 * @param byte_ranges that should not overlap
 * @returns a list of contiguous byte ranges
 */
function byteRangeToContiguous(byte_ranges: ByteRange[]): ByteRange[] {
    if (byte_ranges.length === 0) {
        return []
    }

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
    return contiguous_ranges
}

export { byteRangeToContiguous }