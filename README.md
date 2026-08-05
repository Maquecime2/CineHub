# Ciné Hub

[![CI](https://github.com/Maquecime2/CineHub/actions/workflows/ci.yml/badge.svg)](https://github.com/Maquecime2/CineHub/actions/workflows/ci.yml)

Une archive de films personnelle, tenue comme un carnet d'archiviste : papier
kraft, ruban adhésif, anneaux de café et machine à écrire. On y range ses
boîtiers sur des étagères, on écrit ses critiques à la main, on relie les films
entre eux, et on se laisse recommander ce qu'on n'aurait pas trouvé seul.

**[→ Essayer l'application](https://maquecime2.github.io/CineHub/)**

## Ce qu'on y fait

- **L'étagère** — les films en boîtiers debout, déplaçables, séparés par des
  intercalaires qu'on nomme soi-même. Deux murs : les films vus, et ceux mis de
  côté.
- **La fiche** — une critique en texte libre où l'on peut insérer ses propres
  captures d'écran, des mots-clés, et des liens de film à film.
- **La constellation** — la collection vue comme un graphe : ce qui se tient
  près de quoi.
- **Le carnet** — des notes qui ne se rattachent à aucun film en particulier.
- **L'import** — un export CSV Letterboxd, enrichi par TMDB (affiches,
  réalisateurs, genres, années). Sans fichier, un pseudo suffit à relever
  ses dernières séances et sa watchlist entière depuis le profil public.
- **Les recommandations** — deux curseurs plutôt qu'un bouton magique :
  _niche_ (du grand public à la pépite) et _écart_ (dans vos goûts, ou hors des
  sentiers). Chaque proposition est justifiée en une ligne.

## Démarrer

```bash
npm install
npm run dev
```

L'application s'ouvre sur <http://localhost:5173>.

| Commande          | Effet                            |
| ----------------- | -------------------------------- |
| `npm run dev`     | Serveur de développement         |
| `npm run build`   | Build de production dans `dist/` |
| `npm run preview` | Sert le build local              |
| `npm test`        | Tests unitaires (Vitest)         |
| `npm run lint`    | ESLint                           |
| `npm run format`  | Prettier, en écriture            |

## La clé TMDB

Les affiches, genres et recommandations viennent de [TMDB](https://www.themoviedb.org/settings/api),
qui délivre des clés gratuites. La clé se saisit **dans l'application**, onglet
Import — il n'y a rien à configurer avant de lancer le projet, ni fichier
`.env`, ni secret dans le dépôt.

Deux choses à savoir, en connaissance de cause :

- La clé est rangée en clair dans le `localStorage` de votre navigateur.
- Elle transite en paramètre d'URL, comme le veut l'API v3 de TMDB : elle
  apparaît donc dans l'historique et les journaux réseau.

C'est acceptable pour une clé de lecture publique et gratuite. En revanche,
**n'introduisez pas de clé par défaut via une variable `VITE_*`** : Vite les
inline en clair dans le JavaScript final, ce qui la publierait au lieu de la
protéger.

## Où vivent vos données

Tout est local à votre navigateur, il n'y a aucun serveur :

- les fiches, notes et étagères dans le `localStorage` ;
- les affiches et captures d'écran dans **IndexedDB**, sous forme de blobs — le
  `localStorage` plafonne autour de 5 Mo et gonflerait d'un tiers en base64.

Conséquence directe : les données sont **liées à l'origine du site**. Ce que
vous saisissez sur `localhost:5173` n'apparaîtra pas sur la version en ligne, et
inversement. L'onglet Import propose un export/import complet, qui sert
exactement à faire ce trajet — et de sauvegarde.

## Sous le capot

React 19 + Vite, sans routeur ni gestionnaire d'état : la navigation est un état
de composant.

```
src/
  App.jsx              composition et routage de vue, rien d'autre
  types/               les formes de données du projet, en un seul endroit
  theme/               palette, polices, grain, styles partagés
  domain/              le métier, sans React : film · importing · sky · seeded
  services/            storage · images · shelfViews · (db · tmdb)
  hooks/               useNotes · useShelfViews
  components/          atmosphere · ui · film · stills · shelf · layout
  views/               une vue par écran
  taste.js  reco.js  shelf-views.js  db.js  tmdb.js
```

Trois règles tiennent le découpage : `domain/` et `services/` ne connaissent pas
React ; `components/` ne connaît pas le stockage ; `views/` compose, `App` route.
`domain/seeded.ts` ne renvoie que des nombres et des formes — les couleurs
tirées au sort vivent dans `theme/ink.ts`, pour que le métier ignore la palette.

Les modules purs sont ceux que les tests couvrent en priorité :

| Fichier              | Rôle                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `src/db.js`          | IndexedDB : stockage des images, purge des orphelines, sauvegarde |
| `src/tmdb.js`        | Client TMDB, avec cache et limite de concurrence                  |
| `src/taste.js`       | Profil de goût — pur, hors ligne                                  |
| `src/reco.js`        | Récolte des candidats, puis classement — pur, hors ligne          |
| `src/shelf-views.js` | Le rangement de l'étagère : rangées, catégories, décors           |
| `src/domain/*.ts`    | Modèle, import CSV, constellation, aléatoire reproductible        |

La séparation dans `reco.js` entre récolte réseau et scoring n'est pas
décorative : elle permet de reclasser instantanément quand on bouge un curseur,
sans redemander quoi que ce soit à TMDB — et de tester tout le classement sans
réseau.

### Typage

TypeScript en mode strict sur le métier, les services, les composants et la
plupart des vues. Restent en JavaScript : les modules historiques (`db`, `tmdb`,
`taste`, `reco`, `shelf-views`), `components/shelf/` et
`views/library/LibraryView.jsx`.

L'étagère est le morceau le plus mouvant du projet et son glisser-déposer ne se
teste pas facilement : la typer suppose de pouvoir exercer le geste à la main.
`allowJs` permet de le faire fichier par fichier, quand ce sera le moment.

### Deux bugs connus, documentés sur place

- **`slugOf`** (`src/domain/importing.ts`) mange une lettre de trop sur les
  titres commençant par « Les » ou par « a ». L'appariement reste cohérent, mais
  corriger la regex change la clé des fiches déjà enregistrées : il faut une
  migration, pas seulement une retouche.
- **Restauration d'une sauvegarde** (`src/views/import/BackupPanel.tsx`) : les
  vues d'étagère sont bien dans le fichier et `importBackup` les renvoie, mais
  elles ne sont pas transmises — le rangement est reconstruit depuis les anciens
  intercalaires au lieu d'être rétabli.

## Licence

MIT — voir [LICENSE](LICENSE).
