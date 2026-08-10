/* ============================================================
   LE FILET DE LA VISITE

   Ces tests ne vérifient pas un calcul : ils vérifient une PROMESSE
   d'entretien. Une vue ajoutée au produit sans visite fait échouer la
   suite, et c'est tout leur objet — la règle écrite dans CLAUDE.md ne
   tiendrait pas six mois si rien ne la tenait.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { TOURS, tourForView } from "./steps";

/* La liste des vues du produit, recopiée à la main depuis l'union `View`
   de `FolderTabs` : un type ne survit pas à la compilation, et c'est
   justement ici qu'on veut qu'il soit lisible à l'exécution. `skinlab`
   n'en est pas — c'est un outil de développement, pas une vue. */
const VUES = [
  "library",
  "watchlist",
  "generique",
  "reco",
  "constellation",
  "notebook",
  "import",
  "fil",
  "detail",
  "almanac",
] as const;

describe("la visite couvre le produit", () => {
  it.each(VUES)("« %s » a sa visite", (vue) => {
    const t = tourForView(vue);
    expect(t, `la vue « ${vue} » n'a pas de visite — voir CLAUDE.md`).toBeDefined();
    expect(t!.steps.length).toBeGreaterThan(0);
  });

  it("n'a pas de visite orpheline", () => {
    for (const clé of Object.keys(TOURS)) {
      if (clé === "global") continue;
      expect(VUES).toContain(clé as (typeof VUES)[number]);
    }
  });
});

describe("les étapes se tiennent", () => {
  const toutes = Object.entries(TOURS).flatMap(([id, t]) => t.steps.map((s, i) => ({ id, i, s })));

  it("dit toujours quelque chose", () => {
    for (const { id, i, s } of toutes) {
      expect(s.title.trim(), `${id}[${i}]`).not.toBe("");
      expect(s.body.trim(), `${id}[${i}]`).not.toBe("");
    }
  });

  it("ne vise que par un attribut de visite", () => {
    for (const { id, i, s } of toutes) {
      if (s.target === null) continue;
      expect(s.target, `${id}[${i}]`).toMatch(/^\[data-(tour|tab-rail)/);
    }
  });

  /* La visite globale voyage : chaque étape doit dire dans quelle vue
     elle se joue, sinon elle pointe une cible restée dans la vue
     précédente. */
  it("la visite globale nomme la vue de chaque étape", () => {
    for (const [i, s] of TOURS.global!.steps.entries()) {
      expect(s.view, `global[${i}] : ${s.title}`).toBeDefined();
    }
  });

  /* Les visites de page, elles, ne doivent JAMAIS naviguer : on les
     lance depuis la page qu'elles décrivent. */
  it("les visites de page ne naviguent pas", () => {
    for (const [id, t] of Object.entries(TOURS)) {
      if (id === "global") continue;
      for (const s of t.steps) expect(s.view, `${id} : ${s.title}`).toBeUndefined();
    }
  });
});
