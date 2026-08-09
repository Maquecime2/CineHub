/* `defineConfig` vient de vitest et non de vite : c'est lui qui connaît la
   section `test` en plus de toute la configuration Vite habituelle. */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/* GitHub Pages sert le site sous /CineHub/ (project site). En local on reste à
   la racine, sinon le serveur de dev répondrait sur une sous-URL inutile. */
const base = process.env.GITHUB_ACTIONS ? "/CineHub/" : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    /* ============================================================
       LE CLASSEUR S'INSTALLE
       ============================================================

       Une vidéothèque personnelle qu'il faut aller chercher dans un
       onglet n'est pas un classeur : c'est un signet. Posée sur l'écran
       d'accueil, elle s'ouvre d'un doigt, en plein écran, sans barre
       d'adresse — et surtout SANS RÉSEAU.

       Le hors-ligne n'est pas un supplément ici, c'est la vérité de
       l'application : les films vivent dans `localStorage` et IndexedDB,
       et rien de ce qu'on regarde n'a besoin d'un serveur. Une collection
       qu'on ne peut pas ouvrir dans le métro serait absurde.

       `prompt` et non `autoUpdate` : une application qui se remplace
       toute seule pendant qu'on écrit une note perd ce qu'on écrivait.
       On prévient, et c'est la main qui décide — voir `Installation`. */
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icone-pomme-180.png"],
      manifest: {
        name: "Ciné Hub — votre vidéothèque",
        short_name: "Ciné Hub",
        description:
          "Un classeur de films : ce que vous avez vu, ce que vous en pensez, et ce qu'il vous reste à voir. Tout reste chez vous.",
        lang: "fr",
        /* `.` et non `/` : le site vit sous /CineHub/ en ligne et à la
           racine en local. Une adresse absolue enverrait l'icône de
           l'écran d'accueil sur une page qui n'existe pas. */
        start_url: ".",
        display: "standalone",
        background_color: "#EEE3CC",
        /* La couleur de la barre système : le carton du carnet, pas une
           couleur d'accent. C'est le prolongement de la page, et c'est
           tout l'effet d'une application installée. */
        theme_color: "#EEE3CC",
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          /* L'icône masquable est la même fiche, posée plus au centre :
             Android découpe l'icône à sa guise — cercle, écusson, goutte —
             et ne garantit que les quatre cinquièmes du milieu. */
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
        /* Une collection enrichie par TMDB tient dans quelques mégaoctets
           de JavaScript ; le défaut de deux mégaoctets laissait le plus
           gros morceau hors du précache, donc hors ligne. */
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            /* Les affiches sont immuables : une adresse TMDB désigne pour
               toujours la même image. On les garde longtemps, et on les
               sert du cache avant même de demander au réseau. */
            urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "affiches-tmdb",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /* Les fiches TMDB, elles, changent : on demande d'abord, et le
               cache n'est qu'un filet pour le jour sans réseau. */
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
            /* Les fontes viennent d'un CDN et ne changent jamais. Sans
               elles en cache, le classeur hors ligne s'ouvrait dans la
               fonte du système — méconnaissable. */
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
    /* Le flux Letterboxd n'autorise pas la lecture depuis une autre
       origine : le navigateur refuse la réponse. En développement, c'est
       le serveur Vite qui va la chercher — il n'est pas un navigateur, la
       règle ne le concerne pas. En ligne, le site est un GitHub Pages
       statique et n'a personne pour faire ce travail : il passe par le
       relais réglé dans `services/letterboxd`. */
    proxy: {
      "/lb-rss": {
        target: "https://letterboxd.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/lb-rss/, ""),
      },
    },
  },
  test: {
    /* jsdom pour tout le monde : les modules purs (taste, reco) s'en accommodent
       sans rien changer, et les tests de composants en ont besoin. */
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/setupTests.ts"],
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    coverage: { include: ["src/**/*.{js,ts}"], exclude: ["src/**/*.test.*"] },
  },
});
