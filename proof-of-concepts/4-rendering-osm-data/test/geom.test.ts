import { coordZToXYZ, zxyToMercatorCoord } from "../src/geom";

import { describe, test, expect } from '@jest/globals';

describe("geometry functions should transform as expected", () => {
    test('should be able to reversibly convert from zxy to zoom lat long', () => {
        const original = { x: 259386, y: 175996, z: 19 }
        const coord = zxyToMercatorCoord(original.z, original.x, original.y)
        const tile = coordZToXYZ(coord.y, coord.x, coord.z)

        expect(original.y).toBe(tile.y)
        expect(original.x).toBe(tile.x)
        expect(original.z).toBe(tile.z)
    })

    test('should be able to correctly convert from zoom lat long to tile zxy', () => {
        const expected = { x: 8106, y: 5505, z: 14 }
        const converted = coordZToXYZ(50.722496015529835, -1.8896244694223374, 14)
        
        expect(expected.y).toBe(converted.y)
        expect(expected.x).toBe(converted.x)
        expect(expected.z).toBe(converted.z)
    })
});
