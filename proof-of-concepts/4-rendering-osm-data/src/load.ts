
// load an some map blob
async function loadMapBlob(path: string): Promise<Blob> {
    const resp = await fetch(path);
    if (!resp.ok) {
        throw new Error(
            `request failed; error code: ${resp.statusText || resp.status}`
        );
    }

    return await resp.blob();
}

export { loadMapBlob }
