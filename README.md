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
  réalisateurs, genres, années).
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

React 18 + Vite, sans routeur ni gestionnaire d'état : la navigation est un état
de composant. Quatre modules sont sortis de l'interface, et ce sont eux que les
tests couvrent :

| Fichier        | Rôle                                                              |
| -------------- | ----------------------------------------------------------------- |
| `src/db.js`    | IndexedDB : stockage des images, purge des orphelines, sauvegarde |
| `src/tmdb.js`  | Client TMDB, avec cache et limite de concurrence                  |
| `src/taste.js` | Profil de goût — pur, hors ligne                                  |
| `src/reco.js`  | Récolte des candidats, puis classement — pur, hors ligne          |

La séparation dans `reco.js` entre récolte réseau et scoring n'est pas
décorative : elle permet de reclasser instantanément quand on bouge un curseur,
sans redemander quoi que ce soit à TMDB — et de tester tout le classement sans
réseau.

`src/cine-hub.jsx` réunit l'interface. Le fichier est volumineux et écrit dans
un style dense assumé ; il est exclu de Prettier pour cette raison.

## Licence

MIT — voir [LICENSE](LICENSE).
