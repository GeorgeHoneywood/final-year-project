type Coord = { x: number, y: number };

type BBox = {
    bottom_left: Coord,
    top_right: Coord,
    bottom_right: Coord,
    top_left: Coord,
    centre: Coord,
}

type ByteRange = {
    start: bigint,
    end: bigint,
}

export type { Coord, BBox, ByteRange };
