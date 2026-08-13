/* ============================================================
   LE CATALOGUE FRANÇAIS — la langue d'origine du produit
   ============================================================

   C'est ici que vivent les phrases de l'écran, et nulle part ailleurs.
   Une chaîne écrite en dur dans une vue est une chaîne qui ne se traduit
   pas : le test de parité (`src/i18n/catalogue.test.ts`) surveille les
   clés, pas les oublis d'extraction — celui-là ne se voit qu'à l'œil.

   L'ORDRE SUIT LE PRODUIT, pas l'alphabet : `common` d'abord, puis une
   section par onglet, puis les catalogues de données (motifs, peaux,
   décors) et la visite guidée. On retrouve une phrase en pensant à
   l'endroit où on l'a vue.
   ============================================================ */

const fr = {
  language: {
    title: "La langue",
    close: "Fermer le choix de langue",
    open: "La langue du classeur",
    fr: "Français",
    en: "English",
    frNote: "la langue d'origine du classeur",
    enNote: "the binder, in English",
  },

  skins: {
    carnet: { label: "Carnet d'archiviste", note: "papier kraft, encre sépia, fil rouge" },
    veilleuse: { label: "Veilleuse", note: "le même carnet, lu de nuit" },
    cinematheque: {
      label: "Cinémathèque",
      note: "velours rouge, dorures, écran encore noir",
    },
    bauhaus: { label: "Bauhaus", note: "trois couleurs primaires et pas une de plus" },
    "nuit-americaine": {
      label: "Nuit américaine",
      note: "le jour tourné pour la nuit, filtre bleu",
    },
    kodachrome: { label: "Kodachrome", note: "diapositive oubliée dans sa boîte" },
    herbier: { label: "Herbier", note: "planches séchées, étiquettes manuscrites" },
    bleu: { label: "Bleu d'architecte", note: "traits blancs sur papier ozalid" },
    pulp: { label: "Pulp", note: "poche corné, orange criard, papier jauni" },
    fanzine: { label: "Fanzine", note: "photocopie ratée, noir, blanc et un rouge" },
    pastel: { label: "Pastel", note: "tout est rond, tout est doux" },
    japon: { label: "Papier Japon", note: "indigo, blanc cassé, un sceau rouge" },
    sepia: { label: "Sépia", note: "une photographie qu'on a trop regardée" },
    affiche: { label: "Affiche polonaise", note: "papier grisâtre, trois encres qui se cognent" },
  },
} as const;

export default fr;
