import { getCoordinates } from "./load.js";

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");

// coordinates is an array of longitude (λ), latitude (𝜙) wgs84 pairs
const coordinates = await getCoordinates("/baden-baden.geojson")

// radius of the earth, in meters
// const R = 6371204;

const RADIANS_TO_DEGREES = 180 / Math.PI;
const PI_TIMES_4 = Math.PI * 4;
const web_mercator_coordinates = [];
for (const [long, lat] of coordinates) {
    // equations from: 
    // calculate x/long/λ
    // const x = (Math.PI * R * long) / 180;
    const x = long;
    // calculate y/lat/𝜙
    // const y = R * Math.log(Math.tan(45 + (lat / 2)));
    // function lat2y(lat) { return Math.log(Math.tan((lat / 90 + 1) * PI_4 )) * RAD2DEG; }
    // const y = Math.log(Math.tan((lat / 90 + 1) * PI_TIMES_4)) * RADIANS_TO_DEGREES;
    const y = Math.log(Math.tan((lat / (180 / Math.PI)) / 2 + Math.PI / 4)) * RADIANS_TO_DEGREES;
    // console.log(`long=${long}, lat=${lat}, x=${x}, y=${y}`);
    web_mercator_coordinates.push([x, y]);
}

const x_coordinates = web_mercator_coordinates.map(pair => pair[0]);
const y_coordinates = web_mercator_coordinates.map(pair => pair[1]);

const minimum_x = Math.min(...x_coordinates);
const mininum_y = Math.min(...y_coordinates);

const scaled_coordinates = [];

for (const [x, y] of web_mercator_coordinates) {
    scaled_coordinates.push([x - minimum_x, y - mininum_y]);
}

const height = canvas.height;

ctx.beginPath();
// ctx.moveTo(...scaled_coordinates[0].map(v => (v * 800)))
for (const [x, y] of scaled_coordinates) {
    ctx.lineTo(x * 2000, height - (y * 2000));
}
ctx.stroke();

// console.log(scaled_coordinates);