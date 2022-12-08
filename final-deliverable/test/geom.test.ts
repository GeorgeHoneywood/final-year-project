import { coordZToXYZ, zxyToMercatorCoord , unprojectMercator} from "../src/geom";

import { describe, test, expect } from '@jest/globals';

describe("geometry functions should transform as expected", () => {
    test('should be able to reversibly convert from zxy to zoom lat long', () => {
        const original = { x: 259386, y: 175996, z: 19 }
        const coord = unprojectMercator(zxyToMercatorCoord(original.z, original.x, original.y))
        const tile = coordZToXYZ(coord.y, coord.x, original.z)

        expect(original.y).toBe(tile.y)
        expect(original.x).toBe(tile.x)
        expect(original.z).toBe(tile.z)
    })

    describe.each([
        {
            name: "single",
            value: { lat: 50.722496015529835, lon: -1.8896244694223374, z: 14 },
            want: { x: 8106, y: 5505, z: 14 },
        },
        {
            name: "close pair 1",
            value: { lat: 51.081, lon: -2.0851, z: 14 },
            want: { x: 8097, y: 5479, z: 14 },
        },
        {
            name: "close pair 2",
            value: { lat: 51.0668, lon: -2.0618, z: 14 },
            want: { x: 8098, y: 5480, z: 14 },
        },
        {
            name: "low zoom",
            value: { lat: 58.6311, lon: -11.02443, z: 6 },
            want: { x: 30, y: 19, z: 6 },
        },
        {
            name: "non-integer zoom factor",
            value: { lat: 58.6311, lon: -11.02443, z: 6.5 },
            want: { x: 30, y: 19, z: 6 },
        },
        {
            name: "high zoom", 
            value: { lat: 50.80236, lon: -1.89223, z: 18 },
            want: { x: 129694, y: 87988, z: 18 },
        }
    ])("should be able to correctly convert from zoom lat long to tile zxy", ({ value, want, name }) => {
        test(`${name}: coordZToXYZ(${value.lat},${value.lon},${value.z}) == z:${want.z}/x:${want.x}/y:${want.y}`, () => {
            const converted = coordZToXYZ(value.lat, value.lon, value.z)

            expect(want.x).toBe(converted.x)
            expect(want.y).toBe(converted.y)
            
            expect(want.z).toBe(converted.z)
        })
    })
});
