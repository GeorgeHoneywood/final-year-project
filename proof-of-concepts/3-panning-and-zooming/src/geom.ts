// geometry helper functions

import {  GeometryArray } from "./types.js";

function projectToMercator(wgs84_geometries: GeometryArray): GeometryArray {
    const RADIANS_TO_DEGREES = 180 / Math.PI;
    const projected_geometries = [];
    for (const geometry of wgs84_geometries) {
        const projected_geometry = [];
        for (const [long, lat] of geometry) {
            // equations from: https://wiki.openstreetmap.org/wiki/Mercator#C
            // I attempted to use the formula found in my research report, but I couldn't get it to work
            // calculate x/long/λ
            const x = long;
            // calculate y/lat/𝜙
            const y = Math.log(Math.tan(
                (lat / RADIANS_TO_DEGREES) / 2 + Math.PI / 4
            )) * RADIANS_TO_DEGREES;

            projected_geometry.push([x, y] as [number, number]);
        }
        projected_geometries.push(projected_geometry)
    }
    return projected_geometries;
}

export { projectToMercator }
