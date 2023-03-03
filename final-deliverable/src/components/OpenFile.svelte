<script lang="ts">
    import type { CanvasMap } from "@/map/map"
    import { MapsforgeParser } from "@/map/mapsforge/mapsforge"

    export let map: CanvasMap

    let file_input: HTMLInputElement
    let files: FileList

    function openInput() {
        file_input.click()
    }

    $: if (files && files.length === 1) {
        loadFile(files[0])
    }

    async function loadFile(file: File) {
        const parser = new MapsforgeParser(file, null)

        await parser.readHeader()

        map.setMapParser(parser)
    }
</script>

<input type="file" bind:this={file_input} bind:files />
<button class="shadow" on:click={openInput}>
    <span class="icon folder" />
</button>

<style>
    .folder {
        background-image: url("/icons/folder.svg");
    }

    input {
        display: none;
    }
</style>
