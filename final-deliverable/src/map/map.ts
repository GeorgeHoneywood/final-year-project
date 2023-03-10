import { coordZToXYZ, projectMercator, unprojectMercator, zxyToMercatorCoord } from "./geom.js";
import type { MapsforgeParser } from "./mapsforge/mapsforge.js";
import { Tile, type PoI } from "./mapsforge/objects.js";
import { TilePosition } from './mapsforge/objects.js'
import type { BBox, Coord } from "./types.js";

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

    // zoom level, where 1 is the whole world, and 19 is close enough to see
    // details.
    // this is scaled via 2 ** zoom_level which gives an exponential number
    private zoom_level = 0;
    private scale = 0;

    // map offsets
    private x_offset = 0;
    private y_offset = 0;
    private dpr = 1;

    // when dirty, rerender the map
    // rerendering otherwise is a waste of CPU time
    private dirty = true;

    // optimisation tricks
    private canvas_height = 0;
    private previous_fill_style = "";
    private previous_stroke_style = "";

    private user_position: GeolocationCoordinates | null = null

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

        this.ctx.miterLimit = 2;

        // must set canvas size, otherwise we cannot centre the map properly
        this.setCanvasSize();
        this.handleDPRChange();

        // load the previous map position from the url hash, if possible
        this.initMapPosition();

        // calculate the base zoom levels for each zoom level
        this.initBaseZoomLevels();

        requestAnimationFrame(() => this.render()); // ensure that this==this
    }

    private initBaseZoomLevels() {
        for (let i = 0; i < this.parser.zoom_intervals[this.parser.zoom_intervals.length - 1].max_zoom_level; i++) {
            // FIXME: this is pretty inefficient, .getBaseZoom() does a linear
            // search each call
            const zoom_interval = this.parser.getBaseZoom(i);
            this.base_zooms[i] = {
                min_zoom: zoom_interval.min_zoom_level,
                base_zoom: zoom_interval.base_zoom_level,
            };
        }
    }

    private initMapPosition() {
        let [zoom_level, y, x] = window.location.hash
            .substring(1)
            .split("/")
            .map((e) => +e);

        // check if previous position is within map bounds, otherwise reset
        // NOTE: this is important when switching map files
        if (!this.withinMapExtent({ x, y })) {
            zoom_level = null
            x = null
            y = null
        }

        // if there is no previous location, try to use the map_start_position
        if (!zoom_level || !y || !x) {
            if (this.parser.map_start_location) {
                zoom_level = this.parser.map_start_location.zoom;
                y = this.parser.map_start_location.lat;
                x = this.parser.map_start_location.long;
            } else {
                // centre to the middle of the data bbox if no map start
                // position available
                zoom_level = 15;
                y = (this.parser.bbox.max_lat + this.parser.bbox.min_lat) / 2;
                x = (this.parser.bbox.max_long + this.parser.bbox.min_long) / 2;
            }
        }

        this.setViewport({ x, y }, zoom_level);
    }

    public setMapParser(parser: MapsforgeParser) {
        this.parser = parser;
        this.base_zooms = []
        this.tile_cache = {}
        this.initBaseZoomLevels()
        this.initMapPosition()
    }

    private setCanvasSize() {
        this.dpr = window.devicePixelRatio || 1;
        const size = this.canvas.getBoundingClientRect();
        this.canvas.width = size.width * this.dpr;
        this.canvas.height = size.height * this.dpr;

        // scale canvas back down from drawn size to rendered size
        // on screens where DPR = 1, then this will do nothing
        this.ctx.scale(this.dpr, this.dpr);

        // NOTE: this is useful for debugging issues where too many tiles are
        // being rendered:
        // 
        // this.ctx.translate(200, 200);
        // this.ctx.scale(this.dpr*0.6, this.dpr*0.6);
    }

    private handleDPRChange() {
        // listen for changes in device pixel ratio
        // this can happen when a user moves the window between monitors
        let dpr = window.devicePixelRatio
        for (const i of [1, 2, 3]) {
            window
                .matchMedia(`(resolution: ${i}dppx)`)
                .addEventListener("change", (e) => {
                    if (e.matches) {
                        this.setDirty()

                        // accounting for the amount of dpr change
                        let offset =
                            this.canvas.getBoundingClientRect().height *
                            Math.abs(window.devicePixelRatio - dpr)

                        if (dpr < window.devicePixelRatio) {
                            offset = -offset
                        }
                        this.translate({ y: offset, x: 0 })
                        dpr = window.devicePixelRatio
                    }
                })
        }
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
        this.y_offset -= y;

        this.dirty = true;
    }

    /**
     * Set the viewport of the map to be centred at this wgs84 position, at
     * the chosen zoom level
     * @param {x: number, y: number} wgs84 coord to centre on
     * @param zoom level desired
     */
    public setViewport({ x, y }: Coord, zoom: number) {
        // transform the wgs84 coord into mercator space
        const mercator = projectMercator({ x, y });

        this.zoom_level = zoom;
        const scale = 2 ** this.zoom_level;
        const size = this.canvas.getBoundingClientRect();

        this.x_offset = (size.width / 2) - (mercator.x * scale)
        this.y_offset = (((this.dpr - 1) * size.height + this.canvas.height) / 2) - (mercator.y * scale);

        this.dirty = true;
    }

    public getViewport(): BBox {
        const scale = 2 ** this.zoom_level;
        const size = this.canvas.getBoundingClientRect();

        const mercator_bottom_left: Coord = {
            x: -(this.x_offset) / scale,
            y: -(this.y_offset - (this.canvas.height - size.height)) / scale,
        }
        const mercator_top_right: Coord = {
            x: (size.width - this.x_offset) / scale,
            y: (this.canvas.height - this.y_offset) / scale,
        }

        const bottom_left = unprojectMercator(mercator_bottom_left);
        const top_right = unprojectMercator(mercator_top_right);

        return {
            bottom_left,
            top_right,
            bottom_right: {
                x: top_right.x,
                y: bottom_left.y,
            },
            top_left: {
                x: bottom_left.x,
                y: top_right.y,
            },
            centre: {
                x: (bottom_left.x + top_right.x) / 2,
                y: (bottom_left.y + top_right.y) / 2,
            },
        }
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
            x: this.canvas.getBoundingClientRect().width / 2,
            y: this.canvas.getBoundingClientRect().height / 2,
        },
    ) {
        const new_zoom = this.zoom_level + zoom_delta;

        // clamp zoom level to what our map file supports
        if (
            new_zoom >= this.parser.zoom_intervals[0].min_zoom_level
            && new_zoom < this.parser.zoom_intervals[this.parser.zoom_intervals.length - 1].max_zoom_level
        ) {
            // zoom into the canvas, by adjusting the x_offset and y_offset,
            // so that the point under the mouse cursor stays in the same place.
            // this also handles the case where window.devicePixelRatio != 1
            let scale = 2 ** this.zoom_level;

            const x_offset_scaled = (x - this.x_offset) / scale;
            const y_offset_scaled = ((this.canvas.height - y) - this.y_offset) / scale;

            scale *= (2 ** zoom_delta);

            this.x_offset = x - (x_offset_scaled * scale);
            this.y_offset = (this.canvas.height - y) - (y_offset_scaled * scale);

            this.zoom_level = new_zoom

            this.dirty = true;
        }
    }

    /**
     * Set the position of the user, according to GPS
     * @param coord GPS position
     */
    public setUserPosition(coord: GeolocationCoordinates) {
        this.user_position = coord
        this.dirty = true;
    }

    /**
     * Check if a point is within the bounds of the currently loaded map file
     * @param coord to check
     * @returns true if within, false if outside
     */
    public withinMapExtent(coord: Coord): boolean {
        const bbox = this.parser.bbox

        if (
            (coord.x > bbox.min_long && coord.x < bbox.max_long)
            && (coord.y > bbox.min_lat && coord.y < bbox.max_lat)
        ) {
            return true
        }
        return false
    }

    /**
     * Prefetches data within in the current viewport, in order to populate the
     * service worker cache
     */
    public async prefetch() {
        const base_zoom_interval = this.base_zooms[this.zoom_level - 1 | 0]

        const required_tiles = this.getRequiredTiles(base_zoom_interval.base_zoom, true)
        console.log(required_tiles)

        for (const zoom_level of required_tiles) {
            // we don't need to add these to `this.tile_cache`, as we are just
            // using this to populate the service worker cache

            // FIXME: this will create too many requests that all run at the
            // same time, need a limit on paralellism
            this.parser.fetchBaseTileRange(zoom_level)
            console.log("prefetched tile range: ", zoom_level.toString())
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
        this.canvas_height = this.canvas.height;

        // clear canvas
        this.ctx.fillStyle = "#f2efe9";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas_height);

        // convert zoom level (1-18) into useful scale
        this.scale = 2 ** this.zoom_level;
        const base_zoom_interval = this.base_zooms[this.zoom_level - 1 | 0]
        const required_tiles = this.getRequiredTiles(base_zoom_interval.base_zoom)[0];

        // read each tile we need to render
        for (const get_tile of required_tiles) {
            const tile_index = get_tile.toString()
            // only fetch if we haven't already -- must check undefined, as a
            // tile will be null if there is no data, or it is still loading
            if (this.tile_cache[tile_index] === undefined) {
                this.tile_cache[tile_index] = null
                this.parser.readBaseTile(get_tile)
                    .then((res) => {
                        this.tile_cache[tile_index] = res
                        // once the tile loads, we must set dirty, to render the
                        // new data
                        this.dirty = true
                    })
            }
        }

        let total_ways = 0
        let total_coords = 0
        const totals: { [type: string]: number } = {
            building: 0,
            natural: 0,
            road: 0,
            railway: 0,
            country: 0,
            water: 0,
            beach: 0,
            path: 0,
            grass: 0,
            coastline: 0,
        }

        // draw ways first
        for (const get_tile of required_tiles) {
            const tile = this.tile_cache[get_tile.toString()]
            if (!tile) {
                // tile is either empty, or not loaded yet. skip for now

                this.drawTileLoadCross(get_tile,);
                continue
            }

            // how many PoIs and ways we should show at our current zoom level
            const zoom_row = tile.zoom_table[(this.zoom_level - 1 | 0) - base_zoom_interval.min_zoom]

            for (let i = 0; i < zoom_row.way_count; i++) {
                const way = tile.ways[i]

                // handle multipolygons
                for (const path of way.paths) {
                    total_ways++
                    this.ctx.beginPath();
                    for (const point of path) {
                        this.lineTo(point)
                        total_coords++
                    }
                    // feature styles
                    if (way.is_closed && way.is_building) {
                        this.setFillStyle("#edc88e");
                        this.ctx.fill()
                        totals['building']++
                    } else if (way.is_closed && way.is_natural) {
                        this.setFillStyle("#3f7a3f")
                        this.ctx.fill()
                        totals['natural']++
                    } else if (way.is_closed && way.is_water) {
                        this.setFillStyle("#53b9ef")
                        this.ctx.fill()
                        totals['water']++
                    } else if (way.is_closed && way.is_beach) {
                        this.setFillStyle("#f9e0bb")
                        this.ctx.fill()
                        totals['beach']++
                    } else if (way.is_closed && way.is_grass) {
                        this.setFillStyle("#8dc98d")
                        this.ctx.fill()
                        totals['grass']++
                    } else if (way.is_closed && way.is_residential) {
                        // FIXME: residential landuse rendering on top of roads
                        // this.setFillStyle(prev_fill_style, "#e0dfdf")
                        // this.ctx.fill()
                        continue
                    } else if (way.is_closed && way.is_path) {
                        // pedestrian areas
                        // FIXME: need to stroke the path if not an area
                        if (way.tags?.find((e) => e === "area=yes")) {
                            this.setFillStyle("#f9c1bb")
                            this.ctx.fill()
                            totals['path']++
                        }
                    } else if (way.is_closed && way.is_road) {
                        // road areas
                        // FIXME: need to stroke the road if not an area
                        if (way.tags?.find((e) => e === "area=yes")) {
                            this.setFillStyle("#7a7979")
                            this.ctx.fill()
                            totals['road']++
                        }
                    } else if (way.is_road) {
                        this.setStrokeStyle("#7a7979")
                        let factor = 1

                        if (way.tags?.find((e) =>
                            e.startsWith("highway=motorway")
                            || e.startsWith("highway=trunk")
                        )) {
                            // major roads in orange
                            this.setStrokeStyle("#fcba64")

                            // major roads should be twice as thick as normal roads
                            factor = 2
                        }

                        if (this.zoom_level < 15) {
                            this.ctx.lineWidth = 2 * factor
                        } else if (this.zoom_level < 17) {
                            this.ctx.lineWidth = 4 * factor
                        } else {
                            this.ctx.lineWidth = 6 * factor
                        }
                        totals['road']++
                        this.ctx.stroke()
                    } else if (way.is_path) {
                        this.setStrokeStyle("#f9897c")
                        if (this.zoom_level < 15) {
                            this.ctx.lineWidth = 2
                        } else if (this.zoom_level < 17) {
                            this.ctx.lineWidth = 4
                        } else {
                            this.ctx.lineWidth = 6
                        }
                        totals['path']++
                        this.ctx.stroke()
                    } else if (way.is_railway) {
                        this.ctx.lineWidth = 6
                        this.setStrokeStyle("#ed5c4b")
                        this.ctx.stroke()
                        totals['railway']++
                    } else if (way.is_coastline) {
                        this.setStrokeStyle("black")
                        this.ctx.lineWidth = 1
                        totals['coastline']++
                        this.ctx.stroke()
                    } else {
                        // if we don't render it
                        continue
                        // this.setStrokeStyle("black")
                        // this.ctx.lineWidth = 1
                        // this.ctx.stroke()
                    }
                }
            }
        }

        // draw labels on top
        // FIXME: refactor to DRY this text rendering stuff
        for (const get_tile of required_tiles) {
            const tile = this.tile_cache[get_tile.toString()]
            if (!tile) {
                // tile is either empty, or not loaded yet. skip for now
                continue
            }

            // how many PoIs and ways we should show at our current zoom level
            const zoom_row = tile.zoom_table[(this.zoom_level - 1 | 0) - base_zoom_interval.min_zoom]

            // render way labels
            for (let i = 0; i < zoom_row.way_count; i++) {
                const way = tile.ways[i]

                // draw way labels
                if (this.zoom_level > 17 && way.label_position) {
                    let x = way.paths[0][0].x + way.label_position.x
                    let y = way.paths[0][0].y + way.label_position.y

                    // console.log(tile.bottom_right, tile.top_left)
                    if ((x > tile.bottom_right.x || x < tile.top_left.x)
                        || (y < tile.bottom_right.y || y > tile.top_left.y)
                    ) {
                        // label is outside of the tile, skip it
                        // prevents labels from being duplicated across tiles
                        continue;
                    }

                    x = this.scaleX(x)
                    y = this.scaleY(y) + 15 / 2 // font height

                    // if label is off the canvas, skip it
                    if (x < 0 || y < 0 || x > this.canvas.width || y > this.canvas_height) {
                        // NOTE: this is a bit incorrect, as we only shift the label
                        // position after we decided to render it
                        continue;
                    }

                    // draw the label centered on the geometry
                    this.ctx.font = '15px sans-serif';
                    const label = way.name ?? way.house_number ?? ""
                    const size = this.ctx.measureText(label)
                    x -= size.width / 2

                    this.ctx.fillStyle = "black"
                    this.ctx.fillText(
                        label,
                        x,
                        y,
                    );
                }
            }

            // render out points of interest
            for (let i = 0; i < zoom_row.poi_count; i++) {
                const poi = tile.pois[i]
                if (!poi.name) continue;

                const { x, y } = poi.position;

                // for places draw large stroked labels
                if (poi.tags?.find((e) =>
                    e.startsWith("place=")
                )) {
                    this.ctx.lineWidth = 2
                    this.ctx.strokeStyle = 'black';
                    // little box over the PoI, then label next to
                    this.ctx.strokeRect(
                        this.scaleX(x) - 5,
                        this.scaleY(y) - 5,
                        10,
                        10,
                    );
                    this.drawStokedText(poi, { x, y });
                } else {
                    this.ctx.font = '15px sans-serif';

                    const label = poi.name ?? poi.house_number ?? ""
                    const size = this.ctx.measureText(label)

                    this.ctx.fillStyle = "black"
                    this.ctx.fillText(
                        label,
                        this.scaleX(x) - size.width / 2,
                        this.scaleY(y) + 15 / 2, // font height
                    );
                }
            }
        }

        await this.renderTileLabels(required_tiles);

        // draw the user's position
        this.drawUserPosition();

        this.drawDebugInfo(begin, required_tiles[0], required_tiles.length, total_ways, total_coords, totals);

        requestAnimationFrame(() => this.render());
    }

    private scaleY = (y: number) => this.canvas_height - (y * this.scale + this.y_offset)
    private scaleX = (x: number) => x * this.scale + this.x_offset

    // only set the fill style if it has changed: see https://profiler.firefox.com/docs/#/./bunny
    private setFillStyle(fill_style: string) {
        if (this.previous_fill_style !== fill_style) {
            this.ctx.fillStyle = fill_style;
            this.previous_fill_style = fill_style;
        }
    }

    private setStrokeStyle(stroke_style: string) {
        if (this.previous_stroke_style !== stroke_style) {
            this.ctx.strokeStyle = stroke_style;
            this.previous_stroke_style = stroke_style;
        }
    }

    private async renderTileLabels(required_tiles: TilePosition[]) {
        this.ctx.strokeStyle = "lime";
        this.ctx.lineWidth = 2;
        this.ctx.font = '10px sans-serif';

        for (const tile of required_tiles) {
            const top_left = zxyToMercatorCoord(tile.z, tile.x, tile.y);

            // NOTE: useful for debugging tile load issues
            // const range = await this.parser.getTileByteRange(tile, this.parser.getBaseZoom(this.zoom_level))

            this.ctx.strokeRect(
                this.scaleX(top_left.x),
                this.scaleY(top_left.y),
                10,
                10
            );
            this.ctx.fillStyle = "black";
            this.ctx.fillText(
                `${tile.z}/${tile.x}/${tile.y}`, // ${range.start}-${range.end}, ${range.end - range.start}
                this.scaleX(top_left.x) + 12,
                this.scaleY(top_left.y) - 8
            );
        }
    }

    private lineTo(coord: Coord) {
        this.ctx.lineTo(
            this.scaleX(coord.x),
            this.scaleY(coord.y),
        );
    }
    private moveTo(coord: Coord) {
        this.ctx.moveTo(
            this.scaleX(coord.x),
            this.scaleY(coord.y),
        );
    }

    private drawTileLoadCross(get_tile: TilePosition) {
        const { top_left, bottom_right } = Tile.tileBounds(get_tile)

        this.ctx.beginPath()
        this.moveTo(top_left)
        this.lineTo(bottom_right)
        this.moveTo({ x: bottom_right.x, y: top_left.y });
        this.lineTo({ x: top_left.x, y: bottom_right.y });

        this.ctx.strokeStyle = ""
        this.ctx.lineWidth = 1
        this.ctx.stroke();
    }

    private getRequiredTiles(start_base_zoom: number, recursive: boolean = false): TilePosition[][] {
        let base_zooms = [start_base_zoom]
        if (recursive) {
            for (const interval of this.parser.zoom_intervals) {
                if (interval.base_zoom_level > start_base_zoom) {
                    base_zooms.push(interval.base_zoom_level)
                }
            }
        }

        // individual array for each base zoom level
        const required_tiles: TilePosition[][] = [];

        for (const base_zoom of base_zooms) {
            required_tiles.push([])
            const {
                top_left: top_left_coord, bottom_right: bottom_right_coord,
            } = this.getViewport();

            const top_left = coordZToXYZ(
                top_left_coord.y,
                top_left_coord.x,
                base_zoom
            );

            const bottom_right = coordZToXYZ(
                bottom_right_coord.y,
                bottom_right_coord.x,
                base_zoom
            );

            // loop over the gap between the top left and bottom right of the screen
            // in z/y/x tilespace, as these are the tiles we need to fetch
            // note, loop along x first, as this gets us contiguous byte ranges
            for (let y = top_left.y; y < bottom_right.y + 1; y++) {
                for (let x = top_left.x; x < bottom_right.x + 1; x++) {
                    required_tiles.at(-1).push(new TilePosition(base_zoom | 0, x, y));
                }
            }
        }
        return required_tiles;
    }

    // draw the user's current GPS position to the canvas,
    // if we have it
    private drawUserPosition() {
        if (this.user_position) {
            const { x, y } = projectMercator({
                x: this.user_position.longitude,
                y: this.user_position.latitude
            });

            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = "red";
            this.ctx.strokeRect(
                this.scaleX(x) - 10,
                this.scaleY(y) - 10,
                20,
                20
            );
        }
    }

    private drawStokedText(poi: PoI, proj: { x: number; y: number; }) {
        this.ctx.strokeStyle = 'black';
        this.ctx.font = '20px sans-serif';
        this.ctx.lineWidth = 4;

        const label = poi.name ?? poi.house_number ?? poi.tags?.join(",") ?? ""
        this.ctx.strokeText(
            label,
            this.scaleX(proj.x) + 10,
            this.scaleY(proj.y) + 5
        );

        this.ctx.fillStyle = 'white';
        this.ctx.fillText(
            label,
            this.scaleX(proj.x) + 10,
            this.scaleY(proj.y) + 5
        );
    }

    /**
     * Update the URL hash to reflect the current map position.
     * 
     * Should be called whenever the user has finished moving the map 
     * --- i.e. on mouseup or touchend.
     */
    public updateUrlHash() {
        const { centre } = this.getViewport();

        // using `replaceState` over updating `window.location.hash` should not
        // add a new history entry
        //
        // however this does not seem to work in either chrome or firefox
        // ff has this bug open: https://bugzilla.mozilla.org/show_bug.cgi?id=753264
        window.history.replaceState(null, "", `#${this.zoom_level.toFixed(0)}/${centre.y.toFixed(4)}/${centre.x.toFixed(4)}`)
    }

    /**
     * Draw some debug information to the top left of the map canvas
     * 
     * @param begin time we started rendering the frame at
     * @param top_left the top left tile x,y coordinate
     */
    private drawDebugInfo(begin: number, top_left: { x: number, y: number }, tile_count: number, total_ways: number, total_coords: number, totals: Record<string, number>) {
        this.ctx.font = "15px sans-serif";
        this.ctx.fillStyle = 'black';
        this.ctx.fillText(
            `z${this.zoom_level.toFixed(1)}
             ft=${(performance.now() - begin).toFixed(0)}ms
             tile_x,y=${top_left.x},${top_left.y}
             tiles=${tile_count}
             ways=${total_ways}
             coords=${total_coords}
             totals=${JSON.stringify(totals)}`
                .split("\n").map(e => e.trim()).join(";"),
            5,
            80,
        );
    }
}

export { CanvasMap }
