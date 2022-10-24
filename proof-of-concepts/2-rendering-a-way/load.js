const getCoordinates = async (url) => {
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(
            `request failed; error code: ${resp.statusText || resp.status}`
        );
    }
    const data = await resp.json()
    // get the coordinates for the first feature in a geojson file
    // only works for Polygon type geometries
    return data.features[0].geometry.coordinates[0];
};

export { getCoordinates }
