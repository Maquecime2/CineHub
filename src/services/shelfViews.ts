/* ============================================================
   THE VIEWS — loading, writing, migration
   ============================================================

   One key per view, and not a single array: a drop then rewrites only
   the arrangement touched, not the whole library. On a large collection
   that is the difference between a write of a few dozen kilobytes and a
   write that brushes the quota. */
import { store } from "./storage";
import { VIEW_VERSION, upgradeView, buildViewsFromLegacy } from "../shelf-views";
import type { Divider, Film, FilmStatus, ShelfViews } from "../types";

/** A shelf view. Its shape lives in shelf-views.js, still in JavaScript. */
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

/* The quota message from `store` speaks of posters; here what is lost
   is an arrangement, and saying so is the only way the user will not
   believe their gesture was recorded. */
export const saveView = (view: ViewDoc) => {
  const ok = store.set(viewKey(view.id), view);
  if (!ok) alert("Le rangement n'a pas pu être enregistré — espace de stockage plein.");
  return ok;
};

export const deleteViewKey = (id: string) => {
  try {
    localStorage.removeItem(viewKey(id));
  } catch {
    /* nothing to do */
  }
};

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
  }
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
    store.set(viewKey(v.id), v);
  }
  saveViewIndex(byWall);
  return { byWall, docs };
}
