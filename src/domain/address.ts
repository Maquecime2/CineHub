/* ============================================================
   L'ADRESSE D'UNE VUE — le classeur cesse d'être une seule page
   ============================================================

   La navigation était un ÉTAT : `view` dans `App`, et rien dans la barre
   d'adresse. Trois conséquences, dont une seule se voyait.

   Le retour arrière quittait le site. Une vue ne se partageait pas, ni
   même ne se remettait en favori. Et la troisième, invisible : toute
   mesure d'audience ne voit qu'UNE page vue pour la session entière,
   quel que soit l'outil — ce qui rend inexploitable la seule question
   qu'on veut poser à la porte, « jusqu'où sont-ils allés ».

   ------------------------------------------------------------
   DANS LE FRAGMENT, ET C'EST DÉJÀ TRANCHÉ
   ------------------------------------------------------------

   `SharedCollectionView` a posé la règle et l'argument avec :
   `#/chez/varda` vit dans le FRAGMENT parce que le classeur est publié
   en pages statiques. Un chemin inconnu y renvoie un 404 de l'hébergeur
   avant la moindre ligne de JavaScript, là où un fragment ne quitte
   jamais le navigateur — c'est ce qui fait marcher un lien sans un octet
   de configuration en face.

   Ce module étend ce schéma-là. Il n'en ouvre pas un second : deux
   routeurs sur une page sont deux routeurs qui se contredisent le jour
   où quelqu'un colle une adresse.

   CE QUE LE FRAGMENT NE DONNE PAS, et qu'il ne faut pas se promettre :
   le référencement. Les moteurs ignorent ce qui suit le `#`. Une page
   d'atterrissage qui doit être trouvée voudra un vrai chemin, donc une
   règle de réécriture chez l'hébergeur — c'est un autre chantier, et il
   ne commence pas ici.

   ------------------------------------------------------------
   LES MOTS SONT EN FRANÇAIS, ET NE CHANGENT PAS AVEC LA LANGUE
   ------------------------------------------------------------

   `#/chez/` l'est déjà, et une adresse qui se traduirait serait une
   adresse qu'on ne peut pas envoyer : le lien partagé cesserait de
   marcher chez qui lit le classeur en anglais. Une adresse est un
   identifiant, pas un libellé.

   ELLE EST DONC DÉFINITIVE, comme les identifiants de la boutique. La
   renommer casse les liens déjà envoyés et les favoris déjà posés.
   ============================================================ */
import type { View } from "../components/layout/FolderTabs";

/**
 * Où l'on est. `film` n'accompagne que `detail`.
 *
 * La personne ouverte dans le générique n'y est PAS, et c'est délibéré :
 * `who` est une clé normalisée du classeur local, qui ne désigne
 * personne ailleurs. L'adresse dirait un nom qui ne s'ouvrirait pas.
 * Le prix est connu — revenir en arrière depuis une personne rend le
 * générique, pas la personne précédente.
 */
export interface Place {
  view: View;
  film?: string;
}

/* LE MOT DE CHAQUE VUE. La table est écrite dans les deux sens plus bas
   à partir de celle-ci : une seule liste à tenir, donc pas de moitié
   qu'on oublie de mettre à jour.

   `detail` n'y est pas — elle porte un identifiant, et se lit à part. */
const SLUGS: Record<Exclude<View, "detail">, string> = {
  library: "mur",
  watchlist: "a-voir",
  credits: "generique",
  reco: "reco",
  constellation: "constellation",
  program: "programme",
  almanac: "almanach",
  thread: "fil",
  lists: "listes",
  quiz: "quiz",
  counter: "comptoir",
  import: "import",
  skinlab: "peaux",
};

const VIEW_OF = new Map<string, View>(
  Object.entries(SLUGS).map(([view, slug]) => [slug, view as View])
);

/** La vue sur laquelle on retombe : adresse vide, inconnue, ou fiche morte. */
export const HOME: View = "library";

/* Un identifiant de fiche est fabriqué par le classeur, pas saisi. On
   reste néanmoins strict : ce qui vient de la barre d'adresse est une
   entrée comme une autre, et cette forme est celle qui traverse un lien
   sans se faire réécrire. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** L'adresse d'un endroit, fragment compris. */
export function placeToHash(place: Place): string {
  if (place.view === "detail") {
    /* Une fiche sans identifiant n'est pas une adresse : on rend le mur
       plutôt qu'un `#/fiche/undefined` que personne ne saurait relire. */
    return place.film ? `#/fiche/${place.film}` : `#/${SLUGS[HOME as Exclude<View, "detail">]}`;
  }
  return `#/${SLUGS[place.view as Exclude<View, "detail">]}`;
}

/**
 * L'adresse qu'on a le droit de RAPPORTER, qui n'est pas celle qu'on affiche.
 *
 * ICI EST LA LIGNE, et elle vaut plus que tout le reste de ce module :
 * `#/fiche/demo-mood` dit quel film quelqu'un possède. Envoyé à une
 * instance de mesure, fût-elle la nôtre, c'est du contenu de collection
 * qui sort — dans un produit dont l'argument est que la collection ne
 * sort pas. On rapporte donc `#/fiche` et jamais l'identifiant.
 *
 * Le corollaire, qui n'est pas facultatif : la mesure d'audience doit
 * être en suivi MANUEL. Laissée en automatique, elle lit `location.href`
 * telle quelle et renvoie l'identifiant — cette fonction n'aurait alors
 * servi à rien.
 */
export function placeToPage(place: Place): string {
  return place.view === "detail" ? "#/fiche" : placeToHash(place);
}

/**
 * Lit une adresse du classeur.
 *
 * Rend `null` pour tout ce qui n'est pas à nous — l'adresse vide, une
 * collection partagée (`#/chez/…`), un mot inconnu. `null` veut dire
 * « ne touche à rien » et non « va à l'accueil » : c'est ce qui laisse
 * `main.jsx` trier ses deux pages sans que ce module ait à connaître
 * l'autre.
 */
export function readPlace(hash: string = location.hash): Place | null {
  const raw = hash.trim();

  const film = /^#\/fiche\/([^/?#]+)$/.exec(raw);
  if (film) {
    const id = decodeURIComponent(film[1]!);
    return ID.test(id) ? { view: "detail", film: id } : null;
  }

  const page = /^#\/([a-z-]+)$/.exec(raw);
  const view = page ? VIEW_OF.get(page[1]!) : undefined;
  return view ? { view } : null;
}

/** Les deux endroits sont-ils le même ? Pour ne pas réécrire une adresse identique. */
export const samePlace = (a: Place | null, b: Place | null): boolean =>
  a?.view === b?.view && (a?.film ?? null) === (b?.film ?? null);
