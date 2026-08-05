/* ============================================================
   LES PEAUX — de quoi le site entier est fait
   ============================================================

   Une peau n'est pas une palette. Changer huit couleurs et garder la
   même typographie, le même grain de papier et les mêmes onglets de
   carton, c'est repeindre un carnet d'archiviste en bleu : on obtient un
   carnet d'archiviste bleu. Une peau change donc quatre choses à la
   fois, et c'est ce qui fait qu'on passe vraiment d'un monde à l'autre :

     - LES TEINTES — les treize jetons de `tokens`.
     - LA TYPOGRAPHIE — les quatre rôles, avec les familles à charger.
     - LE FOND DE PAGE — pas une couleur, une recette : le kraft a des
       nappes plus claires là où la lumière tombe, un terminal n'a rien
       du tout, une peau néon a un halo.
     - LA FORME ET L'ATMOSPHÈRE — l'angle d'un onglet, le grain du
       papier, les ronds de café. Une peau brutaliste n'a pas d'arrondi
       et pas de taches : ce n'est pas une couleur qui le dit.

   LES NOMS DES JETONS NE VEULENT PLUS DIRE LEUR COULEUR. `burgundy`
   désigne « la teinte chaude qui porte l'identité » — un magenta dans la
   peau néon, un vert phosphore dans le terminal. Les renommer aurait
   touché six cent treize lignes pour ne rien changer à ce qu'on voit.

   Ce que les peaux NE touchent PAS :
     - le nuancier des objets rangés (`theme/palette`), qui appartient au
       rangement de l'utilisateur et non à l'habillage du site ;
     - le décor d'une vue d'étagère (`theme/surfaces`), choisi vue par
       vue et pour la même raison.
   Les deux sont expliqués là où ils vivent. */

export type Skin = {
  key: string;
  label: string;
  /** Une ligne pour dire ce qu'on regarde. Elle s'affiche au choix. */
  note: string;
  /** Le fond est-il sombre ? Sert à l'aperçu, et à rien d'autre. */
  dark?: boolean;
  c: Record<string, string>;
  fonts: { title: string; body: string; hand: string; mono: string };
  /** Ce qu'il faut demander à Google, tel quel dans l'adresse. */
  google: string[];
  /** Le fond de la page. Une recette entière, pas une couleur. */
  page: string;
  tag: { radius: string; tracking: string; transform: string };
  /* L'atmosphère est faite d'opacités et non de drapeaux : un grain à
     demi effacé est un réglage utile, et un `false` ne l'aurait pas
     permis. Zéro éteint. */
  atm: { grain: number; stain: number; vignette: number };
};

const KRAFT_PAGE = `
  radial-gradient(circle at 18% 12%, #F5EDD8 0%, transparent 45%),
  radial-gradient(circle at 82% 68%, #F2E9D2 0%, transparent 40%),
  radial-gradient(circle at 55% 100%, #E5D6B4 0%, transparent 50%),
  #EEE3CC`;

export const SKINS: Skin[] = [
  {
    key: "carnet",
    label: "Carnet d'archiviste",
    note: "papier kraft, encre sépia, fil rouge",
    c: {
      paper: "#EEE3CC",
      paperDark: "#E2D3AE",
      card: "#F6EFDE",
      ink: "#2B2620",
      inkFaded: "#6E6153",
      burgundy: "#8C3A34",
      ochre: "#B9862E",
      pine: "#3E5B4B",
      slate: "#5C6B78",
      line: "#C9B98F",
      cobalt: "#3A5C8C",
      vermillion: "#C4562E",
      moss: "#6E7A3A",
    },
    fonts: {
      title: "'Playfair Display', serif",
      body: "'Lora', Georgia, serif",
      hand: "'Caveat', cursive",
      mono: "'Special Elite', monospace",
    },
    google: [
      "Playfair+Display:ital,wght@0,600;0,700;1,500;1,600",
      "Lora:ital,wght@0,400;0,500;1,400",
      "Caveat:wght@500;600;700",
      "Special+Elite",
    ],
    page: KRAFT_PAGE,
    tag: { radius: "3px", tracking: "1.5px", transform: "none" },
    atm: { grain: 1, stain: 1, vignette: 1 },
  },

  {
    key: "veilleuse",
    label: "Veilleuse",
    note: "le même carnet, lu de nuit",
    dark: true,
    c: {
      paper: "#211E1B",
      paperDark: "#191714",
      card: "#2B2724",
      ink: "#E8DFCC",
      inkFaded: "#9E9282",
      burgundy: "#C4675E",
      ochre: "#D6A957",
      pine: "#7FA88C",
      slate: "#8A9CAB",
      line: "#4A443C",
      cobalt: "#7A9AC8",
      vermillion: "#E08154",
      moss: "#A3B06A",
    },
    fonts: {
      title: "'Playfair Display', serif",
      body: "'Lora', Georgia, serif",
      hand: "'Caveat', cursive",
      mono: "'Special Elite', monospace",
    },
    google: [
      "Playfair+Display:ital,wght@0,600;0,700;1,500;1,600",
      "Lora:ital,wght@0,400;0,500;1,400",
      "Caveat:wght@500;600;700",
      "Special+Elite",
    ],
    page: `
      radial-gradient(circle at 22% 8%, #2E2926 0%, transparent 48%),
      radial-gradient(circle at 78% 72%, #262220 0%, transparent 44%),
      #211E1B`,
    tag: { radius: "3px", tracking: "1.5px", transform: "none" },
    atm: { grain: 0.6, stain: 0.35, vignette: 1 },
  },

  {
    key: "cinematheque",
    label: "Cinémathèque",
    note: "velours rouge, dorures, écran encore noir",
    dark: true,
    c: {
      paper: "#17100F",
      paperDark: "#0F0A0A",
      card: "#241715",
      ink: "#F0E2CB",
      inkFaded: "#A38F79",
      burgundy: "#A81E28",
      ochre: "#C9A227",
      pine: "#4E6B52",
      slate: "#7C6E63",
      line: "#4A322C",
      cobalt: "#5B6E9E",
      vermillion: "#D9542B",
      moss: "#8C8443",
    },
    fonts: {
      title: "'Poiret One', cursive",
      body: "'Cormorant Garamond', serif",
      hand: "'Parisienne', cursive",
      mono: "'Josefin Sans', sans-serif",
    },
    google: [
      "Poiret+One",
      "Cormorant+Garamond:ital,wght@0,400;0,600;1,400",
      "Parisienne",
      "Josefin+Sans:wght@400;600",
    ],
    page: `
      radial-gradient(ellipse at 50% -10%, #3A1C1C 0%, transparent 55%),
      radial-gradient(circle at 50% 110%, #241413 0%, transparent 50%),
      #17100F`,
    tag: { radius: "0px", tracking: "3px", transform: "uppercase" },
    atm: { grain: 0.5, stain: 0, vignette: 1 },
  },

  {
    key: "bauhaus",
    label: "Bauhaus",
    note: "trois couleurs primaires et pas une de plus",
    c: {
      paper: "#F2F0EB",
      paperDark: "#E2DFD7",
      card: "#FFFFFF",
      ink: "#111111",
      inkFaded: "#6B6B6B",
      burgundy: "#D32F2F",
      ochre: "#F2B705",
      pine: "#1B7F5C",
      slate: "#37474F",
      line: "#111111",
      cobalt: "#1954A6",
      vermillion: "#E8541E",
      moss: "#7A8B1F",
    },
    fonts: {
      title: "'Archivo Black', sans-serif",
      body: "'Archivo', sans-serif",
      hand: "'Archivo', sans-serif",
      mono: "'Space Mono', monospace",
    },
    google: ["Archivo+Black", "Archivo:wght@400;500;700", "Space+Mono:wght@400;700"],
    page: `#F2F0EB`,
    tag: { radius: "0px", tracking: "2px", transform: "uppercase" },
    atm: { grain: 0, stain: 0, vignette: 0 },
  },

  {
    key: "terminal",
    label: "Terminal",
    note: "phosphore vert, quarante colonnes",
    dark: true,
    c: {
      paper: "#0A0F0A",
      paperDark: "#060906",
      card: "#0F160F",
      ink: "#7DF37D",
      inkFaded: "#3E8C4E",
      burgundy: "#39FF6A",
      ochre: "#9BFF57",
      pine: "#2FBF6B",
      slate: "#4E9E7A",
      line: "#1F3D26",
      cobalt: "#38D9A9",
      vermillion: "#B6FF3D",
      moss: "#6BE86B",
    },
    fonts: {
      title: "'VT323', monospace",
      body: "'IBM Plex Mono', monospace",
      hand: "'VT323', monospace",
      mono: "'IBM Plex Mono', monospace",
    },
    google: ["VT323", "IBM+Plex+Mono:wght@400;500;600"],
    page: `
      repeating-linear-gradient(0deg, #0000 0 2px, #00ff6a08 2px 4px),
      radial-gradient(ellipse at 50% 50%, #0E1A0E 0%, #060906 80%)`,
    tag: { radius: "0px", tracking: "2px", transform: "uppercase" },
    atm: { grain: 0.35, stain: 0, vignette: 1 },
  },

  {
    key: "neon",
    label: "Néon",
    note: "une nuit de synthèse, magenta et cyan",
    dark: true,
    c: {
      paper: "#140B29",
      paperDark: "#0C0619",
      card: "#1F1140",
      ink: "#F2E9FF",
      inkFaded: "#9B87C4",
      burgundy: "#FF2E88",
      ochre: "#FFB627",
      pine: "#00E5A0",
      slate: "#7C6BB5",
      line: "#3D2A6B",
      cobalt: "#22D3EE",
      vermillion: "#FF6B35",
      moss: "#9EF01A",
    },
    fonts: {
      title: "'Orbitron', sans-serif",
      body: "'Rajdhani', sans-serif",
      hand: "'Caveat', cursive",
      mono: "'Share Tech Mono', monospace",
    },
    google: [
      "Orbitron:wght@500;700",
      "Rajdhani:wght@400;500;600",
      "Caveat:wght@500;600;700",
      "Share+Tech+Mono",
    ],
    page: `
      radial-gradient(circle at 15% 8%, #FF2E8833 0%, transparent 45%),
      radial-gradient(circle at 85% 75%, #22D3EE2E 0%, transparent 45%),
      linear-gradient(180deg, #1B0F35, #0C0619)`,
    tag: { radius: "0px", tracking: "3px", transform: "uppercase" },
    atm: { grain: 0.25, stain: 0, vignette: 1 },
  },

  {
    key: "herbier",
    label: "Herbier",
    note: "planches séchées, étiquettes manuscrites",
    c: {
      paper: "#F0EDE0",
      paperDark: "#DFDAC6",
      card: "#F8F6EE",
      ink: "#33362C",
      inkFaded: "#6F7362",
      burgundy: "#7A5C3E",
      ochre: "#A98A45",
      pine: "#4A6B4A",
      slate: "#6B7A72",
      line: "#C3BFA4",
      cobalt: "#4F6E82",
      vermillion: "#B26340",
      moss: "#77854A",
    },
    fonts: {
      title: "'EB Garamond', serif",
      body: "'EB Garamond', serif",
      hand: "'Petit Formal Script', cursive",
      mono: "'Cormorant SC', serif",
    },
    google: [
      "EB+Garamond:ital,wght@0,400;0,600;1,400",
      "Petit+Formal+Script",
      "Cormorant+SC:wght@400;600",
    ],
    page: `
      radial-gradient(circle at 25% 15%, #F7F4E8 0%, transparent 50%),
      radial-gradient(circle at 75% 80%, #E9E5D2 0%, transparent 45%),
      #F0EDE0`,
    tag: { radius: "8px", tracking: "1px", transform: "none" },
    atm: { grain: 0.8, stain: 0.5, vignette: 0.6 },
  },

  {
    key: "bleu",
    label: "Bleu d'architecte",
    note: "traits blancs sur papier ozalid",
    dark: true,
    c: {
      paper: "#0E2A47",
      paperDark: "#0A2038",
      card: "#123457",
      ink: "#DCEBF7",
      inkFaded: "#7FA6C4",
      burgundy: "#FF8A5B",
      ochre: "#F2C14E",
      pine: "#5FD3A6",
      slate: "#88AECB",
      line: "#2A567A",
      cobalt: "#63B3ED",
      vermillion: "#FF7A45",
      moss: "#A8D06A",
    },
    fonts: {
      title: "'Saira Condensed', sans-serif",
      body: "'Roboto Condensed', sans-serif",
      hand: "'Caveat', cursive",
      mono: "'Share Tech Mono', monospace",
    },
    google: [
      "Saira+Condensed:wght@400;600;700",
      "Roboto+Condensed:wght@400;700",
      "Caveat:wght@500;600;700",
      "Share+Tech+Mono",
    ],
    page: `
      repeating-linear-gradient(0deg, #ffffff0a 0 1px, transparent 1px 28px),
      repeating-linear-gradient(90deg, #ffffff0a 0 1px, transparent 1px 28px),
      linear-gradient(160deg, #124063, #0A2038)`,
    tag: { radius: "0px", tracking: "2.5px", transform: "uppercase" },
    atm: { grain: 0.3, stain: 0, vignette: 0.8 },
  },

  {
    key: "pulp",
    label: "Pulp",
    note: "poche corné, orange criard, papier jauni",
    c: {
      paper: "#EDD9AE",
      paperDark: "#DCC28C",
      card: "#F7E9C6",
      ink: "#2A1D10",
      inkFaded: "#6E5638",
      burgundy: "#B32B17",
      ochre: "#E08A1E",
      pine: "#4B6B33",
      slate: "#7A5F45",
      line: "#B99B65",
      cobalt: "#2F5C7A",
      vermillion: "#E2521C",
      moss: "#8A8B2C",
    },
    fonts: {
      title: "'Alfa Slab One', cursive",
      body: "'Bitter', serif",
      hand: "'Caveat', cursive",
      mono: "'Oswald', sans-serif",
    },
    google: [
      "Alfa+Slab+One",
      "Bitter:wght@400;600",
      "Caveat:wght@500;600;700",
      "Oswald:wght@400;600",
    ],
    page: `
      radial-gradient(circle at 20% 10%, #F6E6BE 0%, transparent 45%),
      radial-gradient(circle at 80% 85%, #E3C88F 0%, transparent 45%),
      #EDD9AE`,
    tag: { radius: "2px", tracking: "1.5px", transform: "uppercase" },
    atm: { grain: 1, stain: 0.8, vignette: 1 },
  },

  {
    key: "fanzine",
    label: "Fanzine",
    note: "photocopie ratée, noir, blanc et un rouge",
    c: {
      paper: "#EDEDE8",
      paperDark: "#D8D8D2",
      card: "#FFFFFF",
      ink: "#0A0A0A",
      inkFaded: "#5A5A5A",
      burgundy: "#E01B24",
      ochre: "#1A1A1A",
      pine: "#2E2E2E",
      slate: "#4A4A4A",
      line: "#0A0A0A",
      cobalt: "#3A3A3A",
      vermillion: "#E01B24",
      moss: "#6A6A6A",
    },
    fonts: {
      title: "'Anton', sans-serif",
      body: "'Roboto Condensed', sans-serif",
      hand: "'Permanent Marker', cursive",
      mono: "'Courier Prime', monospace",
    },
    google: [
      "Anton",
      "Roboto+Condensed:wght@400;700",
      "Permanent+Marker",
      "Courier+Prime:wght@400;700",
    ],
    page: `#EDEDE8`,
    tag: { radius: "0px", tracking: "1px", transform: "uppercase" },
    atm: { grain: 1, stain: 0.3, vignette: 0 },
  },

  {
    key: "pastel",
    label: "Pastel",
    note: "tout est rond, tout est doux",
    c: {
      paper: "#FBF3F6",
      paperDark: "#F0E2EA",
      card: "#FFFFFF",
      ink: "#4A4256",
      inkFaded: "#8E85A0",
      burgundy: "#E8899C",
      ochre: "#F2C48B",
      pine: "#8ECFAE",
      slate: "#9DB4D8",
      line: "#E4D4E0",
      cobalt: "#8FB8E8",
      vermillion: "#F2A08B",
      moss: "#B7D48E",
    },
    fonts: {
      title: "'Quicksand', sans-serif",
      body: "'Nunito', sans-serif",
      hand: "'Gloria Hallelujah', cursive",
      mono: "'Quicksand', sans-serif",
    },
    google: ["Quicksand:wght@400;500;700", "Nunito:wght@400;600", "Gloria+Hallelujah"],
    page: `
      radial-gradient(circle at 18% 10%, #FDEBF2 0%, transparent 50%),
      radial-gradient(circle at 82% 80%, #EDF3FD 0%, transparent 50%),
      #FBF3F6`,
    tag: { radius: "14px", tracking: "0.5px", transform: "none" },
    atm: { grain: 0, stain: 0, vignette: 0 },
  },

  {
    key: "brutaliste",
    label: "Brutaliste",
    note: "aucun arrondi, aucune tache, aucune excuse",
    c: {
      paper: "#FFFFFF",
      paperDark: "#EAEAEA",
      card: "#FFFFFF",
      ink: "#000000",
      inkFaded: "#666666",
      burgundy: "#000000",
      ochre: "#000000",
      pine: "#000000",
      slate: "#000000",
      line: "#000000",
      cobalt: "#0000FF",
      vermillion: "#FF0000",
      moss: "#000000",
    },
    fonts: {
      title: "'Inter', sans-serif",
      body: "'Inter', sans-serif",
      hand: "'Inter', sans-serif",
      mono: "'Inter', sans-serif",
    },
    google: ["Inter:wght@400;600;900"],
    page: `#FFFFFF`,
    tag: { radius: "0px", tracking: "0px", transform: "uppercase" },
    atm: { grain: 0, stain: 0, vignette: 0 },
  },

  {
    key: "sepia",
    label: "Sépia",
    note: "une photographie qu'on a trop regardée",
    c: {
      paper: "#E8DAC3",
      paperDark: "#D6C4A6",
      card: "#F2E7D3",
      ink: "#3B2C1C",
      inkFaded: "#7A6549",
      burgundy: "#8A5A3C",
      ochre: "#A88248",
      pine: "#6B6647",
      slate: "#7E7157",
      line: "#BFA982",
      cobalt: "#6E6A55",
      vermillion: "#9E6640",
      moss: "#87804F",
    },
    fonts: {
      title: "'Cormorant Garamond', serif",
      body: "'Crimson Text', serif",
      hand: "'Caveat', cursive",
      mono: "'Courier Prime', monospace",
    },
    google: [
      "Cormorant+Garamond:ital,wght@0,400;0,600;1,400",
      "Crimson+Text:ital,wght@0,400;0,600;1,400",
      "Caveat:wght@500;600;700",
      "Courier+Prime:wght@400;700",
    ],
    page: `
      radial-gradient(circle at 50% 20%, #F0E3CC 0%, transparent 55%),
      radial-gradient(circle at 50% 100%, #D2BE9C 0%, transparent 55%),
      #E8DAC3`,
    tag: { radius: "2px", tracking: "1.5px", transform: "none" },
    atm: { grain: 1, stain: 0.6, vignette: 1 },
  },

  {
    key: "abysse",
    label: "Abysse",
    note: "très loin sous la surface",
    dark: true,
    c: {
      paper: "#0B1B22",
      paperDark: "#07131A",
      card: "#11262F",
      ink: "#D6EEF2",
      inkFaded: "#6E97A3",
      burgundy: "#2FB6A8",
      ochre: "#6FD3C0",
      pine: "#2E8C7E",
      slate: "#5E8CA0",
      line: "#1E3D48",
      cobalt: "#3E9BD1",
      vermillion: "#4FD1C5",
      moss: "#79B88C",
    },
    fonts: {
      title: "'Marcellus', serif",
      body: "'Lato', sans-serif",
      hand: "'Caveat', cursive",
      mono: "'Barlow Condensed', sans-serif",
    },
    google: [
      "Marcellus",
      "Lato:wght@400;700",
      "Caveat:wght@500;600;700",
      "Barlow+Condensed:wght@400;600",
    ],
    page: `
      radial-gradient(ellipse at 50% -20%, #1B4A57 0%, transparent 60%),
      linear-gradient(180deg, #0E2029, #07131A)`,
    tag: { radius: "10px", tracking: "2px", transform: "none" },
    atm: { grain: 0.3, stain: 0, vignette: 1 },
  },
];

export const DEFAULT_SKIN = "carnet";

export const skinOf = (key?: string): Skin => SKINS.find((s) => s.key === key) || SKINS[0]!;
