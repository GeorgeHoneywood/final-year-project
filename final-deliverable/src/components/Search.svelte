<script lang="ts">
    import type { CanvasMap } from "../map/map"
    import { search } from "../map/search"
    import { fade } from "svelte/transition"

    export let map: CanvasMap

    let search_input = ""
    let results = []

    import { cubicInOut } from "svelte/easing"

    function scaleY(
        node,
        { delay = 0, duration = 200, easing = (x) => x, baseScale = 0 },
    ) {
        const m = getComputedStyle(node).transform.match(/scale\(([0-9.]+)\)/)
        const s = m ? +m[1] : 1
        const is = 1 - baseScale

        return {
            delay,
            duration,
            css: (t) => {
                const eased = easing(t)
                return `transform-origin: top center; transform: scale(100%, ${
                    eased * s * is + baseScale
                })`
            },
        }
    }

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
            >
                <span class="icon cross" />
            </button>
        {/if}
        <button id="search-button" type="submit">
            <span class="icon search" />
        </button>
    </form>
    {#key results}
        <div
            class="search-results"
            style={!results.length ? "display: none;" : ""}
            in:scaleY={{
                delay: 0,
                duration: 400,
                easing: cubicInOut,
                baseScale: 0.0,
            }}
        >
            {#await promise}
                <p>...loading</p>
            {:then}
                {#if results}
                    {#each results as res}
                        <hr />
                        <div
                            class="search-result {!res.valid
                                ? `invalid-result`
                                : ``}"
                            on:keydown={() => {}}
                            on:click={() => {
                                results = []
                                map.setViewport(
                                    { x: +res.coord.x, y: +res.coord.y },
                                    16,
                                )
                            }}
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
    {/key}
</div>

<style>
    .search {
        background-image: url("/icons/search.svg");
    }

    .cross {
        background-image: url("/icons/cross.svg");
    }

    #search-box {
        top: 5px;
        left: 5px;
        max-width: 450px;
        width: calc(100% - 30px);
    }

    #search-form {
        display: flex;
        justify-content: space-between;
        align-items: stretch;

        padding: 7px;
        border-radius: 10px;
        background-color: var(--white);
        border: 2px solid var(--grey);
    }

    .search-results {
        background-color: var(--white);
        border-radius: 10px;
        border: 2px solid var(--grey);
        padding: 7px;
        margin-top: 7px;
    }

    .search-result {
        cursor: pointer;
        padding: 5px;
    }

    .search-result:hover {
        background-color: var(--grey);
    }

    .search-results hr:first-child {
        display: none;
    }

    .invalid-result {
        text-decoration: line-through;
    }

    #search-form input[name="query"] {
        background-color: var(--white);
        font-size: 12pt;
        margin-right: 7px;
        padding-left: 8px;
        flex: 1 1;
        min-width: 0;
        border: 2px solid var(--grey);
        border-radius: 5px;
    }

    #search-form button[type="reset"] {
        margin-right: 7px;
    }
</style>
