/* ============================================================
   LE RYTHME DE LA SYNCHRONISATION
   ============================================================

   Quand elle se déclenche, et jamais plus souvent que nécessaire :

   — à l'ouverture, une fois le classeur chargé ;
   — au retour du réseau, parce que c'est le moment exact où ce qui
     attendait peut enfin partir ;
   — quand l'onglet redevient visible, parce qu'on revient d'ailleurs et
     qu'un autre appareil a peut-être parlé ;
   — et toutes les cinq minutes, faute de mieux.

   PAS À CHAQUE ÉCRITURE, et c'est délibéré : on écrit à chaque frappe
   dans une critique. Une synchronisation par frappe ferait de chaque
   note un aller-retour réseau, et de chaque panne un message d'erreur.
   Ce qui attend part au prochain passage — c'est tout l'intérêt d'avoir
   une liste d'attente plutôt qu'un envoi immédiat.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { lastReport, pending, synchronise, type SyncReport } from "../services/sync";
import { serverConfigured } from "../services/server";
import type { Film } from "../types";

const RYTHME_MS = 5 * 60 * 1000;

export function useSynchro(
  prêt: boolean,
  poser: (films: Film[]) => void,
  /** Appelé quand des documents sont entrés : à l'appelant de relire. */
  relireLesDocuments: () => void
) {
  const [bilan, setBilan] = useState<SyncReport>({
    state: serverConfigured() ? "no-account" : "absent",
    person: null,
    at: lastReport().at,
    pending: 0,
  });

  /* `poser` change à chaque rendu de l'application : le garder dans une
     référence évite de relancer la boucle à chaque fois. */
  const poserRef = useRef(poser);
  const relireRef = useRef(relireLesDocuments);
  useEffect(() => {
    poserRef.current = poser;
    relireRef.current = relireLesDocuments;
  }, [poser, relireLesDocuments]);
  const enCours = useRef(false);

  const lancer = useCallback(async () => {
    if (!serverConfigured() || enCours.current) return;
    enCours.current = true;
    setBilan((b) => ({ ...b, state: "running" }));
    try {
      const bilan = await synchronise((films) => poserRef.current(films));
      setBilan(bilan);
      if (bilan.documentsIn) relireRef.current();
    } finally {
      enCours.current = false;
    }
  }, []);

  useEffect(() => {
    if (!prêt || !serverConfigured()) return;
    lancer();

    const auRetour = () => lancer();
    const àLaVisite = () => {
      if (document.visibilityState === "visible") lancer();
    };
    window.addEventListener("online", auRetour);
    document.addEventListener("visibilitychange", àLaVisite);
    const minuteur = setInterval(lancer, RYTHME_MS);

    return () => {
      window.removeEventListener("online", auRetour);
      document.removeEventListener("visibilitychange", àLaVisite);
      clearInterval(minuteur);
    };
  }, [prêt, lancer]);

  /* Le compte de ce qui attend se relit à chaque rendu : il change quand
     on écrit, pas quand le réseau parle. */
  const attend = serverConfigured() ? pending() : 0;

  /* « À JOUR » NE PEUT PAS ÊTRE VRAI S'IL RESTE QUELQUE CHOSE À DIRE.

     Le bilan date du dernier tour ; on écrit entre deux tours. Le tiroir
     annonçait donc « à jour, à l'instant » avec une fiche en attente et
     le serveur éteint — techniquement le récit du dernier passage,
     pratiquement un mensonge. L'état affiché se déduit de ce qui attend,
     pas de ce qui s'est passé tout à l'heure. */
  const état = bilan.state === "up-to-date" && attend > 0 ? "waiting" : bilan.state;

  return { bilan: { ...bilan, état, pending: attend }, synchronise: lancer };
}
