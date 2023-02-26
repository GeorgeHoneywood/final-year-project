<script lang="ts">
    // import { loadMapBlob } from "@/map/load.js"
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
    // maximum speed that the map will translate at during a fling
    const FLING_VELOCITY_CLAMP = 25

    // whether the browser is currently online or offline
    let online: boolean

    onMount(async () => {
        const blob = undefined // await loadMapBlob()
        const url = "data/ferndown.map"

        let parser: MapsforgeParser
        if (blob) {
            console.log("blob")
            parser = new MapsforgeParser(blob)
        } else {
            console.log("url", url)
            // load dynamically using HTTP range requests
            parser = new MapsforgeParser(null, new URL(url, location.href))
        }

        await parser.readHeader()
        console.log({ parser })

        map = new CanvasMap(canvas, parser)

        reactToDPRChange()
    })

    /**
     * force value to be inside FLING_VELOCITY_CLAMP
     * for example:
     *
     * ```
     * clamp(-1000) = -100
     * clamp(200) = 100
     * clamp(45) = 45
     * ```
     * @param value to clamp
     * @returns clamped value
     */
    function clamp(value: number): number {
        return Math.max(
            Math.min(value, FLING_VELOCITY_CLAMP),
            -FLING_VELOCITY_CLAMP,
        )
    }

    let mousePosition: Coord | null = null
    let previousPosition: Coord | null = null
    let velocity: Coord | null = null
    let flinging = false
    let mouseDown = false

    const mouse = {
        wheel: (e) => {
            e.preventDefault()

            e.deltaY < 0
                ? map.zoom(0.2, mousePosition!)
                : map.zoom(-0.2, mousePosition!)
        },
        mousedown: (e) => {
            e.preventDefault()
            ;(e.target! as HTMLCanvasElement).focus() // allows keyboard events to fire

            mouseDown = true
            flinging = false
        },
        mouseup: (e) => {
            e.preventDefault()
            mouseDown = false
            map.updateUrlHash()

            const fling = () => {
                if (!velocity) return

                // continue flinging until velocity low
                if (
                    velocity.x > 2 ||
                    velocity.x < -2 ||
                    velocity.y > 2 ||
                    velocity.y < -2
                ) {
                    flinging = true
                    console.log("flinging")

                    map.translate({
                        // clamp to a maximum translation speed
                        x: clamp(velocity.x),
                        y: clamp(velocity.y),
                    })

                    // FIXME: linear damping is flawed
                    // often the y-portion of the fling will will end before the
                    // x-portion, or vice-versa, which looks very odd
                    if (velocity.x > 0) {
                        velocity.x -= 1
                    } else {
                        velocity.x += 1
                    }
                    if (velocity.y > 0) {
                        velocity.y -= 1
                    } else {
                        velocity.y += 1
                    }

                    // continue the fling
                    requestAnimationFrame(fling)
                } else {
                    flinging = false
                    console.log("stop flinging")
                }
            }

            // for a nice smooth fling
            requestAnimationFrame(fling)
        },

        mouseout: (e) => {
            e.preventDefault()
            mouseDown = false
        },

        mousemove: (e) => {
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
            // if flinging, don't update velocity
            if (!flinging) {
                // FIXME: this is not a good method for measuring velocity.
                // it only accounts for the speed to the mouse movement right before
                // the mouseup event

                // TODO: instead time how long between mousedown & mouseup,
                // and use velocity = distance / time

                velocity = change
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
        touchstart: (e) => {
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
        touchmove: (e) => {
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
        touchend: (e) => {
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

        touchcancel: (e) => {
            console.log("noop")
        },
    }

    const keyboard = (e) => {
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

    function reactToDPRChange() {
        // listen for changes in device pixel ratio
        // this can happen when a user moves the window between monitors
        let dpr = window.devicePixelRatio
        for (const i of [1, 2, 3]) {
            window
                .matchMedia(`(resolution: ${i}dppx)`)
                .addEventListener("change", (e) => {
                    if (e.matches) {
                        map.setDirty()

                        if (!canvas) {
                            console.log("no canvas")
                            return
                        }
                        // FIXME: this isn't quite right.
                        // it works for dpr changes in steps of 1, but not 2
                        // think it should be based on canvas pixel size, not css size
                        let offset = canvas.getBoundingClientRect().height
                        if (dpr < window.devicePixelRatio) {
                            offset = -offset
                        }
                        console.log("offset", offset)

                        map.translate({ y: offset, x: 0 })
                        dpr = window.devicePixelRatio
                    }
                })
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
