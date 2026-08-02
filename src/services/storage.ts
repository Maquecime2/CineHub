/* ============================================================
   PERSISTANCE LOCALE — remplace le window.storage du runtime artefact.
   ============================================================ */

/** Les clés du localStorage, réunies pour qu'aucune ne se perde en chemin. */
export const KEYS = {
  films: "films",
  notes: "notebook-notes",
  dividers: "shelf-dividers",
} as const;

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
