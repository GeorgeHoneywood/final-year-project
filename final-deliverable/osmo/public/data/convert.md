# How to convert a `.pbf` data file to a Mapforge binary map file (with debug info)

To run this you will need a copy of Osmosis, with the Mapsforge Map Writer plugin installed. See [here](https://github.com/mapsforge/mapsforge/blob/master/docs/Getting-Started-Map-Writer.md#plugin-installation) for installation instructions.

```bash
./bin/osmosis --rb file=[...].osm.pbf --mapfile-writer file=[...].map debug-file=true commment="some comment"
```

To get some data to convert, you can download a `.pbf` file from the [Geofabrik Downloads](https://download.geofabrik.de/) service. In the UK, the smallest files you can download are county size extracts. If you need a smaller file, you can further extract using Osmium or Osmosis. You can also download a `.pbf` map extract using the online [BBBike extract tool](https://extract.bbbike.org/), of the area you want to convert to Mapsforge format.

You can also use this service to directly download a Mapsforge map, but unfortunately it does not allow you to download a file with debug information enabled. Hence, you have to create the map file yourself if you want to be able to use the debug information.


More zoom intervals == better rendering performance && larger map file
```bash
./bin/osmosis --rb file=/home/honeyfox/Documents/maps/dorset-latest-internal.osm.pbf --mapfile-writer file=/home/honeyfox/code/uni/final-year-project/final-deliverable/data/dorset-zi.map debug-file=true zoom-interval-conf=5,0,7,10,8,11,12,12,13,14,14,21
```

