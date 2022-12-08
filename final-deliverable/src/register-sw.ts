async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register(
                'sw.js',
                // { scope: '/' }
            );
            console.log(reg)
        } catch (err) {
            console.error(`registration failed: ${err}`);
        }
    }
}

export { registerServiceWorker }
