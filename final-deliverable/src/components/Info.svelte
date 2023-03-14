<script lang="ts">
    let shown = false

    let estimate: StorageEstimate | null = null
    let percent_used = 0
    let absolute_used = 0
    let absolute_free = 0

    $: if (estimate) {
        percent_used = (estimate.usage / estimate.quota) * 100
        absolute_used = estimate.usage
        absolute_free = estimate.quota - estimate.usage
    }

    async function toggleInfo() {
        shown = !shown
        estimate = await navigator.storage.estimate()
    }

    // source: https://stackoverflow.com/a/18650828
    function formatBytes(bytes: number, decimals = 2) {
        if (!+bytes) return "0 Bytes"

        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

        const i = Math.floor(Math.log(bytes) / Math.log(k))

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }
</script>

{#if shown}
    <div class="modal">
        <div class="header">
            <h2>About OSMO</h2>
            <button class="shadow" on:click={toggleInfo}>
                <span class="icon cross" />
            </button>
        </div>
        <p>
            {#if navigator.serviceWorker}
                <strong>Storage usage:</strong>
                {percent_used.toFixed(0)}% ({formatBytes(absolute_used)} used,
                {formatBytes(absolute_free)} free)
            {:else}
                <strong>Service worker not available!</strong>
                This means offline mode won't work.
            {/if}
        </p>
        <p>
            OSMO is a HTML5 map viewer for Mapsforge format files, with offline
            support. It uses HTTP range requests to dynamically load the
            required map tiles, meaning the only server component required is a
            regular web server &mdash; i.e. nginx or Apache.
        </p>
        <p>
            The offline mode works by storing the tile data in the service
            worker cache. Instead of downloading each tile individually, it
            takes advantage of the fact that the end byte of the current tile is
            start of the next tile, horizontally. This significantly reduces the
            number of requests required to download a large map region.
        </p>
        <p>
            OSMO written in <a href="https://www.typescriptlang.org/"
                >TypeScript</a
            >, using <a href="https://svelte.dev/">Svelte</a> for the UI,
            rendering the map to a <code>&lt;canvas&gt;</code> element. The map
            data is &copy;
            <a href="https://www.openstreetmap.org/">OpenStreetMap</a>.
        </p>
    </div>
{/if}
<button class="shadow" on:click={toggleInfo}>
    <span class="icon info" />
</button>

<style>
    .info {
        background-image: url("/icons/info.svg");
    }

    .modal {
        position: fixed;
        bottom: 10px;
        left: 10px;
        width: calc(100% - 40px);
        max-width: 450px;
        background-color: var(--white);
        border-radius: 15px;
        border: 2px solid var(--grey);
        padding: 10px;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: start;
    }

    .modal h2 {
        margin-top: 10px;
        margin-bottom: 5px;
    }

    .modal p {
        line-height: 1.35;
    }

    .cross {
        background-image: url("/icons/cross.svg");
    }
</style>
