/* ============================================================
   LA MESURE — savoir d'où viennent les gens, sans savoir qui ils sont
   ============================================================

   Une instance Umami, hébergée par nous, et RIEN par défaut. Sans
   adresse, aucun script n'est chargé et aucune requête ne part : c'est
   la même règle que le serveur (`serverConfigured`), et pour la même
   raison — ce qui dépend du dehors est ABSENT en son absence, jamais à
   moitié là.

   ------------------------------------------------------------
   POURQUOI UMAMI, ET POURQUOI CHEZ NOUS
   ------------------------------------------------------------

   Il s'auto-héberge sur PostgreSQL, dont ce projet a déjà un. Il ne pose
   pas de cookie, donc pas de bandeau à faire cliquer. Et servi depuis un
   sous-domaine à nous, il ne ressemble pas à un script tiers, ce que les
   bloqueurs découpent en premier.

   CE QU'IL NE RÉPONDRA JAMAIS : « combien d'abonnements actifs ». C'est
   de la donnée métier, elle vit en SQL à côté de `purse`. Deux outils
   pour deux questions ; les mélanger donne deux chiffres qui se
   contredisent, et on finit par ne croire ni l'un ni l'autre.

   ------------------------------------------------------------
   LE SUIVI EST MANUEL, ET CE N'EST PAS UN RÉGLAGE
   ------------------------------------------------------------

   `data-auto-track="false"`, parce qu'en automatique Umami lit
   `location.href` telle quelle — donc `#/fiche/demo-mood`, donc quel
   film la personne possède. `placeToPage` existe pour couper cet
   identifiant, et l'automatique le contournerait. Voir `domain/address`,
   où la règle est écrite et testée.

   Ce qui sort d'ici, en tout et pour tout : une adresse de vue prise
   dans une liste fermée, et un nom d'événement pris dans une autre.
   Jamais un titre, jamais un identifiant, jamais un pseudonyme.
   ============================================================ */
import { placeToPage } from "../domain/address";
import type { Place } from "../domain/address";

/* Nettoyée comme celle du serveur, et pour la même raison qu'un test
   raconte là-bas : sous `cmd`, `set VITE_UMAMI=… && npm run build` fait
   entrer l'espace qui précède le `&&` dans la variable. */
export const UMAMI: string = (import.meta.env.VITE_UMAMI || "").trim().replace(/\/+$/, "");

export const UMAMI_ID: string = (import.meta.env.VITE_UMAMI_ID || "").trim();

/* PAS DE VALEUR PAR DÉFAUT EN DÉVELOPPEMENT, contrairement au serveur
   qui pointe sur `localhost:8787`. Une adresse par défaut ferait
   mesurer nos propres allers-retours, et les trente premières secondes
   qu'on veut observer sont celles de quelqu'un d'autre. */
export const measuring = (): boolean => UMAMI !== "" && UMAMI_ID !== "";

/* Ce qu'Umami pose sur la page. Déclaré au plus juste : on n'appelle que
   `track`, sous ses deux formes. */
interface Umami {
  track: ((payload: { url: string }) => void) & ((event: string) => void);
}
declare global {
  interface Window {
    umami?: Umami;
  }
}

let asked = false;

/**
 * Charge le script, une fois.
 *
 * Sans adresse, ne fait rien et ne dit rien — ce n'est pas une panne,
 * c'est une instance qu'on n'a pas.
 */
export function startMeasuring(): void {
  if (!measuring() || asked || typeof document === "undefined") return;
  asked = true;

  const tag = document.createElement("script");
  tag.async = true;
  tag.defer = true;
  tag.src = `${UMAMI}/script.js`;
  tag.dataset.websiteId = UMAMI_ID;
  /* LA LIGNE QUI TIENT LA PROMESSE. Voir l'en-tête : en automatique, le
     script rapporterait `location.href`, identifiant de fiche compris. */
  tag.dataset.autoTrack = "false";
  document.head.appendChild(tag);
}

/**
 * Une vue vue.
 *
 * L'adresse passe par `placeToPage`, qui coupe l'identifiant d'une
 * fiche. On ne prend PAS `location.hash` ici, et c'est délibéré : ce
 * serait rouvrir la porte que `placeToPage` ferme.
 */
export function pageSeen(place: Place): void {
  if (!measuring()) return;
  /* Le script est asynchrone : les premières vues arrivent avant lui.
     On les laisse tomber plutôt que de bâtir une file — une page vue
     manquée à l'ouverture se rattrape à la navigation suivante, et une
     file d'attente serait plus de code que ce que la mesure vaut. */
  window.umami?.track({ url: placeToPage(place) });
}

/**
 * LES GESTES DE LA PORTE, et rien d'autre.
 *
 * La liste est FERMÉE et vit ici : un événement qu'on peut composer est
 * un événement dans lequel finira par passer un titre de film. Les noms
 * sont stockés chez Umami, donc ils ne se renomment pas.
 */
export type Door =
  | "porte:import-lance"
  | "porte:import-abouti"
  | "porte:compte-cree"
  | "porte:demo-retiree"
  | "porte:coffre-protege";

export function doorEvent(what: Door): void {
  if (!measuring()) return;
  window.umami?.track(what);
}
