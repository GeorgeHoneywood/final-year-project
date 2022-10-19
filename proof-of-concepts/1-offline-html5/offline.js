////////////////////////////////////////
// using the basic File API

const picker = document.getElementById("mapFile");

picker.addEventListener("change", async (event) => {
    console.log("File API:");

    const files = event.target.files;
    console.log(`the blob is ${files[0].size} bytes`);

    const slice = files[0].slice(0, 100);
    // should print out "mapsforge" and then some binary stuff
    console.log("small slice of the file", await slice.text())
})

/////////////////////////////////////////
// using the service worker Cache API

const getMapBlob = async (url) => {
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(
            `request failed; error code: ${resp.statusText || resp.status}`
        );
    }
    return resp.blob();
};

let blob = getMapBlob("/albania.map");

blob.then(async (blob) => {
    console.log("Cache API:")
    console.log(`the blob is ${blob.size} bytes`);

    let binary = blob.slice(0, 100);

    // should print out "mapsforge" and then some binary stuff
    console.log("small slice of the file:", await binary.text());
})

