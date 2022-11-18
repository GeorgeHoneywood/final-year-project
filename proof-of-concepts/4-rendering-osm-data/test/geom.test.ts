import { coordZToXYZ, zxyToCoord } from "../src/geom";

import { describe, test, expect } from '@jest/globals';

describe("geometry functions should transform as expected", () => {
    test('should be able to reversibly convert from zxy to zoom lat long', () => {
        const original = { x: 259386, y: 175996, z: 19 }
        const coord = zxyToCoord(original.z, original.x, original.y)
        const tile = coordZToXYZ(coord.y, coord.x, coord.z)

        expect(original.y).toBe(tile.y)
        expect(original.x).toBe(tile.x)
        expect(original.z).toBe(tile.z)
    })
});
