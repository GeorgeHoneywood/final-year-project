<script lang="ts">
    import { loadMapBlob } from "@/map/load.js"
    import { CanvasMap } from "@/map/map.js"
    import { MapsforgeParser } from "@/map/mapsforge/mapsforge.js"
    import type { Coord } from "@/map/types.js"

    import Geolocate from "./Geolocate.svelte"
    import Offline from "./Offline.svelte"
    import OpenFile from "./OpenFile.svelte"
    import Search from "./Search.svelte"

    import { onMount } from "svelte"

    let canvas: HTMLCanvasElement
    let map: CanvasMap

    // window for second tap to occur to be considered double tap
    const DOUBLE_TAP_TIMEOUT = 300

    // whether the browser is currently online or offline
    let online: boolean

    onMount(async () => {
        // const blob = undefined
        const blob = await loadMapBlob("data/ferndown.map")
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
    })

    let mousePosition: Coord | null = null
    let previousPosition: Coord | null = null
    let mouseDown = false

    const mouse = {
        wheel: (e: WheelEvent) => {
            e.preventDefault()

            e.deltaY < 0
                ? map.zoom(0.2, mousePosition!)
                : map.zoom(-0.2, mousePosition!)
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

    // touch handling code: https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
    // TODO:
    // * Double tap zoom

    const currentTouches: any[] = []
    let previousPinchDistance: number | null = null
    let pinchCenter: Coord | null = null
    let firstTap = false
    let wasDoubleTapped = false
    let doubleTapPosition: Coord | null = null
    let previousDoubleTapDistance: number | null = null

    function copyTouch({ identifier, pageX, pageY }: any) {
        return { identifier, pageX, pageY }
    }

    function getCurrentTouchIndex(idToFind: any) {
        for (let i = 0; i < currentTouches.length; i++) {
            const id = currentTouches[i].identifier

            if (id === idToFind) {
                return i
            }
        }
        return -1
    }

    const touch = {
        touchstart: (e: TouchEvent) => {
            e.preventDefault()

            const touches = e.changedTouches

            for (let i = 0; i < touches.length; i++) {
                currentTouches.push(copyTouch(touches[i]))
            }

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

            const touches = e.changedTouches

            if (wasDoubleTapped && e.touches.length === 1) {
                // handle double tap zoom first
                const rect = canvas.getBoundingClientRect()
                doubleTapPosition ??= {
                    x: touches[0].pageX - rect.left,
                    y: touches[0].pageY - rect.top,
                }

                // we only care about the distance in the y-axis for double taps
                const doubleTapDistance =
                    doubleTapPosition.y - (touches[0].pageY - rect.top)
                previousDoubleTapDistance ??= doubleTapDistance

                // zoom about the position of the double tap
                map.zoom(
                    (previousDoubleTapDistance - doubleTapDistance) / 100,
                    doubleTapPosition,
                )
                previousDoubleTapDistance = doubleTapDistance
            } else if (touches.length === 1) {
                // handle single-finger scrolling
                // this handles the random single touches that occur during a pinch zoom
                if (previousPinchDistance !== null) return

                const idx = getCurrentTouchIndex(touches[0].identifier)

                if (idx >= 0) {
                    map.translate({
                        x: -(currentTouches[idx].pageX - touches[0].pageX),
                        y: -(currentTouches[idx].pageY - touches[0].pageY),
                    })
                    currentTouches.splice(idx, 1, copyTouch(touches[0]))
                }
            } else if (touches.length === 2) {
                // handle pinch zoom
                const pinchDistance = Math.hypot(
                    touches[0].pageX - touches[1].pageX,
                    touches[0].pageY - touches[1].pageY,
                )

                previousPinchDistance ??= pinchDistance

                const rect = canvas.getBoundingClientRect()
                pinchCenter ??= {
                    x: (touches[0].pageX + touches[1].pageX - rect.left) / 2,
                    y: (touches[0].pageY + touches[1].pageY - rect.top) / 2,
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

            const touches = e.changedTouches

            for (let i = 0; i < touches.length; i++) {
                const idx = getCurrentTouchIndex(touches[i].identifier)

                if (idx >= 0) {
                    currentTouches.splice(idx, 1)
                }
            }

            // if we are pinch zooming, only stop once the last touch event has ended.
            // otherwise we get a a map jump when you remove one finger
            if (currentTouches.length === 0) {
                previousPinchDistance = null
                pinchCenter = null
            }

            // clear out double tap stuff
            wasDoubleTapped = false
            previousDoubleTapDistance = null
            doubleTapPosition = null
        },

        touchcancel: (e: TouchEvent) => {
            console.log("noop")
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

<svelte:window
    on:resize|preventDefault={() => {
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
<OpenFile {map} />
<Geolocate {map} />

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
