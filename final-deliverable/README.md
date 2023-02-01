# Final deliverable: OSMO (OSM Offline)

This is the code for the final submission, that builds on the proof of concepts.

Visit https://files.george.honeywood.org.uk/final-deliverable/ to see the demo online. This demo should also work offline, using a Service Worker. Once you have visited the page once whilst online, it should be stored in the Service Worker cache, and further offline visits should be possible.

To run the demo locally, you will need to install the dependencies. This can be done by writing `pnpm install` or `npm install` in this directory. Once you've done that, you can run `pnpm dev` or `npm run dev`, and visit the URL it gives.

To run the tests, you'll also need to download [dorset-with-debug.map](https://files.george.honeywood.org.uk/2022-11-16-dorset-with-debug.map), put it in the `data/` folder, and rename it to `dorset-with-debug.map`.

Map data © [OpenStreetMap Contributors (ODbL)](https://www.openstreetmap.org/copyright). Icons from [Font Awesome](https://fontawesome.com/).
