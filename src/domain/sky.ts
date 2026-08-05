/* ============================================================
   CONSTELLATION — une carte du ciel tracée à l'encre.
   Chaque film est une étoile, chaque œuvre liée un astre plus
   discret. Une œuvre citée par deux films devient un pont : c'est
   là que les constellations se forment.
   ============================================================ */
import { hash, seededRand } from "./seeded";
import type { Film, LinkedWork, PlacedNode, SkyFilters, SkyLink, SkyNode } from "../types";

// clé de fusion : deux fois « Nighthawks / Hopper » = un seul astre
export const workKey = (w: LinkedWork): string =>
  `${w.type}::${w.title.trim().toLowerCase()}::${(w.creator || "").trim().toLowerCase()}`;

/* Le ciel ne montre QUE ce que vous avez relié à la main.

   La version précédente plaçait chaque film de la collection et chaînait
   entre eux tous ceux d'un même réalisateur : à quelques centaines de fiches,
   tout se retrouvait relié à tout et le graphe s'effondrait en une masse
   illisible. Un graphe qui montre toutes les relations n'en montre aucune.
   Ici : seuls les films portant au moins un fil rouge entrent dans la carte. */
export function buildSky(
  films: Film[],
  { tags = [], genres = [] }: SkyFilters = {}
): { nodes: SkyNode[]; links: SkyLink[] } {
  const keeps = (f: Film) =>
    (tags.length === 0 || tags.every((t) => (f.themes || []).includes(t))) &&
    (genres.length === 0 || genres.some((g) => (f.genres || []).includes(g)));

  const pool = films.filter(keeps);
  const poolIds = new Set(pool.map((f) => f.id));

  // un lien vers une fiche du mur devient une arête entre deux films ;
  // une simple mention reste un astre distinct
  const worksOf = (f: Film) => (f.linkedWorks || []).filter((w) => !w.filmId);
  const peersOf = (f: Film) =>
    (f.linkedWorks || []).filter((w) => w.filmId && poolIds.has(w.filmId));
  const connected = pool.filter((f) => worksOf(f).length + peersOf(f).length > 0);

  const nodes: SkyNode[] = connected.map((f) => ({
    id: `f:${f.id}`,
    kind: "film",
    label: f.title,
    sub: [f.year, f.director].filter(Boolean).join(" · "),
    rating: f.rating || 0,
    filmId: f.id,
    degree: 0,
  }));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: SkyLink[] = [];
  const byKey = new Map<string, SkyNode>();

  connected.forEach((f) => {
    worksOf(f).forEach((w) => {
      const k = workKey(w);
      let node = byKey.get(k);
      if (!node) {
        node = {
          id: `w:${k}`,
          kind: "work",
          type: w.type,
          label: w.title,
          sub: w.creator || "",
          refs: 0,
          degree: 0,
        };
        byKey.set(k, node);
        nodes.push(node);
      }
      node.refs = (node.refs || 0) + 1;
      links.push({ a: `f:${f.id}`, b: `w:${k}`, kind: "cite" });
    });
    // le lien est réciproque : une seule arête pour les deux moitiés
    peersOf(f).forEach((w) => {
      if (!nodeIds.has(`f:${w.filmId}`)) return;
      const [a, b] = [f.id, w.filmId as string].sort();
      if (!links.some((l) => l.a === `f:${a}` && l.b === `f:${b}`)) {
        links.push({ a: `f:${a}`, b: `f:${b}`, kind: "peer" });
      }
    });
  });

  // le degré sert à doser la taille et à n'étiqueter que les astres qui comptent
  const deg = new Map<string, number>();
  links.forEach((l) => {
    deg.set(l.a, (deg.get(l.a) || 0) + 1);
    deg.set(l.b, (deg.get(l.b) || 0) + 1);
  });
  nodes.forEach((n) => {
    n.degree = deg.get(n.id) || 0;
  });

  return { nodes, links };
}

/* ============================================================
   LES PARENTÉS TROUVÉES DANS LES GÉNÉRIQUES
   ============================================================

   `buildSky` ne montre que ce qu'on a relié à la main, et cette règle
   reste intacte : c'est elle qui empêche le ciel de s'effondrer. Mais
   elle a un coût — une collection neuve donne un onglet vide, et il faut
   des heures de saisie avant que la carte ait quoi que ce soit à dire.

   D'où ceci, À CÔTÉ et jamais à la place : des fils tirés du générique,
   dessinés autrement, éteints par défaut.

   LE SEUIL EST TOUT LE SUJET. Une personne présente dans deux ou trois
   films dit quelque chose : un chef opérateur qu'on suit, un acteur
   qu'on retrouve. Présente dans quinze, elle ne dit plus rien — elle
   relierait tout à tout et ramènerait exactement la masse illisible que
   la règle de `buildSky` avait chassée. Au-delà du seuil, la personne est
   donc IGNORÉE, et non tracée en plus pâle : un fil qui ne veut rien dire
   ne se rattrape pas à l'opacité. */
export interface SuggestOptions {
  /** En deçà, ce n'est pas une parenté. */
  min?: number;
  /** Au-delà, la personne est trop commune pour relier quoi que ce soit. */
  max?: number;
}

/** Tous les noms d'une fiche : réalisation, interprétation, équipe. */
const gensDe = (f: Film): string[] => [
  ...(f.director || "").split(",").map((n) => n.trim()),
  ...(f.cast || []),
  ...Object.values(f.crew || {}).flat(),
];

export function suggestLinks(films: Film[], { min = 2, max = 3 }: SuggestOptions = {}): SkyLink[] {
  const parPersonne = new Map<string, Set<string>>();
  for (const f of films) {
    for (const nom of gensDe(f)) {
      const clé = nom.trim().toLowerCase();
      if (!clé) continue;
      let lot = parPersonne.get(clé);
      if (!lot) parPersonne.set(clé, (lot = new Set()));
      lot.add(f.id);
    }
  }

  /* Une arête par PAIRE, quel qu'en soit le nombre de raisons : deux
     films qui partagent un chef opérateur ET un compositeur sont reliés
     une fois, par un fil qui en donne deux. */
  const arêtes = new Map<string, SkyLink>();
  const nomsLisibles = new Map<string, string>();
  for (const f of films)
    for (const nom of gensDe(f)) {
      const clé = nom.trim().toLowerCase();
      if (clé && !nomsLisibles.has(clé)) nomsLisibles.set(clé, nom.trim());
    }

  for (const [clé, lot] of parPersonne) {
    if (lot.size < min || lot.size > max) continue;
    const ids = [...lot].sort();
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const paire = `${ids[i]}|${ids[j]}`;
        const déjà = arêtes.get(paire);
        if (déjà) déjà.why?.push(nomsLisibles.get(clé) as string);
        else
          arêtes.set(paire, {
            a: `f:${ids[i]}`,
            b: `f:${ids[j]}`,
            kind: "crew",
            why: [nomsLisibles.get(clé) as string],
          });
      }
  }

  return [...arêtes.values()];
}

/* LE CIEL, PARENTÉS COMPRISES.

   Composé plutôt qu'inséré dans `buildSky` : la carte à la main reste
   exactement ce qu'elle était, et l'ajout se lit comme ce qu'il est —
   une couche par-dessus, qu'on retire en éteignant un interrupteur.

   Un film que SEULE une parenté relie n'est pas dans les nœuds de la
   carte de base : on l'y ajoute ici, sans quoi l'arête pointerait dans
   le vide. */
export function buildSkyWithCrew(
  films: Film[],
  filters: SkyFilters = {},
  options: SuggestOptions = {}
): { nodes: SkyNode[]; links: SkyLink[] } {
  const base = buildSky(films, filters);

  /* Les mêmes filtres que la carte de base : suggérer par-dessus un
     ciel restreint aux documentaires ne doit pas ramener le reste. */
  const { tags = [], genres = [] } = filters;
  const pool = films.filter(
    (f) =>
      (tags.length === 0 || tags.every((t) => (f.themes || []).includes(t))) &&
      (genres.length === 0 || genres.some((g) => (f.genres || []).includes(g)))
  );
  const parId = new Map(pool.map((f) => [f.id, f]));

  const nodes = [...base.nodes];
  const présents = new Set(nodes.map((n) => n.id));
  const links = [...base.links];

  for (const lien of suggestLinks(pool, options)) {
    /* Une paire déjà tendue à la main n'a pas besoin qu'on la redouble :
       le fil rouge dit déjà tout, et mieux. */
    if (links.some((l) => l.kind === "peer" && l.a === lien.a && l.b === lien.b)) continue;
    links.push(lien);

    for (const id of [lien.a, lien.b]) {
      if (présents.has(id)) continue;
      const f = parId.get(id.slice(2));
      if (!f) continue;
      présents.add(id);
      nodes.push({
        id,
        kind: "film",
        label: f.title,
        sub: [f.year, f.director].filter(Boolean).join(" · "),
        rating: f.rating || 0,
        filmId: f.id,
        degree: 0,
      });
    }
  }

  // le degré se recompte sur le graphe entier : il dose la taille des astres
  const deg = new Map<string, number>();
  links.forEach((l) => {
    deg.set(l.a, (deg.get(l.a) || 0) + 1);
    deg.set(l.b, (deg.get(l.b) || 0) + 1);
  });
  nodes.forEach((n) => {
    n.degree = deg.get(n.id) || 0;
  });

  return { nodes, links };
}

/* relaxation force-dirigée, déterministe : même collection = même ciel */
export function relax(nodes: SkyNode[], links: SkyLink[], W: number, H: number): PlacedNode[] {
  if (nodes.length === 0) return [];
  const P: PlacedNode[] = nodes.map((n) => {
    const s = Math.abs(hash(n.id));
    return {
      ...n,
      x: W / 2 + (seededRand(s) - 0.5) * W * 0.75,
      y: H / 2 + (seededRand(s + 11) - 0.5) * H * 0.75,
    };
  });
  const index = new Map(P.map((p, i) => [p.id, i]));
  const edges = links
    .map((l) => ({ i: index.get(l.a), j: index.get(l.b), kind: l.kind }))
    .filter(
      (e): e is { i: number; j: number; kind: SkyLink["kind"] } => e.i != null && e.j != null
    );

  for (let step = 0; step < 320; step++) {
    const cool = 1 - step / 320;
    // répulsion : deux astres ne se superposent jamais
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        const a = P[i] as PlacedNode;
        const b = P[j] as PlacedNode;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const d = Math.sqrt(d2);
        const f = Math.min(9000 / d2, 12) * cool;
        const ux = dx / d,
          uy = dy / d;
        a.x -= ux * f;
        a.y -= uy * f;
        b.x += ux * f;
        b.y += uy * f;
      }
    }
    // ressorts : le fil tire les œuvres vers leur film
    edges.forEach((e) => {
      const a = P[e.i] as PlacedNode;
      const b = P[e.j] as PlacedNode;
      const rest = e.kind === "peer" ? 210 : 128;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - rest) * 0.045 * cool;
      const ux = dx / d,
        uy = dy / d;
      a.x += ux * f;
      a.y += uy * f;
      b.x -= ux * f;
      b.y -= uy * f;
    });
    // gravité douce vers le centre de la feuille
    P.forEach((p) => {
      p.x += (W / 2 - p.x) * 0.006 * cool;
      p.y += (H / 2 - p.y) * 0.006 * cool;
    });
  }

  // recadrage : le ciel occupe toute la feuille, quelle que soit la taille de la collection
  const pad = 90;
  const xs = P.map((p) => p.x),
    ys = P.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const k = Math.min(
    (W - pad * 2) / Math.max(maxX - minX, 1),
    (H - pad * 2) / Math.max(maxY - minY, 1)
  );
  // on n'agrandit jamais au-delà du raisonnable : à deux étoiles, le ciel reste aéré
  const s = Math.min(k, 1.6);
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  P.forEach((p) => {
    p.x = W / 2 + (p.x - cx) * s;
    p.y = H / 2 + (p.y - cy) * s;
  });

  return P;
}
