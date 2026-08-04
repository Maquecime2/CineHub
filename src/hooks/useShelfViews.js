import { useCallback, useState } from "react";
import { makeView, layoutView, layoutByDirector, duplicateView, reflowView } from "../shelf-views";
import { saveView, saveViewIndex, deleteViewKey } from "../services/shelfViews";

/* Le rangement de l'étagère : { byWall: { watched: [id…] }, docs: { id: vue } }.
   Un document par vue, chacun dans sa propre clé — écrire une vue ne touche
   qu'à la sienne, le reste de la bibliothèque n'est pas re-sérialisé. */
export function useShelfViews(films) {
  const [views, setViews] = useState({ byWall: { watched: [], watchlist: [] }, docs: {} });

  /* Tous en `useCallback` : ce sont des gestes, jamais du rendu. Ils
     horodatent, et une fonction impure appelée pendant un rendu serait
     une faute — la règle vaut aussi pour le compilateur, qui la relève. */
  /* Le débordement est un invariant, pas un geste : toute écriture y
     passe. Sans quoi une rangée réglée à cinq garderait ses douze films
     et se replierait en accordéon sous une planche unique. */
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
      /* Tout laisser dans le sas donnerait une étagère vide et un tas :
       une vue neuve arrive déjà rangée, en planches d'une dizaine. */
      const doc = layoutView(blank, poolFor(wall));
      add(wall, doc);
      return doc.id;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [add, films]
  );

  /* L'étagère par cinéaste. Elle naît rangée — une ligne et une boîte par
     réalisateur — puis c'est une vue comme une autre : rien ne la refait
     dans son dos, et ce qu'on y déplace y reste. */
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

  /* Supprimer la dernière vue d'un mur laisserait l'étagère sans
     rangement du tout : on refuse plutôt que d'en refabriquer une. */
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
