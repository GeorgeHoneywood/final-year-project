import { describe, test, expect, } from '@jest/globals';

import { byteRangeToContiguous } from "@/map/mapsforge/util"

describe("byteRangeToContiguous should join together touching byte ranges", () => {
    describe.each([
        {
            name: "no change",
            value: [{start: 0n, end: 1n}],
            want: [{start: 0n, end: 1n}]
        },
        {
            name: "2 touching",
            value: [{start: 0n, end: 4n}, {start: 5n, end: 8n}],
            want: [{start: 0n, end: 8n}]
        },
        {
            name: "3 touching",
            value: [{start: 0n, end: 4n}, {start: 5n, end: 8n}, {start: 9n, end: 12n}],
            want: [{start: 0n, end: 12n}]
        },
        {
            name: "3 with gap",
            value: [{start: 0n, end: 4n}, {start: 5n, end: 8n}, {start: 12n, end: 16n}],
            want: [{start: 0n,  end: 8n}, {start: 12n, end: 16n}]
        },
    ])("should be able to decode unsigned variable length ints", ({ name, value, want }) => {
        test(`${name}`, () => {
            const got = byteRangeToContiguous(value)
            expect(got).toStrictEqual(want)
        })
    })
})
