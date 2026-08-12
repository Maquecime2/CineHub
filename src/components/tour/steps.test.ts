/* ============================================================
   LE FILET DE LA VISITE

   Ces tests ne vérifient pas un calcul : ils vérifient une PROMESSE
   d'entretien. Une vue ajoutée au produit sans visite fait échouer la
   suite, et c'est tout leur objet — la règle écrite dans CLAUDE.md ne
   tiendrait pas six mois si rien ne la tenait.
   ============================================================ */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
  "listes",
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

  /* LE DOSSIER FILM SE LIT EN TROIS INTERCALAIRES, et une étape ne peut
     plus se contenter de nommer sa cible : celle-ci n'est montée que si
     son onglet est ouvert. Une étape sans `onglet` viserait donc un
     carton absent trois fois sur quatre — elle serait sautée comme une
     cible manquante, après sept cents millisecondes de voile.

     La règle ne vaut QUE pour cette visite : c'est la seule vue du
     produit qui ait des intercalaires. */
  it("chaque étape du dossier film dit son intercalaire", () => {
    for (const [i, s] of TOURS.detail!.steps.entries()) {
      expect(s.onglet, `detail[${i}] : ${s.title}`).toBeDefined();
    }
  });

  it("aucune autre visite ne parle d'intercalaire", () => {
    for (const [id, t] of Object.entries(TOURS)) {
      if (id === "detail") continue;
      for (const s of t.steps) expect(s.onglet, `${id} : ${s.title}`).toBeUndefined();
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

/* ============================================================
   CHAQUE CIBLE EXISTE QUELQUE PART

   Une étape dont l'ancre n'est posée nulle part ne montre rien : au
   mieux elle est `optional` et se saute après sept cents millisecondes
   de voile opaque, au pire elle laisse la visite plantée. Aucun des
   tests ci-dessus ne l'attrape, parce qu'ils ne lisent que `steps.ts` —
   et c'est exactement ainsi que « generique-dossier » a pu rester dans
   la visite globale, morte en permanence, sans que rien ne le dise.

   ON LIT DONC LES FICHIERS. Deux formes d'ancre coexistent dans le
   projet et le test doit connaître les deux : `data-tour="…"` en JSX
   nu, et la propriété `tour="…"` que `Cardstock` traduit en attribut. N'en
   chercher qu'une donnerait une moisson de faux positifs.

   Ce test ne dit PAS que l'ancre est montée à l'écran au moment de
   l'étape — cela ne se vérifie qu'en jouant la visite. Il dit qu'elle
   existe dans le produit, ce qui est la moitié bon marché du problème.
   ============================================================ */
/* La racine du projet, et non `import.meta.url` : Vite réécrit celui-ci
   en URL de module servie, qui n'est pas un chemin de fichier. */
const SRC = join(process.cwd(), "src");

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [chemin] : [];
  });

const ancresPosées = (): Set<string> => {
  const trouvées = new Set<string>();
  for (const f of fichiers(SRC)) {
    /* `steps.ts` NOMME les ancres, il n'en pose aucune : s'en servir de
       preuve ferait que chaque étape se justifie elle-même. */
    if (/[\\/]tour[\\/]steps\.ts$/.test(f)) continue;
    for (const m of readFileSync(f, "utf8").matchAll(/\b(?:data-tour|tour)=["']([\w-]+)["']/g))
      trouvées.add(m[1]!);
  }
  return trouvées;
};

describe("les cibles de la visite existent dans le produit", () => {
  const posées = ancresPosées();

  it("en trouve un nombre plausible", () => {
    /* Garde-fou du garde-fou : une expression rationnelle cassée rendrait
       un ensemble vide, et tous les tests ci-dessous passeraient. */
    expect(posées.size).toBeGreaterThan(30);
  });

  it("chaque étape vise une ancre posée", () => {
    for (const [id, t] of Object.entries(TOURS)) {
      for (const [i, s] of t.steps.entries()) {
        if (!s.target) continue;
        const nom = /^\[data-tour="([\w-]+)"\]$/.exec(s.target)?.[1];
        if (!nom) continue; // `[data-tab-rail]`, seule exception
        expect(
          posées.has(nom),
          `${id}[${i}] « ${s.title} » vise « ${nom} », qui n'est posé nulle part dans src/`
        ).toBe(true);
      }
    }
  });
});
