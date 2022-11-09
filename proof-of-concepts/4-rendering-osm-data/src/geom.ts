// geometry helper functions

import { Coord, GeometryArray } from "./types.js";

const RADIANS_TO_DEGREES = 180 / Math.PI;

function projectGeometriesToMercator(wgs84_geometries: GeometryArray): GeometryArray {
    const projected_geometries = [];
    for (const geometry of wgs84_geometries) {
        const projected_geometry = [];
        for (const [long, lat] of geometry) {
            const { x, y } = projectMercator({ x: long, y: lat });

            projected_geometry.push([x, y] as [number, number]);
        }
        projected_geometries.push(projected_geometry)
    }
    return projected_geometries;
}

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

export { projectGeometriesToMercator as projectToMercator, unprojectMercator, projectMercator }
