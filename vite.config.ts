/* `defineConfig` comes from vitest and not from vite: it is the one that
   knows the `test` section on top of the whole usual Vite config. */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/* GitHub Pages serves the site under /CineHub/ (a project site). Locally
   we stay at the root, or the dev server would answer on a pointless
   sub-URL. */
const base = process.env.GITHUB_ACTIONS ? "/CineHub/" : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    /* ============================================================
       THE BINDER INSTALLS ITSELF
       ============================================================

       A personal film library one has to go and find in a tab is not a
       binder: it is a bookmark. Laid on the home screen it opens with one
       finger, full screen, with no address bar — and above all WITH NO
       NETWORK.

       Offline is not an extra here, it is the truth of the application:
       the films live in `localStorage` and IndexedDB, and nothing one
       looks at needs a server. A collection one cannot open on the
       underground would be absurd.

       `prompt` and not `autoUpdate`: an application that replaces itself
       while somebody is writing a note loses what they were writing. We
       warn, and the hand decides — see `Installation`. */
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icone-pomme-180.png"],
      manifest: {
        name: "Ciné Hub — votre vidéothèque",
        short_name: "Ciné Hub",
        description:
          "Un classeur de films : ce que vous avez vu, ce que vous en pensez, et ce qu'il vous reste à voir. Tout reste chez vous.",
        lang: "fr",
        /* `.` and not `/`: the site lives under /CineHub/ online and at
           the root locally. An absolute address would send the home
           screen's icon to a page that does not exist. */
        start_url: ".",
        display: "standalone",
        background_color: "#EEE3CC",
        /* The system bar's colour: the notebook's cardstock, not an
           accent colour. It is the page carrying on, and that is the
           whole effect of an installed application. */
        theme_color: "#EEE3CC",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          /* The maskable icon is the same card, laid more towards the
             centre: Android cuts the icon as it pleases — circle, shield,
             droplet — and guarantees only the middle four fifths. */
          {
            src: "icone-masque-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        /* THE SERVICE WORKER IS BUILT, NOT WRITTEN: the plugin generates
           it, with the list of precached files. So no handler can be
           added to it by hand without replacing it entirely —
           `importScripts` is the door meant for that, and
           `public/push.js` goes through it. */
        importScripts: ["push.js"],
        /* A collection enriched by TMDB fits in a few megabytes of
           JavaScript; the two-megabyte default left the biggest chunk out
           of the precache, and therefore out of reach offline. */
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        /* THE CACHE NAMES KEEP THEIR FRENCH SPELLING. They name caches
           already sitting in installed browsers: renaming them does not
           translate anything, it orphans what is in them and downloads
           four hundred posters again. */
        runtimeCaching: [
          {
            /* Posters are immutable: a TMDB address names the same image
               for ever. We keep them a long time, and serve them from the
               cache before even asking the network. */
            urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "affiches-tmdb",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /* TMDB's cards, for their part, change: we ask first, and the
               cache is only a net for the day there is no network. */
            urlPattern: /^https:\/\/api\.themoviedb\.org\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "fiches-tmdb",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /* The fonts come from a CDN and never change. Without them in
               the cache, the offline binder opened in the system font —
               unrecognisable. */
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "fontes",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    /* The Letterboxd feed does not allow reading from another origin:
       the browser refuses the response. In development it is the Vite
       server that goes and fetches it — it is not a browser, the rule
       does not concern it. Online the site is a static GitHub Pages and
       has nobody to do that work: it goes through the relay set in
       `services/letterboxd`. */
    proxy: {
      "/lb-rss": {
        target: "https://letterboxd.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/lb-rss/, ""),
      },
    },
  },
  test: {
    /* jsdom for everyone: the pure modules (taste, reco) put up with it
       without changing a thing, and the component tests need it. */
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/setupTests.ts"],
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    coverage: { include: ["src/**/*.{js,ts}"], exclude: ["src/**/*.test.*"] },
  },
});
