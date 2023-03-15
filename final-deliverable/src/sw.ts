// code reused from first proof of concept
// following this guide:
// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

// tell TypeScript what self is
declare let self: ServiceWorkerGlobalScope

// NOTE: macro replaced at build time
const app_version = __APP_VERSION__

// counting anything that isn't map partials as "assets"
// i.e. HTML, JS, CSS
// this means that assets should be refreshed when the service worker has
// upgraded, and the new version has taken control
const asset_version = `resources-${app_version}`;

// invalidating users' downloaded map files would be a bad idea, so hardcode this
const map_version = "map-v1"

const addAssetsToCache = async (resources: string[]) => {
    const cache = await caches.open(asset_version);
    await cache.addAll(resources);
};

const putAssetInCache = async (request: Request, response: Response) => {
    const cache = await caches.open(asset_version);
    await cache.put(request, response);
};

const putPartialMapInCache = async (request: Request, response: Response) => {
    const cache = await caches.open(map_version);
    await cache.put(request, response);
};

// NOTE: this could get pretty inefficent: for each request we do a linear
// search, over all file in the service worker cache
const handlePartialMapRequest = async (request: Request, requested_range_header: string) => {
    const cache = await caches.open(map_version)

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

                // as we don't check the Content-Range header, just setting 206
                // status is enough
                return new Response(
                    (await responseFromCache.blob())
                        .slice(
                            requested_range.start - cached_range.start,
                            // NOTE: ranges in the cache are end exclusive, so need add one here to get the final byte
                            (requested_range.end - cached_range.start) + 1,
                        ),
                    { status: 206 }
                );
            } else {
                console.log("failed to retrieve chunk", requested_range, "from chunk", cached_range, "tried file", cached_range.key)
            }
        }
    }

    try {
        console.log("service worker fetching from network", requested_range)
        const responseFromNetwork = await fetch(request);

        if (!(responseFromNetwork.status === 206)) {
            throw new Error(
                `range request failed, instead got ${responseFromNetwork.statusText || responseFromNetwork.status} -- maybe the server doesn't support range requests?`
            );
        }

        // creating a new Response wipes out the 206 Partial header,
        // which we have to do to store file in cache
        putPartialMapInCache(new Request(storage_key), new Response(
            await responseFromNetwork.clone().blob(),
            { headers: { "Content-Length": responseFromNetwork.headers.get("Content-Length") } }
        ));

        return responseFromNetwork;
    } catch (error) {
        // we must always return a Response object
        return new Response('Could not retrieve the response from the Service Worker cache', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
}

const cacheFirst = async ({ request }) => {
    const requested_range_header = request.headers.get('range');
    if (requested_range_header) {
        // we are handling a partial map file request
        return handlePartialMapRequest(request, requested_range_header);
    }

    const asset_cache = await caches.open(asset_version)
    // if the file exists in the cache, use it
    const responseFromCache = await asset_cache.match(request);
    if (responseFromCache) {
        return responseFromCache;
    }

    // try to get the resource from the network
    try {
        const responseFromNetwork = await fetch(request);
        // response may be used only once we need to save clone to put one copy
        // in cache and serve second one
        putAssetInCache(request, responseFromNetwork.clone());
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
    console.log(`service worker intercepted fetch for ${event.request.url}`)
    event.respondWith(
        cacheFirst({
            request: event.request
        })
    );
});

self.addEventListener('install', async (event) => {
    console.log('service worker installing')
    let manifest = ((self as any).__WB_MANIFEST as { url: string }[]).map(e => e.url)
    manifest = [...new Set(manifest)] // remove duplicates
    console.log("precaching files in manifest", manifest)

    // precache assets we need
    event.waitUntil((async () => {
        await addAssetsToCache(["./", ...manifest])
        console.log("finished precaching")

        await self.skipWaiting(); // if we are a new service worker version, fire activate immediately
    })());
});

self.addEventListener('activate', async (event) => {
    console.log('service worker activated')
    event.waitUntil((async () => {
        await self.clients.claim()

        // clean out old cache versions, after a new service worker is in
        // control
        for (const cache_name of await self.caches.keys()) {
            if (cache_name === map_version) {
                continue // don't want to clear out the map cache
            }

            if (cache_name !== asset_version) {
                // old cache, delete
                console.log(`cleaned out old cache: ${cache_name}`)
                await self.caches.delete(cache_name)
            }
        }
    })())
});

// needed to convince TypeScript that this is a module
export { }
