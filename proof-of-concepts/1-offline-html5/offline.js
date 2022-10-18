const getMapBlob = async (url) => {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(
        `request failed; error code: ${
          resp.statusText || resp.status
        }`
      );
    }
    return resp.blob();
  };

let blob = getMapBlob("/albania.map")

blob.then((blob) => {
    console.log(`the blob is ${blob.size} bytes`)

    let binary = blob.slice(0, 100)
    console.log("a small slice of the blob:", binary)
})

