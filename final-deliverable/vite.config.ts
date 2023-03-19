import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { ManifestOptions, VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

const pwa_manifest: Partial<ManifestOptions> = {
    name: "OSMO: Final Deliverable",
    short_name: "OSMO",
    start_url: "./",
    background_color: "#f2efe9",
    theme_color: "#f2efe9",
    description: "Offline HTML5 map viewer, based on the Mapsforge format",
    display: "standalone",
    orientation: "portrait",
    scope: "./",
    icons: [
        {
            src: "icons/favicon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable any",
        },
        {
            src: "icons/favicon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable any",
        },
    ],
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        svelte(),
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            injectRegister: null, // we register manually in main.ts
            injectManifest: {
                globPatterns: ["**/*.{js,css,html,svg,png}"],
            },
            manifest: pwa_manifest,
        }),
    ],
    base: "./", // deploying to nested path
    resolve: {
        alias: [
            { find: '@', replacement: resolve(__dirname, 'src') },
        ],
    },
    define: {
        "__APP_VERSION__": JSON.stringify(execSync("git rev-parse HEAD").toString().trim())
    },

})
