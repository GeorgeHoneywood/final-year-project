import { projectMercator, unprojectMercator } from "./geom.js";
import { Coord, GeometryArray } from "./types.js";

class CanvasMap {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private geometries: GeometryArray;

    // inital zoom level, where 1 is the whole world
    private zoom_level = 1;

    private x_offset = 340;
    private y_offset = 320;

    private dirty = true;

    public constructor(canvas: HTMLCanvasElement, geometries: GeometryArray) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d")!;
        this.ctx.font = "15px Arial";

        this.geometries = geometries;

        this.setCanvasSize();

        const [zoom_level, y, x] = window.location.hash.substring(1).split("/").map(e => +e);

        if (zoom_level && y && x) {
            const mercator = projectMercator({ x, y })

            this.x_offset = -(mercator.x * Math.pow(2, zoom_level)) + this.canvas.width / 2
            this.y_offset = -(mercator.y * Math.pow(2, zoom_level)) + this.canvas.height / 2
            this.zoom_level = zoom_level
        }

        requestAnimationFrame(() => this.render()); // ensure that this==this
    }

    private setCanvasSize() {
        this.canvas.width = window.innerWidth - 16;
        this.canvas.height = window.innerHeight - 200;
    }

    public setGeometries(geometries: GeometryArray) {
        this.geometries = geometries;
        this.dirty = true;
    }

    public setDirty() {
        this.dirty = true;
    }

    public translate({ x, y }: Coord) {
        this.x_offset += x;
        this.y_offset += y;

        this.dirty = true;
    }

    // adjust offsets so that we zoom into the centre of the map view
    public zoom(zoom_delta: number,
        { x, y }: Coord = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
        }) {

        this.x_offset = x - (x - this.x_offset)
            * Math.pow(2, zoom_delta);
        this.y_offset = y - (y - this.y_offset)
            * Math.pow(2, zoom_delta);

        this.zoom_level += zoom_delta;

        this.dirty = true;
    }

    public render() {
        // if nothing has changed, don't bother re-rendering
        if (!this.dirty) {
            requestAnimationFrame(() => this.render());
            return;
        }
        this.dirty = false;

        const begin = performance.now();

        // make sure the canvas takes up most of the screen
        this.setCanvasSize();

        // clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // draw a crosshair
        this.drawCrosshair();

        // convert zoom level (1-18) into useful scale
        const scale = Math.pow(2, this.zoom_level);

        for (const geometry of this.geometries) {
            this.ctx.beginPath();
            for (const [x, y] of geometry) {
                // TODO: possible optimisation: only draw lines that are actually on the canvas
                this.ctx.lineTo(
                    (x * scale) + this.x_offset,
                    this.canvas.height - ((y * scale) + this.y_offset) // as we are drawing from 0,0 being the top left, we must flip the y-axis
                );
            }
            this.ctx.stroke();
        }

        this.drawDebugInfo(begin, scale);

        this.updateUrlHash()

        requestAnimationFrame(() => this.render());
    }

    private drawCrosshair() {
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
    }

    i = 0;
    private updateUrlHash() {
        if (this.i !== 10) {
            this.i++; return
        } else {
            this.i = 0;
        }

        const scale = Math.pow(2, this.zoom_level);

        const mercatorCenter: Coord = {
            x: ((this.canvas.width / 2) - this.x_offset) / scale,
            y: ((this.canvas.height / 2) - this.y_offset) / scale,
        }

        const wgs84Center = unprojectMercator(mercatorCenter)

        window.location.hash = `${this.zoom_level.toFixed(0)}/${wgs84Center.y.toFixed(4)}/${wgs84Center.x.toFixed(4)}`
    }

    private drawDebugInfo(begin: number, scale: number) {
        const mercatorCenter: Coord = {
            x: ((this.canvas.width / 2) - this.x_offset) / scale,
            y: ((this.canvas.height / 2) - this.y_offset) / scale,
        }
        const wgs84Center = unprojectMercator(mercatorCenter)

        this.ctx.fillText(
            `z${this.zoom_level.toFixed(1)},
             x=${this.x_offset.toPrecision(8)},
             y=${this.y_offset.toPrecision(8)},
             frame_time=${(performance.now() - begin).toFixed(0)}ms,
             mercator_x,y=${mercatorCenter.x.toFixed(4)},${mercatorCenter.y.toFixed(4)},
             wgs84_x,y = ${wgs84Center.x.toFixed(4)},${wgs84Center.y.toFixed(4)}`
                .split("\n").map(e => e.trim()).join(" "),
            5,
            15
        );
    }
}

export { CanvasMap }
