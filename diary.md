# Final Year Project Diary

## Term 1

### Week 2 (2022-09-26)

Worked on the initial project plan. Read through "OpenStreetMap -- Using and Enhancing the Free Map of the World".

### Week 3 (2022-10-03)

Got feedback on initial plan from my supervisor (Reuben Rowe), and made alterations based on it. Specifically, I shorted the abstract by moving content to an introduction section, wrote a general "Aims & objectives" section, and added a "Deliverables" section, referencing these deliverables in the timeline. I also polished the "Risks & mitigations" section, and changed inline links to references.

### Week 4 (2022-10-10)

Worked on the first report, about offline HTML5 applications (deliverable 1).

### Week 5 (2022-10-17)

Worked on the offline HTML5 proof of concept (deliverable 2). Implemented a demo offline app using service workers, with the ability to load a large file either from the local disk using the File API, or from the service worker cache with the Cache API.

Completed report on OpenStreetMap data sources (deliverable 3). Completed report on map projections (deliverable 4).

### Week 6 (2022-10-24)

Implemented the proof of concept that renders some array of wgs84 coordinates to a Mercator projected map (deliverable 5, proof-of-concepts/2-rendering-a-way). Allows you to render the boundaries of three different towns -- with manually chosen zoom factor.

Started a report on the HTML5 canvas.

Started work on the panning and zooming proof of concept (deliverable 6, proof-of-concepts/3-panning-and-zooming). Got WASD panning, and scrollwheel zoom working.

### Week 7 (2022-10-31)

Continued work on the panning and zooming proof of concept. Implemented click panning and touch controls: pinch zoom & single finger panning. Also made zooming work around the mouse/pinch gesture instead of the centre of the screen.

Made the map linkable, i.e. you can send a link to a position on the map. This is done by writing the current map centre position and zoom level to the end of the URL.

Add esbuild (JavaScript bundler). This means I can write JavaScript in multiple files, but have them merged together be served to the user. I can also use newer JavaScript features, and have them transpiled into older syntax.

### Week 8 (2022-11-07)

Began work on the Mapsforge file parser. Added testing using Jest to help develop the Mapsforge parser. Finished decoding the file header, which contains metadata and other information needed to parse the rest of the file.

### Week 9 (2022-11-14)

More Mapsforge parser work. Specifically decoding the tile data itself. First reading PoIs from the file, then Ways. Used the Mapsforge map file creator to generate map files with debug information, to make writing the parser easier. Created a `Reader` abstraction over the JavaScript `DataView` API, storing and updating the offset that the data is being read from, making the code much cleaner.

Got a single tile of data to appear in the canvas map, but there is some issue with the transformation of the coordinate data.

### Week 10 (2022-11-21)

Worked on the interim report in preparation for supervisor meeting, then for the interim submission. Fixed a tricky bug that was a result of an incorrect interpretation of the signed integer values. This was discovered and fixed by writing some tests that I should have written in the first place.

Got multiple tiles to appear on the map, being loaded dynamically as you pan and zoom. Currently always loads the high resolution subfile, at z14, so zooming out quickly becomes slow. Fixing this is my next goal.

### Week 11 (2022-11-28)

Worked on getting the correct base tiles to render as you zoom in/out, significantly improving performance, and letting you get a high level overview of the map.

Added styling for Ways and PoIs, with some zoom-conditional rendering logic. Continuing with the interim report.

### Week 12 (2022-12-05)

Improved multipolygon handling, rendering each ring separately. Still not perfect, as it currently in-fills everything inside the outer way, when it should only fill up to the inner ways.

Worked on handling v5 files. These have variable tag values, so data other than the hardcoded tags supported by the format can be stored.

Added an online mode, where instead of fetching the whole map blob in one go, we fetch only the chunks we need, using HTTP range requests. This allows you to interactively use huge map files, like the whole of England (~800 MB), as it only fetches the necessary bits of the file for your current viewport.

## Term 2

### Week 18 (2023-01-16)

Added geolocation support, using `geolocation.watchPosition()`, which updates with your position. Also added double tap + hold gesture for zooming with a single finger on mobile.

Worked on the professional issues' section of the report, talking about accessibility.

### Week 19 (2023-01-23)

Finished off the professional issues section. Talked about visual impairments and physical disabilities, and how they impact usage of an OSM-based map. Also discussed how mappers can help make OSM accessible by using certain tags, like `wheelchair=*` or `smoothness=*`. Debating writing a conclusion paragraph for it.

Worked on map fling --- where map continues to scroll after fast movement. Only for mouse controls at the moment.

Started work on search (geocoding), using the Nominatim API hosted by the OSMF. Improved styling, by making the canvas fullscreen, and overlaying the title atop it.

### Week 20 (2023-01-30)

Added the ability to bind the search to the current map viewport. Made search results show up beneath the search bar, where you can click them to pan the map to the location.

UI improvements. Made search bar responsive, and always visible. Replaced text with icons where possible. 

### Week 21 (2023-02-06)

Big refactor to use Svelte front-end framework. This made all the UI code much cleaner, with no more passing DOM references through the JavaScript code. Now there is a big `Map.svelte` component, which holds all the Touch/Mouse/Keyboard event handlers. Also allowed me to scope the CSS to each component, instead of having a single massive chunk of CSS in `index.html`.

Using a proper UI framework made it much easier to make the search form reactive. Worked on making it resettable. Also added a nice dropdown animation for when the results pop in. 

### Week 22 (2023-02-13)

### Week 23 (2023-02-20)

### Week 24 (2023-02-27)

### Week 25 (2023-03-06)

### Week 26 (2023-03-13)

### Week 27 (2023-03-20)
