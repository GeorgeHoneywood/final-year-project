// TODO: ideally this would be written in typescript, but getting service worker
// types imported is surprisingly difficult.

// code reused from first proof of concept
// following this guide:
// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers



const addResourcesToCache = async (resources) => {
    const cache = await caches.open('v1');
    await cache.addAll(resources);
};

const putInCache = async (request, response) => {
    const cache = await caches.open('v1');
    await cache.put(request, response);
};

const cacheFirst = async ({ request }) => {
    const requested_range_header = request.headers.get('range');
    // we are handling a partial map file request
    if (requested_range_header) {
        const cache = await caches.open('v1')

        const [start, end] = requested_range_header.split("=")[1].split("-").map(e => +e)
        const requested_range = { start, end }

        const storage_key = `${request.url}?${requested_range_header}`

        // unfortunately we can't use cache.matchAll as we can't get the
        // original url back
        const keys = await cache.keys()
        const cached_ranges = []
        for (const key of keys) {
            const cache_url = new URL(key.url)

            if (new URL(request.url).pathname !== cache_url.pathname) {
                // not the file we are looking for
                continue
            }

            const range = cache_url.searchParams.get("bytes")
            const [start, end] = range.split("-").map(e => +e)
            cached_ranges.push({
                start,
                end,
                length: (end - start) + 1,
                key: key.url,
            })
        }

        for (const cached_range of cached_ranges) {
            if (requested_range.start >= cached_range.start && requested_range.end <= cached_range.end) {
                // we can use this range

                const responseFromCache = await cache.match(cached_range.key);
                if (responseFromCache) {
                    console.log("served from the service worker cache", requested_range, "from chunk", cached_range)

                    return new Response(
                        (await responseFromCache.blob())
                            .slice(
                                requested_range.start - cached_range.start,
                                requested_range.end - cached_range.start
                            )
                    );
                } else {
                    console.log("failed to retrieve chunk", requested_range, "from chunk", cached_range, "tried file", cached_range.key)
                }
            }
        }


        console.log("service worker fetching from network", requested_range)
        const responseFromNetwork = await fetch(request);

        // creating a new Response wipes out the 206 Partial header
        putInCache(storage_key, new Response(
            await responseFromNetwork.clone().blob(),
            { headers: { "Content-Length": responseFromNetwork.headers.get("Content-Length") } }
        ));

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
