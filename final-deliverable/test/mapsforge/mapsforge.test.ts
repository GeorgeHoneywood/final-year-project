import { describe, test, expect } from '@jest/globals';
import fs from "fs/promises"
import { join } from "path"

import { MapsforgeParser } from "@/map/mapsforge/mapsforge"

const getPath = (path: string) => {
    return join(__dirname, "files", path)
}

describe("MapsforgeParser should correctly parse Mapsforge files", () => {
    test('should throw an error for files without magic bytes', async () => {
        const junk_file = new Blob([await fs.readFile(getPath("random-bytes.map"))])

        const parser = new MapsforgeParser(junk_file)

        await expect(parser.readHeader())
            .rejects
            .toThrowError();
    })

    test('should be able to decode header fields', async () => {
        const albania = new Blob([await fs.readFile(getPath("ferndown.map"))])
        const p = new MapsforgeParser(albania)
        await p.readHeader()

        expect(p.comment).toBe(null);

        expect(p.version).toBe(3);

        expect(p.file_size).toBe(873064n)

        expect(p.creation_date.toISOString()).toBe("2022-11-09T23:26:57.207Z")

        for (const val in [
            p.bbox.min_lat,
            p.bbox.min_long,
            p.bbox.max_lat,
            p.bbox.max_long,
        ]) {
            expect(val).toBeTruthy()
        }

        expect(p.tile_size).toBe(256)

        expect(p.projection).toBe("Mercator")

        expect(p.flags.has_debug_info).toBe(false)
        expect(p.flags.has_map_start_position).toBe(false)
        expect(p.flags.has_start_zoom_level).toBe(false)
        expect(p.flags.has_language_preference).toBe(false)
        expect(p.flags.has_comment).toBe(false)
        expect(p.flags.has_created_by).toBe(true)

        // toBeClose to for floating point numbers
        // expect(p.map_start_location?.lat).toBeCloseTo(41.145255)
        // expect(p.map_start_location?.long).toBeCloseTo(19.979665)
        // expect(p.map_start_location?.zoom).toBe(8)

        // expect(p.language_preference).toBe("en,de,fr,es")

        // expect(p.comment).toBe("Map data (c) OpenStreetMap contributors")

        expect(p.created_by).toBe("mapsforge-map-writer-0.18.0")

        expect(p.poi_tag_count).toBe(41)
        expect(p.poi_tags.length).toBe(41)

        expect(p.way_tag_count).toBe(124)
        expect(p.way_tags.length).toBe(124)

        expect(p.zoom_interval_count).toBe(3)
        expect(p.zoom_intervals.length).toBe(3)

        const z0 = p.zoom_intervals[0]
        expect(z0.min_zoom_level).toBe(0)
        expect(z0.base_zoom_level).toBe(5)
        expect(z0.max_zoom_level).toBe(7)
        expect(z0.sub_file_start_position).toBe(2956n)
        expect(z0.sub_file_length).toBe(5060n)
        expect(z0.tile_total).toBe(1)
        // checked these z/x/y values against openstreetmap.org
        // see https://tile.openstreetmap.org/5/17/11.png for the top tile
        // and https://tile.openstreetmap.org/5/17/12.png for the bottom tile
        expect(z0.top_tile_y).toBe(10)
        expect(z0.bottom_tile_y).toBe(10)
    })

    test('should be able to read a file with debug info', async () => {
        const ferndown_debug = new Blob([await fs.readFile(getPath("ferndown-with-debug.map"))])

        const p = new MapsforgeParser(ferndown_debug)

        await expect(p.readHeader())
            .resolves
            .toBe(undefined);

        const zoom_level = p.zoom_intervals.at(-1)

        const x = zoom_level.left_tile_x + 1
        const y = zoom_level.top_tile_y
        const tile = await p.readBaseTile({ z: zoom_level.base_zoom_level, x, y })

        expect(tile).toBeTruthy()
    })

    test("should be able to load a map tile", async () => {
        const ferndown = new Blob([await fs.readFile(getPath("ferndown.map"))])
        const p = new MapsforgeParser(ferndown)
        await p.readHeader()

        const zoom_level = p.zoom_intervals.at(-1)

        const tile = (await p.readBaseTile({
            z: zoom_level.base_zoom_level,
            x: zoom_level.left_tile_x + 1,
            y: zoom_level.top_tile_y + 1,
        }))!

        expect(tile).toBeTruthy()

        expect(tile.pois.length).toBe(36)
        expect(tile.ways.length).toBe(410);

        const poi = tile.pois[2]!
        expect(poi.name).toBe("Old Forge Road")
        expect(poi.tags).toStrictEqual(["highway=bus_stop"])
        expect(poi.position.x).toBeCloseTo(-1.91829175)
        expect(poi.position.y).toBeCloseTo(59.17312685)

        const way = tile.ways[40]
        expect(way.name).toBe("Haviland Road")
        expect(way.tags).toStrictEqual(["highway=unclassified"])
        expect(way.is_closed).toBe(false)

        const first = way.paths[0][0];
        expect(first.x).toBeCloseTo(-1.91370475)
        expect(first.y).toBeCloseTo(59.17816229)
        const last = way.paths[0][11];
        expect(last.x).toBeCloseTo(-1.91624574, 7)
        expect(last.y).toBeCloseTo(59.18165976, 7)
    })

    test("should return the base zoom level for some zoom", async () => {
        const ferndown = new Blob([await fs.readFile(getPath("ferndown.map"))])
        const p = new MapsforgeParser(ferndown)
        await p.readHeader()

        for (let z = 0; z < 21; z++) {
            const zoom = p.getBaseZoom(z)

            if (z <= 7) {
                expect(zoom.base_zoom_level).toBe(5)
            } else if (z <= 11) {
                expect(zoom.base_zoom_level).toBe(10)
            } else {
                expect(zoom.base_zoom_level).toBe(14)
            }
        }
    })

    test("should be able to read map start positions", async () => {
        const egham = new Blob([await fs.readFile(getPath("egham-v5-with-start-pos.map"))])
        const p = new MapsforgeParser(egham)
        await p.readHeader()

        expect(p.map_start_location.lat).toBeCloseTo(51.4294)
        expect(p.map_start_location.long).toBeCloseTo(-0.547)
        expect(p.map_start_location.zoom).toBeCloseTo(21)
    })

    test("should be able to parse v5 files", async () => {
        const egham = new Blob([await fs.readFile(getPath("egham-v5-with-start-pos.map"))])
        const p = new MapsforgeParser(egham)
        await p.readHeader()

        const tile = await p.readBaseTile({ z: 14, x: 8167, y: 5453 })
        expect(tile).toBeTruthy()

        expect(tile.ways.length).toBe(1806)
        expect(tile.pois.length).toBe(192)
    })

    test("should return a null tile when reading outside map file bbox", async () => {
        const egham = new Blob([await fs.readFile(getPath("egham-v5-with-start-pos.map"))])
        const p = new MapsforgeParser(egham)
        await p.readHeader()

        const zoom_level = p.zoom_intervals.at(-1)

        const tile = await p.readBaseTile({
            z: zoom_level.base_zoom_level,
            x: zoom_level.right_tile_x + 1,
            y: zoom_level.top_tile_y + 1,
        })
        expect(tile).toBeNull()
    })

    test('should be able to read the last tile from a subfile', async () => {
        // file without debug info
        let ferndown = new Blob([await fs.readFile(getPath("ferndown.map"))])

        let p = new MapsforgeParser(ferndown)
        await expect(p.readHeader())
            .resolves
            .toBe(undefined);

        let zoom_level = p.zoom_intervals.at(-1)

        let x = zoom_level.right_tile_x
        let y = zoom_level.bottom_tile_y
        let tile = await p.readBaseTile({ z: zoom_level.base_zoom_level, x, y })
        expect(tile).toBeTruthy()

        // file with debug info
        ferndown = new Blob([await fs.readFile(getPath("ferndown-with-debug.map"))])

        p = new MapsforgeParser(ferndown)
        await expect(p.readHeader())
            .resolves
            .toBe(undefined);

        zoom_level = p.zoom_intervals.at(-1)

        x = zoom_level.right_tile_x
        y = zoom_level.bottom_tile_y
        tile = await p.readBaseTile({ z: zoom_level.base_zoom_level, x, y })

        expect(tile).toBeTruthy()
    })

    test('fetchBaseTileRange should fetch the correct byte ranges', async () => {

        const fetchBytesMock = jest.spyOn(MapsforgeParser.prototype as any, 'fetchBytes') // any cast to access private method

        let ferndown = new Blob([await fs.readFile(getPath("ferndown.map"))])

        let p = new MapsforgeParser(ferndown)
        await expect(p.readHeader())
            .resolves
            .toBe(undefined);

        let zoom_level = p.zoom_intervals.at(-1)

        let x = zoom_level.left_tile_x + 1
        let y = zoom_level.top_tile_y + 1
        let z = zoom_level.base_zoom_level

        // load a square of 4 tiles, 2x2 
        await expect (p.fetchBaseTileRange([
            { z, x, y },
            { z, x: x + 1, y },
            { z, x, y: y + 1 },
            { z, x: x + 1, y: y + 1 },
        ])).resolves.toBe(undefined)

        // final calls to fetchBytes should be 2 byte ranges, one for the bytes
        // for the first row of tiles, and one for the second row
        expect(fetchBytesMock.mock.calls.at(-2)).toStrictEqual(
            [135608, 222458]
        )
        expect(fetchBytesMock.mock.calls.at(-1)).toStrictEqual(
            [332039, 438949]
        )

        fetchBytesMock.mockRestore();
    })
})
