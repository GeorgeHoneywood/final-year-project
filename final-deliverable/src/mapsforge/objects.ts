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

    is_coastline: boolean
    is_building: boolean
    is_water: boolean
    is_beach: boolean
    is_natural: boolean
    is_grass: boolean
    is_residential: boolean
    is_road: boolean
    is_path: boolean

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

        this.is_coastline = !!tags?.find((e) => e == "natural=coastline")

        this.is_beach = !!tags?.find((e) => e === "natural=beach")
        this.is_water = !!tags?.find((e) => e === "natural=water")

        // water is value of natural=, so we don't care about natural if it is
        // already water
        // FIXME: using all natural values like this isn't a good idea, too wide
        // of a net
        this.is_natural = !this.is_water && !this.is_beach ? !!tags?.find((e) =>
            e.startsWith("natural")
            || e === "landuse=forest"
        ) : false

        this.is_grass = !!tags?.find((e) =>
            e === "landuse=grass"
            || e === "landuse=meadow"
            || e === "landuse=farmland"
            || e === "leisure=golf_course"
            || e === "leisure=park"
            || e === "landuse=recreation_ground"
        )

        this.is_residential = !!tags?.find((e) => e === "landuse=residential")

        // using startsWith catches the "highway=X_link" cases
        this.is_road = !!tags?.find((e) =>
            e.startsWith("highway=motorway")
            || e.startsWith("highway=trunk")
            || e.startsWith("highway=primary")
            || e.startsWith("highway=secondary")
            || e.startsWith("highway=tertiary")
            || e === "highway=unclassified"
            || e === "highway=residential"
            || e === "highway=service"
            || e === "highway=living_street"
        )

        this.is_path = !!tags?.find((e) =>
            e === "highway=footway"
            || e === "highway=cycleway"
            || e === "highway=bridleway"
            || e === "highway=steps"
            || e === "highway=path"
            || e === "highway=track"
            || e === "highway=pedestrian"
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