/* ============================================================
   EST-CE QUE NODE SAIT SEULEMENT LIRE CE QU'ON A ÉCRIT ?
   ============================================================

   Ce serveur ne se compile pas : il tourne en TypeScript direct, sous
   `--experimental-strip-types`, qui EFFACE les types sans rien
   transformer. Toute syntaxe TypeScript qui demande une transformation
   — propriété de paramètre, `enum`, `namespace` — l'arrête net au
   démarrage.

   ET RIEN NE LE VOYAIT. `tsc --noEmit` accepte ces syntaxes, puisqu'elles
   sont valides ; vitest transforme avant d'exécuter, donc les tests
   passent ; et la suite de tests ne DÉMARRE jamais le serveur. Un
   `constructor(readonly quel: …)` est ainsi resté deux jours dans
   `limits.ts`, à travers tous les contrôles au vert, et n'a été trouvé
   qu'en lançant `npm run dev` à la main.

   Ce script charge donc chaque module PAR NODE LUI-MÊME, avec le même
   drapeau qu'en production. C'est la seule chose qui reproduise la
   panne : `node --check` ne la voit pas non plus, il ne valide que la
   syntaxe JavaScript.

   `index.ts` N'EST PAS DE LA PARTIE : l'importer ouvrirait la base et
   mettrait le serveur à écouter. Il est couvert autrement — c'est le
   fichier qu'on lance, donc celui dont la panne se voit tout de suite.
   ============================================================ */
import { readdir } from "node:fs/promises";

const dir = new URL("../src/", import.meta.url);
const files = (await readdir(dir)).filter((f) => f.endsWith(".ts") && f !== "index.ts").sort();

let broken = 0;
for (const file of files) {
  try {
    await import(new URL(file, dir).href);
  } catch (e) {
    broken += 1;
    console.error(`✗ ${file}\n  ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (broken > 0) {
  console.error(`\n${broken} module(s) que Node refuse de charger.`);
  process.exit(1);
}
console.log(`${files.length} modules chargés par Node, sans transformation.`);
