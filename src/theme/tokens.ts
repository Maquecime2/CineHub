/* ============================================================
   TOKENS — carnet d'archiviste : papier kraft, encre, fil rouge
   ============================================================ */

export const C = {
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
  // accents — des touches plus vives qui percent le kraft
  cobalt: "#3A5C8C",
  vermillion: "#C4562E",
  moss: "#6E7A3A",
} as const;

export const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500;1,600&family=Lora:ital,wght@0,400;0,500;1,400&family=Caveat:wght@500;600;700&family=Special+Elite&display=swap');

::selection { background: ${C.ochre}66; color: ${C.ink}; }

body { background: ${C.paper}; }

/* la molette fait défiler un dossier, pas une page web */
::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-track { background: ${C.paperDark}; }
::-webkit-scrollbar-thumb { background: ${C.line}; border: 2px solid ${C.paperDark}; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: ${C.inkFaded}; }

@keyframes swayIn { from { opacity: 0; transform: translateY(10px) rotate(var(--tilt, 0deg)); } to { opacity: 1; transform: translateY(0) rotate(var(--tilt, 0deg)); } }

/* l'ouverture du boîtier : le rabat pivote, l'affiche sort de son logement,
   la fiche arrive en dernier — dans cet ordre, sinon rien ne se lit. */
@keyframes openLid { from { transform: rotateY(0deg); } to { transform: rotateY(-158deg); } }
@keyframes slideOut { from { opacity: 0; transform: translateX(-34px) rotate(-4deg); } to { opacity: 1; transform: none; } }
@keyframes caseIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes sheetIn { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }

/* Pendant un glissement, la languette du tiroir s'annonce comme cible.
   En CSS et non en état React : un setState ici re-rendrait tout le
   rayon au moment précis où la souris commence à bouger. */
html[data-dragging="1"] [data-drawer-tab] { background: ${C.ochre} !important; }

/* Un panneau ouvert pose un voile plein écran pour se refermer au premier
   clic à côté. Mais on TIRE un objet du cabinet vers une planche : ce
   voile recevrait le dépôt à la place du rayon. Pendant un glissement il
   se retire donc du chemin, sans cesser d'exister. */
html[data-dragging="1"] [data-veil] { pointer-events: none; }

/* Le repère se pose, il ne s'allume pas. Sa transition vit ICI et non dans
   le style en ligne, et c'est délibéré : le code de glissement doit pouvoir
   la couper le temps d'une trame (pour placer le repère sans qu'il traverse
   l'étagère depuis sa place précédente) puis la rendre en effaçant
   simplement la propriété en ligne — ce qui ne marcherait pas si la valeur
   de repos venait, elle aussi, du style en ligne. */
[data-drop-mark] {
  transition: transform .24s cubic-bezier(.2,.88,.3,1), opacity .22s ease-out;
}

/* Les cibles de dépôt s'annoncent, elles aussi en CSS : une catégorie qui
   va recevoir un film s'éclaire, une rangée vide se signale, une couture
   entre deux rangées se creuse. Tout passe par un attribut écrit à la
   main sur le nœud — c'est la même règle que la languette ci-dessus, et
   pour la même raison. */
[data-cat-over="1"] { background: var(--cat-open, ${C.ochre}22) !important; }
[data-row-over="1"] { box-shadow: inset 0 0 0 1px ${C.ochre}66; }
[data-seam-over="1"] { background: ${C.ochre}44; }
[data-row-seam] { transition: background .12s ease, height .12s ease; }

/* L'encre du repère de dépôt vient du thème de la vue. En variable CSS et
   non en prop React : changer de thème ne doit toucher à rien de ce que
   le glissement manipule.

   L'ombre en est exclue : elle est faite de ces mêmes chemins, décalés,
   et les repeindre à l'encre du thème lui ôtait sa raison d'être — un
   trait pâle sous le trait, de la même couleur, ne pose rien sur rien. */
[data-drop-mark] svg > path { stroke: var(--mark-ink, ${C.burgundy}); }
[data-drop-mark] svg > path[fill] { fill: var(--mark-ink, ${C.burgundy}); }

/* Un objet accroché au mur se saisit : il le dit au survol, d'une ombre
   portée et de rien d'autre. Aucune transformation ici — l'inclinaison
   est écrite en ligne, et une seconde main sur la même propriété
   effacerait le guingois de l'objet. */
[data-wall-item] { transition: filter .16s ease; }
[data-wall-item]:hover { filter: drop-shadow(2px 3px 3px rgba(30,20,10,0.3)); }
[data-wall-item]:active { cursor: grabbing; }

@media (prefers-reduced-motion: reduce) {
  [data-case] *, [data-case] { animation-duration: .01ms !important; animation-delay: 0ms !important; }
  [data-drop-mark], [data-lean], [data-row-seam], [data-wall-item] { transition: none !important; }
}

input::placeholder, textarea::placeholder { color: ${C.inkFaded}88; font-style: italic; }

/* le champ éditable n'a pas de placeholder natif : on le dessine */
[contenteditable][data-placeholder]:empty::before {
  content: attr(data-placeholder);
  color: ${C.inkFaded}88;
  font-style: italic;
  pointer-events: none;
}
`;

export const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.055 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";
