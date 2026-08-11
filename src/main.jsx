import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { CollectionPartagee, lireLAdresse } from "./views/CollectionPartagee";
import { applySkin, loadSkinKey } from "./theme/applySkin";
import "./index.css";

/* ============================================================
   DEUX PAGES, ET UNE SEULE APPLICATION
   ============================================================

   `#/chez/varda` ouvre la collection de quelqu'un d'autre. Ce n'est pas
   une vue du classeur : c'est une AUTRE page, qui ne charge ni la
   collection locale, ni le coffre, ni la synchronisation, ni la visite.
   Le tri se fait donc ici, avant que `App` ne monte — la monter pour la
   cacher ensuite lui ferait ouvrir IndexedDB et réveiller tout le
   reste, chez quelqu'un qui vient seulement regarder.

   La peau, elle, se pose quand même : une page du classeur qui n'aurait
   pas son papier ne ressemblerait à rien.
   ============================================================ */
const adresse = lireLAdresse();

if (adresse) applySkin(loadSkinKey());

/* PASSER D'UNE PAGE À L'AUTRE DEMANDE UN VRAI CHARGEMENT.

   Le tri ci-dessus n'a lieu qu'une fois, à l'ouverture. Coller une
   adresse `#/chez/…` dans la barre d'un classeur déjà ouvert ne
   changeait donc rien : le fragment bougeait, l'écran restait — observé
   en essai, et parfaitement déroutant.

   On recharge plutôt que de fabriquer un routeur : les deux pages ne
   partagent aucun état, l'une monte le coffre et la synchronisation que
   l'autre doit justement laisser dormir, et passer de l'une à l'autre
   est un geste rare. Un routeur coûterait ici plus cher que ce qu'il
   rendrait. */
addEventListener("hashchange", () => {
  const maintenant = lireLAdresse();
  const changéDePage = !!maintenant !== !!adresse || maintenant?.pseudo !== adresse?.pseudo;
  if (changéDePage) location.reload();
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {adresse ? <CollectionPartagee adresse={adresse} /> : <App />}
  </React.StrictMode>
);
