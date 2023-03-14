<script lang="ts">
    import { loadMapBlob } from "@/map/load.js"
    import { CanvasMap } from "@/map/map.js"
    import { MapsforgeParser } from "@/map/mapsforge/mapsforge.js"
    import type { Coord } from "@/map/types.js"

    import Geolocate from "./Geolocate.svelte"
    import Offline from "./Offline.svelte"
    import OpenFile from "./OpenFile.svelte"
    import Search from "./Search.svelte"
    import Download from "./Download.svelte"
    import Controls from "./Controls.svelte"
    import Info from "./Info.svelte"

    import { onMount } from "svelte"

    let canvas: HTMLCanvasElement
    let map: CanvasMap

    // window for second tap to occur to be considered double tap
    const DOUBLE_TAP_TIMEOUT = 300

    // whether the browser is currently online or offline
    let online: boolean

    let map_size: DOMRect | null = null

    onMount(async () => {
        let blob = undefined
        // blob = await loadMapBlob("data/egham.map")
        // blob = await loadMapBlob("data/ferndown.map")
        // blob = await loadMapBlob("data/ferndown-with-debug.map")
        // const url = "data/ferndown-with-debug.map"
        // const url = "data/ferndown.map"
        const url = "data/england.map"

        let parser: MapsforgeParser
        if (blob) {
            console.log("loading from blob")
            parser = new MapsforgeParser(blob)
        } else {
            console.log("loading from url:", url)
            // load dynamically using HTTP range requests
            parser = new MapsforgeParser(null, new URL(url, location.href))
        }

        await parser.readHeader()
        console.log({ parser })

        map = new CanvasMap(canvas, parser)

        map_size = canvas.getBoundingClientRect()
    })

    // ====== mouse handling code
    let mousePosition: Coord | null = null
    let previousPosition: Coord | null = null
    let mouseDown = false

    const mouse = {
        wheel: (e: WheelEvent) => {
            e.preventDefault()

            e.deltaY < 0
                ? map.zoom(0.2, mousePosition || undefined)
                : map.zoom(-0.2, mousePosition || undefined)
        },
        mousedown: (e: MouseEvent) => {
            e.preventDefault() // NOTE: for some reason the formatter keeps moving the semicolon to the next line
            ;(e.target! as HTMLCanvasElement).focus() // allows keyboard events to fire

            mouseDown = true
        },
        mouseup: (e: MouseEvent) => {
            e.preventDefault()
            mouseDown = false
            map.updateUrlHash()
        },
        mouseout: (e: MouseEvent) => {
            e.preventDefault()
            mouseDown = false
        },
        mousemove: (e: MouseEvent) => {
            e.preventDefault()

            const rect = canvas.getBoundingClientRect()
            mousePosition = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            }

            previousPosition ??= mousePosition

            const change = {
                x: mousePosition.x - previousPosition.x,
                y: mousePosition.y - previousPosition.y,
            }

            if (mouseDown) {
                map.translate({ x: change.x, y: change.y })
            }

            previousPosition = mousePosition
        },
    }

    // ====== touch handling code: https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
    // panning
    let previousTouchPosition: Coord | null = null
    // pinch zoom
    let pinchCenter: Coord | null = null
    let previousPinchDistance: number | null = null
    // double tap zoom
    let firstTap = false
    let wasDoubleTapped = false
    let doubleTapPosition: Coord | null = null
    let previousDoubleTapDistance: number | null = null

    const touch = {
        touchstart: (e: TouchEvent) => {
            e.preventDefault()

            // figure out if a double tap has occurred
            if (!firstTap) {
                firstTap = true
                setTimeout(() => {
                    firstTap = false
                }, DOUBLE_TAP_TIMEOUT)
                return
            }

            if (firstTap) {
                wasDoubleTapped = true
            }
        },
        touchmove: (e: TouchEvent) => {
            e.preventDefault()

            if (wasDoubleTapped && e.touches.length === 1) {
                // handle double tap zoom first
                const rect = canvas.getBoundingClientRect()
                doubleTapPosition ??= {
                    x: e.touches[0].pageX - rect.left,
                    y: e.touches[0].pageY - rect.top,
                }

                // we only care about the distance in the y-axis for double taps
                const doubleTapDistance =
                    doubleTapPosition.y - (e.touches[0].pageY - rect.top)
                previousDoubleTapDistance ??= doubleTapDistance

                // zoom about the position of the double tap
                map.zoom(
                    (previousDoubleTapDistance - doubleTapDistance) / 100,
                    doubleTapPosition,
                )

                previousDoubleTapDistance = doubleTapDistance
            } else if (e.touches.length === 1) {
                // handle single-finger scrolling

                // this handles the random single touches that occur during a pinch zoom
                if (previousPinchDistance !== null) return

                previousTouchPosition ??= {
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY,
                }

                map.translate({
                    x: -(previousTouchPosition.x - e.touches[0].pageX),
                    y: -(previousTouchPosition.y - e.touches[0].pageY),
                })

                previousTouchPosition = {
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY,
                }
            } else if (e.touches.length === 2) {
                // handle pinch zoom
                const pinchDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY,
                )

                previousPinchDistance ??= pinchDistance

                const box = canvas.getBoundingClientRect()
                pinchCenter ??= {
                    x: (e.touches[0].pageX + e.touches[1].pageX - box.left) / 2,
                    y: (e.touches[0].pageY + e.touches[1].pageY - box.top) / 2,
                }

                // zoom about the pinch center
                map.zoom(
                    -(previousPinchDistance - pinchDistance) / 100,
                    pinchCenter,
                )

                previousPinchDistance = pinchDistance
            }
        },
        touchend: (e: TouchEvent) => {
            e.preventDefault()
            map.updateUrlHash()

            // if we are pinch zooming, only stop once the last touch event has ended.
            // otherwise we get a a map jump when you remove one finger
            if (e.touches.length === 0) {
                previousPinchDistance = null
                pinchCenter = null
            }

            // clear out double tap stuff
            wasDoubleTapped = false
            previousDoubleTapDistance = null
            doubleTapPosition = null
            previousTouchPosition = null
        },
        touchcancel: (e: TouchEvent) => {
            e.preventDefault()
            map.updateUrlHash()

            previousPinchDistance = null
            previousTouchPosition = null
        },
    }

    const keyboard = (e: KeyboardEvent) => {
        switch (e.key) {
            case "w":
                e.preventDefault()
                map.translate({ x: 0, y: -20 })
                break
            case "s":
                e.preventDefault()
                map.translate({ x: 0, y: 20 })
                break
            case "a":
                e.preventDefault()
                map.translate({ x: 20, y: 0 })
                break
            case "d":
                e.preventDefault()
                map.translate({ x: -20, y: 0 })
                break
            case "+":
                e.preventDefault()
                map.zoom(1)
                break
            case "-":
                e.preventDefault()
                map.zoom(-1)
                break
        }
    }
</script>

<!-- 
    handles window resizes, by shifting the map position so that the origin of the
    resize is the top left
-->
<svelte:window
    on:resize|preventDefault={() => {
        // FIXME: not particularly happy with this: would be better to have the origin
        // of the map be the top left, not the bottom left
        const new_size = canvas.getBoundingClientRect()
        map.translate({
            x: 0,
            y: (map_size.height - new_size.height) * window.devicePixelRatio,
        })
        map_size = new_size
        map.setDirty()
    }}
    bind:online
/>

<!-- on:blur noop to prevent a11y lint error -->
<!-- 
    tabindex makes it selectable, so key* events are fired
-->
<canvas
    id="map"
    tabindex="0"
    bind:this={canvas}
    on:wheel={mouse.wheel}
    on:mousedown={mouse.mousedown}
    on:mouseup={mouse.mouseup}
    on:mouseout={mouse.mouseout}
    on:blur={() => {}}
    on:mousemove={mouse.mousemove}
    on:touchstart={touch.touchstart}
    on:touchmove={touch.touchmove}
    on:touchend={touch.touchend}
    on:touchcancel={touch.touchcancel}
    on:keydown={keyboard}
/>
{#if online}
    <Search {map} />
{:else}
    <Offline />
{/if}

<!-- holds controls at bottom right -->
<Controls>
    {#if online && navigator.serviceWorker}
        <Download {map} />
    {/if}
    <OpenFile {map} />
    <Geolocate {map} />
    <Info />
</Controls>

<style>
    #map {
        z-index: 0;
        width: 100%;
        height: 100%;
    }

    #map:focus {
        outline: none;
    }
</style>
