<script lang="ts">
    import type { CanvasMap } from "../util/map"
    import { search } from "../util/search"
    import { fade } from "svelte/transition"

    export let map: CanvasMap

    let search_input = ""
    let results = []

    async function doSearch() {
        let addresses = []
        results = []

        for (const res of await search(search_input, map.getViewport())) {
            addresses.push({
                valid: map.withinMapExtent({
                    x: +res.lon,
                    y: +res.lat,
                }),
                coord: {
                    x: res.lon,
                    y: res.lat,
                },
                name: res.display_name,
            })
        }

        results = addresses
    }

    let promise = null
</script>

<div id="search-box">
    <form
        on:submit|preventDefault={() => (promise = doSearch())}
        id="search-form"
    >
        <input
            name="query"
            type="text"
            placeholder="10 Downing Street"
            bind:value={search_input}
        />
        {#if search_input}
            <button
                type="reset"
                on:click|preventDefault={() => {
                    results = []
                    search_input = ""
                }}
                transition:fade
            >
                <span class="icon cross" />
            </button>
        {/if}
        <button id="search-button" type="submit">
            <span class="icon search" />
        </button>
    </form>
    <div class="search-results">
        {#await promise}
            <p>...loading</p>
        {:then}
            {#if results}
                {#each results as res}
                    <div
                        transition:fade
                        class="search-result {!res.valid
                            ? `invalid-result`
                            : ``}"
                        on:keydown={() => {}}
                        on:click={() =>
                            map.setViewport(
                                { x: +res.coord.x, y: +res.coord.y },
                                16,
                            )}
                    >
                        {res.name}
                    </div>
                {/each}
            {:else}
                <p>none</p>
            {/if}
        {:catch error}
            <p style="color: red">{error.message}</p>
        {/await}
    </div>
</div>
