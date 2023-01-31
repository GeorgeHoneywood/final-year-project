import { BBox } from "./types";

export interface NominatimResult {
    place_id: number;
    licence: string;
    osm_type: string;
    osm_id: number;
    boundingbox: string[];
    lat: string;
    lon: string;
    display_name: string;
    class: string;
    type: string;
    importance: number;
}

/**
 * Make a search for a location in OSM using the Nominatim API, hosted by the OSMF
 * @param query to search for
 * @returns search results
 */
async function search(query: string, bbox: BBox): Promise<NominatimResult> {
    const viewbox = `${bbox.bottom_left.x.toFixed(4)},${bbox.bottom_left.y.toFixed(4)},${bbox.top_right.x.toFixed(4)},${bbox.top_right.y.toFixed(4)}`

    // NOTE: bounded=1 forces results to be within the viewbox
    const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&viewbox=${encodeURIComponent(viewbox)}&bounded=1`,
        {
            "headers": {
                "Accept": "application/json",
            },
        })

    return await resp.json()
}

export { search }