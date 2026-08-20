/* ============================================================
   THE VIEWS — loading, writing, migration
   ============================================================

   One key per view, and not a single array: a drop then rewrites only
   the arrangement touched, not the whole library. On a large collection
   that is the difference between a write of a few dozen kilobytes and a
   write that brushes the quota. */
import { store } from "./storage";
import { documentsSettled } from "./documents";
import i18n from "../i18n";
import { VIEW_VERSION, upgradeView, buildViewsFromLegacy, fromRoom } from "../shelf-views";
import type { Divider, Film, FilmStatus, ShelfViews } from "../types";

/** A shelf view. Its shape lives in shelf-views.js, still in JavaScript. */
type ViewDoc = { id: string; wall: FilmStatus } & Record<string, unknown>;

export const VIEW_INDEX = "shelf-views";
export const viewKey = (id: string) => `shelf-view:${id}`;

/* L'INDEX DE « LA PIÈCE » SE LIT ENCORE, ET IL LE FAUT.

   Une version de ce classeur a écrit `{ version, order: [id…] }` — une
   liste PLATE, sans mur — là où celle-ci attend `{ byWall }`. Sans cette
   lecture, `loadViewIndex` rend `null`, « un index absent » fait tomber
   `ensureViews` dans `buildViewsFromLegacy`, et le classeur FABRIQUE des
   vues neuves par-dessus des vraies qui dorment au coffre.

   On rend donc les identifiants dans les DEUX formes. Le mur, lui, se
   décide document par document, dans `fromRoom` : l'index plat ne le
   connaît pas, et le deviner ici reviendrait à ranger de force. */
const namedInIndex = (): string[] | null => {
  const idx = store.get<{
    byWall?: Record<FilmStatus, string[]>;
    order?: string[];
  } | null>(VIEW_INDEX, null);
  if (idx?.byWall) return Object.values(idx.byWall).flat();
  return Array.isArray(idx?.order) ? idx.order : null;
};

const loadViewIndex = (): { byWall: Record<FilmStatus, string[]> } | null => {
  const idx = store.get<{ byWall?: Record<FilmStatus, string[]> } | null>(VIEW_INDEX, null);
  return idx?.byWall ? (idx as { byWall: Record<FilmStatus, string[]> }) : null;
};

export const saveViewIndex = (byWall: Record<FilmStatus, string[]>) =>
  store.set(VIEW_INDEX, { version: VIEW_VERSION, byWall });

const loadView = (id: string) => store.get<ViewDoc | null>(viewKey(id), null);

/* The quota message from `store` speaks of posters; here what is lost
   is an arrangement, and saying so is the only way the user will not
   believe their gesture was recorded. */
export const saveView = (view: ViewDoc) => {
  const ok = store.set(viewKey(view.id), view);
  if (!ok) alert(i18n.t("errors.viewNotSaved"));
  return ok;
};

/* PAR LE MAGASIN, ET NON PAR `localStorage` EN DIRECT.

   C'est ce détour qui pose la pierre tombale : sans lui la vue
   disparaissait ici et restait là-bas, indéfiniment. Voir `store.remove`,
   qui n'existait pas quand cette ligne a été écrite — d'où le contournement. */
export const deleteViewKey = (id: string) => store.remove(viewKey(id));

/* Build the views from the old arrangement, once.

   The guard is on the EXISTENCE of the index, never on "there is no
   divider": a user who has never laid one would otherwise get a
   brand-new view regenerated at every load, and lose their arrangement
   every time. */
export function ensureViews({
  films,
  dividers,
  wallPrefs,
  force = false,
}: {
  films: Film[];
  dividers: Divider[];
  wallPrefs: Record<string, unknown>;
  force?: boolean;
}): ShelfViews {
  if (!force) {
    const idx = loadViewIndex();
    if (idx) {
      const docs: Record<string, unknown> = {};
      for (const wall of Object.keys(idx.byWall) as FilmStatus[]) {
        for (const id of idx.byWall[wall]) {
          const v = loadView(id);
          if (!v) continue;
          /* A view from an earlier version is taken up HERE, at load
             time, and saved again. Leaving it as it is means leaving it
             in one big line until the user touches it — which is to say
             never. */
          const up = upgradeView(v);
          if (up !== v) store.set(viewKey(id), up);
          docs[id] = up;
        }
      }
      // an index leading nowhere is worth a missing index: we rebuild
      if (Object.keys(docs).length) return { byWall: idx.byWall, docs };
    }

    /* PAS D'INDEX D'ICI, MAIS PEUT-ÊTRE UN INDEX DE « LA PIÈCE ».
       On le reprend AVANT de fabriquer quoi que ce soit : fabriquer
       laisserait les vraies vues orphelines au coffre et donnerait
       l'impression de les avoir perdues. */
    const flat = namedInIndex();
    if (flat?.length) {
      const byWall: Record<FilmStatus, string[]> = { watched: [], watchlist: [] };
      const docs: Record<string, unknown> = {};
      for (const id of flat) {
        const v = loadView(id);
        if (!v) continue;
        for (const out of fromRoom(v) as ViewDoc[]) {
          const up = upgradeView(out) as ViewDoc;
          byWall[up.wall].push(up.id);
          docs[up.id] = up;
          store.set(viewKey(up.id), up);
        }
      }
      if (Object.keys(docs).length) {
        /* L'index repasse à la forme d'ici, une fois : sans cette
           écriture on referait la reprise à chaque ouverture, et le jour
           où la synchro parle, c'est l'index que l'autre appareil ne
           saurait pas lire qui partirait. */
        saveViewIndex(byWall);
        return { byWall, docs };
      }
    }
  }
  /* ON FABRIQUE POUR MONTRER, ON N'ÉCRIT QUE SI L'ON SAIT.

     Un navigateur neuf ne trouve aucun index — le tirage n'a pas encore
     eu lieu — et fabriquait ici un « rangement d'origine » qu'il
     ÉCRIVAIT aussitôt. Les vraies vues descendaient une seconde plus
     tard et reprenaient l'index, mais les fabriquées restaient sur le
     disque, partaient au serveur et venaient grossir les orphelines de
     l'autre session : des vues que personne n'a rangées, que rien ne
     nomme, et qui donnent l'impression d'avoir perdu les siennes.

     Tant que les documents ne sont pas descendus, ce qu'on bâtit est
     donc un PIS-ALLER D'AFFICHAGE et rien de plus. Un `force` reste une
     demande explicite et s'écrit, lui. */
  const persist = force || documentsSettled();
  // shelf-views.js is still in JavaScript: its parameters have no declared type
  const built: ViewDoc[] = buildViewsFromLegacy({
    films,
    dividers,
    wallPrefs,
    now: Date.now(),
  } as never);
  const byWall: Record<FilmStatus, string[]> = { watched: [], watchlist: [] };
  const docs: Record<string, unknown> = {};
  for (const v of built) {
    byWall[v.wall].push(v.id);
    docs[v.id] = v;
    if (persist) store.set(viewKey(v.id), v);
  }
  if (persist) saveViewIndex(byWall);
  return { byWall, docs };
}

/* ============================================================
   LES VUES ORPHELINES — présentes, et que rien ne liste
   ============================================================

   UN DOCUMENT DE VUE SANS ENTRÉE DANS L'INDEX EST INVISIBLE À JAMAIS.
   Le classeur n'affiche que ce que l'index nomme ; le reste dort sur le
   disque et sur le serveur sans que rien ne puisse y mener.

   Cet état existe pour une raison précise, désormais corrigée :
   supprimer une vue effaçait la clé sans poser de pierre tombale, donc
   le document restait sur le serveur. Une collection y montrait
   vingt-deux vues quand son index n'en nommait plus que quatre.

   LA RÉCUPÉRATION EST UN GESTE, PAS UNE RÈGLE. Adopter d'office tout ce
   qui traîne ferait revenir des vues que quelqu'un a supprimées exprès —
   et les faire revenir sans l'avoir demandé est pire que les avoir
   perdues. C'est donc au panneau de réparation d'appeler ceci, et à
   personne d'autre.
   ============================================================ */

/** Les vues présentes sur le disque que l'index ne nomme pas. */
export function orphanViews(): ViewDoc[] {
  const named = new Set(namedInIndex() ?? []);
  const found: ViewDoc[] = [];
  /* `store.keys()` ET NON UN PARCOURS DE `localStorage` : les vues sont
     COFFRÉES (`storage`, `VAULTED_PREFIXES`). Ce parcours ne voyait donc
     plus une seule d'entre elles, et le panneau de réparation — celui
     dont tout l'objet est de retrouver des vues perdues — annonçait
     « rien à récupérer » quoi qu'il arrive. */
  for (const key of store.keys()) {
    if (!key.startsWith("shelf-view:")) continue;
    const id = key.slice("shelf-view:".length);
    if (named.has(id)) continue;
    const doc = loadView(id);
    /* ON RECONNAÎT UNE VUE À SES RAYONS, ET PLUS SEULEMENT À SON MUR.

       La garde exigeait `wall`. Une vue venue de « la pièce » n'en porte
       plus : elle était donc REJETÉE, et ce panneau — dont tout l'objet
       est de retrouver des vues perdues — annonçait « rien à récupérer »
       exactement quand il y avait tout à récupérer. C'est le défaut déjà
       payé sur `store.keys()`, dix lignes plus haut. */
    if (doc?.shelves) found.push(doc);
  }
  return found;
}

/**
 * Remet les vues nommées dans l'index, à la fin de leur mur.
 *
 * À la FIN, et non au début : celles qu'on regarde n'ont pas à changer
 * de place parce qu'on en a retrouvé d'autres.
 */
export function adoptViews(ids: string[]): number {
  const idx = loadViewIndex();
  const byWall: Record<FilmStatus, string[]> = {
    watched: [...(idx?.byWall.watched ?? [])],
    watchlist: [...(idx?.byWall.watchlist ?? [])],
  };
  let taken = 0;
  for (const id of ids) {
    const doc = loadView(id);
    if (!doc?.shelves) continue;
    /* ON LA REPREND EN LA RETRANSFORMANT. Adoptée telle quelle, une vue
       de « la pièce » n'aurait pas de mur, s'afficherait du côté « vu »,
       et les fiches rangées sur sa PILE disparaîtraient au premier
       `reconcileView` sans un mot. `fromRoom` peut donc en rendre DEUX,
       et c'est le seul cas où adopter ÉCRIT. */
    for (const out of fromRoom(doc) as ViewDoc[]) {
      const up = upgradeView(out) as ViewDoc;
      if (byWall[up.wall].includes(up.id)) continue;
      if (up !== doc) store.set(viewKey(up.id), up);
      byWall[up.wall].push(up.id);
      taken += 1;
    }
  }
  if (taken > 0) saveViewIndex(byWall);
  return taken;
}

/**
 * Jeter des vues orphelines pour de bon.
 *
 * Elles partent PAR LE MAGASIN, donc une pierre tombale est posée et le
 * serveur les efface au tour suivant. C'est tout l'objet de la
 * correction qui a précédé : sans elle on ne pouvait pas jeter ce qu'on
 * voyait ici, puisque la suppression n'allait nulle part.
 *
 * L'index n'est pas touché : par définition il ne les nomme pas.
 */
export function discardViews(ids: string[]): number {
  let gone = 0;
  for (const id of ids) {
    /* Même raison qu'`orphanViews` : la vitrine ne tient plus ces
       clés, donc rien n'était jamais jeté. */
    if (!store.has(viewKey(id))) continue;
    deleteViewKey(id);
    gone += 1;
  }
  return gone;
}
