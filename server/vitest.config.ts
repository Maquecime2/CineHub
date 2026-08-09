import { defineConfig } from "vitest/config";

/* Sans ce fichier, vitest remonte jusqu'à la configuration du CLIENT —
   qui ne cherche des tests que dans `src/` et monte un DOM. Le serveur
   n'a besoin ni de l'un ni de l'autre. */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    /* Un Postgres en WebAssembly démarre en une fraction de seconde,
       mais une base neuve par test finit par compter. */
    testTimeout: 20000,
  },
});
