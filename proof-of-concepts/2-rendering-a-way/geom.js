// geometry helper functions

function projectToMercator(wgs84_coordinates) {
    const RADIANS_TO_DEGREES = 180 / Math.PI;
    const projected_coordinates = [];
    for (const [long, lat] of wgs84_coordinates) {
        // equations from: https://wiki.openstreetmap.org/wiki/Mercator#C
        // I attempted to use the formula found in my research report, but I couldn't get it to work
        // calculate x/long/λ
        const x = long;
        // calculate y/lat/𝜙
        const y = Math.log(Math.tan(
            (lat / RADIANS_TO_DEGREES) / 2 + Math.PI / 4
        )) * RADIANS_TO_DEGREES;

        projected_coordinates.push([x, y]);
    }
    return projected_coordinates;
}

function scaleToZeroZero(projected_coordinates) {
    const x_coordinates = projected_coordinates.map(pair => pair[0]);
    const y_coordinates = projected_coordinates.map(pair => pair[1]);
    const minimum_x = Math.min(...x_coordinates);
    const minmum_y = Math.min(...y_coordinates);

    const scaled_coordinates = [];
    for (const [x, y] of projected_coordinates) {
        scaled_coordinates.push([x - minimum_x, y - minmum_y]);
    }
    return scaled_coordinates;
}

export { projectToMercator, scaleToZeroZero }