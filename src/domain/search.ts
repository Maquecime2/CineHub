/* ============================================================
   CHERCHER UN FILM — une seule définition, pour toute l'app
   ============================================================

   Le même prédicat « titre OU réalisateur » était recopié dans trois
   vues, et les trois ont divergé sans que personne le voie : l'étagère
   éteint, le mur filtre, la fiche propose. Trois comportements, soit —
   mais trois définitions de ce que « correspondre » VEUT DIRE, non : taper
   « 1974 » ou le nom d'un acteur ne trouvait rien nulle part.

   Ici la question « ce film répond-il ? » a une réponse, et une seule.
   Les vues gardent leur façon de s'en servir.

   Pas d'index : à quelques milliers de fiches un balayage se fait en
   moins d'une image, et un index serait une structure de plus à tenir à
   jour à chaque écriture. */
import { motifById } from "./motifs";
import type { Film } from "../types";

/* Exportée sous son nom entier : le Générique s'en sert pour l'IDENTITÉ
   d'une personne — « decae » et « Decaë » sont le même chef opérateur, et
   la question « ces deux noms désignent-ils quelqu'un de commun » n'a pas
   plus de raison d'avoir deux réponses que « ce film répond-il ». */
export const normaliser = (s: string): string =>
  s
    .toLowerCase()
    /* Les accents sautent des deux côtés : on cherche « amelie » et on
       trouve « Amélie », ce qui est le comportement qu'on attend d'un
       champ de recherche même sans savoir le nommer. */
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/* CE SUR QUOI ON CHERCHE, ET DANS QUEL ORDRE D'IMPORTANCE.

   Le titre et le réalisateur d'abord — c'est ce qu'on tape neuf fois sur
   dix. Puis l'année, le casting, vos mots-clés et les motifs : ce sont
   des chemins de traverse, mais ils ne coûtent rien et ils rattrapent les
   fois où l'on ne se souvient QUE de ça. Le rang sert au tri.

   VOS PROPRES MOTS VIENNENT EN DERNIER, ET ILS MANQUAIENT.

   La visite guidée promettait depuis le début « un titre, un·e cinéaste,
   UN MOT DE VOS NOTES » — et la critique comme les notes libres étaient
   les deux seuls champs sur lesquels on ne cherchait pas. On pouvait
   écrire trois pages sur un film et ne jamais le retrouver par ce qu'on
   en avait dit.

   Bon dernier au classement, et c'est voulu : quelqu'un qui tape
   « Kurosawa » veut le cinéaste, pas les douze fiches où son nom est
   cité en passant. Mais il veut les trouver quand rien d'autre ne
   répond. */
const champs = (f: Film): { texte: string; rang: number }[] => [
  { texte: f.title || "", rang: 0 },
  { texte: f.director || "", rang: 1 },
  { texte: String(f.year || ""), rang: 2 },
  { texte: (f.cast || []).join(" "), rang: 3 },
  { texte: (f.themes || []).join(" "), rang: 4 },
  {
    texte: (f.motifs || [])
      .map((id) => motifById(id)?.label || "")
      .filter(Boolean)
      .join(" "),
    rang: 4,
  },
  { texte: sansJetons(f.review), rang: 5 },
  { texte: sansJetons(f.notes), rang: 5 },
];

/* LES PHOTOGRAMMES NE SONT PAS DES MOTS.

   Une critique porte ses captures sous la forme `[img:3]`, insérées au
   fil du texte. Les laisser entrer dans la recherche ferait répondre
   toute fiche illustrée à « img », ce qui n'est pas une réponse.

   La forme du jeton est recopiée ici plutôt qu'importée de
   `components/stills/tokens` : le domaine ne dépend d'aucun composant,
   et c'est cette règle-là qui lui permet d'être testé sans React. Si
   elle change là-bas, elle doit changer ici — ces deux lignes sont le
   prix de l'indépendance. */
const JETON_CAPTURE = /\[img:\d+\]/g;
const sansJetons = (s: string | undefined): string => (s || "").replace(JETON_CAPTURE, " ");

/** Le rang du meilleur champ touché, ou `null` si rien ne répond. */
export const scoreFilm = (f: Film, q: string): number | null => {
  const t = normaliser(q.trim());
  if (!t) return 0;
  let best: number | null = null;
  for (const { texte, rang } of champs(f)) {
    if (!texte) continue;
    const n = normaliser(texte);
    if (!n.includes(t)) continue;
    /* Un titre qui COMMENCE par ce qu'on tape passe devant celui qui le
       contient au milieu : « Solaris » avant « Le Solaris de minuit ». */
    const r = n.startsWith(t) ? rang - 0.5 : rang;
    if (best == null || r < best) best = r;
  }
  return best;
};

export const matchFilm = (f: Film, q: string): boolean => scoreFilm(f, q) !== null;

/**
 * Les films qui répondent, les plus pertinents d'abord.
 *
 * `limit = 0` veut dire « tous » : le mur filtre sa collection entière et
 * n'a pas de raison d'être tronqué comme une liste de suggestions.
 */
export const searchFilms = (films: Film[], q: string, limit = 12): Film[] => {
  const t = q.trim();
  if (!t) return limit > 0 ? films.slice(0, limit) : films;
  const notés: { f: Film; s: number }[] = [];
  for (const f of films) {
    const s = scoreFilm(f, t);
    if (s != null) notés.push({ f, s });
  }
  notés.sort((a, b) => a.s - b.s || a.f.title.localeCompare(b.f.title));
  const out = notés.map((n) => n.f);
  return limit > 0 ? out.slice(0, limit) : out;
};
