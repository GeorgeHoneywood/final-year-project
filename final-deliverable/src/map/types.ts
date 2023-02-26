type Coord = { x: number, y: number };

type BBox = {
    bottom_left: Coord,
    top_right: Coord,
    bottom_right: Coord,
    top_left: Coord,
    centre: Coord,
}

export type { Coord, BBox };
