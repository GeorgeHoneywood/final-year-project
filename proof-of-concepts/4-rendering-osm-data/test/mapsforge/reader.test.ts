import { describe, test, expect, } from '@jest/globals';

// FIXME: should use a an absolute import here.
// this is nasty
import { Reader } from '../../src/mapsforge/reader'

describe("Reader should be able decode values from the mapsforge file", () => {
    describe.each([
        {
            name: "1 byte",
            value: [0b0111_1111],
            want: 127
        },
        {
            name: "1 byte min",
            value: [0b0000_0001],
            want: 1
        },
        {
            name: "2 byte min",
            value: [0b1000_0000, 0b0000_0001],
            want: 128
        },
        {
            name: "2 byte max",
            value: [0b1111_1111, 0b0111_1111],
            want: (2 ** ((7 + 8) - 1)) - 1
        },
        {
            name: "3 byte min",
            value: [0b1000_0000, 0b1000_0000, 0b0000_0001],
            want: (2 ** ((7 + 8) - 1))
        },
        {
            name: "3 byte max",
            value: [0b1111_1111, 0b1111_1111, 0b0111_1111],
            want: (2 ** ((7 + 7 + 8) - 1)) - 1
        },
        {
            name: "4 byte min",
            value: [0b1000_0000, 0b1000_0000, 0b1000_0000, 0b0000_0001],
            want: (2 ** ((7 + 7 + 8) - 1))
        },
    ])("should be able to decode unsigned variable length ints", ({ name, value, want }) => {
        test(`${name}: [${value.map(n => n.toString(2).padStart(8, "0"))}].getVUint()} == ${want}`, () => {
            let reader = new Reader(
                new Uint8ClampedArray(
                    value
                ).buffer
            )

            expect(reader.getVUint()).toBe(want)
        })
    })

    describe.each([
        {
            name: "1 byte max negative",
            value: [0b0111_1111],
            want: -63
        },
        {
            name: "1 byte max positve",
            value: [0b0011_1111],
            want: 63
        },
        {
            name: "2 byte min",
            value: [0b1000_0000, 0b0000_0001],
            want: 128
        },
        {
            name: "2 byte max",
            value: [0b1111_1111, 0b0111_1111],
            want: -(2 ** (7 + 6)) + 1
        },
        {
            name: "3 byte min",
            value: [0b1000_0000, 0b1000_0000, 0b0100_0001],
            want: -(2 ** (7 + 7))
        },
        {
            name: "3 byte max",
            value: [0b1111_1111, 0b1111_1111, 0b0111_1111],
            want: -((2 ** (7 + 7 + 6)) - 1)
        },
        {
            name: "4 byte min",
            value: [0b1000_0000, 0b1000_0000, 0b1000_0000, 0b0000_0001],
            want: (2 ** ((7 + 7 + 7 + 1) - 1))
        },
    ])("should be able to decode signed variable ints", ({ name, value, want }) => {
        test(`${name}: [${value.map(n => n.toString(2).padStart(8, "0"))}].getVSint()} == ${want}`, () => {
            let reader = new Reader(
                new Uint8ClampedArray(
                    value
                ).buffer
            )

            expect(reader.getVSint()).toBe(want)
        })
    })
});
