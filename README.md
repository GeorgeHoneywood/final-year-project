# OSMO: Offline viewer for Mapsforge map files

OSMO renders map files stored in the popular Mapsforge format, allowing for the (slow) the display of entire countries. Some other key features:

* Partial offline downloads
* Geolocation
* Search (using Nominatim API)
* Render local map files

A fairly novel feature is the usage of HTTP range requests to load the specific bytes required to render the map. This means that no app specific server is required — a generic web server like Apache or nginx can be used. This was inspired by the [Protomaps project](https://protomaps.com/), which uses a purpose built map format designed around this concept.

The Service Worker cache is used to store the fetched byte ranges, so that portions of the whole map file can be downloaded in advance and rendered offline.

You can find an online demo at [files.george.honeywood.org.uk/final-deliverable/](https://files.george.honeywood.org.uk/final-deliverable/#18/51.4273/-0.5543), where you can scroll about and search within the UK.

Technology wise, OSMO is fairly simple, with the renderer using the HTML5 canvas, and the bulk of the code being written in TypeScript. The frontend code is written in Svelte, with Vite as a bundler/transpiler.

You can read the report associated with this project [here](https://github.com/GeorgeHoneywood/final-year-project/files/11584765/george-honeywood-final-report.pdf). OSMO was developed as my Final Year Project, at Royal Holloway, University of London, supervised by Dr. Reuben Rowe.
