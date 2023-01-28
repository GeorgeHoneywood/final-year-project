import type { CanvasMap } from "./map.js";
import type { Coord } from "./types.js";

// window for second tap to occur to be considered double tap 
const DOUBLE_TAP_TIMEOUT = 300;
// maximum speed that the map will translate at during a fling
const FLING_VELOCITY_CLAMP = 25

/**
 * registers event handlers, that allow the user to control the CanasMap
 * @param map 
 * @param canvas 
 * @param geolocate_button 
 */
function registerEventHandlers(
    map: CanvasMap,
    canvas: HTMLCanvasElement,
    geolocate_button: HTMLButtonElement,
) {
    // register mouse event handlers 
    handleMouse(map, canvas);
    // register touch event handlers
    handleTouch(map, canvas);
    // register keyboard event handlers for WASD+- controls
    handleKeyboard(map);

    // register geolocate button
    handleGPS(map, geolocate_button);

    // handle window resizes
    window.addEventListener("resize", (e) => {
        // TODO: this should adjust offsets so that the centre of the map
        // stays in the centre when the window resizes
        e.preventDefault();

        map.setDirty();
    });
}

function handleTouch(map: CanvasMap, canvas: HTMLCanvasElement) {
    // touch handling code: https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
    // TODO:
    // * Double tap zoom

    const currentTouches: any[] = [];
    let previousPinchDistance: number | null = null;
    let pinchCenter: Coord | null = null;
    let firstTap = false;
    let wasDoubleTapped = false;
    let doubleTapPosition: Coord | null = null;
    let previousDoubleTapDistance: number | null = null;

    function copyTouch({ identifier, pageX, pageY }: any) {
        return { identifier, pageX, pageY };
    }

    function getCurrentTouchIndex(idToFind: any) {
        for (let i = 0; i < currentTouches.length; i++) {
            const id = currentTouches[i].identifier;

            if (id === idToFind) {
                return i;
            }
        }
        return -1;
    }

    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();

        const touches = e.changedTouches;

        for (let i = 0; i < touches.length; i++) {
            currentTouches.push(copyTouch(touches[i]));
        }

        // figure out if a double tap has occurred
        if (!firstTap) {
            firstTap = true;
            setTimeout(() => { firstTap = false; }, DOUBLE_TAP_TIMEOUT);
            return;
        }

        if (firstTap) {
            wasDoubleTapped = true;
        }
    });

    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();

        const touches = e.changedTouches;

        if (wasDoubleTapped && e.touches.length === 1) {
            // handle double tap zoom first
            const rect = canvas.getBoundingClientRect();
            doubleTapPosition ??= {
                x: touches[0].pageX - rect.left,
                y: rect.bottom - touches[0].pageY,
            };

            // we only care about the distance in the y-axis for double taps
            const doubleTapDistance = doubleTapPosition.y - rect.bottom - touches[0].pageY;
            previousDoubleTapDistance ??= doubleTapDistance;

            // zoom about the position of the double tap
            map.zoom((previousDoubleTapDistance - doubleTapDistance) / 100, doubleTapPosition);
            previousDoubleTapDistance = doubleTapDistance;
        } else if (touches.length === 1) {
            // handle single-finger scrolling
            // this handles the random single touches that occur during a pinch zoom
            if (previousPinchDistance !== null)
                return;

            const idx = getCurrentTouchIndex(touches[0].identifier);

            if (idx >= 0) {
                map.translate({
                    x: -(currentTouches[idx].pageX - touches[0].pageX),
                    y: currentTouches[idx].pageY - touches[0].pageY,
                });
                currentTouches.splice(idx, 1, copyTouch(touches[0]));
            }


        } else if (touches.length === 2) {
            // handle pinch zoom
            const pinchDistance = Math.hypot(
                (touches[0].pageX - touches[1].pageX),
                (touches[0].pageY - touches[1].pageY)
            );

            previousPinchDistance ??= pinchDistance;

            const rect = canvas.getBoundingClientRect();
            pinchCenter ??= {
                x: ((touches[0].pageX - rect.left)
                    + (touches[1].pageX - rect.left)) / 2,
                y: ((rect.bottom - touches[0].pageY)
                    + (rect.bottom - touches[1].pageY)) / 2,
            };

            // zoom about the pinch center
            map.zoom(-(previousPinchDistance - pinchDistance) / 100, pinchCenter);

            previousPinchDistance = pinchDistance;
        }
    });
    canvas.addEventListener("touchend", (e) => {
        e.preventDefault();

        const touches = e.changedTouches;

        for (let i = 0; i < touches.length; i++) {

            const idx = getCurrentTouchIndex(touches[i].identifier);

            if (idx >= 0) {
                currentTouches.splice(idx, 1);
            }
        }

        // if we are pinch zooming, only stop once the last touch event has ended.
        // otherwise we get a a map jump when you remove one finger
        if (currentTouches.length === 0) {
            previousPinchDistance = null;
            pinchCenter = null;
        }

        // clear out double tap stuff
        wasDoubleTapped = false;
        previousDoubleTapDistance = null;
        doubleTapPosition = null;
    });

    canvas.addEventListener("touchcancel", (e) => {
        console.log("noop");
    });
}

function handleKeyboard(map: CanvasMap) {
    document.addEventListener("keydown", (e) => {
        switch (e.key) {
            case "w":
                e.preventDefault();
                map.translate({ x: 0, y: -20 });
                break;
            case "s":
                e.preventDefault();
                map.translate({ x: 0, y: 20 });
                break;
            case "a":
                e.preventDefault();
                map.translate({ x: 20, y: 0 });
                break;
            case "d":
                e.preventDefault();
                map.translate({ x: -20, y: 0 });
                break;
            case "+":
                e.preventDefault();
                map.zoom(1);
                break;
            case "-":
                e.preventDefault();
                map.zoom(-1);
                break;
        }
    });
}

function handleMouse(map: CanvasMap, canvas: HTMLCanvasElement) {
    let mousePosition: Coord | null = null;
    let previousPosition: Coord | null = null;
    let velocity: Coord | null = null;
    let flinging = false

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();

        e.deltaY < 0 ? map.zoom(0.2, mousePosition!) : map.zoom(-0.2, mousePosition!);
    });

    let mouseDown = false;

    canvas.addEventListener("mousedown", (e) => {
        e.preventDefault();
        mouseDown = true;
        flinging = false
    });

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
        );
    }

    canvas.addEventListener("mouseup", (e) => {
        e.preventDefault();
        mouseDown = false;

        const fling = () => {
            if (!velocity) return

            // continue flinging until velocity low
            if (velocity.x > 2 ||
                velocity.x < -2 ||
                velocity.y > 2 ||
                velocity.y < -2) {
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
                if (velocity.x > 0) { velocity.x -= 1 }
                else { velocity.x += 1 }
                if (velocity.y > 0) { velocity.y -= 1 }
                else { velocity.y += 1 }

                // continue the fling
                requestAnimationFrame(fling)
            } else {
                flinging = false
                console.log("stop flinging")
            }
        }

        // for a nice smooth fling
        requestAnimationFrame(fling)
    });

    canvas.addEventListener("mouseout", (e) => {
        e.preventDefault();
        mouseDown = false;
    });

    canvas.addEventListener("mousemove", (e) => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        mousePosition = {
            x: e.clientX - rect.left,
            y: rect.bottom - e.clientY,
        };

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
            map.translate({ x: change.x, y: change.y });
        }

        previousPosition = mousePosition
    });
}

function handleGPS(map: CanvasMap, geolocate_button: HTMLButtonElement) {
    geolocate_button.addEventListener("click", () => {
        console.log("geolocating!");
        if (navigator.geolocation) {
            // TODO: handle GeolocationPositionError 
            // ref: https://developer.mozilla.org/en-US/docs/Web/API/GeolocationPositionError
            navigator.geolocation.watchPosition((pos: GeolocationPosition) => {
                map.setUserPosition(pos.coords);
            });
        } else {
            console.log("geolocation is unsupported!");
        }
    });
}

export { registerEventHandlers }
