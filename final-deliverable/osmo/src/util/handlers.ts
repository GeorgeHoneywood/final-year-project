import type { CanvasMap } from "./map.js";
import { search } from "./search.js";

/**
 * registers event handlers, that allow the user to control the CanasMap
 * @param map 
 * @param canvas 
 * @param geolocate_button 
 */
function registerEventHandlers(
    map: CanvasMap,

) {
    // search bits
    // FIXME: should either pass all these references in, or none of them...
    const search_results = document.querySelector(".search-results")
    const search_input = document.querySelector("#search-form input[name=query]") as HTMLInputElement
    const search_button = document.getElementById("search-button") as HTMLButtonElement
    console.log(search_input, search_button)
    if (!search_results || !search_button) {
        console.log("required element not found!")
        return


        async function doSearch() {
            if (!search_results) {
                console.log("required element not found 2!")
                return
            }

            const results = await search(search_input.value, map.getViewport())

            let output = ``

            for (const res of results) {
                const valid = map.withinMapExtent({
                    x: +res.lon, y: +res.lat
                })

                output += `
            <div 
                class="search-result ${!valid ? `invalid-result` : ``}"
                data-coordinate="${res.lon}, ${res.lat}"
            >
                ${res.display_name}
            </div>`
            }

            search_results.innerHTML = output
        }

        search_results.addEventListener("click", (e) => {
            if (!e.target || !(e.target as HTMLElement).classList.contains("search-result")) {
                return
            }

            const [x, y] = (e.target as HTMLElement)
                .dataset["coordinate"]!
                .split(",")

            map.setViewport({
                x: +x,
                y: +y,
            }, 16)
        })

        search_input.addEventListener("keydown", (e) => {
            if (e.key == "Enter") {
                e.preventDefault()
                doSearch()
            }
        })

        search_button.addEventListener("click", (e) => {
            e.preventDefault()
            doSearch()
        })

    }

    export { registerEventHandlers }
