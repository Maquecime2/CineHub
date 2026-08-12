/* ============================================================
   LIRE LA MESURE — il n'y a pas de tableau de bord, et c'est voulu
   ============================================================

   Ces chiffres n'ont pas de route : les exposer demanderait une notion
   d'administrateur que ce serveur n'a pas, et l'inventer pour un
   tableau de bord serait la mauvaise raison d'ajouter un pouvoir.
   On les lit ici, depuis la machine qui tient la base.

   CE QU'ILS NE DIRONT JAMAIS : combien de personnes. Y répondre
   demanderait de garder ce qu'on refuse de garder. Ils disent ce qui
   sert et ce qui coûte — c'est ce pour quoi on mesure.
   ============================================================ */
import { openPostgres } from "../src/db.ts";
import { mesures } from "../src/store.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manque.");
  process.exit(1);
}

const jours = Number(process.argv[2] || 30);
const db = await openPostgres(url);
const rows = await mesures(db, jours);

const total = new Map<string, number>();
for (const l of rows) total.set(l.geste, (total.get(l.geste) ?? 0) + Number(l.n));

console.log(
  `Sur ${jours} jours — ${lignes.length} lignes, ${[...total.values()].reduce((a, b) => a + b, 0)} appels\n`
);
for (const [geste, n] of [...total].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(8)}  ${geste}`);
}

await db.close();
