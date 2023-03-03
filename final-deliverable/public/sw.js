// TODO: ideally this would be written in typescript, but getting service worker
// types imported is surprisingly difficult.

// code reused from first proof of concept
// following this guide: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

const addResourcesToCache = async (resources) => {
    const cache = await caches.open('v1');
    await cache.addAll(resources);
};

const putInCache = async (request, response) => {
    const cache = await caches.open('v1');
    await cache.put(request, response);
};

const cacheFirst = async ({ request }) => {
    const range = request.headers.get('range');
    // we are handling a partial map file request
    if (range){
        const key = `${request.url}-${range}`

        const responseFromCache = await caches.match(key);
        if (responseFromCache) {
            console.log("served from the service worker cache", range)
            return responseFromCache;
        }

        console.log("service worker fetching from network", range)
        const responseFromNetwork = await fetch(request);
        // creating a new Response wipes out the 206 Partial header
        putInCache(key, new Response(await responseFromNetwork.clone().blob()));

        return responseFromNetwork;
    }

    // if the file exists in the cache, use it
    const responseFromCache = await caches.match(request);
    if (responseFromCache) {
        return responseFromCache;
    }

    // try to get the resource from the network
    try {
        const responseFromNetwork = await fetch(request);
        // response may be used only once
        // we need to save clone to put one copy in cache
        // and serve second one
        putInCache(request, responseFromNetwork.clone());
        return responseFromNetwork;
    } catch (error) {
        // we must always return a Response object
        return new Response('Could not retrieve the response from the Service Worker cache', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
};

self.addEventListener('fetch', (event) => {
    event.respondWith(
        cacheFirst({
            request: event.request
        })
    );
});
