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

## Repères

- `src/App.jsx` — l'orchestre : état des films, navigation par `view`, montage
  des couches globales (modale, peaux, visite).
- `src/views/` — une vue par onglet. `src/domain/` — la logique pure, testée.
  `src/services/` — la persistance et les entrées/sorties.
- `src/components/layout/FolderTabs.tsx` — le rail d'onglets et ses trois
  actions de pied : épingler un film, la peau du site, la visite.
- Budget de `z-index` : grain 1, page et rail 2, panneaux d'étagère 30–45,
  modale 50, peaux et tiroirs 59–60, visite 190–200.
- `[data-enters]` porte une transformation pendant son animation d'entrée :
  tout `position: fixed` doit être monté EN DEHORS, sinon il s'ancre sur la
  colonne au lieu de la fenêtre.

## Vérifier

`npm run dev`, `npm test`, **`npm run lint`**, **`npx prettier --check .`**,
`npm run build`.

Les deux contrôles en gras manquaient à cette liste, et l'intégration
continue, elle, les fait échouer — trois `React.ReactNode` écrits sans
importer `React`, et dix-neuf fichiers mal formatés, sont passés jusque
dans `main` sans que personne les voie. Un contrôle absent de la liste
des contrôles est un contrôle qu'on ne fait pas.

- Les 197 avertissements du lint sont tolérés ; ce sont les ERREURS qui
  arrêtent tout. On écrit `import type { ReactNode } from "react"` et
  jamais le préfixe `React.` — c'est la convention du reste du projet.
- `npm run format` réécrit, `--check` se contente de dire.
