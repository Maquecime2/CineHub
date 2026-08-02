import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* GitHub Pages sert le site sous /CineHub/ (project site). En local on reste à
   la racine, sinon le serveur de dev répondrait sur une sous-URL inutile. */
const base = process.env.GITHUB_ACTIONS ? "/CineHub/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173 },
  test: {
    // taste.js et reco.js sont purs : pas de DOM à simuler.
    environment: "node",
    include: ["src/**/*.test.js"],
    coverage: { include: ["src/taste.js", "src/reco.js"] },
  },
});
