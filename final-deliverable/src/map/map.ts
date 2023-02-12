import { coordZToXYZ, projectMercator, unprojectMercator } from "./geom.js";
import type { MapsforgeParser } from "./mapsforge/mapsforge.js";
import type { PoI, Tile, TilePosition } from "./mapsforge/objects.js";
import type { BBox, Coord } from "./types.js";

class CanvasMap {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;

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

    private user_position: GeolocationCoordinates | null = null

    /**
     * Create a map, linked to a canvas, to show tiles from the parser.
     *
     * @param canvas to render the map to
     * @param parser to show on the map
     */
    public constructor(canvas: HTMLCanvasElement, parser: MapsforgeParser) {
        this.canvas = canvas;
        this.gl = this.canvas.getContext("webgl2")!;

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

        this.setViewport({ x, y }, zoom_level)

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

        // note: following tutorial at https://webgl2fundamentals.org/webgl/lessons/webgl-fundamentals.html

        var vertexShaderSource = `#version 300 es
     
        // an attribute is an input (in) to a vertex shader.
        // It will receive data from a buffer
        in vec2 a_position;

        uniform vec2 u_resolution;
         
        // all shaders have a main function
        void main() {
            // convert the position from pixels to 0.0 to 1.0
            vec2 zeroToOne = a_position / u_resolution;
         
            // convert from 0->1 to 0->2
            vec2 zeroToTwo = zeroToOne * 2.0;
         
            // convert from 0->2 to -1->+1 (clip space)
            vec2 clipSpace = zeroToTwo - 1.0;
         
            gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        }
        `;

        var fragmentShaderSource = `#version 300 es
         
        // fragment shaders don't have a default precision so we need
        // to pick one. highp is a good default. It means "high precision"
        precision highp float;

        uniform vec4 u_color;
         
        // we need to declare an output for the fragment shader
        out vec4 outColor;
         
        void main() {
          // Just set the output to a constant reddish-purple
          outColor = u_color;
        }
        `;

        var vertexShader = this.createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource);
        var fragmentShader = this.createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource);

        var program = this.createProgram(this.gl, vertexShader, fragmentShader);
        var positionAttributeLocation = this.gl.getAttribLocation(program, "a_position");
        var resolutionUniformLocation = this.gl.getUniformLocation(program, "u_resolution");
        var colorLocation = this.gl.getUniformLocation(program, "u_color");

        var positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

        // three 2d points
        var positions = [
            10, 20,
            140, 20,
            10, 120,
            10, 120,
            140, 20,
            140, 120,
        ];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

        var vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(vao);
        this.gl.enableVertexAttribArray(positionAttributeLocation);

        var size = 2;          // 2 components per iteration
        var type = this.gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        this.gl.vertexAttribPointer(
            positionAttributeLocation, size, type, normalize, stride, offset)

        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

        // clear canvas
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        this.gl.useProgram(program);

        this.gl.bindVertexArray(vao);

        this.gl.uniform2f(resolutionUniformLocation, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.uniform4f(colorLocation, Math.random(), Math.random(), Math.random(), 1);
        

        var primitiveType = this.gl.TRIANGLES;
        var offset = 0;
        var count = 6;
        this.gl.drawArrays(primitiveType, offset, count);

        // requestAnimationFrame(() => this.render()); // ensure that this==this
    }

    private createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (success) {
            return shader;
        }

        console.log(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }

    createProgram(gl, vertexShader, fragmentShader) {
        var program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        var success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (success) {
            return program;
        }

        console.log(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    private setCanvasSize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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
     * Set the viewport of the map to be centred at this wgs84 position, at
     * the chosen zoom level
     * @param {x: number, y: number} wgs84 coord to centre on
     * @param zoom level desired
     */
    public setViewport({ x, y }: Coord, zoom: number) {
        // transform the wgs84 coord into mercator space
        const mercator = projectMercator({ x, y });

        this.zoom_level = zoom;
        const scale = Math.pow(2, this.zoom_level);

        // centre on the user position
        this.x_offset = -(mercator.x * scale) + this.canvas.width / 2;
        this.y_offset = -(mercator.y * scale) + this.canvas.height / 2;

        this.dirty = true;
    }

    public getViewport(): BBox {
        const scale = Math.pow(2, this.zoom_level);

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
        this.gl.fillStyle = "#f2efe9"
        this.gl.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // convert zoom level (1-18) into useful scale
        const scale = Math.pow(2, this.zoom_level);

        const top_left_coord = unprojectMercator({
            y: (this.gl.canvas.height - this.y_offset) / scale,
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
            x: ((this.gl.canvas.width - this.x_offset) / scale),
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
                    this.gl.beginPath();
                    for (const { x, y } of path) {
                        this.gl.lineTo(
                            x * scale + this.x_offset,
                            this.canvas.height - (y * scale + this.y_offset), // as we are drawing from 0,0 being the top left, we must flip the y-axis
                        );
                    }
                    // feature styles
                    if (way.is_closed && way.is_building) {
                        this.gl.fillStyle = "#edc88e"
                        this.gl.fill()
                        totals['building']++
                    } else if (way.is_closed && way.is_natural) {
                        this.gl.fillStyle = "#3f7a3f"
                        this.gl.fill()
                        totals['natural']++
                    } else if (way.is_closed && way.is_water) {
                        this.gl.fillStyle = "#53b9ef"
                        this.gl.fill()
                        totals['water']++
                    } else if (way.is_closed && way.is_beach) {
                        this.gl.fillStyle = "#f9e0bb"
                        this.gl.fill()
                        totals['beach']++
                    } else if (way.is_closed && way.is_grass) {
                        this.gl.fillStyle = "#8dc98d"
                        this.gl.fill()
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
                            this.gl.fillStyle = "#f9c1bb"
                            this.gl.fill()
                            totals['path']++
                        }
                    } else if (way.is_closed && way.is_road) {
                        // road areas
                        // FIXME: need to stroke the road if not an area
                        if (way.tags?.find((e) => e === "area=yes")) {
                            this.gl.fillStyle = "#7a7979"
                            this.gl.fill()
                            totals['road']++
                        }
                    } else if (way.is_road) {
                        this.gl.strokeStyle = "#7a7979"
                        let scale = 1

                        if (way.tags?.find((e) =>
                            e.startsWith("highway=motorway")
                            || e.startsWith("highway=trunk")
                        )) {
                            // major roads in orange
                            this.gl.strokeStyle = "#fcba64"

                            // major roads should be twice as thick as normal roads
                            scale = 2
                        }

                        if (this.zoom_level < 15) {
                            this.gl.lineWidth = 2 * scale
                        } else if (this.zoom_level < 17) {
                            this.gl.lineWidth = 4 * scale
                        } else {
                            this.gl.lineWidth = 6 * scale
                        }
                        totals['road']++
                        this.gl.stroke()
                    } else if (way.is_path) {
                        this.gl.strokeStyle = "#f9897c"
                        if (this.zoom_level < 15) {
                            this.gl.lineWidth = 2
                        } else if (this.zoom_level < 17) {
                            this.gl.lineWidth = 4
                        } else {
                            this.gl.lineWidth = 6
                        }
                        totals['path']++
                        this.gl.stroke()
                    } else if (way.is_railway) {
                        this.gl.lineWidth = 6
                        this.gl.strokeStyle = "#ed5c4b"
                        this.gl.stroke()
                        totals['railway']++
                    } else if (way.is_coastline) {
                        this.gl.strokeStyle = "black"
                        this.gl.lineWidth = 1
                        totals['coastline']++
                        this.gl.stroke()
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
                    this.gl.font = '15px sans-serif';

                    const label = way.name ?? way.house_number ?? ""
                    const size = this.gl.measureText(label)

                    this.gl.fillStyle = "black"
                    this.gl.fillText(
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
                    this.gl.lineWidth = 2
                    this.gl.strokeStyle = 'black';
                    // little box over the PoI, then label next to
                    this.gl.strokeRect(
                        x * scale + this.x_offset - 5,
                        this.canvas.height - (y * scale + this.y_offset) - 5, // as we are drawing from 0,0 being the top left, we must flip the y-axis
                        10,
                        10,
                    );
                    this.drawStokedText(poi, { x, y }, scale);
                } else {
                    this.gl.font = '15px sans-serif';

                    const label = poi.name ?? poi.house_number ?? ""
                    const size = this.gl.measureText(label)

                    this.gl.fillStyle = "black"
                    this.gl.fillText(
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

            this.gl.stroke();
        }

        // draw the user's position
        this.drawUserPosition(scale);

        // this.drawDebugInfo(begin, scale, top_left, required_tiles.length, total_ways, totals);

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

            this.gl.lineWidth = 2;
            this.gl.strokeStyle = "red";
            this.gl.strokeRect(
                x * scale + this.x_offset - 10,
                this.canvas.height - (y * scale + this.y_offset) - 10,
                20,
                20
            );
        }
    }

    private drawStokedText(poi: PoI, proj: { x: number; y: number; }, scale: number) {
        this.gl.strokeStyle = 'black';
        this.gl.font = '20px sans-serif';
        this.gl.lineWidth = 4;

        const label = poi.name ?? poi.house_number ?? poi.tags?.join(",") ?? ""
        this.gl.strokeText(
            label,
            proj.x * scale + this.x_offset + 10,
            this.canvas.height - (proj.y * scale + this.y_offset) + 5
        );

        this.gl.fillStyle = 'white';
        this.gl.fillText(
            label,
            proj.x * scale + this.x_offset + 10,
            this.canvas.height - (proj.y * scale + this.y_offset) + 5
        );
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

        this.gl.font = "15px sans-serif";
        this.gl.fillStyle = 'black';
        this.gl.fillText(
            `z${this.zoom_level.toFixed(1)},
             frame_time=${(performance.now() - begin).toFixed(0)}ms,
             tile_x,y=${top_left.x},${top_left.y},
             tile_count=${tile_count},
             total_ways=${total_ways},
             totals=${JSON.stringify(totals)}`
                .split("\n").map(e => e.trim()).join(" "),
            5,
            15,
        );
    }
}

export { CanvasMap }
