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

| Route                                 | Ce qu'elle fait                                                 |
| ------------------------------------- | --------------------------------------------------------------- |
| `POST /auth/inscription/options`      | Ouvre une inscription pour un pseudonyme libre                  |
| `POST /auth/inscription/verification` | Enregistre la clé, crée le compte, ouvre la session             |
| `POST /auth/connexion/options`        | Propose une cérémonie — même réponse si le compte est inconnu   |
| `POST /auth/connexion/verification`   | Vérifie la signature et ouvre la session                        |
| `GET /moi`                            | Qui est connecté, et combien de fiches                          |
| `POST /deconnexion`                   | Ferme la session                                                |
| `GET /collection?depuis=…`            | Ce qui a bougé depuis une date                                  |
| `PUT /collection`                     | Range des fiches (500 par envoi au plus)                        |
| `GET /tmdb/*`                         | Relais TMDB — onze chemins, la clé reste ici, compte exigé      |
| `GET /letterboxd/:pseudo`             | Relais du flux RSS que le navigateur ne peut pas lire           |
| `PUT /partage`                        | Personne, par lien, ou tout le monde — jeton neuf à chaque fois |
| `PUT /fiche/:id/cachee`               | Écarter une fiche du partage, ou l'y remettre                   |
| `GET /chez/:pseudo?jeton=…`           | La collection de quelqu'un, sans compte ni cookie               |
| `GET /profils/:pseudo`                | Le profil de qui se montre — 404 pour les autres                |
| `PUT /abonnements/:pseudo`            | Suivre. Sens unique, personne n'est prévenu                     |
| `DELETE /abonnements/:pseudo`         | Ne plus suivre — possible même si l'autre s'est refermé         |
| `GET /abonnements`                    | Qui vous suivez, et si leur collection est encore ouverte       |
| `GET /fil?avant=…`                    | Ce que les gens suivis ont touché récemment                     |
| `GET /oeuvres/:tmdbId`                | Ce que les collections publiques disent d'un film               |
| `GET /blocages`                       | Qui vous avez fait taire                                        |
| `PUT /blocages/:pseudo`               | Ne plus rien voir de quelqu'un — et lui non plus de vous        |
| `DELETE /blocages/:pseudo`            | Le défaire ; les abonnements coupés ne reviennent pas           |
| `POST /signalements`                  | Dire ce qui ne va pas ; deux fois vaut une                      |
| `GET /listes`                         | Vos listes, et celles où l'on vous laisse écrire                |
| `POST /listes`                        | En ouvrir une — fermée par défaut                               |
| `GET/PUT/DELETE /listes/:id`          | La lire, la retoucher, l'effacer (propriétaire)                 |
| `POST /listes/:id/oeuvres`            | Y ranger une œuvre, par son `tmdb_id`                           |
| `DELETE /listes/:id/oeuvres/:tmdbId`  | L'en retirer                                                    |
| `PUT/DELETE /listes/:id/membres/:qui` | Inviter à écrire, renvoyer — ou partir soi-même                 |
| `GET /defis`                          | Les vôtres, ceux rejoints, ceux des gens suivis                 |
| `POST /defis`                         | Une liste plus une période ; qui le lance y participe           |
| `GET /defis/:id`                      | Ses œuvres, et où en est chaque participant                     |
| `PUT/DELETE /defis/:id/participation` | Entrer, sortir — sortir se fait toujours                        |
| `GET /mes-donnees`                    | Tout ce que le serveur détient de vous                          |
| `DELETE /mon-compte`                  | L'efface, et tout ce qui pend dessous                           |
| `GET /sante`                          | Debout ?                                                        |

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

## Ce qu'un visiteur voit, et ce qu'il ne verra jamais

`GET /chez/:pseudo` est la **seule** route qui réponde à quelqu'un sans
compte. Trois décisions la gouvernent :

**Les notes et le journal des séances sont retirés dans la REQUÊTE**
(`donnees - notes - watches - watchedAt`), pas dans la route. Une
route qui filtre est une route qu'on duplique un jour en oubliant la
moitié du filtre ; une soustraction écrite dans la seule requête qui
sert le public ne s'oublie pas.

**Le même 404 dans les trois cas** — compte inconnu, collection privée,
jeton faux. Distinguer renseignerait un inconnu sur qui est inscrit et
sur qui garde une collection secrète.

**Le partage appartient à la collection**, pas à chaque fiche : « je
montre ma vidéothèque » se dit une fois. Une fiche peut en être écartée
(`cachee`), et c'est l'exception.

## Le fil ne raconte pas, il montre

Le serveur ne garde aucune histoire : il sait qu'une fiche a bougé, pas
ce qui a changé dedans. Le fil rend donc des films **récemment touchés**
chez les gens suivis, avec la note et la critique du moment. Il n'écrit
jamais « a mis quatre étoiles » — ce qu'il serait incapable de prouver.

Il se calcule à la lecture, sans table de fil : pour quelques dizaines
d'abonnements, l'index `fiche_suite` suffit largement. Le jour où il ne
suffira plus sera un vrai problème d'échelle, et pas avant.

**On ne trouve que ceux qui se montrent.** Pas d'annuaire, pas de liste
d'inscrits : `GET /profils/:pseudo` répond 404 pour un compte privé
exactement comme pour un compte inexistant. Un partage par LIEN n'ouvre
pas de profil — un lien se donne à quelqu'un, il ne rend pas trouvable.

## Il n'y a pas de table d'avis

C'est la décision de l'étape des avis partagés. Une critique existe
déjà : elle est dans la fiche de son auteur, `donnees->>'review'`, et
elle s'y synchronise depuis la phase 4. La recopier ailleurs pour la
« publier » créerait deux vérités qui divergeraient au premier oubli —
une critique corrigée chez soi et restée fausse en public.

Publier n'est donc pas un geste de plus : c'est la conséquence du
partage déjà choisi. Ce qui manquait n'était pas un endroit où écrire,
mais un index pour lire à l'ENVERS — non plus « les films de cette
personne » mais « les gens qui ont vu ce film » (`fiche_oeuvre`).

`tmdb_id` est la seule clé possible : deux personnes qui rangent le même
film ont deux fiches, deux identifiants, souvent deux titres. Une fiche
saisie à la main n'a donc pas d'écho, et c'est cohérent.

**Une note est du texte tant qu'on ne l'a pas regardée.** Le `jsonb`
vient de clients de toutes les époques : `rating` y est un nombre, une
chaîne, une chaîne vide, ou absent. Un `::numeric` direct fait tomber la
requête entière sur une seule fiche mal formée — la moyenne de tout le
monde perdue pour une vieille fiche d'un inconnu. La forme se vérifie
avant la conversion.

**`GET /oeuvres/:tmdbId` exige un compte**, alors que la collection
partagée n'en demande pas. La différence : là-bas on ouvre la porte de
quelqu'un qui vous a donné son adresse ; ici on interroge tout le monde
à la fois. L'ouvrir aux inconnus ferait de ce serveur un moissonneur
d'avis.

## Le blocage se déclare d'un côté et agit des deux

Bloquer quelqu'un le retire de ce qu'on voit ET nous retire de ce qu'il
voit — profil, fil, écho des œuvres. Un blocage à sens unique laisse
l'autre continuer de lire, de répondre et de recommencer. Les trois
lectures qui font se croiser deux personnes partagent donc le même
fragment de condition, écrit une fois.

Il défait au passage les abonnements **des deux côtés**, et ne les
refait pas au déblocage : reconstituer un lien qu'on a coupé serait
décider à la place de quelqu'un.

Ce qu'il ne fait **pas** : cacher une collection publique à qui en
connaît l'adresse. Un blocage est un silence, pas un mur, et prétendre
le contraire donnerait une fausse sécurité.

## Une liste contient des œuvres, pas des fiches

Une liste de fiches serait la liste des exemplaires de quelqu'un : elle
ne voudrait plus rien dire chez un autre, et se viderait le jour où son
auteur efface une fiche. `tmdb_id` est donc la clé, et le titre n'est
gardé qu'en instantané — de quoi afficher la liste à quelqu'un qui n'a
ni le film ni de clé TMDB.

**Co-construire est un droit d'écriture, pas une propriété partagée.**
Un membre ajoute et retire des œuvres ; il ne renomme pas la liste, ne
la publie pas et ne l'efface pas. Sans cette asymétrie, une liste à six
mains n'a plus personne pour en répondre. Partir, en revanche, ne
demande la permission de personne.

## L'avancement d'un défi se calcule, il ne se déclare pas

Personne ne coche « vu » : le classeur le sait déjà. Une œuvre compte
quand une séance **datée dans la période** figure au journal — celui-là
même qui ne sort jamais d'une collection partagée. Il n'en sort pas
davantage ici : seul un NOMBRE en ressort, et seulement pour des gens
qui ont demandé à participer. D'où l'inscription explicite : compter
automatiquement les abonnés d'une liste publique mesurerait des gens
qui n'ont rien demandé.

`jsonb_typeof` avant `jsonb_array_elements`, pour la même raison que la
moyenne des notes : `watches` traverse des clients de toutes les
époques, et une seule vieille fiche ferait tomber la requête entière —
l'avancement de tout le monde perdu d'un coup. `watchedAt` sert de repli
pour les fiches d'avant le journal ; les ignorer dirait « pas vu » à
quelqu'un qui a vu.

**La table s'appelle `epreuve` et non `defi`** : ce dernier nom était
déjà pris par le hasard des cérémonies WebAuthn, et deux tables de sens
opposés sous un même nom se confondent une nuit de panne. « Défi » reste
le mot de l'écran.

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

Le déploiement. Le client, lui, **parle désormais à ce serveur** : il tire,
fusionne et pousse sa collection dès qu'un compte est ouvert, et
continue de fonctionner entièrement sans.

**Les images ne se synchronisent pas**, et c'est un choix assumé pour
l'instant : les captures et les affiches importées d'un disque sont des
blobs dans IndexedDB, et les faire suivre demande un stockage d'objets
— une dépense et un compte de plus, pour un serveur qui tourne encore
sur une machine de bureau. Un second appareil affiche donc un cadre qui
dit « restée sur l'autre appareil » plutôt qu'un rectangle muet.

**Il n'y a pas encore de file de modération.** Les signalements
s'empilent dans leur table, avec leur auteur, leur cible et la personne
visée ; rien ne les lit. C'est acceptable tant que ce serveur tourne sur
une machine de bureau, et ce ne le sera plus le jour des inscriptions
ouvertes.
