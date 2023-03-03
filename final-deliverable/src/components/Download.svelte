<script lang="ts">
    import type { CanvasMap } from "@/map/map"
    import { MapsforgeParser } from "@/map/mapsforge/mapsforge"

    export let map: CanvasMap

    async function download() {
        console.log("downloading region")
        map.prefetch()
    }
</script>

<button class="shadow" on:click={download}>
    <span class="icon download" />
</button>

<style>
    .download {
        background-image: url("/icons/download.svg");
    }
</style>
