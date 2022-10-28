import { getCoordinates } from "./load.js";
import { projectToMercator, scaleToZeroZero as translateToZeroZero } from "./geom.js";

const canvas = document.getElementById("map") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

// inital zoom level, where 1 is the whole world
let zoom_level = 1;

let scale = 0; //
let x_offset = 0;
let y_offset = 0;

// adjust offsets so that we zoom into the centre of the map view
function centerZoom(zoom_delta: number) {
    x_offset = canvas.width / 2 - (canvas.width / 2 - x_offset)
        * Math.pow(2, zoom_delta);
    y_offset = canvas.height / 2 - (canvas.height / 2 - y_offset)
        * Math.pow(2, zoom_delta);
    zoom_level += zoom_delta
}

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!ctx) return;

    e.deltaY < 0 ? centerZoom(0.1) : centerZoom(-0.1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderMap();
});

document.addEventListener("keydown", (e) => {
    e.preventDefault();

    switch (e.key) {
        case "w":
            y_offset -= 20;
            break;
        case "s":
            y_offset += 20;
            break;
        case "a":
            x_offset += 20;
            break;
        case "d":
            x_offset -= 20;
            break;
        case "+":
            centerZoom(1);
            break;
        case "-":
            centerZoom(-1);
            break;
    }

    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    renderMap();
});

// coordinates is an array of longitude (λ), latitude (𝜙) wgs84 pairs
const wgs84_geometries = await getCoordinates(`data/ferndown-buildings.geojson`);
const projected_geometries = projectToMercator(wgs84_geometries);

// as we are drawing from (0,0) we should reshape our data so that
// it is always around (0,0)
const translated_geometries = translateToZeroZero(projected_geometries);

function renderMap() {
    if (!ctx) return;

    scale = Math.pow(2, zoom_level);

    // make sure the canvas takes up most of the screen
    canvas.width = window.innerWidth - 50;
    canvas.height = window.innerHeight - 200;

    // draw a crosshair
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    for (const geometry of translated_geometries) {
        ctx.beginPath();
        for (const [x, y] of geometry) {
            ctx.lineTo(
                (x * scale) + x_offset,
                canvas.height - ((y * scale) + y_offset) // as we are drawing from 0,0 being the top left, we must flip the y-axis
            );
        }
        ctx.stroke();
    }
}

renderMap();