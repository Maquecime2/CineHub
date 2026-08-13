/* ============================================================
   THE ENGLISH CATALOGUE
   ============================================================

   It mirrors `fr.ts` key for key — the parity test refuses anything else.
   What it does NOT do is translate word for word: the French says
   "papier kraft, encre sépia, fil rouge" and the English says the same
   thing to an English ear, which is not the same words.

   The house voice carries over: concrete nouns, no exclamation marks, and
   a sentence that says what a thing IS rather than what it does.
   ============================================================ */

const en = {
  language: {
    title: "Language",
    close: "Close the language picker",
    open: "The binder's language",
    fr: "Français",
    en: "English",
    frNote: "le classeur dans sa langue d'origine",
    enNote: "the binder, in English",
  },

  surfaces: {
    paints: {
      platre: "Plaster",
      lin: "Linen",
      craie: "Chalk",
      ocre: "Pale ochre",
      terracotta: "Terracotta",
      rose: "Old rose",
      sauge: "Sage",
      eucalyptus: "Eucalyptus",
      ciel: "Faded sky",
      atelier: "Workwear blue",
      anthracite: "Anthracite",
      nuit: "Night",
    },
    patterns: {
      rayuresFines: "Fine stripes",
      rayuresLarges: "Wide stripes",
      quadrillage: "Grid",
      damier: "Chequerboard",
      pois: "Dots",
      chevrons: "Chevrons",
      ecailles: "Scales",
      fleurs: "Small flowers",
      tirets: "Dashes",
    },
    textures: {
      grain: "Grain",
      crepi: "Render",
      toile: "Canvas",
      beton: "Concrete",
    },
    materials: {
      chene: "Oak",
      noyer: "Walnut",
      teck: "Teak",
      ebene: "Ebony",
      bouleau: "Birch",
      ceruse: "Limed oak",
      merisier: "Cherry",
      acier: "Brushed steel",
      laiton: "Brass",
      noirMat: "Matt black",
      verre: "Glass",
      verreFume: "Smoked glass",
      beton: "Polished concrete",
      ardoise: "Slate",
      marbre: "Marble",
      blanc: "Lacquered white",
      vert: "Workshop green",
      bleu: "Midnight blue",
      rouge: "Garnet red",
      moutarde: "Mustard",
    },
    families: {
      bois: "Wood",
      metal: "Metal",
      verre: "Glass",
      pierre: "Stone",
      peint: "Painted",
    },
    finishes: {
      mat: "Matt",
      satine: "Satin",
      laque: "Lacquered",
    },
  },

  shelf: {
    woods: {
      kraft: "Kraft",
      noyer: "Walnut",
      ceruse: "Limed oak",
      nuit: "Night",
      atelier: "Workshop",
    },
    decor: {
      divider: "Divider",
      plant: "Houseplant",
      cactus: "Cactus",
      statuette: "Statuette",
      cat: "Ceramic cat",
      candle: "Candle",
      mug: "Mug",
      clock: "Alarm clock",
      books: "Stack of books",
      frame: "Photo frame",
      postcard: "Postcard",
      wallclock: "Wall clock",
      garland: "Garland",
      pennant: "Bunting",
      ivy: "Hanging ivy",
      tape: "Sticky tape",
    },
    kinds: {
      bedside: {
        title: "Bedside films",
        tag: "the ones you watch again",
      },
      main: {
        title: "The collection",
      },
      reserve: {
        title: "Set aside",
        tag: "kept, not thrown away",
      },
    },
  },
  palette: {
    families: {
      warm: "Warm",
      golden: "Golden",
      cool: "Cool",
      green: "Green",
      neutral: "Neutral",
    },
  },
  linkTypes: {
    book: "Book",
    painting: "Painting",
    film: "Film",
    other: "Another work",
  },

  skins: {
    carnet: { label: "Archivist's notebook", note: "kraft paper, sepia ink, a red thread" },
    veilleuse: { label: "Night light", note: "the same notebook, read after dark" },
    cinematheque: {
      label: "Cinematheque",
      note: "red velvet, gilding, the screen still black",
    },
    bauhaus: { label: "Bauhaus", note: "three primary colours and not one more" },
    "nuit-americaine": {
      label: "Day for night",
      note: "daylight shot for night, through a blue filter",
    },
    kodachrome: { label: "Kodachrome", note: "a slide left forgotten in its box" },
    herbier: { label: "Herbarium", note: "dried plates, handwritten labels" },
    bleu: { label: "Architect's blue", note: "white lines on ozalid paper" },
    pulp: { label: "Pulp", note: "a dog-eared paperback, loud orange, yellowed paper" },
    fanzine: { label: "Fanzine", note: "a botched photocopy: black, white and one red" },
    pastel: { label: "Pastel", note: "everything round, everything soft" },
    japon: { label: "Japanese paper", note: "indigo, off-white, one red seal" },
    sepia: { label: "Sepia", note: "a photograph looked at too often" },
    affiche: { label: "Polish poster", note: "greyish paper, three inks knocking together" },
  },
} as const;

export default en;
