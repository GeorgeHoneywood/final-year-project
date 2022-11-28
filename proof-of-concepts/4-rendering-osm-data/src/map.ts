import { coordZToXYZ, projectMercator, unprojectMercator } from "./geom.js";
import { MapsforgeParser } from "./mapsforge/mapsforge.js";
import { Tile, TilePosition } from "./mapsforge/objects.js";
import { Coord } from "./types.js";

class CanvasMap {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private parser: MapsforgeParser;

    // store each tile we have fetched from the map file,
    // so that we do not need to re-fetch it if the user scrolls back
    // FIXME: should think about cache invalidation
    private tile_cache: { [id: string]: Tile | null } = {}

    // store the base tile zoom level for each possible zoom level
    private base_zooms: {
        [original: number]: {
            base_zoom: number,
            min_zoom: number
        }
    } = {}

    // zoom level, where 1 is the whole world this is scaled by calling
    // Math.pow(2, zoom_level) to get a non-logarithmic number
    private zoom_level = 0;

    private x_offset = 0;
    private y_offset = 0;

    // when dirty, rerender the map
    // rerendering otherwise is a waste of CPU time
    private dirty = true;

    /**
     * Create a map, linked to a canvas, to show tiles from the parser.
     *
     * @param canvas to render the map to
     * @param parser to show on the map
     */
    public constructor(canvas: HTMLCanvasElement, parser: MapsforgeParser) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d")!;
        this.ctx.font = "15px Arial";

        this.parser = parser;

        // must set canvas size, otherwise we cannot centre the map properly
        this.setCanvasSize();

        // load the previous map position from the url hash, if possible
        let [zoom_level, y, x] = window.location.hash
            .substring(1)
            .split("/")
            .map((e) => +e);

        // if there is no previous location, try to use the map_start_position
        if (!zoom_level || !y || !x) {
            if (parser.map_start_location) {
                zoom_level = parser.map_start_location.zoom;
                y = parser.map_start_location.lat;
                x = parser.map_start_location.long;
            } else {
                // centre to the middle of the data bbox if no map start
                // position available
                zoom_level = 15;
                y = (this.parser.bbox.max_lat + this.parser.bbox.min_lat) / 2
                x = (this.parser.bbox.max_long + this.parser.bbox.min_long) / 2
            }
        }

        // transform the wgs84 coord into mercator space
        const mercator = projectMercator({ x, y });
        const scale = Math.pow(2, zoom_level);

        // centre on the previous map location
        this.x_offset = -(mercator.x * scale) + this.canvas.width / 2;
        this.y_offset = -(mercator.y * scale) + this.canvas.height / 2;
        this.zoom_level = zoom_level;

        // calculate the base zoom levels for each zoom level
        for (let i = 0; i < this.parser.zoom_intervals[this.parser.zoom_intervals.length - 1].max_zoom_level; i++) {
            // FIXME: this is pretty inefficient, .getBaseZoom() does a linear
            // search each call
            const zoom_interval = this.parser.getBaseZoom(i)
            this.base_zooms[i] = {
                min_zoom: zoom_interval.min_zoom_level,
                base_zoom: zoom_interval.base_zoom_level,
            }
        }

        requestAnimationFrame(() => this.render()); // ensure that this==this
    }

    private setCanvasSize() {
        this.canvas.width = window.innerWidth - 16;
        this.canvas.height = window.innerHeight - 76;
    }

    public setDirty() {
        this.dirty = true;
    }

    /**
     * Scroll the map by a specified amount
     *
     * @param coord specifying x/y delta to pan the map by
     */
    public translate({ x, y }: Coord) {
        this.x_offset += x;
        this.y_offset += y;

        this.dirty = true;
    }

    /**
     * Zoom the map in or out. Supplying a positive number will zoom in, and
     * negative out. Optionally supply a Coord to zoom around, otherwise it will
     * zoom to the centre of the screen.
     *
     * @param zoom_delta is the amount to zoom in/out by. Supplying a delta of 1
     * will double the scale
     * @param coord optional Coord to zoom about, used for mousewheel zooming
     */
    public zoom(
        zoom_delta: number,
        { x, y }: Coord = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
        },
    ) {
        const new_zoom = this.zoom_level + zoom_delta;

        // clamp zoom level to what our map file supports
        if (
            new_zoom >= this.parser.zoom_intervals[0].min_zoom_level
            && new_zoom < this.parser.zoom_intervals[this.parser.zoom_intervals.length - 1].max_zoom_level
        ) {
            this.x_offset = x - (x - this.x_offset) * Math.pow(2, zoom_delta);
            this.y_offset = y - (y - this.y_offset) * Math.pow(2, zoom_delta);

            this.zoom_level = new_zoom

            this.dirty = true;
        }
    }

    /**
     * Renders out the map to the canvas. Should be called via
     * requestAnimationFrame, as this allows the map to be rendered at a stable
     * frame rate.
     */
    public async render() {
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

        const top_left_coord = unprojectMercator({
            y: (this.ctx.canvas.height - this.y_offset) / scale,
            x: -(this.x_offset / scale),
        })

        const base_zoom_interval = this.base_zooms[this.zoom_level | 0]

        const top_left = coordZToXYZ(
            top_left_coord.y,
            top_left_coord.x,
            base_zoom_interval.base_zoom,
        )

        const bottom_right_coord = unprojectMercator({
            y: -(this.y_offset / scale),
            x: ((this.ctx.canvas.width - this.x_offset) / scale),
        })

        const bottom_right = coordZToXYZ(
            bottom_right_coord.y,
            bottom_right_coord.x,
            base_zoom_interval.base_zoom,
        )

        // loop over the gap between the top left and bottom right of the screen
        // in z/y/x tilespace, as these are the tiles we need to fetch
        const required_tiles: TilePosition[] = []
        for (let x = top_left.x; x < bottom_right.x + 1; x++) {
            for (let y = top_left.y; y < bottom_right.y + 1; y++) {
                required_tiles.push({
                    x,
                    y,
                    z: base_zoom_interval.base_zoom | 0,
                })
            }
        }
        console.log(required_tiles)

        // read each tile we need to render
        for (const get_tile of required_tiles) {
            const tile_index = `${get_tile.z}/${get_tile.x}/${get_tile.y}`
            // only fetch if we haven't already -- must check undefined, as a
            // tile will be null if there is no data, or it is still loading
            if (this.tile_cache[tile_index] === undefined) {
                this.tile_cache[tile_index] = null
                // FIXME: this isn't great -- when overzooming, we fetch the
                // same base tile multiple times, and render it ontop of itself,
                // for each of the overzoomed tiles in the viewport. not sure of
                // the best way to handle this case. handling it here feels like
                // the implementation leaking out...
                this.parser.readBaseTile(
                    get_tile.z,
                    get_tile.x,
                    get_tile.y,
                ).then((res) => {
                    this.tile_cache[tile_index] = res
                    // once the tile loads, we must set dirty, so we render
                    this.dirty = true
                })
            }
        }

        for (const get_tile of required_tiles) {
            const tile_index = `${get_tile.z}/${get_tile.x}/${get_tile.y}`
            const tile = this.tile_cache[tile_index]
            if (!tile) {
                // tile is either empty, or not loaded yet. skip for now
                continue
            }

            // how many PoIs and ways we should show at our current zoom level
            const zoom_row = tile.zoom_table[(this.zoom_level | 0) - base_zoom_interval.min_zoom]

            // render out points of interest
            for (let i = 0; i < zoom_row.poi_count; i++) {
                const poi = tile.pois[i]
                // if (!poi.name || this.zoom_level < 16) continue;

                this.ctx.beginPath();
                const { x, y } = poi.position;
                const proj = projectMercator({ x, y });

                this.ctx.rect(
                    proj.x * scale + this.x_offset - 5,
                    this.canvas.height - (proj.y * scale + this.y_offset) - 5, // as we are drawing from 0,0 being the top left, we must flip the y-axis
                    10,
                    10,
                );
                this.ctx.fillText(
                    poi.name ?? poi.house_number ?? poi.tags?.join(",") ?? "",
                    proj.x * scale + this.x_offset + 10,
                    this.canvas.height - (proj.y * scale + this.y_offset) + 5,
                );

                this.ctx.stroke();
            }

            // render out the ways
            for (let i = 0; i < zoom_row.way_count; i++) {
                const way = tile.ways[i]

                // draw way labels
                if (this.zoom_level > 17 && way.label_position) {
                    // draw the label centered on the geometry
                    // FIXME: this only makes sense for closed geometries -- i.e.
                    // not roads/paths
                    const size = this.ctx.measureText(
                        way.name ?? way.house_number ?? "",
                    );
                    const proj = projectMercator({ x: way.path[0].x, y: way.path[0].y });

                    this.ctx.fillText(
                        way.name ?? way.house_number ?? "",
                        (proj.x + way.label_position.x) * scale +
                        this.x_offset -
                        size.width / 2,
                        this.canvas.height -
                        ((proj.y + way.label_position.y) * scale +
                            this.y_offset) +
                        15 / 2, // font height
                    );
                }

                this.ctx.beginPath();
                for (const { x, y } of way.path) {
                    const proj = projectMercator({ x, y });
                    this.ctx.lineTo(
                        proj.x * scale + this.x_offset,
                        this.canvas.height - (proj.y * scale + this.y_offset), // as we are drawing from 0,0 being the top left, we must flip the y-axis
                    );
                }
                this.ctx.stroke();
            }
        }

        this.drawDebugInfo(begin, scale, top_left);

        this.updateUrlHash();

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
    // updating the URL too often get the tab killed in firefox,
    // so only do it every 10th update
    private updateUrlHash() {
        if (this.i !== 10) {
            this.i++;
            return;
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

    /**
     * Draw some debug information to the top left of the map canvas
     * 
     * @param begin time we started rendering the frame at
     * @param scale the current zoom scale
     * @param top_left the top left tile x,y coordinate
     */
    private drawDebugInfo(begin: number, scale: number, top_left: { x: number, y: number }) {
        const mercatorCenter: Coord = {
            x: ((this.canvas.width / 2) - this.x_offset) / scale,
            y: ((this.canvas.height / 2) - this.y_offset) / scale,
        };
        const wgs84Center = unprojectMercator(mercatorCenter);

        this.ctx.fillText(
            `z${this.zoom_level.toFixed(1)},
             x=${this.x_offset.toPrecision(8)},
             y=${this.y_offset.toPrecision(8)},
             frame_time=${(performance.now() - begin).toFixed(0)}ms,
             mercator_x,y=${mercatorCenter.x.toFixed(4)},${mercatorCenter.y.toFixed(4)},
             wgs84_x,y = ${wgs84Center.x.toFixed(4)},${wgs84Center.y.toFixed(4)}
             tile_x,y=${top_left.x},${top_left.y}`
                .split("\n").map(e => e.trim()).join(" "),
            5,
            15,
        );
    }
}

export { CanvasMap }
