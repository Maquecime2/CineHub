/* ============================================================
   TOKENS — ce dont le site est fait, et qui peut changer
   ============================================================

   `C` n'est plus une liste d'hexadécimaux mais une liste de RENVOIS. La
   couleur elle-même vit dans une variable CSS écrite sur la racine du
   document, et c'est une PEAU qui l'y écrit (voir `theme/skins.ts`).

   Pourquoi ainsi, et pas un contexte React : `C` est importé par vingt-
   neuf fichiers et lu six cent treize fois, presque toujours dans un
   style en ligne. En faire un état de React aurait voulu dire un crochet
   dans chacun de ces fichiers, et un re-rendu de l'application entière à
   chaque changement. Une variable CSS ne demande rien à personne — on
   l'écrit sur `documentElement`, et le navigateur repeint.

   Le nom des clés ne bouge pas, et c'est délibéré : `burgundy` désigne
   maintenant « la teinte chaude qui porte l'identité », pas le bordeaux.
   Une peau de nuit y met un rouge sombre, une peau néon un magenta. Les
   renommer toutes eût été plus juste et aurait touché six cent treize
   lignes pour ne rien changer à ce qu'on voit.

   Les valeurs par défaut — celles du carnet d'archiviste, papier kraft
   et fil rouge — sont écrites dans `FONT_IMPORT` plus bas : la peau
   « carnet » n'a donc rien à faire pour que le site soit ce qu'il a
   toujours été. */

export const C = {
  paper: "var(--c-paper)",
  paperDark: "var(--c-paper-dark)",
  card: "var(--c-card)",
  ink: "var(--c-ink)",
  inkFaded: "var(--c-ink-faded)",
  burgundy: "var(--c-burgundy)",
  ochre: "var(--c-ochre)",
  pine: "var(--c-pine)",
  slate: "var(--c-slate)",
  line: "var(--c-line)",
  // accents — des touches plus vives qui percent le fond
  cobalt: "var(--c-cobalt)",
  vermillion: "var(--c-vermillion)",
  moss: "var(--c-moss)",
} as const;

/* LES QUATRE RÔLES DE LA TYPOGRAPHIE.

   Il n'y avait pas de rôles : quatre familles nommées en toutes lettres,
   recopiées deux cent vingt-neuf fois. Une peau qui change de police
   devait donc réécrire deux cent vingt-neuf lignes.

   Ce sont des rôles et non des polices : `mono` est « ce qui se tape à
   la machine » — les étiquettes, les compteurs, les petites capitales —
   et une peau peut y mettre une grotesque condensée sans que rien de ce
   qui l'emploie ait à le savoir. */
export const F = {
  title: "var(--f-title)",
  body: "var(--f-body)",
  hand: "var(--f-hand)",
  mono: "var(--f-mono)",
} as const;

/* UNE COULEUR, PLUS TRANSPARENTE.

   On écrivait `${C.ink}22` — l'hexadécimal et son canal alpha collés
   bout à bout. C'était juste tant que `C.ink` ÉTAIT un hexadécimal ;
   `var(--c-ink)22` ne veut plus rien dire.

   `color-mix` fait le même travail sans rien savoir de la forme de la
   couleur : elle marche sur un renvoi comme sur un dièse, ce qui laisse
   les teintes du nuancier (qui, elles, restent des hexadécimaux) passer
   par le même chemin.

   L'opacité s'écrit en clair — `alpha(C.ink, 0.13)` plutôt que `22` —
   parce que personne ne lit `0x22` comme « treize pour cent ». */
export const alpha = (color: string, a: number): string =>
  `color-mix(in srgb, ${color} ${Math.round(a * 1000) / 10}%, transparent)`;

export const FONT_IMPORT = `
/* LA PEAU PAR DEFAUT — le carnet d'archiviste, papier kraft et fil
   rouge. Elle est ici, en dur, et non dans le catalogue des peaux : le
   site doit etre ce qu'il a toujours ete avant meme qu'une ligne de
   JavaScript ait tourne. Une peau choisie reecrit ces memes variables
   sur documentElement, ou elles gagnent contre celles-ci.

   Les polices ne sont plus importees ici : chaque peau a les siennes, et
   les charger toutes couterait une demi-douzaine de fichiers jamais
   affiches. C'est applySkin qui pose le lien vers celles du jour.

   Pas un seul accent grave dans ce bloc, ni ailleurs entre les deux
   accolades de cette chaine a gabarit : il la refermerait au milieu
   d'une phrase. Le meme avertissement est repete plus bas, la ou le
   piege s'est deja referme une fois. */
:root {
  --c-paper: #EEE3CC;
  --c-paper-dark: #E2D3AE;
  --c-card: #F6EFDE;
  --c-ink: #2B2620;
  --c-ink-faded: #6E6153;
  --c-burgundy: #8C3A34;
  --c-ochre: #B9862E;
  --c-pine: #3E5B4B;
  --c-slate: #5C6B78;
  --c-line: #C9B98F;
  --c-cobalt: #3A5C8C;
  --c-vermillion: #C4562E;
  --c-moss: #6E7A3A;

  --f-title: 'Playfair Display', serif;
  --f-body: 'Lora', Georgia, serif;
  --f-hand: 'Caveat', cursive;
  --f-mono: 'Special Elite', monospace;

  /* La FORME des choses, que la couleur seule ne dit pas : un onglet de
     classeur n'a pas le même angle qu'une pastille pastel, et une
     affiche imprimée ne veut aucun arrondi nulle part. */
  --tag-radius: 3px;
  --tag-tracking: 1.5px;
  --tag-transform: none;
}

::selection { background: ${alpha(C.ochre, 0.4)}; color: ${C.ink}; }

body { background: ${C.paper}; }

/* Le rail des onglets peut avoir a defiler dans une fenetre courte. Sa
   barre n'apporte rien — la tranche d'un classeur n'en a pas — et elle
   mangerait onze des quarante-six pixels de large du rail. On la retire
   sans retirer le defilement : la molette et le clavier marchent
   toujours. */
[data-tab-rail] { scrollbar-width: none; }
[data-tab-rail]::-webkit-scrollbar { width: 0; height: 0; }

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
[data-cat-over="1"] { background: var(--cat-open, ${alpha(C.ochre, 0.13)}) !important; }
[data-row-over="1"] { box-shadow: inset 0 0 0 1px ${alpha(C.ochre, 0.4)}; }
[data-seam-over="1"] { background: ${alpha(C.ochre, 0.27)}; }
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

/* PENDANT UN GLISSEMENT, IL S'EFFACE DU CHEMIN.

   Un objet accroché peut désormais déborder de son rayon, et ce qui
   déborde restait saisissable : il recouvrait le rayon d'en dessous et
   recevait à sa place les dépôts qu'on lui destinait. C'est ce défaut-là
   qui justifiait de border les objets loin des bords ; on retire donc le
   défaut plutôt que la liberté.

   Même raisonnement que le voile juste au-dessus : le temps du geste, ce
   qui n'est pas une cible cesse d'en être une.

   SAUF CELUI QU'ON TIENT. Un glissement dont la source cesse d'être
   testable au survol est un glissement que le navigateur annule net :
   la règle, en s'appliquant aussi à l'objet empoigné, empêchait de
   reprendre un objet volant une fois posé. Il se marque donc au départ
   du geste (voir WallItem, dans items.jsx), et l'exception le laisse en
   place.

   Pas d'accent grave dans ce commentaire, ni ailleurs entre ces deux
   accolades : tout ce bloc est une chaîne à gabarit, et un accent grave
   la refermerait au milieu d'une phrase. */
html[data-dragging="1"] [data-wall-item]:not([data-drag-self]) {
  pointer-events: none !important;
}
[data-wall-item]:hover { filter: drop-shadow(2px 3px 3px rgba(30,20,10,0.3)); }
[data-wall-item]:active { cursor: grabbing; }

@media (prefers-reduced-motion: reduce) {
  [data-case] *, [data-case] { animation-duration: .01ms !important; animation-delay: 0ms !important; }
  [data-drop-mark], [data-lean], [data-row-seam], [data-wall-item] { transition: none !important; }
}

input::placeholder, textarea::placeholder { color: ${alpha(C.inkFaded, 0.53)}; font-style: italic; }

/* le champ éditable n'a pas de placeholder natif : on le dessine */
[contenteditable][data-placeholder]:empty::before {
  content: attr(data-placeholder);
  color: ${alpha(C.inkFaded, 0.53)};
  font-style: italic;
  pointer-events: none;
}
`;

export const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.055 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";
