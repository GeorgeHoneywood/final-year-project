import { getCoordinates } from "./load.js";
import { projectToMercator } from "./geom.js";
import { CanvasMap } from "./map.js";

const canvas = document.getElementById("map") as HTMLCanvasElement;
const layerPicker = document.getElementById("layerPicker") as HTMLSelectElement;

// wgs84_geometries is a list of arrays of longitude (λ), latitude (𝜙) wgs84 pairs
let wgs84_geometries = await getCoordinates(`data/world-and-ferndown.geojson`);
let projected_geometries = projectToMercator(wgs84_geometries);

const map = new CanvasMap(canvas, projected_geometries);

layerPicker.addEventListener("change", async (e) => {
    wgs84_geometries = await getCoordinates(`data/${(e.target! as any).value}.geojson`);
    projected_geometries = projectToMercator(wgs84_geometries);

    map.setGeometries(projected_geometries);
})

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    e.deltaY < 0 ? map.zoom(0.2) : map.zoom(-0.2);
});

// FIXME: this should adjust offsets so that the centre of the map
// stays in the centre when the window resizes
window.addEventListener("resize", (e) => {
    e.preventDefault();

    map.setDirty();
});

document.addEventListener("keydown", (e) => {
    e.preventDefault();

    switch (e.key) {
        case "w":
            map.translate({ x: 0, y: -20 });
            break;
        case "s":
            map.translate({ x: 0, y: 20 })
            break;
        case "a":
            map.translate({ x: 20, y: 0 });
            break;
        case "d":
            map.translate({ x: -20, y: 0 })
            break;
        case "+":
            map.zoom(1);
            break;
        case "-":
            map.zoom(-1);
            break;
    }
});
