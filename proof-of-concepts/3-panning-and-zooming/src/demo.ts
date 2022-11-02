import { getCoordinates } from "./load.js";
import { projectToMercator } from "./geom.js";
import { CanvasMap } from "./map.js";
import { Coord } from "./types.js";

const canvas = document.getElementById("map") as HTMLCanvasElement;
const layerPicker = document.getElementById("layerPicker") as HTMLSelectElement;


// wgs84_geometries is a list of arrays of longitude (λ), latitude (𝜙) wgs84 pairs
let wgs84_geometries = await getCoordinates(`data/${layerPicker.value}.geojson`);
let projected_geometries = projectToMercator(wgs84_geometries);

const map = new CanvasMap(canvas, projected_geometries);

layerPicker.addEventListener("change", async (e) => {
    wgs84_geometries = await getCoordinates(`data/${layerPicker.value}.geojson`);
    projected_geometries = projectToMercator(wgs84_geometries);

    map.setGeometries(projected_geometries);
})

let mousePosition: Coord | null = null;

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    e.deltaY < 0 ? map.zoom(0.2, mousePosition!) : map.zoom(-0.2, mousePosition!);
});

let mouseDown = false;

canvas.addEventListener("mousedown", (e) => {
    e.preventDefault()
    mouseDown = true;
});

canvas.addEventListener("mouseup", (e) => {
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

    if (mouseDown) {
        map.translate({ x: e.movementX, y: -e.movementY });
    }
});

// touch handling code: https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
// TODO:
// * Double tap zoom
// * Double & hold zoom in and out

const currentTouches: any[] = [];
let previousPinchDistance: number | null = null;
let pinchCenter: Coord | null = null;

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
});

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();

    const touches = e.changedTouches;

    if (touches.length == 1) {
        // this handles the random single touches that occur during a pinch zoom
        if (previousPinchDistance !== null) return;

        const idx = getCurrentTouchIndex(touches[0].identifier);

        if (idx >= 0) {
            map.translate({
                x: -(currentTouches[idx].pageX - touches[0].pageX),
                y: currentTouches[idx].pageY - touches[0].pageY,
            });
            currentTouches.splice(idx, 1, copyTouch(touches[0]));
        }

    } else if (touches.length === 2) {
        let pinchDistance = Math.hypot(
            (touches[0].pageX - touches[1].pageX),
            (touches[0].pageY - touches[1].pageY),
        );

        previousPinchDistance ??= pinchDistance;

        const rect = canvas.getBoundingClientRect();
        pinchCenter ??= {
            x: ((touches[0].pageX - rect.left)
                + (touches[1].pageX - rect.left)) / 2,
            y: ((rect.bottom - touches[0].pageY)
                + (rect.bottom - touches[1].pageY)) / 2,
        };

        map.zoom(-(previousPinchDistance - pinchDistance) / 100, pinchCenter);

        previousPinchDistance = pinchDistance;
    }
});
canvas.addEventListener("touchend", (e) => {
    e.preventDefault();

    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {

        let idx = getCurrentTouchIndex(touches[i].identifier);

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
});

canvas.addEventListener("touchcancel", (e) => {
    console.log("noop");
});


// FIXME: this should adjust offsets so that the centre of the map
// stays in the centre when the window resizes
window.addEventListener("resize", (e) => {
    e.preventDefault();

    map.setDirty();
});

document.addEventListener("keydown", (e) => {
    e.preventDefault();

    switch (e.key) {
        case "w":
            map.translate({ x: 0, y: -20 });
            break;
        case "s":
            map.translate({ x: 0, y: 20 })
            break;
        case "a":
            map.translate({ x: 20, y: 0 });
            break;
        case "d":
            map.translate({ x: -20, y: 0 })
            break;
        case "+":
            map.zoom(1);
            break;
        case "-":
            map.zoom(-1);
            break;
    }
});
