/* ============================================================
   LES NOMS DE PAYS ET DE LANGUES
   ============================================================

   Le domaine rend des codes ISO parce qu'il ne sait pas dans quelle
   langue on le lira ; ce sont les vues qui le savent. Elles étaient
   deux à le savoir — l'almanach et la fiche — d'où ce module : une
   seule table, et pas deux traductions du même code qui divergent.

   `Intl.DisplayNames` fait le travail sans la moindre table à tenir à
   jour : deux cent cinquante pays et sept mille langues vivent déjà
   dans le navigateur. Le repli est le code lui-même — mieux vaut lire
   « ZZ » qu'un vide. */
const nomDe = (type: "region" | "language") => {
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames(["fr"], { type });
  } catch {
    dn = null;
  }
  return (code: string): string => {
    try {
      return dn?.of(code) || code;
    } catch {
      return code;
    }
  };
};

export const nomPays = nomDe("region");
export const nomLangue = nomDe("language");
