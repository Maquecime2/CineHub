/* `defineConfig` vient de vitest et non de vite : c'est lui qui connaît la
   section `test` en plus de toute la configuration Vite habituelle. */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/* GitHub Pages sert le site sous /CineHub/ (project site). En local on reste à
   la racine, sinon le serveur de dev répondrait sur une sous-URL inutile. */
const base = process.env.GITHUB_ACTIONS ? "/CineHub/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
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
