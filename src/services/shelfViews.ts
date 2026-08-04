/* ============================================================
   LES VUES — chargement, écriture, migration
   ============================================================

   Une clé par vue, et non un tableau unique : un dépôt réécrit alors le
   seul agencement touché, pas toute la bibliothèque. Sur une grande
   collection c'est la différence entre une écriture de quelques dizaines
   de kilo-octets et une écriture qui frôle le quota. */
import { store } from "./storage";
import { VIEW_VERSION, upgradeView, buildViewsFromLegacy } from "../shelf-views";
import type { Divider, Film, FilmStatus, ShelfViews } from "../types";

/** Une vue d'étagère. Sa forme vit dans shelf-views.js, encore en JavaScript. */
type ViewDoc = { id: string; wall: FilmStatus } & Record<string, unknown>;

export const VIEW_INDEX = "shelf-views";
export const viewKey = (id: string) => `shelf-view:${id}`;

const loadViewIndex = (): { byWall: Record<FilmStatus, string[]> } | null => {
  const idx = store.get<{ byWall?: Record<FilmStatus, string[]> } | null>(VIEW_INDEX, null);
  return idx?.byWall ? (idx as { byWall: Record<FilmStatus, string[]> }) : null;
};

export const saveViewIndex = (byWall: Record<FilmStatus, string[]>) =>
  store.set(VIEW_INDEX, { version: VIEW_VERSION, byWall });

const loadView = (id: string) => store.get<ViewDoc | null>(viewKey(id), null);

/* Le message de quota de `store` parle d'affiches ; ici ce qu'on perd
   est un rangement, et le dire est la seule façon que l'utilisateur ne
   croie pas son geste enregistré. */
export const saveView = (view: ViewDoc) => {
  const ok = store.set(viewKey(view.id), view);
  if (!ok) alert("Le rangement n'a pas pu être enregistré — espace de stockage plein.");
  return ok;
};

export const deleteViewKey = (id: string) => {
  try {
    localStorage.removeItem(viewKey(id));
  } catch {
    /* rien à faire */
  }
};

/* Fabriquer les vues à partir de l'ancien rangement, une fois.

   La garde porte sur l'EXISTENCE de l'index, jamais sur « il n'y a pas
   d'intercalaire » : un utilisateur qui n'en a jamais posé se verrait
   sinon regénérer une vue neuve à chaque chargement, et perdrait son
   agencement à chaque fois. */
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
          /* Une vue d'une version antérieure est reprise ICI, au
             chargement, et réenregistrée. La laisser telle quelle, c'est
             la laisser en une seule grosse ligne jusqu'à ce que
             l'utilisateur y touche — autant dire jamais. */
          const up = upgradeView(v);
          if (up !== v) store.set(viewKey(id), up);
          docs[id] = up;
        }
      }
      // un index qui ne mène à rien vaut un index absent : on refabrique
      if (Object.keys(docs).length) return { byWall: idx.byWall, docs };
    }
  }
  // shelf-views.js est encore en JavaScript : ses paramètres n'ont pas de type déclaré
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
    store.set(viewKey(v.id), v);
  }
  saveViewIndex(byWall);
  return { byWall, docs };
}
