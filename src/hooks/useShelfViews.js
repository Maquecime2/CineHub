import { useCallback, useState } from "react";
import { makeView, layoutView, layoutByDirector, duplicateView, reflowView } from "../shelf-views";
import { saveView, saveViewIndex, deleteViewKey } from "../services/shelfViews";

/* The shelf's arrangement: { byWall: { watched: [id…] }, docs: { id: view } }.
   One document per view, each under its own key — writing a view touches
   only its own, the rest of the library is not re-serialised. */
export function useShelfViews(films) {
  const [views, setViews] = useState({ byWall: { watched: [], watchlist: [] }, docs: {} });

  /* All in `useCallback`: these are gestures, never rendering. They
     timestamp, and an impure function called during a render would be a
     fault — the rule holds for the compiler too, which flags it. */
  /* Overflow is an invariant, not a gesture: every write goes through
     it. Without it a row set to five would keep its twelve films and
     fold up like an accordion under a single board. */
  const commit = useCallback((next) => {
    const stamped = { ...reflowView(next), updatedAt: Date.now() };
    setViews((s) => ({ ...s, docs: { ...s.docs, [stamped.id]: stamped } }));
    saveView(stamped);
  }, []);

  const add = useCallback((wall, doc) => {
    setViews((s) => {
      const byWall = { ...s.byWall, [wall]: [...(s.byWall[wall] || []), doc.id] };
      saveViewIndex(byWall);
      return { byWall, docs: { ...s.docs, [doc.id]: doc } };
    });
    saveView(doc);
  }, []);

  const poolFor = (wall) =>
    films.filter((f) => (f.status === "watchlist") === (wall === "watchlist"));

  const create = useCallback(
    (wall, name) => {
      const blank = makeView({ wall, name: name || "Nouvelle vue", now: Date.now() });
      /* Leaving everything in the airlock would give an empty shelf and
       a heap: a brand-new view arrives already tidy, in boards of ten. */
      const doc = layoutView(blank, poolFor(wall));
      add(wall, doc);
      return doc.id;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [add, films]
  );

  /* The shelf by film-maker. It is born tidy — one line and one box per
     director — then it is a view like any other: nothing redoes it
     behind its back, and what one moves in it stays there. */
  const createByDirector = useCallback(
    (wall) => {
      const blank = makeView({ wall, name: "Par réalisateur", now: Date.now() });
      const doc = layoutByDirector(blank, poolFor(wall));
      add(wall, doc);
      return doc.id;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [add, films]
  );

  const copy = useCallback(
    (id) => {
      const src = views.docs[id];
      if (!src) return null;
      const doc = duplicateView(src, { now: Date.now() });
      add(src.wall, doc);
      return doc.id;
    },
    [views.docs, add]
  );

  /* Deleting the last view of a wall would leave the shelf with no
     arrangement at all: we refuse rather than build another one. */
  const remove = useCallback(
    (id) => {
      const doc = views.docs[id];
      if (!doc || (views.byWall[doc.wall] || []).length <= 1) return false;
      setViews((s) => {
        const byWall = { ...s.byWall, [doc.wall]: s.byWall[doc.wall].filter((x) => x !== id) };
        const docs = { ...s.docs };
        delete docs[id];
        saveViewIndex(byWall);
        return { byWall, docs };
      });
      deleteViewKey(id);
      return true;
    },
    [views]
  );

  return { views, setViews, commit, create, createByDirector, copy, remove };
}
