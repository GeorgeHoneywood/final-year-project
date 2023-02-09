<script lang="ts">
    import type { CanvasMap } from "../map/map"

    export let map: CanvasMap

    function geolocate() {
        console.log("geolocating!")
        let updatedViewport = false

        if (navigator.geolocation) {
            // TODO: handle GeolocationPositionError
            // ref: https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
            navigator.geolocation.watchPosition((pos: GeolocationPosition) => {
                map.setUserPosition(pos.coords)

                if (!updatedViewport) {
                    // set map to be centred on GPS position
                    map.setViewport(
                        {
                            x: pos.coords.longitude,
                            y: pos.coords.latitude,
                        },
                        15,
                    )
                    updatedViewport = true
                }
            })
        } else {
            console.log("geolocation is unsupported!")
        }
    }
</script>

<button id="geolocate" class="shadow" on:click={geolocate}>
    <span class="icon geolocate" />
</button>

<style>
    .geolocate {
        background-image: url("assets/geolocate.svg");
    }

    #geolocate {
        bottom: 10px;
        right: 10px;
    }
</style>
