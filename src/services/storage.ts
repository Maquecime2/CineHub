/* ============================================================
   PERSISTANCE LOCALE — remplace le window.storage du runtime artefact.
   ============================================================ */

/** Les clés du localStorage, réunies pour qu'aucune ne se perde en chemin. */
export const KEYS = {
  films: "films",
  notes: "notebook-notes",
  dividers: "shelf-dividers",
  onboarding: "onboarding",
} as const;

/* Le registre des dates vit dans `documents`, qui écrit lui-même par ce
   magasin : on le charge à la volée pour ne pas nouer les deux modules
   l'un à l'autre au chargement. La promesse n'est pas attendue — dater
   un document ne doit jamais retarder son écriture. */
const noterSiSynchronisable = async (clé: string): Promise<void> => {
  const { estSynchronisable, noterDocument } = await import("./documents");
  if (estSynchronisable(clé)) noterDocument(clé);
};

export const store = {
  get: <T>(k: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  /* Le quota localStorage (~5 Mo) est la vraie limite quand on colle des
     affiches en data URI : on prévient au lieu de perdre l'écriture. */
  set: (k: string, v: unknown): boolean => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      /* LA DATE SE POSE ICI, ET C'EST TOUT L'INTÉRÊT DE LA POSER ICI.

         Six services écrivent des documents — l'étagère, le carnet, les
         fils, le vocabulaire, les décors, les préférences du mur — et
         aucun ne date ce qu'il écrit. Demander à chacun d'y penser,
         c'est se garantir qu'un l'oubliera, et qu'un pan du classeur ne
         se synchronisera jamais sans que rien ne le signale.

         L'import est différé pour une raison bête et réelle : le
         registre des dates s'écrit lui-même par ce magasin, et un import
         direct fabriquerait une boucle entre les deux modules. */
      void noterSiSynchronisable(k);
      return true;
    } catch (e) {
      console.error(e);
      if (String((e as Error)?.name || "").includes("Quota")) {
        alert(
          "Espace de stockage plein.\n\nLes affiches importées depuis votre disque sont les plus lourdes : préférez une adresse d'image (clic droit → copier l'adresse de l'image) ou l'enrichissement TMDB, qui ne stockent qu'un lien."
        );
      }
      return false;
    }
  },
};
