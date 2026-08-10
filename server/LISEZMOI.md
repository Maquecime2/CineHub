# Le serveur de Ciné Hub

Squelette de la phase 3 : des comptes qui entrent par clé d'accès
(passkey), une session, et deux routes de collection qui prouvent la
chaîne. Le communautaire — profils, abonnements, avis, listes — viendra
là-dessus.

**Le classeur continue de marcher sans lui.** Le client reste local
d'abord ; ce serveur est une copie, pas la source.

## Le faire tourner

```bash
cd server
cp .env.exemple .env
docker compose up -d
npm install
npm run dev
```

Le socle SQL est posé au démarrage : il est conditionnel de bout en
bout, donc rejouable, et un serveur qui démarre sur une base vide
démarre quand même.

## Les contrôles

```bash
npm test && npm run typecheck
```

Les tests parlent à un **vrai Postgres**, compilé en WebAssembly
(PGlite) : pas de Docker à lancer, et pourtant les contraintes, les
`jsonb` et les `ON CONFLICT` sont ceux de la production. Une base neuve
par test.

Ce qu'ils **n'**éprouvent **pas** : la cérémonie cryptographique
elle-même, qui demande un authentificateur — une empreinte, un visage,
une clé physique. La vérification des signatures est confiée à
`@simplewebauthn/server`. Le reste du chemin est couvert.

## Les routes

| Route                                 | Ce qu'elle fait                                               |
| ------------------------------------- | ------------------------------------------------------------- |
| `POST /auth/inscription/options`      | Ouvre une inscription pour un pseudonyme libre                |
| `POST /auth/inscription/verification` | Enregistre la clé, crée le compte, ouvre la session           |
| `POST /auth/connexion/options`        | Propose une cérémonie — même réponse si le compte est inconnu |
| `POST /auth/connexion/verification`   | Vérifie la signature et ouvre la session                      |
| `GET /moi`                            | Qui est connecté, et combien de fiches                        |
| `POST /deconnexion`                   | Ferme la session                                              |
| `GET /collection?depuis=…`            | Ce qui a bougé depuis une date                                |
| `PUT /collection`                     | Range des fiches (500 par envoi au plus)                      |
| `GET /tmdb/*`                         | Relais TMDB — onze chemins, la clé reste ici, compte exigé    |
| `GET /letterboxd/:pseudo`             | Relais du flux RSS que le navigateur ne peut pas lire         |
| `GET /mes-donnees`                    | Tout ce que le serveur détient de vous                        |
| `DELETE /mon-compte`                  | L'efface, et tout ce qui pend dessous                         |
| `GET /sante`                          | Debout ?                                                      |

## Trois choix qui méritent d'être connus

**Le cookie porte un secret ; la base n'en garde que l'empreinte.** Une
fuite de la table des sessions ne donne aucune session utilisable.

**Le dernier écrivain gagne, et c'est la base qui arbitre.** La clause
`WHERE fiche.maj_le < EXCLUDED.maj_le` refuse une version plus ancienne
que celle déjà rangée. Lire puis écrire côté serveur laisserait un
intervalle où deux appareils peuvent se doubler.

**Une suppression se synchronise.** Effacer la ligne ferait revenir la
fiche au prochain envoi de l'appareil qui ne sait pas encore : on garde
une pierre tombale.

**Le compte rendu d'un envoi distingue trois choses** — `rangees`,
`perimees`, `illisibles`. Un client qui vide sa file d'attente sur la foi
d'un seul chiffre croirait avoir envoyé ce que la base a écarté.

**Le relais TMDB exige un compte.** Sans cela, c'est un accès TMDB
gratuit et anonyme pour la Terre entière, sur notre quota. Un classeur
sans compte garde donc la clé saisie chez lui — ce qu'il fait déjà. Et
seuls onze chemins sont relayés, écrits en toutes lettres : un relais qui
transmet n'importe quoi prête sa clé, son adresse et sa facture.

## Le curseur est un rang, jamais une heure

`GET /collection?depuis=` prend le **numéro d'ordre** de la dernière
fiche vue, pas une date. Le serveur numérote ce qu'il reçoit (`seq`), et
renumérote une fiche à chaque modification.

Suivre les dates paraissait économique et ne l'était pas : un téléphone
en retard d'une heure pousse des fiches datées d'une heure plus tôt, et
l'autre appareil — qui demande « ce qui a bougé depuis maintenant » — ne
les verrait **jamais**. Elles seraient rangées sur le serveur, invisibles
à tous, sans qu'aucune erreur ne le dise.

Les dates du client (`maj_le`) gardent leur rôle : arbitrer entre deux
versions d'une même fiche. Les deux ne se confondent pas.

## « Le serveur ne répond pas » alors qu'il tourne

Neuf fois sur dix : l'ORIGINE. Le navigateur refuse une réponse dont
l'origine n'est pas autorisée **avant** de la donner à la page, et
`fetch` échoue exactement comme si le serveur était éteint — la
distinction n'est pas révélée, délibérément.

Le serveur de développement (5173) et l'aperçu de la version construite
(4173) sont deux origines différentes. Les deux doivent figurer dans
`ORIGINE`. Le démarrage les imprime, c'est le seul endroit où la vérité
se lit :

```
Ciné Hub — serveur debout sur 8787
  origine acceptée : http://localhost:5173
  origine acceptée : http://localhost:4173
```

Côté client, essayer la version construite contre ce serveur :

```bash
VITE_SERVEUR=http://localhost:8787 npm run build && npm run preview
```

## La porte de service

`POST /dev/session` ouvre une session sans clé d'accès. Elle n'existe que
si `NODE_ENV` n'est pas `production` **et** que `PORTE_DEV=1` est posé à
la main. Elle sert à éprouver la synchronisation de bout en bout dans un
navigateur piloté, où aucune empreinte ni aucun visage n'existe.

## Ce qui n'est pas encore là

Les profils publics, les abonnements, les avis, les listes — et le
déploiement. Le client, lui, **parle désormais à ce serveur** : il tire,
fusionne et pousse sa collection dès qu'un compte est ouvert, et
continue de fonctionner entièrement sans.

La table des signalements existe déjà, vide : celle-là n'arrive jamais à
temps si on l'ajoute après coup.
