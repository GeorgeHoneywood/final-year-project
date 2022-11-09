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

### Week 9 (2022-11-14)

### Week 10 (2022-11-21)

### Week 11 (2022-11-28)

### Week 12 (2022-12-05)