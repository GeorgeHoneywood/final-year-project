import { coordZToXYZ, projectMercator, unprojectMercator, zxyToMercatorCoord } from "./geom.js";
import type { MapsforgeParser } from "./mapsforge/mapsforge.js";
import type { PoI, Tile, TilePosition } from "./mapsforge/objects.js";
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

    private x_offset = 0;
    private y_offset = 0;
    private dpr = 1;

    // when dirty, rerender the map
    // rerendering otherwise is a waste of CPU time
    private dirty = true;

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
        this.ctx.translate(50, 50);
        this.ctx.scale(this.dpr*0.4, this.dpr*0.4);
        // this.ctx.scale(this.dpr, this.dpr);
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

        this.x_offset = -(mercator.x * scale)
        this.y_offset = (this.canvas.height - size.height) - (mercator.y * scale);

        this.dirty = true;
    }

    public getViewport(): BBox {
        const scale = 2 ** this.zoom_level;

        const mercator_bottom_left: Coord = {
            x: -(this.x_offset) / scale,
            y: -(this.y_offset) / scale,
        }
        const mercator_top_right: Coord = {
            x: -(this.canvas.width - this.x_offset) / scale,
            y: ((this.canvas.height) - this.y_offset) / scale,
        }

        return {
            bottom_left: unprojectMercator(mercator_bottom_left),
            top_right: unprojectMercator(mercator_top_right),
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
        this.ctx.fillStyle =  "#111" //"#f2efe9"
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // convert zoom level (1-18) into useful scale
        const scale = 2 ** this.zoom_level;

        const size = this.canvas.getBoundingClientRect();
        console.log(size.height)
        console.log(this.y_offset)
        console.log(size.height - this.y_offset)
        console.log(size.height - this.y_offset + size.height)

        const top_left_coord = unprojectMercator({
            y: (-this.y_offset+ this.canvas.height) / scale,
            x: -(this.x_offset / scale),
        })

        const base_zoom_interval = this.base_zooms[this.zoom_level | 0]

        const top_left = coordZToXYZ(
            top_left_coord.y,
            top_left_coord.x,
            base_zoom_interval.base_zoom,
        )

        const bottom_right_coord = unprojectMercator({
            y: -((this.y_offset) / scale),
            x: ((size.width - this.x_offset) / scale),
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
            for (let y = top_left.y; y < bottom_right.y+1; y++) {
                required_tiles.push({
                    x,
                    y,
                    z: base_zoom_interval.base_zoom | 0,
                })
            }
        }

        // read each tile we need to render
        for (const get_tile of required_tiles) {
            const tile_index = getIndexString(get_tile)
            // only fetch if we haven't already -- must check undefined, as a
            // tile will be null if there is no data, or it is still loading
            if (this.tile_cache[tile_index] === undefined) {
                this.tile_cache[tile_index] = null
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

        let total_ways = 0
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
            const tile = this.tile_cache[getIndexString(get_tile)]
            if (!tile) {
                // tile is either empty, or not loaded yet. skip for now
                continue
            }

            // how many PoIs and ways we should show at our current zoom level
            const zoom_row = tile.zoom_table[(this.zoom_level | 0) - base_zoom_interval.min_zoom]

            for (let i = 0; i < zoom_row.way_count; i++) {
                const way = tile.ways[i]

                // handle multipolygons
                for (const path of way.paths) {
                    total_ways++
                    this.ctx.beginPath();
                    for (const { x, y } of path) {
                        this.ctx.lineTo(
                            x * scale + this.x_offset,
                            this.canvas.height - (y * scale + this.y_offset), // as we are drawing from 0,0 being the top left, we must flip the y-axis
                        );
                    }
                    // feature styles
                    if (way.is_closed && way.is_building) {
                        this.ctx.fillStyle = "#edc88e"
                        this.ctx.fill()
                        totals['building']++
                    } else if (way.is_closed && way.is_natural) {
                        this.ctx.fillStyle = "#3f7a3f"
                        // this.ctx.fill()
                        totals['natural']++
                    } else if (way.is_closed && way.is_water) {
                        this.ctx.fillStyle = "#53b9ef"
                        this.ctx.fill()
                        totals['water']++
                    } else if (way.is_closed && way.is_beach) {
                        this.ctx.fillStyle = "#f9e0bb"
                        this.ctx.fill()
                        totals['beach']++
                    } else if (way.is_closed && way.is_grass) {
                        this.ctx.fillStyle = "#8dc98d"
                        // this.ctx.fill()
                        totals['grass']++
                    } else if (way.is_closed && way.is_residential) {
                        // FIXME: residential landuse rendering on top of roads
                        // this.ctx.fillStyle = "#e0dfdf"
                        // this.ctx.fill()
                        continue
                    } else if (way.is_closed && way.is_path) {
                        // pedestrian areas
                        // FIXME: need to stroke the path if not an area
                        if (way.tags?.find((e) => e === "area=yes")) {
                            this.ctx.fillStyle = "#f9c1bb"
                            this.ctx.fill()
                            totals['path']++
                        }
                    } else if (way.is_closed && way.is_road) {
                        // road areas
                        // FIXME: need to stroke the road if not an area
                        if (way.tags?.find((e) => e === "area=yes")) {
                            this.ctx.fillStyle = "#7a7979"
                            this.ctx.fill()
                            totals['road']++
                        }
                    } else if (way.is_road) {
                        this.ctx.strokeStyle = "#7a7979"
                        let scale = 1

                        if (way.tags?.find((e) =>
                            e.startsWith("highway=motorway")
                            || e.startsWith("highway=trunk")
                        )) {
                            // major roads in orange
                            this.ctx.strokeStyle = "#fcba64"

                            // major roads should be twice as thick as normal roads
                            scale = 2
                        }

                        if (this.zoom_level < 15) {
                            this.ctx.lineWidth = 2 * scale
                        } else if (this.zoom_level < 17) {
                            this.ctx.lineWidth = 4 * scale
                        } else {
                            this.ctx.lineWidth = 6 * scale
                        }
                        totals['road']++
                        this.ctx.stroke()
                    } else if (way.is_path) {
                        this.ctx.strokeStyle = "#f9897c"
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
                        this.ctx.strokeStyle = "#ed5c4b"
                        this.ctx.stroke()
                        totals['railway']++
                    } else if (way.is_coastline) {
                        this.ctx.strokeStyle = "black"
                        this.ctx.lineWidth = 1
                        totals['coastline']++
                        this.ctx.stroke()
                    } else {
                        // if we don't render it
                        continue
                        // this.ctx.strokeStyle = "black"
                        // this.ctx.lineWidth = 1
                        // this.ctx.stroke()
                    }
                }
            }
        }

        // draw labels on top
        // FIXME: refactor to DRY this text rendering stuff
        for (const get_tile of required_tiles) {
            const tile = this.tile_cache[getIndexString(get_tile)]
            if (!tile) {
                // tile is either empty, or not loaded yet. skip for now
                continue
            }

            // how many PoIs and ways we should show at our current zoom level
            const zoom_row = tile.zoom_table[(this.zoom_level | 0) - base_zoom_interval.min_zoom]

            // render way labels
            for (let i = 0; i < zoom_row.way_count; i++) {
                const way = tile.ways[i]
                // draw way labels
                if (this.zoom_level > 17 && way.label_position) {
                    // draw the label centered on the geometry
                    this.ctx.font = '15px sans-serif';

                    const label = way.name ?? way.house_number ?? ""
                    const size = this.ctx.measureText(label)

                    this.ctx.fillStyle = "black"
                    this.ctx.fillText(
                        label,
                        (way.paths[0][0].x + way.label_position.x) * scale
                        + this.x_offset
                        - size.width / 2,
                        this.canvas.height
                        - ((way.paths[0][0].y + way.label_position.y) * scale + this.y_offset)
                        + 15 / 2, // font height
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
                        x * scale + this.x_offset - 5,
                        this.canvas.height - (y * scale + this.y_offset) - 5, // as we are drawing from 0,0 being the top left, we must flip the y-axis
                        10,
                        10,
                    );
                    this.drawStokedText(poi, { x, y }, scale);
                } else {
                    this.ctx.font = '15px sans-serif';

                    const label = poi.name ?? poi.house_number ?? ""
                    const size = this.ctx.measureText(label)

                    this.ctx.fillStyle = "black"
                    this.ctx.fillText(
                        label,
                        (x) * scale
                        + this.x_offset
                        - size.width / 2,
                        this.canvas.height
                        - (y * scale + this.y_offset)
                        + 15 / 2, // font height
                    );
                }
            }

            this.ctx.stroke();
        }

        const show_tile_borders = true

        // render tile borders
        if (show_tile_borders) {
            this.ctx.strokeStyle = "lime"
            this.ctx.lineWidth = 2
            this.ctx.font = '10px sans-serif';

            for (const tile of required_tiles) {
                const top_left = zxyToMercatorCoord(tile.z, tile.x, tile.y)

                this.ctx.strokeRect(
                    top_left.x * scale + this.x_offset,
                    this.canvas.height - (top_left.y * scale + this.y_offset),
                    10,
                    10,
                )
                this.ctx.fillStyle = "black"
                this.ctx.fillText(
                    `${tile.z}/${tile.x}/${tile.y}`,
                    top_left.x * scale + this.x_offset + 12,
                    this.canvas.height - (top_left.y * scale + this.y_offset- 8),
                )
            }
        }

        // draw the user's position
        this.drawUserPosition(scale);

        this.drawDebugInfo(begin, scale, top_left, required_tiles.length, total_ways, totals);

        console.log({
            x_tiles: bottom_right.x - top_left.x+1,
            y_tiles: bottom_right.y - top_left.y+1,
        })

        console.log(bottom_right.x)
        console.log(top_left.x)

        this.updateUrlHash();

        requestAnimationFrame(() => this.render());

        function getIndexString(get_tile: TilePosition) {
            return `${get_tile.z}/${get_tile.x}/${get_tile.y}`;
        }
    }

    // draw the user's current GPS position to the canvas,
    // if we have it
    private drawUserPosition(scale: number) {
        if (this.user_position) {
            const { x, y } = projectMercator({
                x: this.user_position.longitude,
                y: this.user_position.latitude
            });

            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = "red";
            this.ctx.strokeRect(
                x * scale + this.x_offset - 10,
                this.canvas.height - (y * scale + this.y_offset) - 10,
                20,
                20
            );
        }
    }

    private drawStokedText(poi: PoI, proj: { x: number; y: number; }, scale: number) {
        this.ctx.strokeStyle = 'black';
        this.ctx.font = '20px sans-serif';
        this.ctx.lineWidth = 4;

        const label = poi.name ?? poi.house_number ?? poi.tags?.join(",") ?? ""
        this.ctx.strokeText(
            label,
            proj.x * scale + this.x_offset + 10,
            this.canvas.height - (proj.y * scale + this.y_offset) + 5
        );

        this.ctx.fillStyle = 'white';
        this.ctx.fillText(
            label,
            proj.x * scale + this.x_offset + 10,
            this.canvas.height - (proj.y * scale + this.y_offset) + 5
        );
    }

    i = 0;
    // updating the URL too often gets the tab killed in firefox,
    // so only do it every 10th update
    // TODO: should only update when the user has stopped moving
    // i.e. on mouseup or touchend
    private updateUrlHash() {
        if (this.i !== 10) {
            this.i++;
            return;
        } else {
            this.i = 0;
        }

        const scale = 2 ** this.zoom_level;

        const size = this.canvas.getBoundingClientRect();

        const mercatorCenter: Coord = {
            x: -(this.x_offset) / scale,
            y: -((this.canvas.height - size.height) - this.y_offset) / scale,
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
    private drawDebugInfo(begin: number, scale: number, top_left: { x: number, y: number }, tile_count: number, total_ways: number, totals: Record<string, number>) {
        // const mercatorCenter: Coord = {
        //     x: ((this.canvas.width / 2) - this.x_offset) / scale,
        //     y: ((this.canvas.height / 2) - this.y_offset) / scale,
        // };
        // const wgs84Center = unprojectMercator(mercatorCenter);

        // x=${this.x_offset.toPrecision(8)},
        // y=${this.y_offset.toPrecision(8)},
        // mercator_x,y=${mercatorCenter.x.toFixed(4)},${mercatorCenter.y.toFixed(4)},
        // wgs84_x,y = ${wgs84Center.x.toFixed(4)},${wgs84Center.y.toFixed(4)},

        this.ctx.font = "15px sans-serif";
        this.ctx.fillStyle = 'black';
        this.ctx.fillText(
            `z${this.zoom_level.toFixed(1)}
             ft=${(performance.now() - begin).toFixed(0)}ms
             tile_x,y=${top_left.x},${top_left.y}
             tiles=${tile_count}
             ways=${total_ways}
             totals=${JSON.stringify(totals)}`
                .split("\n").map(e => e.trim()).join(";"),
            5,
            80,
        );
    }
}

export { CanvasMap }
