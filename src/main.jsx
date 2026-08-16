import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { SharedCollectionView, readAddress } from "./views/SharedCollectionView";
import { applySkin, loadSkinKey } from "./theme/applySkin";
import { Boundary } from "./components/ui/Boundary";
import { FeedbackProvider } from "./components/ui/Feedback";
import "./index.css";

/* ============================================================
   TWO PAGES, AND ONE SINGLE APPLICATION
   ============================================================

   `#/chez/varda` opens somebody else's collection. That is not a view of
   the binder: it is ANOTHER page, which loads neither the local
   collection, nor the vault, nor the synchronisation, nor the tour. So
   the sorting happens here, before `App` mounts — mounting it and then
   hiding it would have it open IndexedDB and wake all the rest, for
   somebody who has only come to look.

   The skin, on the other hand, is applied anyway: a page of the binder
   without its paper would look like nothing at all.
   ============================================================ */
const address = readAddress();

if (address) applySkin(loadSkinKey());

/* ============================================================
   CHANGING PAGE WITHOUT A ROUTER
   ============================================================

   The sorting above happens once only, on opening. Pasting a
   `#/chez/…` address into the bar of an already open binder therefore
   changed nothing: the fragment moved, the screen stayed — observed in
   testing, and thoroughly baffling.

   We reload rather than build a router: the two pages share no state,
   one mounts the vault and the synchronisation that the other must
   precisely leave asleep, and moving from one to the other is a rare
   gesture. A router would cost more here than it saved.
   ============================================================ */
addEventListener("hashchange", () => {
  const current = readAddress();
  const pageChanged = !!current !== !!address || current?.pseudo !== address?.pseudo;
  if (pageChanged) location.reload();
});

/* LA DIGUE ET L'ANNOTATION SONT MONTÉES ICI, AUTOUR DES DEUX PAGES.

   La digue, parce que celle qui entoure la colonne de vue ne se protège
   pas elle-même : un défaut dans le rail, dans une couche globale ou
   dans le montage d'`App` lui-même la traverse, et il n'y avait aucune
   frontière d'erreur dans tout le projet — donc une page blanche.

   L'annotation, parce qu'elle est demandée depuis n'importe où : un
   import qui se termine, une note prise, un achat. Un fournisseur à la
   racine est ce qui permet de la dire sans passer une fonction de
   composant en composant. */
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Boundary>
      <FeedbackProvider>
        {address ? <SharedCollectionView address={address} /> : <App />}
      </FeedbackProvider>
    </Boundary>
  </React.StrictMode>
);
