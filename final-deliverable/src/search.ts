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
async function search(query: string): Promise<NominatimResult> {
    const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        {
            "headers": {
                "Accept": "application/json",
            },
        })

    return await resp.json()
}

export { search }