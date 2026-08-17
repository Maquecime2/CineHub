# CineHub — notes pour les agents

Vidéothèque personnelle, entièrement côté client : React + Vite, données en
`localStorage` et IndexedDB, aucun serveur, aucun compte.

## La direction artistique est un carnet

Kraft, encre, carton. Toute refonte d'interface garde le papier, l'encre et le
carton ; la nouveauté n'entre qu'en accent. Concrètement :

- Les couleurs et les polices se prennent AUX JETONS (`src/theme/tokens.ts` :
  `C`, `F`, `alpha`), jamais en dur — quatorze peaux les réécrivent, dont des
  sombres, et une valeur en dur devient illisible sous la première d'entre elles.
- Les durées d'animation passent par `--motion-fast` / `--motion-slow` /
  `--motion-ease`. Le bloc `prefers-reduced-motion` les met à zéro tout seul ;
  une durée écrite à la main lui échappe.
- Le désordre visuel (inclinaisons, punaises, bords déchirés) est SEMÉ, jamais
  tiré au sort : `src/domain/seeded.ts`. Un mur qui gigote n'est pas un mur.
- Les marques d'usage sont dans `src/components/atmosphere/` et jamais dans une
  vue : `index.tsx` pour le papier (grain, café, ruban, punaise, tampon de
  page), `hall.tsx` pour le volet communautaire, qui est LE HALL D'UNE SALLE —
  ticket perforé, vitrine, fronton, trame d'impression, agrafe, pliure. Une vue
  qui redessine l'un des deux est une vue qui vient de forker la DA.
- **Les effets chers appartiennent aux MOMENTS, pas aux LISTES.** `mixBlendMode`,
  `filter`, les ombres multiples : sur l'ouverture d'une pochette ou un tampon de
  fin, oui ; sur les cinquante lignes d'un palmarès qui défile, jamais.
- Un SVG embarqué ne résout pas un `var()` (`theme/surfaces.ts`) : toute texture
  teintée prend son encre RÉSOLUE en argument. Les dégradés CSS, eux, lisent les
  jetons — c'est pourquoi le hall les préfère.
- **Le verdict se dit par un MOT, pas par une couleur.** Vert pour juste et rouge
  pour faux disparaissent sous cinq des quatorze peaux. On tamponne.

## Ce qu'une vue montre quand elle n'a rien à montrer

Quatre états, quatre primitives, et aucune n'est à réécrire dans une vue :

- `Waiting` (`components/ui`) — le squelette de lignes réglées, avec
  `role="status"`. Une phrase muette dit à l'œil qu'on attend et ne le dit à
  personne d'autre.
- `Nothing` / `Guideline` — il n'y a rien, et c'est normal.
- **`Trouble`** — on n'a pas pu demander. Une seule forme, avec `role="alert"` :
  les échecs s'écrivaient sous cinq noms (`trouble`, `souci`, `msg`, `error`,
  `keyState`) et cinq styles en ligne, et pas un seul n'était annoncé.
- **`Boundary`** (`components/ui/Boundary.tsx`) — la vue est tombée. C'est la
  seule classe du projet : React n'expose `getDerivedStateFromError` que là. Il
  y en a une autour de la colonne de vue et une autour de la racine, parce que
  la première ne se protège pas elle-même. `Suspense` connaît l'attente et
  JAMAIS l'échec : un `import()` refusé le traverse.

**« Il n'y a rien » et « on n'a pas pu demander » ne sont pas le même écran**, et
les confondre est le défaut qu'on vient de retirer de quatre vues. Un
`.catch(() => {})` sur un chargement de page en est toujours un ; sur une
décoration — un portrait, un nom de réalisateur — il reste le bon choix.

**`Feedback` / `useSay`** dit ce qui vient de se passer : une annotation
manuscrite dans la marge, jamais deux à la fois, `aria-live` compris. Ce n'est
pas une bulle de matériau — ce produit est un carnet.

## LE MOTIF EST LE RASSEMBLEMENT

**IL Y A EU DEUX OBJETS ICI, ET C'ÉTAIT TOUT LE PROBLÈME.** On posait un
**motif** sur une fiche, puis on le promouvait en **fil** — un second objet, avec
son nom, sa couleur, son identifiant. Rien à l'écran ne disait à quoi servait la
promotion, le bouton restait identique une fois le fil créé, et depuis une
seconde fiche portant le même motif le clic partait en silence vers la carte :
on croyait avoir fait quelque chose, on n'avait rien fait. Pire, `label` était
une COPIE du libellé du motif — qu'un motif de catalogue n'a pas — donc le fil
partait sur le disque avec `label: undefined` et la lecture suivante plantait au
montage de `App`.

Désormais : **un motif posé sur `STAR_FROM` fiches (deux) est une étoile de la
carte**, sans que personne le demande. La clé `localStorage` reste `"fils"`, mais
ce qu'elle tient n'est plus une liste d'objets — ce sont des **écarts** au défaut
(un nom réécrit, une couleur, une note, une fiche mise à la main, l'étoile
éteinte). Pas d'écart, pas de ligne stockée : `isPlainDefault` l'efface.

- **L'IDENTITÉ EST LE MOTIF**, jamais un identifiant tiré : deux lignes sur un
  même motif ne peuvent plus exister, et un doublon venu d'une sauvegarde est
  fusionné à la porte (`normalizeThreads`).
- **`label` est un REMPLACEMENT, et rien d'autre.** Vide est le cas normal ;
  `threadLabel` lit le catalogue. Y recopier le nom du motif fige la langue du
  jour et contredit le catalogue à la première réétiquette.
- `effectiveThreads` est **la seule porte** par laquelle le ciel lit les étoiles ;
  `includeOff` est ce que lit le bandeau de pastilles, parce qu'on ne rallume pas
  une étoile qu'on ne voit plus.
- La couleur par défaut est **semée** sur l'identifiant du motif
  (`colorForMotif`) : `CAT_KEYS[fils.length % …]` la faisait dépendre du nombre
  de rassemblements existant le jour de la création, et toutes les couleurs
  glissaient quand on en effaçait un plus ancien.
- **Le fil « à la main » (`motif: null`) n'existe plus** : c'est un motif perso,
  que le sélecteur crée déjà, auquel on ajoute des fiches. Une notion en moins.
- `MotifPanel` (`components/film/MotifPanel.tsx`) est la moitié du modèle qui
  n'était atteignable de nulle part : renommer, colorer, annoter, mettre et
  retirer une fiche, éteindre, **revenir au défaut**, supprimer un motif perso.

## UN ORDRE SE JUSTIFIE, ET LA JUSTIFICATION EST UNE DONNÉE

La vue `lineage` (« Filiations », groupe `explore`) tient deux choses que le
classeur ne savait pas dire : l'**ORDRE** dans lequel on veut voir des films, et
les **liens entre cinéastes** qui justifient cet ordre. Rien dans une fiche ne
dit qui a formé qui — `domain/people` l'énonce lui-même, une personne « n'est pas
une entité qu'on range, c'est une question posée à la collection », et la seule
relation personne↔personne qui existait, `companions`, est DÉRIVÉE et non
éditable.

**LA JUSTIFICATION N'EST PAS DE LA PROSE.** `Step.because` pointe vers un
`Bond.id`, et c'est ce qui distingue cet écran d'une liste annotée : pointer une
étape épaissit son arête, choisir une arête allume toutes les étapes qui
l'invoquent. Le raisonnement se parcourt dans les deux sens au lieu de se
relire. Les trois autres plans — la thèse du parcours, la note de marge, les
liens lus en clair sous chaque entrée — sont là parce qu'aucun ne remplace les
autres.

- **DEUX DOCUMENTS, JAMAIS UN.** `"filiations"` tient un savoir sur le cinéma,
  permanent ; `"parcours"` tient des intentions, qui se soldent. Réordonner écrit
  toutes les 400 ms (`store.setSoon`), poser un lien arrive deux fois par mois :
  fusionnés, la carte entière entrerait dans l'arbitrage _last-writer-wins_ à
  chaque pixel de glissement, et on perdrait une carte pour avoir traîné un film
  sur un second appareil.
- **`Step.id` ET NON `filmId` EST L'IDENTITÉ D'UNE ÉTAPE.** Ozu 1949, puis Hou,
  puis Ozu 1953 est un plan parfaitement ordinaire ; clé sur le film, il devenait
  interdit sans que personne l'ait décidé. C'est aussi la seule clé React
  correcte pour une liste qu'on réordonne.
- **LE TABLEAU EST L'ORDRE**, comme dans `shelf-views`. Rien ne porte de rang,
  rien n'est trié à la sortie, et `groupedSteps` ne groupe que du CONSÉCUTIF :
  rassembler tous les Ozu réécrirait le plan sous prétexte de le présenter.
- **A→B ET B→A SUR UN LIEN ORIENTÉ N'EST PAS UN DOUBLON, C'EST UNE
  CONTRADICTION.** `bondId` est calculé — clés triées si le lien est symétrique —
  donc un doublon est impossible et non improbable. La contradiction, elle, est
  refusée À LA PORTE par `normalizeBonds` (le premier écrit gagne) **et
  visiblement par le formulaire** : un clic avalé qui n'écrit rien est le défaut
  exact que les motifs ont mis un chantier à perdre.
- **`normalizeCourses` NE CONNAÎT PAS LES ARÊTES**, et ne doit jamais les
  connaître. Les deux documents voyagent séparément : valider l'un contre l'autre
  effacerait la justification de quelqu'un parce que sa synchro avait deux
  secondes de retard. Un `because` pendant est MUET au rendu, jamais nettoyé — y
  compris quand on retire le lien à la main, puisque reposer le même lien rend
  le même identifiant.
- **LIRE N'ÉCRIT PAS.** `courseSteps` filtre les fiches disparues à l'affichage
  et laisse le disque tranquille — copie de `threadMembers`. Et `strandedCount`
  existe pour que la vue le DISE : une colonne qui rétrécit de deux entrées sans
  un mot est le même défaut qu'un échec silencieux.
- **UN LIEN SURVIT À LA FICHE.** `fromName` / `toName` gardent le nom saisi, donc
  effacer la dernière fiche d'un cinéaste ne désapprend pas qui l'a formé : le
  nœud devient `orphan`. L'orthographe de la collection l'emporte quand elle
  existe, sinon la carte serait le seul écran à l'appeler autrement.
- **`relax` A ÉTÉ DESSERRÉ EN TYPES SEULEMENT** (`domain/sky`), pas une ligne du
  corps : il ne lit d'un nœud que son `id` et d'une arête que `kind`/`force`. Les
  quatre natures de lien passent donc toutes en `"peer"` et la sémantique roule
  sur `force` (maître 3 → 140 px, contrepoint 1 → 220 px). `ConstellationView`
  n'est PAS touché ; ce qui est partagé est du comportement — `useNodeDrag` et
  son **seuil de 4 px**, sans lequel chaque clic est un micro-glissement et la
  sélection croisée ne part jamais — et non du dessin.
- **LE MIROIR EN LISTE N'EST PAS UNE POLITESSE.** Un graphe SVG ne se parcourt
  pas au lecteur d'écran, quel que soit le soin mis aux `aria-label` : il n'y a
  pas d'ordre de lecture dans un plan. La liste masquée est le seul chemin
  linéaire honnête, et elle sert de repli sur téléphone étroit.
- **LES DEUX RETRAITS PASSENT PAR `Confirmation`**, et chacun dit ce qui SURVIT :
  supprimer un parcours perd un ordre et des notes que rien d'autre ne tient ;
  retirer un lien perd un savoir et laisse muettes les étapes qui l'invoquaient,
  mais ne touche ni aux fiches ni au parcours.
- **L'ÉCRAN EST UNE PILE, PAS DEUX COLONNES.** Les deux moitiés se
  répondaient côte à côte et se lisaient comme deux écrans sans rapport.
  La carte est désormais PLEINE LARGEUR au-dessus du rail qu'elle
  explique, et l'étape choisie ouvre `StepPanel` en dessous.
  `OrderColumn` et `StepRow` ont disparu : `OrderStrip` prend une
  `direction` et `StepCard` se reflowe. **La colonne du téléphone n'est
  pas un rail dégradé, c'est le bon** — `usePointerDrag` ne défile
  qu'en VERTICAL (`pace()` lit `clientY`), donc une bande horizontale ne
  peut pas amener un emplacement hors champ sous un doigt qui glisse.
- **L'ORDRE EST UN RAIL, ET LE RAIL EST TIRÉ D'UNE SEULE PIÈCE.** Des
  tuiles séparées se lisent comme une étagère — des choses qu'on
  possède, sans relation ; le trait dit le contraire. Il est donc un
  FOND de la liste posé à `RAIL_Y`, et non un segment par carte : huit
  segments laissent huit jointures et le trait redevient huit tirets.
  D'où `POSTER_H` fixe et `PosterArt` en `plain` — une affiche 2:3 et une
  émulsion de remplacement n'ont pas la même hauteur, et les perles se
  poseraient à deux niveaux. Le bord déchiré est le prix payé.
- **`groupedSteps` EST ENFIN APPELÉ**, et il ne réunit que du CONSÉCUTIF.
  Le rail n'en garde que les BORNES (`bandStart` / `bandEnd`) et reste
  une liste PLATE : imbriquer une liste par groupe ferait de chaque
  bandeau une entrée à parcourir au lecteur d'écran, pour une décoration.
- **UNE SÉLECTION SE DÉPLACE EN BLOC, ET `moveGroup` REFUSE L'ABSURDE.**
  Déposer une sélection sur l'un de ses propres membres n'a pas de
  réponse : le domaine rend le MÊME tableau, donc rien n'est écrit ni
  annoncé — le contrat de `move`. Ce qui est pris garde son ordre à soi.
  Glisser une station HORS sélection la déplace SEULE : un geste
  n'emporte jamais plus que ce qu'il a visiblement saisi. Et la sélection
  ne survit pas à ce qu'elle désigne, sinon le retrait en bloc porterait
  sur des identifiants morts.
- **UNE COMMANDE NE SE NICHE PAS DANS UNE COMMANDE.** La case à cocher
  posée DANS le bouton de l'affiche était du HTML invalide, et le bouton
  y prenait pour NOM le libellé de la case : deux boutons portant la même
  chose, et plus rien pour dire lequel ouvrait la fiche. Elle est à côté,
  en recouvrement, et le bouton porte son propre `aria-label`.
- **LE `<select>` DE JUSTIFICATION A DISPARU.** `BondPicker` est un
  `radiogroup` de rubans lus par `bondLabel` DEPUIS ce cinéaste, et
  « nouer X à… » y est PERMANENT et non réservé à une liste vide :
  `Linking` porte `forStep`, donc poser le lien fait pointer l'étape
  dessus dans le même geste. Le patch du ruban s'écrit RÉGLÉ
  (`onPatch(patch, true)`) — le poser en différé puis « régler » derrière
  rejouait le parcours d'avant par-dessus.
- **DEUX PORTES VERS UN PARCOURS**, et l'implicite reste la première.
  Poser un film en fait toujours un ; le bouton existe parce qu'un écran
  vide n'offrant qu'un champ de texte laissait chercher un bouton absent.
  `isEmptyCourse` le rend inoffensif.
- **LE SÉLECTEUR INTERROGE TMDB, SUR ENTRÉE ET JAMAIS À LA FRAPPE.** Pas
  de hook de debounce dans ce dépôt et ce n'est pas ici qu'on en invente
  un : TMDB est compté. Un résultat absent du classeur passe par
  `getDetails` → `makeFilm({status:"watchlist", source:"tmdb"})` →
  `onAddFilm`, et c'est le RÉALISATEUR ramené par `getDetails` qui compte
  le plus — sans lui l'étape serait un titre que la carte ne peut pas
  expliquer. Sans clé ni compte : `NoKey`, et la moitié locale continue.
- **`useMapView` DÉPLACE LA FENÊTRE, JAMAIS LA DISPOSITION** : rien de ce
  hook n'entre dans le mémo de `relax`. Et **les nudges de `useNodeDrag`
  se divisent par `k`** — ils comptent en pixels CLIENT, la carte se lit
  en unités de VUE ; à k = 1 les deux coïncident, ce qui est exactement
  pourquoi la confusion a survécu sans zoom. Le recentrage au clavier
  passe par un EFFET : `useGraphKeyboard` pose le curseur en état, donc
  dans le gestionnaire `keys.cursor` vaut encore l'ancien nœud.
- **Côté serveur : RIEN.** La table `doc` est générique (`person_id` + `key`
  texte libre), donc deux clés de plus ne demandent aucun déploiement. Ce qui se
  paie est côté client : **`SYNCABLE_VERSION` monte** (`services/documents.ts`),
  sans quoi `catchUpDocuments` ne rejoue pas le rattrapage et les classeurs déjà
  connectés n'enverront JAMAIS ces documents — la pire perte, celle qu'on ne
  découvre qu'en changeant d'ordinateur.

## Tout ce qu'on sait d'un film, sans quitter l'écran

Trois écrans posaient la même question et aucun ne savait y répondre : un
parcours dans les filiations, une proposition au générique, une découverte
à la reco. Tous trois offrent un film qu'on n'a PAS vu, et tous trois n'en
montraient qu'une affiche, un titre et une année. La seule sortie était de
quitter l'écran — donc de perdre le parcours qu'on bâtissait, ou la
recherche qu'on venait de régler.

**`FilmQuickView` (`components/film/FilmQuickView.tsx`) est une COUCHE, et
pas trois panneaux dans le flux.** Écrit en ligne, chaque écran aurait dû
lui trouver de la place, et le plus étroit des trois aurait décidé de ce
que les trois pouvaient dire. Par-dessus, la place est celle de la
fenêtre : c'est ce qui rend « exhaustif » tenable. `Layer` + `useDialog`,
comme tout ce qui prend la main.

- **EXHAUSTIF, DONC SECTIONNÉ.** Un mur de quarante valeurs n'est pas plus
  lisible que quatre, il l'est moins : ce que le film EST, ce qu'on en a
  FAIT, les gens, les mots. Une SECTION vide ne se dessine pas ; un CHAMP
  vide se dessine avec un tiret, parce que dans une section la différence
  entre « rien » et « jamais demandé » est ce que le bouton du haut sert
  à corriger.
- **`Film.synopsis` EST UNE DONNÉE, ET `SHAPE` MONTE À 5.** Aucune fiche
  au monde n'en portait — le champ n'existait pas — donc une vue rapide
  qui n'aurait montré que du stocké aurait été vide pour tout le monde le
  jour de sa sortie. Elle le demande UNE fois, par fiche, et `onEnrich`
  l'écrit : payé une fois, et hors ligne ensuite.
- **ELLE COMBLE DES TROUS, ELLE NE CORRIGE RIEN.** Une durée saisie à la
  main survit à un panneau qu'on a seulement ouvert. C'est cette règle —
  celle de `TmdbFacts` et de la fusion d'import — qui rend la requête sûre
  à lancer sans rien demander à personne.
- **`inBinder` EST FAUX POUR UN CANDIDAT**, et ce n'est pas un détail :
  une note à zéro et zéro séance AFFIRMERAIENT qu'on n'a pas aimé un film
  qu'on n'a pas vu. Ni note, ni séance, ni statut hors du classeur.
- **`Names` (`components/film/Names.tsx`) A ÉTÉ SORTI DE `TmdbFacts`.** Il
  y était enfermé, donc la vue rapide et l'identité de la fiche ne
  pouvaient pas l'atteindre et avaient commencé à redessiner le leur —
  avec l'infobulle écrite en français au milieu d'une vue, alors que
  `credits.whatIHaveOf` était dans les deux catalogues depuis toujours.
- **`searchPerson` NE PREND PLUS `results[0]`.** C'est le classement par
  POPULARITÉ de TMDB : demander un réalisateur qui partage son nom avec un
  acteur plus connu rendait l'acteur, puis on demandait ce que cet
  acteur avait RÉALISÉ — et le générique listait des films que la personne
  regardée n'a jamais signés. Ça se lit comme un filtre qui fuit ; c'est la
  mauvaise personne. Le métier entre donc dans la question ET dans la clé
  de cache. Il reste un REPLI et jamais un filtre : TMDB laisse
  `known_for_department` vide sur quantité de fiches maigres.

- **`Film.frames` N'EST PAS `Film.stills`, ET LES CONFONDRE COÛTERAIT DE
  L'ARGENT.** `stills` sont VOS captures : elles vivent dans le coffre de
  l'appareil, sont miroitées côté serveur et comptent dans
  `MEDIA_CEILING`. `frames` sont quelques plans que TMDB héberge — on n'en
  garde que le CHEMIN (deux tailles à composer : bande en w300,
  agrandissement en w1280), rien à annoter, rien à effacer, rien à
  miroiter. Les deux se dessinent loin l'une de l'autre et se nomment
  autrement, sinon on croit pouvoir légender les secondes.
- **ELLES NE COÛTENT AUCUN APPEL** : `append_to_response` les joint à la
  requête que `getDetails` faisait déjà. Le relais transmet tous les
  paramètres, donc rien à déployer. Et comme `keywords`, **absent et vide
  ne disent pas la même chose** — `[]` est une RÉPONSE, sans quoi la vue
  rapide redemanderait à chaque ouverture, pour toujours.

## Aucune phrase n'est écrite dans une vue

`src/i18n/catalogue.test.ts` garde les deux catalogues l'un contre l'autre, et il
le fait bien. Ce qu'il ne voit pas est le cas qui s'était accumulé : **une phrase
qui n'atteint jamais un catalogue**. Il y en avait environ cent quatre-vingts, sur
une trentaine de fichiers — des panneaux entiers en français dans un écran
anglais, des libellés à moitié traduits (« Plus longue drought », « Strength du
lien »), et les quatre onglets de l'almanach affichant `almanac.plate1` dans les
deux langues parce que le `t()` n'était jamais appelé. Rien n'échouait.

**`src/i18n/literals.test.ts` est cette garde.** Il refuse un littéral parlé dans
`title=`, `label=`, `placeholder=`, `aria-label=` et le texte JSX direct.
`EXEMPT` et `KEPT` sont courts **exprès** : quand ils grossissent, ce test ne
protège plus rien.

Une couche sans crochet — une classe (`Boundary`), un service, `db.js` — lit
`i18n.t` sur l'instance. Ce qui reste en dur est de la **donnée** et non de
l'affichage : `UNKNOWN_DIRECTOR`, le nom d'un rangement, le libellé par défaut
d'une catégorie sont écrits dans le document de la vue, et les traduire figerait
la langue du jour dans les données de quelqu'un.

## La main se règle, et elle se lit

La cursive était le trait le plus reconnaissable du carnet et le plus
coûteux à lire : jolie sur une ligne, LENTE dans un bloc de texte et dans
un sous-titre de neuf pixels. Trois choses en découlent, et aucune n'est
un avis sur le goût.

- **`--f-hand` EST LE LEVIER, ET C'EST TOUT.** `theme/handwriting.ts` tient
  un choix — la cursive de la peau, ou sa police de labeur — que
  `skinVars` consulte. Deux cent trois emplois basculent sans qu'un
  fichier de vue soit touché : c'est ce que la couche de jetons
  promettait. Le réglage vit **à côté** des peaux et non dedans — une
  peau choisit SA cursive, celui-ci dit si l'on en veut une du tout, et
  le ranger dans la grille aurait obligé à dédoubler les dix-sept.
- **L'ABONNEMENT VA D'`applySkin` VERS `handwriting`**, jamais l'inverse :
  `handwriting` ne connaît pas les peaux, et lui faire appeler `applySkin`
  fermerait un cercle.
- **LES PEAUX CHARGEAIENT CAVEAT EN 500/600/700 ET RIEN NE DEMANDAIT DE
  GRAISSE**, donc tout s'affichait au 400 — que le fichier ne contient
  pas. Le navigateur prenait le trait le plus mince, en encre pâlie, à
  quatorze pixels : l'illisibilité venait de là plus que de la cursive.
  Une règle unique la corrige, `[style*="--f-hand"]`, et **elle marche
  parce que le projet s'habille EN LIGNE** — React écrit le nom du jeton
  dans l'attribut `style`. C'est une clé posée sur une convention du
  projet, et elle est écrite là où cette convention est déjà expliquée.

## Le focus se voit

`all: unset` est la convention des boutons du projet, et elle emporte le contour
de focus. Rien ne le remplaçait : **la navigation au clavier était invisible
partout**. La règle `:focus-visible` est dans `FONT_IMPORT` (`theme/tokens.ts`),
en deux traits — un à l'encre, une ombre claire dessous — pour qu'il en reste un
visible sous les dix-sept peaux.

Toute couche qui prend la main passe par **`useDialog`** (`hooks/useDialog.ts`) :
le focus entre, y tourne en cycle, et **revient au bouton qui l'a ouverte**.
Sans lui, ouvrir un panneau au clavier laisse le curseur derrière le voile, et le
refermer renvoie au début du document.

## La visite guidée suit le produit

`src/components/tour/steps.ts` est la description de ce que l'application sait
faire. **Toute fonctionnalité ajoutée, modifiée, renommée ou retirée oblige à
mettre `steps.ts` à jour dans le même changement** — nouvelle étape, texte
corrigé, étape supprimée — et à poser ou retirer l'attribut `data-tour`
correspondant sur la cible.

- Une vue neuve veut sa propre entrée dans `TOURS`, sous la clé de la vue, et sa
  place dans la visite `global`.
- Une étape qui vise du contenu (une affiche, une rangée, une fiche) porte
  `optional: true` : un classeur vide doit pouvoir jouer la visite en entier.
- Un changement qui laisse la visite décrire l'ancien produit est incomplet.

Le test `src/components/tour/steps.test.ts` refuse une vue sans visite : il est
là pour que la règle ne dépende pas de la seule bonne volonté.

## LE QUIZZ EST UN ÉCRAN, PAS UN PARAGRAPHE

Il se jouait dans un accordéon : la partie était rendue DANS une ligne de
liste, sous le formulaire de tirage et au-dessus de la banque d'admin. On
répondait à une question de cinéma en regardant par-dessus son épaule le
bouton « tenir la banque ».

`src/views/quiz/` tient les pièces ; `src/views/QuizView.tsx` reste
l'entrée, parce que c'est ce que l'union `View` nomme et ce que le filet
importe. Ce qui est réellement partagé est `shared.ts`, et il est COURT
exprès — `SIZES` et `holds` n'ont que le compositeur pour appelant,
`dealable` que la banque. Les remonter aurait inventé un partage.

- **`QuizTable` est une couche**, donc `Layer` : la colonne de vue est un
  contexte d'empilement et porte une transformation pendant son animation
  d'entrée. La partie est à 50 du budget, la confirmation d'abandon à 60 —
  **on demande PAR-DESSUS la partie.**
- **`useDialog` ferme en DEMANDANT**, et le corps dit ce qui SURVIT. Une
  partie CLOSE se referme d'un geste : elle n'a plus rien à abandonner.
- **LE TAMPON DIT UN MOT — « POSÉE » — ET JAMAIS UN VERDICT.** Les bonnes
  réponses ne sont réellement pas connues du client avant la fin
  (`drawnQuestions` n'étale `is_right` que si `withAnswers`) : « juste »
  serait inventé. `useSay` l'annonce, parce qu'un tampon ne se lit pas au
  clavier.
- **Effacer la soirée ferme la couche.** Sans cela on reste devant une
  partie que le serveur ne connaît plus.
- **Une visite ne peut pas ouvrir une modale.** Les pas du jeu sont
  `optional` et se sautent quand la partie est fermée ; `quiz-open` décrit
  la PORTE, qui existe toujours.

## LE RETARD EST ESTAMPILLÉ LÀ OÙ LA LIGNE S'ÉCRIT

`quiz.seconds_per_question` est **NULL par défaut** — tout quizz déjà
tiré est sans chronomètre, rien à rétro-remplir — et ses bornes 5–600
vivent dans le SCHÉMA.

- **`store.answer` pose `late` À L'INSERT.** Le calculer à la lecture
  rendrait un score qui change tout seul entre deux rafraîchissements.
  `scoresOf` et `awardQuiz` n'ont alors qu'un mot de plus chacun :
  `FILTER (WHERE c.is_right AND NOT a.late)`.
- **Le délai court depuis la DERNIÈRE ACTION** (`max(answered_at)`, sinon
  `started_at`), et non « la question précédente par rang » : `answer` ne
  vérifie aucun ordre, c'est le client qui se trouve marcher dans l'ordre
  du tirage.
- **Une réponse hors délai est ACCEPTÉE et vaut zéro**, jamais refusée :
  refuser perdrait la réponse et contredirait « on ne revient pas
  dessus », déjà à l'écran.
- `quiz_flawless` n'a pas une ligne à changer — il exige `score ===
weight`, et un retard baisse le score sans toucher le poids.
- **La conséquence se dit DEUX fois** : au tirage et avant de commencer.
  Elle n'est pas devinable — acheter un pouvoir consomme du temps, un
  réseau lent coûte, et fermer l'onglet coûte la question en cours.

## UNE NATURE CHANGE CE QUI COMPTE, JAMAIS CE QUE ÇA PAIE

`challenge.kind` (`'liste'`, `'critique'`, `'critere'`), `target`,
`subject`. Les valeurs restent **en français**, comme `person.sharing` :
elles s'écrivent dans les lignes.

- **Aucune `Kind` neuve dans `points.ts`.** Deux variantes refusées
  d'avance : un `challenge_review` mieux payé (il est plus facile à
  vérifier, ce serait l'arbitrage) et un gain proportionnel à la cible
  (le créateur fixerait son propre prix).
- **`target` NULL veut dire « toute la liste ».** Le `least` de
  `settleChallenge` refuse l'inatteignable : la liste peut MAIGRIR après
  coup, et une cible devenue plus grande qu'elle rendrait le défi
  impossible à finir sans que personne l'ait décidé.
- **« Pendant la période » NE PEUT PAS ÊTRE `updated_at`** pour une
  critique : une critique ne porte aucune date et `card.updated_at` bouge
  à la moindre retouche. On demande une SÉANCE dans la période ET
  `REVIEW_LENGTH` signes — la mesure qui décide déjà de la payer.
- **`SEEN_DURING` a DEUX appelants** — `progressOf`, qui affiche, et
  `settleChallenge`, qui PAIE. `merit_event` étant unique, **un paiement
  faux ne peut pas être rejoué juste** : le filet des trois âges de fiche
  (`points.test.ts`) est sur le second, et il a été tissé AVANT l'édition.
- **`rightsOnChallenge` est la PORTE UNIQUE**, et six routes y passent.
  Tant qu'il y a une liste elle rend exactement ce que rendait
  `rightsOnList` — y compris qu'un membre ayant monté le défi écrit sans
  administrer. **Élargir une permission est une décision, pas un effet de
  bord de déménagement.** Sans liste : on y est ou on l'a créé, et un
  défi par critère n'est JAMAIS découvrable.

## Le nom d'un champ venu du serveur s'épelle comme le serveur l'écrit

Quatre fois dans ce dépôt, et **aucune n'a jamais rien fait échouer** —
c'est là tout le problème. Un champ absent n'est pas une erreur : il vaut
`undefined`, toujours, et l'écran annonce le mauvais chiffre pour
toujours.

`liste_id` pour `list_id`, `per` pour `by`, `ouverte` pour `open` — ce
dernier faisait que « collection refermée » ne s'est **jamais** affiché
dans le fil, et on croyait à une panne. La lecture d'un champ optionnel
se fait donc en `!= null` et non `!==` : **absent veut dire absent**, pas
« la valeur opposée ».

## Le mérite s'écrit dans un journal

Le volet communautaire compte des points : `merit_event` est un JOURNAL, et
`purse` un cache qui se dit tel. Trois garanties, toutes dans le SCHÉMA :

- L'unicité `(person, kind, ref)` fait qu'un fait ne paie qu'une fois. Aucun
  appelant n'a à vérifier quoi que ce soit, et une requête rejouée est sans
  effet — c'est ce qui permet de solder un défi « au premier qui regarde »
  plutôt qu'avec une tâche de fond que ce serveur n'a pas.
- `CHECK (tokens >= 0)` sur `purse` refuse le découvert. Un achat est UNE
  instruction : le refus annule la dépense avec, donc personne n'est débité
  pour rien.
- `quiz_help` a une clé primaire, et elle ferme le seul vrai trou du lot :
  « écarter deux mauvaises réponses » rend toujours LES MÊMES deux, sinon on
  paie une fois et on épluche la question.

**ON DÉFIE QUELQU'UN, ON NE PUBLIE PLUS EN ESPÉRANT.**
`PUT/DELETE /challenges/:id/participants/:pseudo` exigent `administer` —
le droit que demande déjà la suppression — là où `participation` ne
demande que celui de LIRE. Un co-rédacteur ajoute des œuvres, il n'engage
pas des gens. **Et cette route ne paie AUCUN `challenge_joined`** :
l'auto-inscription paie l'auteur parce que quelqu'un a CHOISI de venir ;
payer pour ceux qu'on ajoute soi-même serait se verser quatre points par
ami.

**`list_shared` N'ÉTAIT CÂBLÉ NULLE PART.** Déclaré dans les deux barèmes
depuis toujours, crédité par personne. Il paie désormais le propriétaire
quand une liste atteint quelqu'un, sur une référence composite
`listId:memberId` — copie de `challenge_joined`, qui achète gratuitement
« retirer et remettre ne paie pas deux fois ». Une ligne déclarée et non
câblée est un oubli, pas du poids mort.

**`liste_id` ET `per` N'EXISTAIENT PAS.** Le serveur envoie `list_id` et
`by` ; les interfaces client de `Challenge` et de `ListWork` épelaient
autrement, donc les deux champs valaient `undefined` À L'EXÉCUTION,
toujours. Rien n'échouait — un champ absent n'est pas une erreur — mais
« ce que ce défi vaut » cherchait l'auteur par un pseudo indéfini et
annonçait **zéro film vu sur chaque défi**, et aucun nom ne s'est jamais
affiché sous une œuvre d'une liste écrite à plusieurs. Le commentaire qui
signale ce piège pour les quiz était juste à côté.

**Aucune route ne prend un montant en entrée.** Le barème vit dans
`server/src/points.ts` ; `src/domain/points.ts` en est une copie qui AFFICHE et
ne crédite rien, et un test compare les deux tables.

**`quiz_doubled` EST LA SEULE LIGNE QUI NE PAIE PAS DE MÉRITE**, et c'est
délibéré. Elle vient du pouvoir « double mise », acheté avec des jetons : la
doubler en mérite reviendrait à vendre des places au classement. `awardTokens`
écrit donc `merit = 0` là où `award` écrit le même chiffre dans les deux
colonnes. Le plafond quotidien ne s'y applique pas, et n'a pas à s'y appliquer —
il garde ce qu'on DÉCLARE, et rien de ce qui passe par là n'est déclaré.

**LE CATALOGUE N'EST PLUS ENTIÈREMENT DU CODE.** `server/src/shop.ts` tient les
familles qui demandent du code pour être rendues — tampons, titres, papiers,
peaux, pouvoirs. Les POCHETTES et les OBJETS D'ÉTAGÈRE vivent en base
(`sql/002_collection.sql`, `pack_def` / `decor_def`) et se créent depuis le
studio du comptoir, parce qu'une image et une rareté ne justifient pas un
déploiement. `resolveItem` lit le code d'abord, la base ensuite : une ligne de
`pack_def` ne peut donc pas usurper l'identifiant d'une peau et en changer le
prix.

**LE STUDIO A DEUX GESTES, ET LE SECOND EST IRRÉVERSIBLE.** Ce fichier a promis
« on retire, on n'efface jamais » — le retrait sort de l'étal sans rien
reprendre à personne, parce qu'un identifiant est écrit dans la collection de
tout le monde et sur leurs étagères. Ce n'est plus la seule porte, sur demande
explicite : `?forever=1` efface pour de bon.

Ce que cela coûte est écrit dans `deleteDecorDef` / `deletePackDef`
(`server/src/store.ts`) et éprouvé dans `test/collection.test.ts`, parce que
c'est ce qu'on oublie six mois plus tard :

- **`decor_won` N'A PAS DE CLÉ ÉTRANGÈRE** vers `decor_def` — un identifiant
  survit à sa définition, exprès. N'effacer que la définition laisserait une
  ligne de possession qui ne désigne plus rien : un carré vide, sans nom, que
  personne ne peut jeter. On efface donc **les deux**, et la vignette quitte la
  collection de ceux qui l'avaient.
- **Ce qui reste hors d'atteinte** : une vignette déjà POSÉE est écrite dans le
  document de la vue, chez la personne. Elle y laisse une place vide. D'où le
  nombre de possesseurs rendu par la route — c'est ce qu'on vient de leur
  reprendre, et le serveur est le seul à pouvoir encore le dire.

**LA RARETÉ SE LIT SUR CHAQUE VIGNETTE, EN TOUTES LETTRES.** Un liseré doré
disparaît sous cinq des dix-sept peaux ; c'est la même règle que le verdict du
quizz. Et le studio dessine ses vignettes en passant `media` à `WonDraw` :
par défaut celui-ci lit le cache de l'étal, qui ne contient ni ce qu'on vient
de déposer ni ce qui est retiré — le studio affichait donc des carrés vides à
l'endroit exact où il faut voir ce qu'on publie.

**LES BIBELOTS NE SE DÉPOSENT PLUS, ILS SE TIRENT.** Chacun montait les siens ;
`POST /decor` n'existe plus, et l'atelier du cabinet ne propose plus d'importer.
Une pochette rend **UN** objet (`DRAWS`), tiré par le serveur dans le bassin de
CETTE pochette, aux seuils habituels (700/950/1000).

Tout le reste de `/decor` tient, et c'est voulu : on lit les siens, on les
partage, on en prend copie, on les efface. **Fermer la porte d'entrée n'est pas
vider la pièce** — personne ne perd ce qu'il avait posé. `createDecor` et
`addCustomDecor` restent en place pour la synchronisation d'un appareil qui n'a
pas encore vu ce changement.

**CE QUI SORT D'UNE POCHETTE NE SE PARTAGE PAS**, et c'est la seule règle du lot
qui protège le produit plutôt que les données : une personne généreuse qui
ouvrirait sa collection viderait la boutique en un après-midi. D'où `decor_won`,
séparée de `decor` — ni `is_public`, ni table de copie, ni route pour donner.
Les ranger ensemble aurait mis le partage à une propriété de distance.

**TROIS ORIGINES DE DÉCOR, ET `decorSpec` LES COUD.**
`src/components/shelf/constants.tsx` est le seul endroit qui sait les trois : la
maison (`DECOR_BY_KEY`, en mémoire), les gagnés (`won:<id>`,
`services/wonDecor`), les déposés (`custom:<id>`, `services/customDecor`). Il est
appelé au rendu de CHAQUE objet posé, donc tout y est synchrone et hors ligne —
d'où le cache local de `wonDecor`, rempli par la lecture de `stall`
(`hooks/useHall`) et jamais par une vue.

`wall` et `tintable` sont les deux seules propriétés de dessin qui descendent en
base : elles ne se devinent pas d'une image. Une image déposée s'affiche dans un
`img`, où la couleur ne passe pas.

**QUATRE CHOSES SE PORTENT**, une à la fois chacune : tampon, peau, papier,
titre. La liste est `WEARABLE` dans `shop.ts`, et elle décide pour `buy`
(`isUnique`), pour `wear`, pour le CTE de `sell` et pour la route `/shop/worn` —
elle était recopiée à ces quatre endroits sous la forme « tampon ou peau », et
deux familles de plus ont suffi à ce que trois d'entre eux se trompent.

Une peau range sa CLÉ (`grants`), les trois autres rangent l'identifiant de
l'article. `wear` reçoit toujours l'IDENTIFIANT et convertit : l'inverse
vérifiait la possession sur une clé absente d'`owned`, et porter une peau
achetée répondait 403, toujours.

**Le papier n'est pas une peau.** Il ne réécrit rien : il dessine le grain du
fond avec l'encre du thème en cours (`theme/surfaces.ts`, `paperLayer`), donc
les six se combinent avec les dix-sept peaux. Comme tout SVG embarqué, il prend
son encre RÉSOLUE en argument.

Ce qu'on déclare soi-même (séances, notes, critiques) est plafonné par jour, et
la forme de `ref` le plafonne à vie. Le vérifiable — quiz, défis, contributions
— porte le reste.

## Repères

- `src/App.jsx` — l'orchestre : état des films, navigation par `view`, montage
  des couches globales (modale, peaux, visite).
- `src/views/` — une vue par onglet. `src/domain/` — la logique pure, testée.
  `src/services/` — la persistance et les entrées/sorties.
- `src/components/layout/FolderTabs.tsx` — le rail et ses actions de pied
  (épingler, chercher, importer, la peau, la langue, la clé, le compte, la
  visite). **L'union `View` y est la source de vérité des vues** :
  `steps.test.ts` la LIT dans ce fichier, il ne la recopie plus.
  - **Le rail ne porte plus une vue par pastille, mais un GROUPE** : `GROUPS`
    en tient trois — le classeur, explorer, le hall — et `SubTabs` déplie les
    membres du groupe ouvert, au-dessus de la colonne et non dedans (la
    colonne rejoue son animation d'entrée à chaque page). Une vue neuve entre
    donc dans un groupe ; `groupOf` rend `undefined` pour `detail` et
    `import`, qui sont des pages et non des onglets.
  - `needsServer` est au niveau du GROUPE : sans serveur, le hall n'existe
    pas — absent, jamais grisé.
  - **Sur téléphone, ce sont les ACTIONS qui défilent, pas les onglets.**
    L'inverse a coûté cinq pixels de large à la navigation entière, et un
    bouton souple dans une barre qui défile rétrécit au lieu de défiler :
    d'où le `flexShrink: 0` sur chacun.
  - **`all: unset` REND UN BOUTON « inline », ET IL FALLAIT LE REDIRE.**
    `inked` et `bare` tenaient leur `display: inline-flex` de `tap`, **vide
    sous une souris** : sur ordinateur, pas de boîte flexible, donc le
    `gap: 6` inerte et l'icône posée sur la LIGNE DE BASE du texte. Tous les
    boutons à icône étaient de travers, et uniquement là où presque tout le
    monde les regarde. La mise en boîte appartient au bouton ; `tap` ne
    garde que la cible qu'un doigt peut atteindre.
    **`justifyContent` N'EST PAS DANS CETTE MISE EN BOÎTE**, et le premier
    correctif l'y avait mis : un bouton qui s'ajuste à son contenu n'a rien
    à centrer horizontalement, la propriété ne compte QUE sous une largeur
    imposée — c'est-à-dire là où elle nuit, une ligne de résultat étirée
    voyant son affiche et son titre ramenés au milieu. Elle reste dans
    `tap`, où elle centre une icône seule dans ses quarante-quatre pixels.
- Le carnet n'est plus une vue : `components/layout/NotebookDrawer.tsx`,
  ouvert depuis la barre du classeur. Les notes, elles, n'ont pas bougé.
- `src/views/CounterView.tsx` — le comptoir : guichet, présentoir, carnet à
  souches. `src/components/play/` en tient les pièces.
- Budget de `z-index` : grain 1, page et rail 2, la barre du bas du téléphone
  20, panneaux d'étagère 30–45, modale 50, peaux et tiroirs 59–60,
  visite 190–200.
- **Ce budget n'est vrai que pour ce qui est monté hors de la colonne de vue.**
  `[data-enters]` est un contexte d'empilement (`position: relative`,
  `z-index: 2`) ET il porte une transformation pendant son animation
  d'entrée. Un `position: fixed` rendu dedans s'ancre donc sur la colonne au
  lieu de la fenêtre, et son `z-index` ne le classe plus que parmi ses
  voisins de colonne — un panneau à 45 y perd contre n'importe quoi du
  dehors, puisque seul le 2 de la colonne compte.
  Tout panneau, voile, tiroir ou repère en `position: fixed` passe donc par
  `<Layer>` (`src/components/ui/Layer.tsx`), qui le rend dans le corps du
  document. La règle vaut aussi pour ce qui se place en coordonnées d'écran
  calculées à la main, comme le repère de dépôt de l'étagère.
  Exception assumée : un menu ancré à son bouton (`position: absolute` sous
  lui, avec son voile) reste dans la colonne — le sortir romprait l'ancrage.

## Trois paliers, et ce que chacun ouvre

Ce classeur se vend, et le compte en est la porte. Cette section dit qui a le
droit de quoi, parce que c'est la seule chose qu'on ne peut pas retrouver en
lisant le code.

**IL Y A EU UNE AUTRE DOCTRINE, ET ELLE EST MORTE.** Ce fichier a promis
pendant tout un chantier que « le classeur ne se paie jamais », qu'il marchait
entier hors ligne et sans compte, et que ce qui dépendait du dehors était
invisible en son absence. Ce n'est plus vrai, volontairement. Ce paragraphe
reste parce qu'une doctrine renversée sans qu'on le dise laisse derrière elle
des commentaires qui argumentent l'inverse du code — et on en lit encore.

### Sans compte : la visite, et douze fiches à regarder

On voit la visite guidée et les douze fiches de démonstration, affiches
comprises — elles viennent du serveur (`GET /demo`), qui les tient en stock
commun. **On ne crée rien, on n'importe rien, on n'interroge pas TMDB.** Ce
n'est pas un classeur bridé : c'est une vitrine, et elle n'a pas d'autre
prétention.

### Avec un compte : tout, borné

Tout le produit s'ouvre — ranger, noter, chercher, importer, exporter, les
séances, les critiques, le hall. **Une session valide est nécessaire pour
ouvrir le classeur** : le coffre local reste un CACHE qui garde l'application
rapide, il n'est plus la vérité. Sans réseau, on ne rentre pas.

Ce qui est borné est ce qui COÛTE au serveur — le miroir des médias, les
décors, le nombre d'imports. Les bornes vivent dans `server/src/limits.ts`, en
une fonction du palier, et se règlent par l'environnement.

### Avec un abonnement : les mêmes bornes, desserrées

On ne facture pas une fonctionnalité, on facture une CAPACITÉ qu'on héberge.
Le palier vit dans le SCHÉMA — une colonne `plan` sur `person` — comme le
reste de ce qui protège quelqu'un ; une règle écrite dans une route se
contourne par la route suivante. Il s'accorde à la main tant que la
facturation n'existe pas.

**L'ADMIN PASSE AU-DESSUS DE TOUT.** `ADMINS=maquecime` dans l'environnement,
appliqué à chaque démarrage par `index.ts` : un rôle qu'aucune requête ne peut
accorder est un rôle dans lequel personne ne peut monter.

### Les jetons ne se vendent pas

Une seule peau est donnée ; les seize autres se prennent au comptoir, **en
jetons, et les jetons se GAGNENT**. On ne les vend pas contre de l'argent :
`merit_event` est un classement, et un classement qu'on peut acheter ne mesure
plus rien. C'est la seule règle de cette section qui interdit un revenu, et
elle est délibérée.

Une peau achetée l'est pour toujours : `owned` n'a pas de date, et rien ne
l'efface. Un abonnement qui s'arrête ne la reprend pas.

### Le verrou est au choix, jamais à l'application

`applySkin.ts` IGNORE le champ `locked` et sert la peau qu'on lui demande sans
poser de question. **Le verrou est dans `SkinPicker`, jamais dans l'application
de la peau** — sans quoi un rechargement ferait retomber le classeur sur
« carnet » et il se déguiserait tout seul.

`src/theme/skins.test.ts` tient la règle : une seule peau libre, un prix entier
sur chaque autre, un article de boutique pour chacune, et le même prix que
`server/src/shop.ts` — qui est l'original, puisque c'est lui qui débite.

## Le serveur EST le classeur

`server/` est un second paquet, avec ses propres dépendances et ses
propres contrôles (`cd server && npm test && npm run typecheck && npm run boot`).
Il n'est pas dans la liste ci-dessous.

**`npm run boot` EST LÀ PARCE QUE LES DEUX AUTRES NE SUFFISENT PAS.** Ce
serveur ne se compile pas : il tourne en TypeScript direct sous
`--experimental-strip-types`, qui EFFACE les types sans rien
transformer. Une propriété de paramètre — `constructor(readonly x: T)` —,
un `enum`, un `namespace` l'arrêtent net au démarrage. Or `tsc` les
accepte, puisqu'elles sont valides, et vitest transforme avant
d'exécuter : la suite de tests ne DÉMARRE jamais le serveur. Un
`constructor(readonly quel: …)` est resté deux jours dans `limits.ts`, à
travers tous les contrôles au vert, et n'a été trouvé qu'en lançant
`npm run dev` à la main. `boot` charge chaque module par Node lui-même,
avec le drapeau de production ; `node --check` ne voit rien, il ne
valide que la syntaxe JavaScript.

**LA PORTE EST UNE SESSION.** Au chargement, `App` demande `/me` et lit la
réponse en trois états, qui ne se confondent jamais :

| Réponse          | Écran                                                     |
| ---------------- | --------------------------------------------------------- |
| Une personne     | Le classeur                                               |
| Refus (401/403)  | La porte : visite, démos, « ouvrir un compte »            |
| Silence (réseau) | La reconnexion : « on n'arrive pas à joindre le serveur » |

`whoAmI` ([src/services/server.ts]) fait déjà cette distinction et il faut la
garder : « tu n'es pas connecté » et « on n'y arrive pas » n'appellent pas le
même geste, et les confondre est le défaut classique de ce genre de porte.

**LE COFFRE LOCAL EST UN CACHE, PAS LA VÉRITÉ.** IndexedDB tient la collection
pour que l'application soit instantanée et pour que la synchro sache quoi
envoyer ; la copie qui fait foi est au serveur. Ce qui suit reste vrai et le
reste : le dépôt d'un média, la montée d'un décor et l'envoi d'une fiche ne
sont JAMAIS sur le chemin d'un geste. On écrit en local, on rend la main, la
synchro rattrape.

**UNE GARDE D'ÉCRAN N'EST PAS UNE GARDE.** La porte de session cache
l'interface ; elle ne protège rien. Chaque route continue de demander son
compte, et chaque plafond vit dans la requête qui écrit.

- Le schéma est du **SQL qu'on lit** (`server/sql/`), pas la sortie d'un ORM.
  Il y a DEUX fichiers maintenant, et la liste est dans `db.ts` (`SCHEMA_FILES`)
  pour que personne n'ait à la retenir en trois endroits. Toujours pas de table
  de migrations : chaque fichier est conditionnel de bout en bout, donc
  rejouable. Le jour où l'un cessera de l'être — une donnée à transformer
  plutôt qu'une colonne à ajouter — c'est ce jour-là qu'il faudra la table. Les requêtes vivent toutes dans `server/src/store.ts`,
  en paramètres numérotés — une valeur passée en `$1` ne peut jamais
  devenir de la syntaxe.
- Les tests du serveur parlent à un **vrai Postgres** compilé en
  WebAssembly (PGlite) : pas de Docker à lancer, et les contraintes
  éprouvées sont celles de la production.
- Ce qui protège quelqu'un est dans le SCHÉMA quand c'est possible —
  unicité, forme du pseudonyme, cascade d'effacement, refus d'une
  version périmée, plafond appliqué DANS l'insert. Une règle écrite dans
  une route se contourne par la route suivante. Quand le schéma ne suffit
  pas, la règle vit dans `store.ts` en une seule requête : `canReadDecor`
  en est l'exemple, où le blocage entre deux personnes l'emporte sur la
  vitrine — écrit en trois vérifications plus une quatrième posée
  par-dessus, c'est la quatrième qu'on finit par oublier.
- **Les médias ont trois préfixes, et ce n'est pas cosmétique.**
  `p/<id de personne>/<clé>` est privé et LE CHEMIN EST LA PREUVE : un
  ticket n'est signé que pour son propre préfixe. `decor/<id>` est
  partageable, et son droit de lecture se lit en base. `bank/<catégorie>`
  est du stock commun que tout le monde lit et que seul un admin écrit —
  c'est là que vivent les affiches des douze démonstrations, puisqu'elles
  se montrent à qui n'a pas de compte. Un décor rangé sous le préfixe
  privé aurait obligé, le jour du partage, à signer sur le préfixe privé
  d'autrui — et la garantie la plus simple du système aurait sauté pour
  tout le monde, affiches comprises. `bank/decor/<clé>` est la seconde
  branche de ce stock commun : les objets d'étagère déposés depuis le
  studio. **Ne pas confondre avec `decor/<uuid>`** — celui-là est un
  bibelot que QUELQU'UN a déposé, et son droit de lecture se demande à la
  base ; les deux se ressemblent et ne se gardent pas pareil.
- Un SVG venu du container d'autrui repasse par `sanitizeSvg` **à la
  réception**. `CustomDraw` l'injecte en ligne ; l'assainissement au
  dépôt ne compte pour rien dans cette décision.
  **L'exception est ce qui s'affiche dans une balise `img`** — les objets
  gagnés (`WonDraw`).
  Là, le navigateur isole lui-même : ni script, ni accès au document qui
  l'affiche. Il n'y a rien à assainir parce qu'il n'y a rien à atteindre, et
  c'est plus sûr que le nettoyage, pas moins. La règle se lit donc : injecté en
  ligne, on assainit ; affiché en `img`, on n'a pas à le faire.

## Vérifier

`npm run dev`, `npm test`, **`npm run lint`**, **`npx prettier --check .`**,
**`npm run typecheck`**, `npm run build`.

Les trois contrôles en gras manquaient à cette liste, et l'intégration
continue, elle, les fait échouer — trois `React.ReactNode` écrits sans
importer `React`, et dix-neuf fichiers mal formatés, sont passés jusque
dans `main` sans que personne les voie. Un contrôle absent de la liste
des contrôles est un contrôle qu'on ne fait pas.

**`npm run typecheck` n'est PAS couvert par `npm run build`.** Vite
transpile sans vérifier les types : un champ renommé dans un `interface`
et pas chez ceux qui le lisent passe le build ET les tests, puis casse à
l'écran. Quatre erreurs de ce genre — `STRENGTHS[].valeur` et
`SkyNode.couleur` — ont survécu à `npm test` et à `npm run build` avant
que `tsc` ne les nomme.

- Les 197 avertissements du lint sont tolérés ; ce sont les ERREURS qui
  arrêtent tout. On écrit `import type { ReactNode } from "react"` et
  jamais le préfixe `React.` — c'est la convention du reste du projet.
- `npm run format` réécrit, `--check` se contente de dire.
