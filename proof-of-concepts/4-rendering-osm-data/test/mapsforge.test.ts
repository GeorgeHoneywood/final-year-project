import { MapsforgeParser } from "../src/mapsforge"
import { describe, test, expect } from '@jest/globals';
import fs from "fs/promises"

describe("MapsforgeParser should correctly parse Mapsforge files", () => {
    test('should throw an error for files without magic bytes', async () => {
        const junk_file = new Blob([await fs.readFile("./data/random-bytes.map")])

        const parser = new MapsforgeParser(junk_file)

        await expect(parser.readHeader())
            .rejects
            .toThrowError();
    })

    test('should be able to decode header fields', async () => {
        const albania = new Blob([await fs.readFile("./data/albania.map")])
        const p = new MapsforgeParser(albania)
        await p.readHeader()

        expect(p.comment)
            .toBe("Map data (c) OpenStreetMap contributors");

        expect(p.version)
            .toBe(5);

        expect(p.file_size)
            .toBe(31098060n)

        expect(p.creation_date.toISOString())
            .toBe("2022-10-14T05:56:20.006Z")

        for (const val in [
            p.bbox.min_lat,
            p.bbox.min_long,
            p.bbox.max_lat,
            p.bbox.max_long,
        ]) {
            expect(val).toBeTruthy()
        }
    })

    test("should be able to load a map tile", async () => {
        const albania = new Blob([await fs.readFile("./data/ferndown.map")])
        const p = new MapsforgeParser(albania)
        await p.readHeader()
        console.log(p.zoom_intervals)

        const zoom_level = p.zoom_intervals[p.zoom_interval_count-1]
       
        const tile = await p.readTile(zoom_level.base_zoom_level, zoom_level.top_tile_y,  zoom_level.top_tile_y)

        expect(tile).toBeTruthy()
    })
});