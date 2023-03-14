import './app.css'
import App from './App.svelte'

const start_time = performance.now()

if (
    window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
    || !navigator.serviceWorker
) {
    console.log(
        `starting app, not using service worker because ${!navigator.serviceWorker ? "serviceWorker is not available" : "we are on localhost"}`
    )
    new App({
        target: document.getElementById('app'),
    })
} else {
    // NOTE: this ensures the service worker has been registered, and has "claimed"
    // before starting the app
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(() => {
        return new Promise<void>(resolve => {
            if (navigator.serviceWorker.controller) {
                resolve();
            } else {
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    resolve();
                });
            }
        });
    }).then(() => {
        console.log(`starting app, service worker is ready, took ${performance.now() - start_time}ms`)
        new App({
            target: document.getElementById('app'),
        })
    })
}
