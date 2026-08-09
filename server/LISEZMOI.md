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

## Ce qui n'est pas encore là

Le relais TMDB (la clé est encore côté client), les profils publics, les
abonnements, les avis, les listes, le balayage des défis expirés, et le
déploiement. La table des signalements existe déjà, vide : celle-là
n'arrive jamais à temps si on l'ajoute après coup.
