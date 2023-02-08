// geometry helper functions

import type { Coord } from "./types.js";

const RADIANS_TO_DEGREES = 180 / Math.PI;

// equations from: https://wiki.openstreetmap.org/wiki/Mercator#C
// I attempted to use the formula found in my research report, but I couldn't get it to work
function projectMercator({ x, y }: Coord) {
    // calculate y/lat/𝜙
    y = Math.log(Math.tan(
        (y / RADIANS_TO_DEGREES) / 2 + Math.PI / 4
    )) * RADIANS_TO_DEGREES;
    return { x, y };
}

function unprojectMercator({ x, y }: Coord): Coord {
    y = (((Math.atan(Math.exp(
        y / RADIANS_TO_DEGREES
    ))) * 2) - (Math.PI / 2)) * RADIANS_TO_DEGREES
    return { x, y }
}

// convert some lat/long zoom coordinates into tiled space
// reference: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function coordZToXYZ(lat: number, lon: number, zoom: number) {
    const scale = Math.pow(2, zoom | 0)
    const lat_radians = lat / RADIANS_TO_DEGREES

    return {
        x: ((lon + 180) / 360) * scale | 0, // round down
        y: (((1.0 - (Math.asinh(Math.tan(lat_radians)) / Math.PI)) / 2.0) * scale) | 0,
        z: zoom | 0,
    }
}

function zxyToMercatorCoord(zoom: number, x: number, y: number) {
    const scale = Math.pow(2, zoom)
    const lat_radians = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y / scale)))))

    const unprojected = {
        x: ((x / scale) * 360) - 180,
        y: lat_radians * RADIANS_TO_DEGREES,
    }
    const projected = projectMercator(unprojected)

    return {
        x: projected.x,
        y: projected.y,
        z: zoom,
    }
}

const MICRO_DEGREES_TO_DEGREES = 10 ** 6

function microDegreesToDegrees(microDegrees: number) {
    return microDegrees / MICRO_DEGREES_TO_DEGREES
}

export {
    unprojectMercator,
    projectMercator,
    coordZToXYZ,
    zxyToMercatorCoord,
    microDegreesToDegrees,
}
