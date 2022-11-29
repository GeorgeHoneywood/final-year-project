# Final Year Project -- Offline HTML5 Maps Application 

This is where I store all the code and reports for my Final Year Project.

All of the reports, if not already compiled to `.pdf`, can be compiled with `latexmk -pdf main.tex` so long as you have a copy of TexLive.

## Repository structure

```
├── diary.md: my project dairy, updated regularly with my progress
├── interim-report
├── plan: the inital plan for the project
├── proof-of-concepts: that I have written throughout the development process
│   ├── 1-offline-html5: a simple demo of offline HTML5 capabilities
│   ├── 2-rendering-a-way: projecting some coordinates to a canvas
│   ├── 3-panning-and-zooming: the same as previous, with also the ability to pan and zoom
│   ├── 4-rendering-osm-data: reading & rendering tiled data from a Mapsforge file
│   └── upload.sh: a helper script to upload demos to my website
├── research-reports: compiled with latexmk
│   ├── 1-offline-html5
│   ├── 2-osm-data-sources
│   ├── 3-map-projections
│   └── 4-html5-canvas
└── sources.bib: shared citations between all reports
```
