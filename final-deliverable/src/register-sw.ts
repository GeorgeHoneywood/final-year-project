async function registerServiceWorker() {
    // only register the service worker when not running locally
    if (
        window.location.hostname === "localhost"
        || window.location.hostname === "127.0.0.1"
    ) {
        console.log("not registering service worker! (running locally)")
        return
    }

    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register(
                'sw.js',
                // { scope: '/' }
            );
            console.log(`registered service worker: ${reg}`)
        } catch (err) {
            console.error(`registration failed: ${err}`);
        }
    }
}

export { registerServiceWorker }
