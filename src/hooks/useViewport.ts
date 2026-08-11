/* ============================================================
   LE GABARIT — la taille de la fenêtre, et la main qui la touche
   ============================================================

   Le classeur a été dessiné pour un bureau : un rail d'onglets sur la
   tranche, des boîtiers de quatre-vingt-seize pixels, un glisser-déposer
   à la souris. Rien de tout cela ne se lit sur un téléphone, et pour le
   savoir il faut poser la question à la fenêtre.

   ELLE SE POSE UNE FOIS, ET PAS PAR COMPOSANT. Un `resize` écouté dans
   chaque vue, c'est autant d'abonnements et autant de re-rendus à chaque
   pixel de redimensionnement. `matchMedia` ne parle que quand le seuil
   est FRANCHI : trois écouteurs pour toute l'application, et un re-rendu
   au moment exact où la mise en page doit changer.

   `useSyncExternalStore` plutôt qu'un `useState` dans un `useEffect` :
   la valeur est lue au premier rendu, et non au second. Un rail qui
   naît vertical pour devenir horizontal une trame plus tard, c'est un
   saut que l'on voit. */
import { useSyncExternalStore } from "react";
import { BP } from "../theme/tokens";

/** Ce que la fenêtre répond. Les trois tailles s'excluent. */
export interface Viewport {
  /** Sous le seuil `BP.phone` : une seule colonne, la navigation en pied. */
  phone: boolean;
  /** Entre les deux seuils : le rail tient, les grilles se resserrent. */
  tablet: boolean;
  /** Au-dessus de `BP.tablet` : le classeur tel qu'il a été dessiné. */
  desk: boolean;
  /* CE N'EST PAS LA MÊME QUESTION QUE LA LARGEUR. Une tablette posée en
     paysage est large ET tactile ; un navigateur réduit à trois cents
     pixels est étroit et se pilote à la souris. Les cibles de quarante-
     quatre pixels et le glissement au doigt répondent à `coarse`, les
     mises en page répondent à la largeur. Les confondre, c'est donner
     des boutons de doigt à une souris. */
  coarse: boolean;
}

const QUERIES = {
  phone: `(max-width: ${BP.phone - 1}px)`,
  tablet: `(min-width: ${BP.phone}px) and (max-width: ${BP.tablet - 1}px)`,
  desk: `(min-width: ${BP.tablet}px)`,
  coarse: "(pointer: coarse)",
} as const;

type Key = keyof typeof QUERIES;
const KEYS = Object.keys(QUERIES) as Key[];

/* Un environnement sans `matchMedia` doit rendre le bureau plutôt que
   rien : jsdom ne l'implémente pas de lui-même. La question se pose à
   chaque appel et non une fois pour toutes à l'import — un test qui pose
   sa doublure après le chargement du module resterait sinon face à la
   réponse figée du premier instant. */
const supported = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

const lists: Partial<Record<Key, MediaQueryList>> = {};
const listOf = (k: Key): MediaQueryList | undefined => {
  if (!supported()) return undefined;
  let l = lists[k];
  if (!l) {
    l = window.matchMedia(QUERIES[k]);
    lists[k] = l;
  }
  return l;
};

const DESK: Viewport = { phone: false, tablet: false, desk: true, coarse: false };

/* L'INSTANTANÉ EST MIS EN CACHE, ET C'EST OBLIGATOIRE.
   `useSyncExternalStore` compare l'ancienne et la nouvelle valeur par
   identité. Fabriquer un objet neuf à chaque lecture lui ferait croire
   à un changement à chaque rendu — et il boucle. On ne recompose donc
   l'objet que lorsqu'une requête a vraiment parlé. */
let snapshot: Viewport = DESK;
let dirty = true;

const read = (): Viewport => {
  if (!supported()) return DESK;
  if (dirty) {
    const next = Object.fromEntries(
      KEYS.map((k) => [k, listOf(k)?.matches ?? false])
    ) as unknown as Viewport;
    /* Aucune requête ne répond — un `matchMedia` bouchonné qui renvoie
       toujours faux, ce que font la plupart des doublures de test. On
       retombe alors sur le bureau plutôt que sur un gabarit sans nom. */
    if (!next.phone && !next.tablet) next.desk = true;
    snapshot = next;
    dirty = false;
  }
  return snapshot;
};

const subscribe = (onChange: () => void): (() => void) => {
  if (!supported()) return () => {};
  const fire = () => {
    dirty = true;
    onChange();
  };
  const attached = KEYS.map((k) => listOf(k)).filter((l): l is MediaQueryList => !!l);
  attached.forEach((l) => l.addEventListener("change", fire));
  return () => attached.forEach((l) => l.removeEventListener("change", fire));
};

/** Le gabarit courant. Un seul abonnement pour toute l'application. */
export const useViewport = (): Viewport => useSyncExternalStore(subscribe, read, () => DESK);

/** Pour les tests : oublier ce qui a été mesuré et mesurer de nouveau. */
export const resetViewport = (): void => {
  KEYS.forEach((k) => delete lists[k]);
  dirty = true;
};
