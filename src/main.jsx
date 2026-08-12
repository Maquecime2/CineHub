import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { SharedCollectionView, readAddress } from "./views/SharedCollectionView";
import { applySkin, loadSkinKey } from "./theme/applySkin";
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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {address ? <SharedCollectionView address={address} /> : <App />}
  </React.StrictMode>
);
