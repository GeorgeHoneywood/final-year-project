import { GeometryArray } from "./types.js";

// load an array of coordinates from a geojson file
async function getCoordinates(path: string): Promise<GeometryArray> {
    const resp = await fetch(path);
    if (!resp.ok) {
        throw new Error(
            `request failed; error code: ${resp.statusText || resp.status}`
        );
    }
    const data = await resp.json();

    const geometries = data.features.map((e: any) => e.geometry);
    const polygons = geometries.filter(
        (e: any) => e.type == "Polygon"
    );
    const line_strings = geometries.filter(
        (e: any) => e.type == "LineString"
    );

    return [
        ...polygons.map((e: any) => e.coordinates[0]),
        ...line_strings.map((e: any) => e.coordinates),
    ];
}

export { getCoordinates }
