<script lang="ts">
    import { onMount } from "svelte"

    import Map from "./components/Map.svelte"

    onMount(() => {
        if (navigator.storage && navigator.storage.persist) {
            // this should prevent our service worker cache from being deleted
            // when under storage pressure
            navigator.storage.persist().then((persistent) => {
                console.log(
                    persistent
                        ? "we have persistent storage"
                        : "storage is not persistent",
                )
            })
        }
    })
</script>

<div id="map-container">
    <!-- stands for OpenStreetMap Offline :) -->
    <h1 id="title">OSMO</h1>
    <Map />
</div>

<style>
    #map-container {
        position: relative;
    }

    :global(#map-container > *) {
        position: absolute;
        z-index: 2;
    }

    #title {
        top: 5px;
        right: 5px;
        margin: 0px;
        padding: 5px;
        padding-left: 10pt;
        padding-right: 10pt;
        background-color: var(--white);
        border-radius: 10px;
        border: 2px solid var(--grey);
    }

    @media only screen and (max-width: 650px) {
        #title {
            display: none;
        }
    }
</style>
