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
- **Côté serveur : RIEN.** La table `doc` est générique (`person_id` + `key`
  texte libre), donc deux clés de plus ne demandent aucun déploiement. Ce qui se
  paie est côté client : **`SYNCABLE_VERSION` monte** (`services/documents.ts`),
  sans quoi `catchUpDocuments` ne rejoue pas le rattrapage et les classeurs déjà
  connectés n'enverront JAMAIS ces documents — la pire perte, celle qu'on ne
  découvre qu'en changeant d'ordinateur.

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
