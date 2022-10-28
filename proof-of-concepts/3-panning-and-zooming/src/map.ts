import { GeometryArray } from "./types.js";

class CanvasMap {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private geometries: GeometryArray;

    // inital zoom level, where 1 is the whole world
    private zoom_level = 1;

    private x_offset = 0;
    private y_offset = 0;

    public constructor(canvas: HTMLCanvasElement, geometries: GeometryArray) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d")!;

        this.geometries = geometries;
    }

    public translate({ x, y }: { x: number, y: number }) {
        this.x_offset += x;
        this.y_offset += y;
        this.render();
    }

    // adjust offsets so that we zoom into the centre of the map view
    public zoom(zoom_delta: number) {
        this.x_offset = this.canvas.width / 2 - (this.canvas.width / 2 - this.x_offset)
            * Math.pow(2, zoom_delta);
        this.y_offset = this.canvas.height / 2 - (this.canvas.height / 2 - this.y_offset)
            * Math.pow(2, zoom_delta);

        this.zoom_level += zoom_delta;

        this.render();
    }

    public render() {
        // make sure the canvas takes up most of the screen
        this.canvas.width = window.innerWidth - 50;
        this.canvas.height = window.innerHeight - 200;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // draw a crosshair
        this.drawCrosshair();

        this.ctx.font = "15px Arial";
        this.ctx.fillText(`z${this.zoom_level.toFixed(1)}, x=${this.x_offset.toPrecision(8)}, y=${this.y_offset.toPrecision(8)}`, 5, 15);

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
    }

    private drawCrosshair() {
        this.ctx.moveTo(this.canvas.width / 2, 0);
        this.ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        this.ctx.stroke();
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
    }
}

export { CanvasMap }
