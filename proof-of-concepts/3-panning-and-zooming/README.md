This proof of concept will take some geojson data, and will render it to the display. You will then be able to pan/zoom the view.

The test data file, `data/world-and-ferndown.geojson` is a GeoJSON file, containing buildings in Ferndown, and rough boundaries of world countries.

Run the demo by running `tsc` and then `python -m http.server` in this directory, and visiting [localhost:8000](http://localhost:8000)

Map data © [OpenStreetMap Contributors (ODbL)](https://www.openstreetmap.org/copyright) and [Natural Earth (public domain)](https://www.naturalearthdata.com/about/terms-of-use/). Natural Earth used for country outlines.
