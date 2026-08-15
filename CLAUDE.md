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

- Le schéma est du **SQL qu'on lit** (`server/sql/001_baseline.sql`), pas la
  sortie d'un ORM. Les requêtes vivent toutes dans `server/src/store.ts`,
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
  tout le monde, affiches comprises.
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
