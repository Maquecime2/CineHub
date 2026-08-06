/* ============================================================
   CONSTELLATION — une carte du ciel tracée à l'encre.
   Chaque film est une étoile, chaque œuvre liée un astre plus
   discret. Une œuvre citée par deux films devient un pont : c'est
   là que les constellations se forment.
   ============================================================ */
import { hash, seededRand } from "./seeded";
import { forceDe } from "./relations";
import { membresDuFil } from "./fils";
import type { Fil } from "./fils";
import type { Force } from "./relations";
import type {
  Film,
  Kinship,
  KinshipRole,
  LinkedWork,
  PlacedNode,
  SkyFilters,
  SkyLink,
  SkyNode,
} from "../types";

// clé de fusion : deux fois « Nighthawks / Hopper » = un seul astre
export const workKey = (w: LinkedWork): string =>
  `${w.type}::${w.title.trim().toLowerCase()}::${(w.creator || "").trim().toLowerCase()}`;

/* Le ciel ne montre QUE ce que vous avez relié à la main.

   La version précédente plaçait chaque film de la collection et chaînait
   entre eux tous ceux d'un même réalisateur : à quelques centaines de fiches,
   tout se retrouvait relié à tout et le graphe s'effondrait en une masse
   illisible. Un graphe qui montre toutes les relations n'en montre aucune.
   Ici : seuls les films portant au moins un fil rouge entrent dans la carte. */
/* La relation telle qu'elle est écrite du côté `a`, en allant vers `b`.
   Les deux moitiés d'un fil portent des relations inverses : sans ce
   choix, le sens du trait dépendrait de l'ordre de parcours de la
   collection, et « fait suite à » se retournerait au hasard. */
const parRelation = (films: Film[], aId: string, bId: string) =>
  (films.find((f) => f.id === aId)?.linkedWorks || []).find((w) => w.filmId === bId)?.relation;

/* CE QUI ENTRE AU CIEL EN PLUS DES FILS ROUGES.

   La règle de `buildSky` — seuls les films reliés à la main — reste la
   garde qui empêche le graphe de s'effondrer. Mais elle laissait deux
   choses dehors, et ce sont justement les deux qu'on venait chercher :

   — les FILS, qui sont un rassemblement nommé (« les films où le héros
     meurt »). Un fil relie ses membres par construction : ils entrent
     donc au ciel même sans qu'aucun fil rouge n'ait été tendu, sans quoi
     poser la question ne montrerait rien ;
   — les ÉPINGLES, un film qu'on est allé chercher à la main dans la
     recherche. Un astre isolé, oui — mais posé exprès, par un geste, et
     qui repart au premier coup de balai. */
export interface SkyExtras {
  fils?: Fil[];
  /** Identifiants de films à faire entrer au ciel quoi qu'il arrive. */
  pinned?: string[];
}

export function buildSky(
  films: Film[],
  { tags = [], genres = [] }: SkyFilters = {},
  { fils = [], pinned = [] }: SkyExtras = {}
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
  /* Les membres des fils et les épinglés entrent avec les reliés. On les
     réunit AVANT de construire les nœuds : un film peut être les deux à
     la fois, et le dédoublerait sinon. */
  const parLesFils = new Set<string>();
  for (const fil of fils) for (const id of membresDuFil(fil, pool)) parLesFils.add(id);
  const épinglés = new Set(pinned.filter((id) => poolIds.has(id)));

  const connected = pool.filter(
    (f) => worksOf(f).length + peersOf(f).length > 0 || parLesFils.has(f.id) || épinglés.has(f.id)
  );

  const nodes: SkyNode[] = connected.map((f) => ({
    id: `f:${f.id}`,
    kind: "film",
    label: f.title,
    sub: [f.year, f.director].filter(Boolean).join(" · "),
    rating: f.rating || 0,
    filmId: f.id,
    degree: 0,
    épinglé: épinglés.has(f.id) && worksOf(f).length + peersOf(f).length === 0,
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
        /* L'arête est unique quand le fil, lui, est écrit des deux côtés
           en relations inverses. On garde donc celle du bout `a`, pour que
           « fait suite à » se lise toujours dans le sens du trait. */
        const côtéA = a === f.id ? w.relation : parRelation(films, a as string, b as string);
        links.push({
          a: `f:${a}`,
          b: `f:${b}`,
          kind: "peer",
          relation: côtéA,
          force: forceDe(w.force),
        });
      }
    });
  });

  /* Un fil est un astre à part entière plutôt qu'une couleur posée sur
     ses membres : il porte un nom, on peut le prendre pour foyer, et ses
     membres se rassemblent visiblement autour de lui. Un fil vide n'entre
     pas — un nom seul au milieu du ciel ne dit rien. */
  for (const fil of fils) {
    const membres = membresDuFil(fil, connected);
    if (membres.length === 0) continue;
    const id = `t:${fil.id}`;
    nodes.push({
      id,
      kind: "fil",
      label: fil.label,
      sub: `${membres.length} film${membres.length > 1 ? "s" : ""}`,
      couleur: fil.couleur,
      motif: fil.motif ?? null,
      degree: 0,
    });
    for (const filmId of membres) links.push({ a: id, b: `f:${filmId}`, kind: "fil" });
  }

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

/* TOUT CE QUI PEUT APPARENTER DEUX FICHES, avec sa NATURE.

   La version précédente aplatissait tout en une liste de noms, et
   perdait le métier au passage : la carte pouvait dire « Decaë » mais
   pas « image · Decaë ». Or c'est le métier qui donne son sens au fil —
   suivre un chef opérateur et retrouver un acteur ne sont pas la même
   curiosité.

   `thème` est une source NOUVELLE, et la seule qui ne vienne pas d'un
   générique : ce sont vos propres mots-clés. Elle obéit au même seuil
   que les personnes — un mot posé sur quinze fiches ne relie rien de
   plus qu'un acteur omniprésent. */
const CREW_ROLES: Record<string, KinshipRole> = {
  image: "image",
  musique: "musique",
  scénario: "scénario",
};

const parentésDe = (f: Film): Kinship[] => {
  const out: Kinship[] = [];
  for (const nom of (f.director || "").split(","))
    if (nom.trim()) out.push({ role: "réalisation", nom: nom.trim() });
  for (const nom of f.cast || []) if (nom.trim()) out.push({ role: "interprétation", nom });
  for (const [métier, noms] of Object.entries(f.crew || {})) {
    const role = CREW_ROLES[métier];
    if (!role) continue;
    for (const nom of noms) if (nom.trim()) out.push({ role, nom });
  }
  for (const t of f.themes || []) if (t.trim()) out.push({ role: "thème", nom: t });
  return out;
};

/* La clé d'unicité inclut le RÔLE : un compositeur qui joue aussi dans
   deux films est deux parentés différentes, et les confondre ferait
   disparaître l'une des deux. */
const cléDe = (k: Kinship): string => `${k.role}::${k.nom.trim().toLowerCase()}`;

export function suggestLinks(films: Film[], { min = 2, max = 3 }: SuggestOptions = {}): SkyLink[] {
  const parParenté = new Map<string, Set<string>>();
  const lisible = new Map<string, Kinship>();

  for (const f of films) {
    for (const k of parentésDe(f)) {
      const clé = cléDe(k);
      if (clé.endsWith("::")) continue;
      let lot = parParenté.get(clé);
      if (!lot) parParenté.set(clé, (lot = new Set()));
      lot.add(f.id);
      if (!lisible.has(clé)) lisible.set(clé, { role: k.role, nom: k.nom.trim() });
    }
  }

  /* Une arête par PAIRE, quel qu'en soit le nombre de raisons : deux
     films qui partagent un chef opérateur ET un compositeur sont reliés
     une fois, par un fil qui en donne deux. */
  const arêtes = new Map<string, SkyLink>();

  for (const [clé, lot] of parParenté) {
    if (lot.size < min || lot.size > max) continue;
    const raison = lisible.get(clé) as Kinship;
    const ids = [...lot].sort();
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const paire = `${ids[i]}|${ids[j]}`;
        const déjà = arêtes.get(paire);
        if (déjà) déjà.why?.push(raison);
        else
          arêtes.set(paire, {
            a: `f:${ids[i]}`,
            b: `f:${ids[j]}`,
            kind: "crew",
            why: [raison],
          });
      }
  }

  return [...arêtes.values()];
}

/* ============================================================
   LE VOISINAGE — ce qu'on montre quand on n'affiche pas tout
   ============================================================

   Le remède au fouillis n'est pas un meilleur placement : c'est de NE
   PAS TOUT MONTRER. Un graphe de deux cents astres ne se lit à aucune
   disposition, et le lecteur n'a de toute façon qu'une question à la
   fois — « qu'est-ce qui tient près de CELUI-CI ».

   On part donc d'un foyer et l'on rend ce qui est à `depth` pas de lui,
   par un parcours en largeur sur les arêtes déjà construites. Rien à
   changer dans `buildSky` ni `buildSkyWithCrew` : le sous-graphe se
   taille APRÈS, ce qui laisse la carte entière disponible pour qui la
   veut. */
export function neighbourhood(
  nodes: SkyNode[],
  links: SkyLink[],
  focusId: string,
  depth = 1
): { nodes: SkyNode[]; links: SkyLink[] } {
  const existe = new Set(nodes.map((n) => n.id));
  if (!existe.has(focusId)) return { nodes: [], links: [] };

  const voisins = new Map<string, string[]>();
  for (const l of links) {
    if (!voisins.has(l.a)) voisins.set(l.a, []);
    if (!voisins.has(l.b)) voisins.set(l.b, []);
    voisins.get(l.a)?.push(l.b);
    voisins.get(l.b)?.push(l.a);
  }

  const gardés = new Set([focusId]);
  let front = [focusId];
  for (let d = 0; d < depth; d++) {
    const suivant: string[] = [];
    for (const id of front)
      for (const v of voisins.get(id) || [])
        if (!gardés.has(v)) {
          gardés.add(v);
          suivant.push(v);
        }
    front = suivant;
  }

  return {
    nodes: nodes.filter((n) => gardés.has(n.id)),
    /* Une arête n'est gardée que si SES DEUX BOUTS le sont : un fil qui
       part vers un astre qu'on n'affiche pas ne mène nulle part et fait
       croire à un voisin invisible. */
    links: links.filter((l) => gardés.has(l.a) && gardés.has(l.b)),
  };
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
  options: SuggestOptions = {},
  extras: SkyExtras = {}
): { nodes: SkyNode[]; links: SkyLink[] } {
  const base = buildSky(films, filters, extras);

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
    .map((l) => ({ i: index.get(l.a), j: index.get(l.b), kind: l.kind, force: l.force }))
    .filter(
      (e): e is { i: number; j: number; kind: SkyLink["kind"]; force: Force | undefined } =>
        e.i != null && e.j != null
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
      /* Un lien fort rapproche : c'est la seule chose que la carte sache
         faire d'une force, et c'est déjà la bonne — deux films qu'on tient
         pour le même film à deux reprises doivent se toucher. Un fil tient
         ses membres en grappe autour de son nom, un peu plus lâche qu'une
         œuvre citée pour laisser la place aux étiquettes. */
      const rest = e.kind === "peer" ? 260 - forceDe(e.force) * 40 : e.kind === "fil" ? 170 : 128;
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
