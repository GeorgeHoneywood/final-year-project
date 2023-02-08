<script lang="ts">

    import { registerServiceWorker } from "./util/register-sw.js"

    import Map from "./Map.svelte"

    async function main() {
        await registerServiceWorker()
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
        <Map />
    </div>
</main>

<style>
</style>
