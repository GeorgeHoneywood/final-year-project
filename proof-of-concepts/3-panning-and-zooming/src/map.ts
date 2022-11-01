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

        requestAnimationFrame(() => this.render()); // ensure that this==this
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

        const begin = performance.now()

        // make sure the canvas takes up most of the screen
        this.canvas.width = window.innerWidth - 16;
        this.canvas.height = window.innerHeight - 200;

        // clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // draw a crosshair
        this.drawCrosshair();

        // convert zoom level (1-18) into useful scale
        const scale = Math.pow(2, this.zoom_level);

        for (const geometry of this.geometries) {
            this.ctx.beginPath();
            for (const [x, y] of geometry) {
                this.ctx.lineTo(
                    (x * scale) + this.x_offset,
                    this.canvas.height - ((y * scale) + this.y_offset) // as we are drawing from 0,0 being the top left, we must flip the y-axis
                );
            }
            this.ctx.stroke();
        }

        this.drawDebugInfo(begin);

        requestAnimationFrame(() => this.render());
    }

    private drawCrosshair() {
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
    }

    private drawDebugInfo(begin: number) {
        this.ctx.fillText(
            `z${this.zoom_level.toFixed(1)}, x=${this.x_offset.toPrecision(8)}, y=${this.y_offset.toPrecision(8)}, frame time=${(performance.now() - begin).toFixed(0)}ms`,
            5,
            15
        );
    }
}

export { CanvasMap }
