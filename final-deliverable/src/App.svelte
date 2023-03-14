<script lang="ts">
    import Map from "./components/Map.svelte"
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
