<script lang="ts">
    import type { CanvasMap } from "@/map/map"
    import Spinner from "./Spinner.svelte"

    export let map: CanvasMap
    let loading = false

    function geolocate() {
        console.log("geolocating!")
        let updated_viewport = false

        if (navigator.geolocation) {
            loading = true

            // TODO: handle GeolocationPositionError
            // ref: https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
            navigator.geolocation.watchPosition((pos: GeolocationPosition) => {
                loading = false
                map.setUserPosition(pos.coords)

                if (!updated_viewport) {
                    // set map to be centred on GPS position
                    map.setViewport(
                        {
                            x: pos.coords.longitude,
                            y: pos.coords.latitude,
                        },
                        15,
                    )
                    updated_viewport = true
                }
            })
        } else {
            console.log("geolocation is unsupported!")
        }
    }
</script>

<button id="geolocate" class="shadow" on:click={geolocate} disabled={loading}>
    {#if !loading}
        <span class="icon geolocate" />
    {:else}
        <Spinner />
    {/if}
</button>

<style>
    .geolocate {
        background-image: url("/icons/geolocate.svg");
    }
</style>
