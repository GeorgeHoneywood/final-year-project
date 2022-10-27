import { getCoordinates } from "./load.js";
import { projectToMercator, scaleToZeroZero } from "./geom.js";

const canvas = document.getElementById("map") as HTMLCanvasElement;
const townPicker = document.getElementById("townPicker") as HTMLSelectElement;
const ctx = canvas.getContext("2d");

// change the zoom factor to resize the rendered maps
// TODO: employ some logic to figure out this scaling factor automatically
const ZOOM_FACTORS: { [index: string]: number } = {
    "baden-baden": 2000,
    egham: 20000,
    ferndown: 7000,
    "egham-detailed": 50000,
    "ferndown-buildings": 23000,
}

townPicker.addEventListener("change", async (e) => {
    if (!ctx) return;
    // clear out the canvas before drawing a new map
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await renderMap((e.target! as any).value);
})

async function renderMap(town: string) {
    if (!ctx) return;
    // coordinates is an array of longitude (λ), latitude (𝜙) wgs84 pairs
    const wgs84_geometries = await getCoordinates(`data/${town}.geojson`)

    const projected_geometries = projectToMercator(wgs84_geometries);

    // as we are drawing from (0,0) we should reshape our data so that
    // it is always around (0,0)
    const scaled_geometries = scaleToZeroZero(projected_geometries);

    const zoom_factor = ZOOM_FACTORS[town];
    for (const geometry of scaled_geometries) {
        ctx.beginPath();
        for (const [x, y] of geometry) {
            ctx.lineTo(x * zoom_factor, canvas.height - (y * zoom_factor)); // as we are drawing from 0,0 being the top left, we must flip the y-axis
        }
        ctx.stroke();
    }
}

// default to showing Ferndown (buildings)
await renderMap("ferndown-buildings")