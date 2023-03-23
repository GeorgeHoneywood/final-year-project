# Final deliverable: OSMO (OSM Offline)

This is the code for the final submission, that builds on the proof of concepts.

Visit https://files.george.honeywood.org.uk/final-deliverable/ to see the live demo or, watch the [YouTube demo video](https://youtu.be/2XLOaLw82c8). 

The live demo works offline, using a service worker. Once you have visited the page once whilst online, it should be stored in the service worker cache, and further offline visits should be possible.

To run the demo locally, you will need to install the dependencies. This can be done by writing `pnpm install` in this directory. Once you've done that, you can run `pnpm dev`, and visit the URL it gives. You will also need to download the [`england.map`](https://files.george.honeywood.org.uk/final-deliverable/data/england.map), and place it in the `public/data/` folder --- it is an 800 MB file, so it may take some time to download. 

It can be deployed to my server with `pnpm upload`.

Map data © [OpenStreetMap Contributors (ODbL)](https://www.openstreetmap.org/copyright). Icons from [Font Awesome](https://fontawesome.com/).
