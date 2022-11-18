
import { Coord } from '../types'

class Way {
    // the id of the Way in OpenStreetMap. only available if debug info is present
    osm_id: string | null

    path: Coord[]
    label_position: Coord | null
    layer: number

    name: string | null
    house_number: string | null
    ref: string | null

    tags: string[] | null

    constructor(
        osm_id: string | null,
        path: Coord[],
        label_position: Coord | null,
        layer: number,
        name: string | null,
        house_number: string | null,
        ref: string | null,
        tags: string[] | null
    ) {
        this.osm_id = osm_id

        this.path = path
        this.label_position = label_position
        this.layer = layer

        this.name = name
        this.house_number = house_number
        this.ref = ref

        this.tags = tags
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

export { Way, PoI }
