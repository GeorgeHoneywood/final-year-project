<script lang="ts">
    import type { CanvasMap } from "@/map/map"
    import Spinner from "./Spinner.svelte";

    export let map: CanvasMap

    let loading = false

    async function download() {
        loading = true
        await map.prefetch()
        loading = false
    }
</script>

<button class="shadow" on:click={download} disabled={loading}>
    {#if !loading}
        <span class="icon download" />
    {:else}
        <Spinner />
    {/if}
</button>

<style>
    .download {
        background-image: url("/icons/download.svg");
    }
</style>
