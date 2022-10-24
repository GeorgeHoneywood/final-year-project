import { getData } from "./load.js";

const canvas = document.getElementById("map");

const ctx = canvas.getContext("2d");

function drawBasicBox(ctx) {
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#FFF';

    ctx.fillRect(0, 0, 600, 10);
    ctx.strokeRect(0, 0, 600, 10);
}

drawBasicBox(ctx);

const data = await getData("/egham.geojson")
const coordinates = data.features[0].geometry.coordinates[0];

console.log("coordinates is an array of lat/long wgs84 pairs", coordinates)
