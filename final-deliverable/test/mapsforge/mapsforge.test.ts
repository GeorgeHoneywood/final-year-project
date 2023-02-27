import { describe, test, expect } from '@jest/globals';
import fs from "fs/promises"

import { MapsforgeParser } from "@/map/mapsforge/mapsforge"

describe("MapsforgeParser should correctly parse Mapsforge files", () => {
    test('should throw an error for files without magic bytes', async () => {
        const junk_file = new Blob([await fs.readFile("./public/data/random-bytes.map")])

        const parser = new MapsforgeParser(junk_file)

        await expect(parser.readHeader())
            .rejects
            .toThrowError();
    })

    test('should be able to decode header fields', async () => {
        const albania = new Blob([await fs.readFile("./public/data/ferndown.map")])
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
        const ferndown_debug = new Blob([await fs.readFile("./public/data/ferndown-with-debug.map")])

        const p = new MapsforgeParser(ferndown_debug)

        await expect(p.readHeader())
            .resolves
            .toBe(undefined);

        const zoom_level = p.zoom_intervals[p.zoom_interval_count - 1]

        const x = zoom_level.left_tile_x + 1
        const y = zoom_level.top_tile_y
        const tile = await p.readBaseTile({z: zoom_level.base_zoom_level, x, y})

        expect(tile).toBeTruthy()
    })

    test("should be able to load a map tile", async () => {
        const ferndown = new Blob([await fs.readFile("./public/data/ferndown.map")])
        const p = new MapsforgeParser(ferndown)
        await p.readHeader()

        const zoom_level = p.zoom_intervals[p.zoom_interval_count - 1]

        const tile = (await p.readBaseTile({
            z: zoom_level.base_zoom_level,
            x: zoom_level.left_tile_x + 1,
            y: zoom_level.top_tile_y + 1,
         } ))!

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
        const ferndown = new Blob([await fs.readFile("./public/data/ferndown.map")])
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
})
