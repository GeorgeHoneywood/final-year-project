const getData = async (url) => {
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(
            `request failed; error code: ${resp.statusText || resp.status}`
        );
    }
    return resp.json();
};

export { getData }
