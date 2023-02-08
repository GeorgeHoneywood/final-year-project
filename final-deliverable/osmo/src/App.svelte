<script lang="ts">
    import { MapsforgeParser } from "./util/mapsforge/mapsforge.js"
    import { loadMapBlob } from "./util/load.js"
    import { CanvasMap } from "./util/map.js"
    import { registerServiceWorker } from "./util/register-sw.js"
    import { registerEventHandlers } from "./util/handlers.js"

    // references to the DOM, that we pass through the application
    let canvas: HTMLCanvasElement
    const geolocate_button = document.getElementById(
        "geolocate",
    ) as HTMLButtonElement

    async function main() {
        await registerServiceWorker()

        // load entire map blob
        const parser = new MapsforgeParser(await loadMapBlob("data/egham.map"))
        // load dynamically using HTTP range requests
        // const parser = new MapsforgeParser(null, new URL("data/egham.map", location.href))

        await parser.readHeader()
        console.log({ parser })

        const map = new CanvasMap(canvas, parser)
        registerEventHandlers(map, canvas, geolocate_button)
    }
    main()

  
</script>

<main>
    <!-- 
  TODO: the JavaScript should  probably contruct the required <canvas> and
  <button> elements.

  this would make it easier to embed the map on other websites.
-->
    <div id="map-container">
        <!-- stands for OpenStreetMap Offline :) -->
        <h1 id="title">OSMO</h1>
        <!-- 
    tabindex makes it selectable, so key* events are fire
    note that the canvas sets its' own size, so no css required
  -->
        <canvas id="map" tabindex="0" bind:this={canvas}/>
        <div id="search-box">
            <div id="search-form">
                <input
                    name="query"
                    type="text"
                    placeholder="10 Downing Street"
                />
                <button id="search-button">
                    <span class="icon search" />
                </button>
            </div>
            <div class="search-results" />
        </div>
        <button id="geolocate" class="shadow">
            <span class="icon geolocate" />
        </button>
    </div>
</main>

<style>
</style>
