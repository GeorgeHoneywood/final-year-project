import { MapsforgeParser } from "./mapsforge/mapsforge.js"
import { loadMapBlob } from "./load.js";
import { CanvasMap } from "./map.js";
import { registerServiceWorker } from "./register-sw.js";
import { registerEventHandlers } from "./handlers.js";

// references to the DOM, that we pass through the application
const canvas = document.getElementById("map") as HTMLCanvasElement;
const geolocate_button = document.getElementById("geolocate") as HTMLButtonElement;

async function main() {
    await registerServiceWorker()

    // load entire map blob
    const parser = new MapsforgeParser(await loadMapBlob("data/egham.map"))
    // load dynamically using HTTP range requests
    // const parser = new MapsforgeParser(null, new URL("data/egham.map", location.href))

    await parser.readHeader()
    console.log({ parser })

    const map = new CanvasMap(canvas, parser);
    registerEventHandlers(map, canvas, geolocate_button)
}

main();
