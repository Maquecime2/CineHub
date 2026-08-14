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

## Ce qui s'achète ne reprend rien

Trois peaux se vendent au comptoir ; **les quatorze autres restent libres, hors
ligne comprises, et le resteront**. Verrouiller une peau qui marchait déjà sans
compte serait la reprendre à quelqu'un — un test nomme les quatorze pour que la
règle ne dépende pas de la mémoire.

`applySkin.ts` IGNORE le champ `locked` et sert la peau qu'on lui demande sans
poser de question : s'il consultait le serveur, un rechargement hors ligne
retomberait sur « carnet » et le classeur se déguiserait tout seul. **Le verrou
est au choix (`SkinPicker`), jamais à l'application.**

Les tampons et les vignettes échappent au problème autrement : ils n'existent
que là où des pseudonymes se croisent. Sans compte, il n'y a personne à qui les
montrer.

## Le serveur vit à côté, et le classeur vit sans lui

`server/` est un second paquet, avec ses propres dépendances et ses
propres contrôles (`cd server && npm test && npm run typecheck`). Il n'est
pas dans la liste ci-dessous.

**Le client l'appelle, et abondamment** — `src/services/server.ts`, lu par
une vingtaine de fichiers : comptes par clés d'accès, synchro des fiches
et des documents, partage, listes et défis, relais TMDB, miroir des
médias. Ce qui reste vrai, et qui ne se négocie pas : **sans adresse de
serveur, sans compte ou sans réseau, le classeur marche entier.** Toute
fonctionnalité qui dépend du dehors est donc INVISIBLE en son absence,
jamais grisée : `serverConfigured()` et `accountOpen()` sont les deux
questions à poser avant de dessiner quoi que ce soit.

Trois choses, à ce titre, ne sont jamais sur le chemin d'un geste : le
dépôt d'un média, la montée d'un décor, l'envoi d'une fiche. On écrit en
local, on rend la main, et la synchro suivante rattrape.

- Le schéma est du **SQL qu'on lit** (`server/sql/001_baseline.sql`), pas la
  sortie d'un ORM. Les requêtes vivent toutes dans `server/src/store.ts`,
  en paramètres numérotés — une valeur passée en `$1` ne peut jamais
  devenir de la syntaxe.
- Les tests du serveur parlent à un **vrai Postgres** compilé en
  WebAssembly (PGlite) : pas de Docker à lancer, et les contraintes
  éprouvées sont celles de la production.
- Ce qui protège quelqu'un est dans le SCHÉMA quand c'est possible —
  unicité, forme du pseudonyme, cascade d'effacement, refus d'une
  version périmée. Une règle écrite dans une route se contourne par la
  route suivante. Quand le schéma ne suffit pas, la règle vit dans
  `store.ts` en une seule requête : `canReadDecor` en est l'exemple, où
  le blocage entre deux personnes l'emporte sur la vitrine — écrit en
  trois vérifications plus une quatrième posée par-dessus, c'est la
  quatrième qu'on finit par oublier.
- **Les médias ont deux préfixes, et ce n'est pas cosmétique.**
  `p/<id de personne>/<clé>` est privé et LE CHEMIN EST LA PREUVE : un
  ticket n'est signé que pour son propre préfixe. `decor/<id>` est
  partageable, et son droit de lecture se lit en base. Un décor rangé
  sous le préfixe privé aurait obligé, le jour du partage, à signer sur
  le préfixe privé d'autrui — et la garantie la plus simple du système
  aurait sauté pour tout le monde, affiches comprises.
- Un SVG venu du container d'autrui repasse par `sanitizeSvg` **à la
  réception**. `CustomDraw` l'injecte en ligne ; l'assainissement au
  dépôt ne compte pour rien dans cette décision.

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
