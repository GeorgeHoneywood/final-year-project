import { Coord } from '../types'

class Way {
    // the id of the Way in OpenStreetMap. only available if debug info is present
    osm_id: string | null

    path: Coord[]
    // label_position is relative to path[0]
    label_position: Coord | null
    layer: number

    name: string | null
    house_number: string | null
    ref: string | null

    tags: string[] | null

    is_closed: boolean
    is_building: boolean
    is_natural: boolean
    is_water: boolean
    is_grass: boolean

    constructor(
        osm_id: string | null,
        path: Coord[],
        label_position: Coord | null,
        layer: number,
        name: string | null,
        house_number: string | null,
        ref: string | null,
        tags: string[] | null,
    ) {
        this.osm_id = osm_id

        this.path = path
        this.label_position = label_position
        this.layer = layer

        this.name = name
        this.house_number = house_number
        this.ref = ref

        this.tags = tags

        // way is closed if start and end coords are close
        this.is_closed = Math.hypot(
            path[0].x - path[path.length - 1].x,
            path[0].y - path[path.length - 1].y
        ) < 0.000000001

        this.is_building = !!tags?.find((e) => e.startsWith("building"))
        this.is_water = !!tags?.find((e) => e === "natural=water")
        // water is value of natural=, so we don't care about natural if it is already water
        this.is_natural = !this.is_water ? !!tags?.find((e) => e.startsWith("natural")) : false
        this.is_grass = !!tags?.find((e) =>
            e === "landuse=grass"
            || e === "landuse=meadow"
            || e === "landuse=farmland"
            || e === "leisure=golf_course"
        )
    }
}

class PoI {
    // the id of the PoI in OpenStreetMap. only available if debug info is present
    osm_id: string | null

    position: Coord
    layer: number

    name: string | null
    house_number: string | null
    elevation: number | null

    tags: string[] | null

    constructor(
        osm_id: string | null,
        position: Coord,
        layer: number,
        name: string | null,
        house_number: string | null,
        elevation: number | null,
        tags: string[] | null
    ) {
        this.osm_id = osm_id

        this.position = position
        this.layer = layer

        this.name = name
        this.house_number = house_number
        this.elevation = elevation

        this.tags = tags
    }
}

class Tile {
    // the zoom table is relative to the zoom interval's min_zoom
    zoom_table: ZoomTable
    pois: PoI[]
    ways: Way[]

    constructor(zoom_table: ZoomTable, pois: PoI[], ways: Way[]) {
        this.zoom_table = zoom_table
        this.pois = pois
        this.ways = ways
    }
}

type TilePosition = {
    z: number,
    y: number,
    x: number,
}

type ZoomTable = {
    poi_count: number,
    way_count: number
}[]

export { Way, PoI, Tile }
export type { TilePosition, ZoomTable }
