# Chantier communautaire — où on en est

> Document de REPRISE. Il dit ce qui est fait, ce qui reste, et surtout ce
> qu'on a appris en route — les pièges trouvés valent plus que la liste des
> tâches, parce qu'ils ne se redécouvrent pas tout seuls.
>
> À supprimer quand le chantier est fini. Un document de reprise qui survit
> à son chantier devient une carte périmée que quelqu'un finira par suivre.

## Ce qu'on cherche à faire

Le hall existe, il est correct, et il ne se joue pas. Trois constats :

- **Le quizz se joue dans un accordéon** (`Playing` rendu dans une ligne de
  liste, sous le formulaire de tirage et au-dessus de la banque d'admin).
  Pas de `Layer`, pas de `useDialog`, pas de barre de progression, aucun
  retour après une réponse posée, aucune transition. Un jeu demande
  l'écran ; celui-ci demande un paragraphe.
- **Un défi était une liste plus deux dates**, et rien d'autre. Pas
  d'adversaire, pas de cible, pas d'invitation.
- **On invite en tapant un pseudo exact**, partout.

Ce qu'on **n'ouvre pas**, décidé : noter les critiques. Une critique n'a
aucune identité stable — c'est un champ dans la fiche de son auteur, et
`server/sql/001_baseline.sql:563` dit pourquoi il n'y a pas de table. La
noter demanderait d'inventer cette identité, une table de votes, et un
garde-fou contre l'échange entre comptes complices.

## Fait

| Lot                                     | Commit    |
| --------------------------------------- | --------- |
| **A2** — le temps au tableau des scores | `f17c1e4` |
| **LS** — `list_shared` câblé            | `19b6eec` |
| **B1** — inviter quelqu'un à un défi    | `19b6eec` |
| **A4a** — filet de tests sur `QuizView` | `9cc89e6` |

### A2 — le temps

`scoresOf` rend `seconds`, calculé des deux bornes que `quiz_attempt`
portait déjà. Le formateur est `src/domain/elapsed.ts`, pur et testé sur
ses cas limites (minute pile, heure pile, horloge qui recule).

**La vitesse ne paie rien**, et deux tests serveur le tiennent : la même
partie commencée deux heures plus tôt rapporte le même mérite,
`quiz_first` mis à part puisque celui-là mesure l'ORDRE. Si la vitesse
payait, la première chose à faire pour monter au classement serait de
cliquer au hasard très vite.

### LS — `list_shared`

Il était déclaré dans les deux barèmes depuis toujours et crédité par
personne. Il paie le propriétaire sur `PUT /lists/:id/members/:pseudo`,
référence composite `listId:memberId` — copie de `challenge_joined`, dont
la forme achète gratuitement « retirer et remettre ne paie pas deux fois ».
Le barème n'a pas bougé : le 5 était déjà des deux côtés.

### B1 — défier quelqu'un

`PUT/DELETE /challenges/:id/participants/:pseudo`, calquées sur les joueurs
de quizz. **Aucun changement de schéma** : `challenge_participant`
acceptait déjà n'importe qui, seul le geste manquait. Elles exigent
`administer` — un co-rédacteur de la liste ajoute des œuvres, il n'engage
pas des gens — et **ne paient aucun `challenge_joined`** : l'auto-inscription
paie l'auteur parce que quelqu'un a CHOISI de venir ; payer pour ceux qu'on
ajoute soi-même, ce serait se verser quatre points par ami.

### A4a — le filet

`src/views/QuizView.test.tsx`, onze cas écrits contre le fichier **tel
qu'il est**. Leur raison d'être est d'y survivre sans une retouche pendant
la découpe : s'il faut les éditer pour la faire passer, c'est que la
découpe a changé le comportement.

## Trois défauts trouvés en route, et ce qu'ils apprennent

1. **`liste_id` et `per` n'existaient pas.** Le serveur envoie `list_id` et
   `by` ; les interfaces client de `Challenge` et `ListWork` épelaient
   autrement, donc les deux champs valaient `undefined` à l'exécution,
   toujours. Rien n'échouait — un champ absent n'est pas une erreur — mais
   « ce que ce défi vaut » cherchait l'auteur par un pseudo indéfini et
   annonçait **zéro film vu sur chaque défi**, et aucun nom ne s'est jamais
   affiché sous une œuvre d'une liste écrite à plusieurs. Corrigé.
   _La leçon :_ un commentaire signalait déjà ce piège vingt lignes plus
   bas, pour les quiz. Le signaler ne le referme pas.
2. **Un backtick dans un commentaire posé DANS un littéral gabarit** ferme
   la chaîne au milieu de la requête SQL. `FONT_IMPORT` le documente depuis
   longtemps ; `store.ts` le documente maintenant aussi.
3. **`vi.mock` est remonté en tête de fichier.** Une fabrique qui lit une
   constante déclarée plus bas échoue, et le message ne parle jamais de
   remontée. D'où `vi.hoisted`.

## Ce qui reste, dans l'ordre

```
A4b + A5  découpe de QuizView en src/views/quiz/*, et les confirmations
A1        la partie en plein écran (Layer + useDialog)
A3        le chronomètre par question, appliqué par le serveur (003.sql)
C         GET /followers + PeoplePicker
B3        cible chiffrée
B2        « écrire une critique » — impose l'extraction de SEEN_DURING
B4        critère au lieu d'une liste — EN DERNIER (list_id NULL)
```

### A4b + A5 — la découpe et les confirmations

`QuizView.tsx` reste l'entrée (l'union `View` de `FolderTabs.tsx` nomme
`"quiz"`). Nouveau `src/views/quiz/` : `Composer`, `OneQuiz`, `QuizTable`
(ex-`Playing`), `Asked`, `Correction`, `Scoreboard`, `Guests`, `Bank`
(~380 lignes à elle seule), `shared.ts`.

**Fichier par fichier**, avec `npm test && npm run typecheck && npx
prettier --check .` entre chacun. **Ne pas grossir `EXEMPT`/`KEPT`** de
`literals.test.ts` : c'est exactement le moment où ce test cesse de
protéger quelque chose.

**Trois manques de doctrine à combler au passage**, tous les trois « un
geste qui ne dit rien » :

- `deleteQuiz` — pas de `Confirmation`. **`severe`.** Ce qui survit : les
  questions de la banque (la cascade emporte
  `quiz_draw`/`quiz_answer`/`quiz_attempt`, jamais `quiz_question`).
- `removePlayer` — pas de `Confirmation`. **Pas `severe`** : le serveur dit
  que le score reste, le corps doit le dire.
- L'échec d'une invitation est un `div` en écriture manuscrite, **sans
  `role="alert"`** : il n'est annoncé à personne. Il doit devenir un
  `Trouble`. Le filet s'accroche au TEXTE et non au rôle, exprès — il
  survivra à la correction.

L'en-tête de `OneQuiz` est un `<div onClick>` : ni focusable, ni
`aria-expanded`. Il devient un `<button>` — **à faire dans A1**, où il
devient « ouvrir la partie » avec `aria-haspopup="dialog"`, plutôt que deux
fois.

### A1 — le plein écran

`Layer` obligatoire (la colonne de vue est un contexte d'empilement),
`role="dialog"` + `aria-modal` + `aria-labelledby` écrits à la main —
`useDialog` ne pose aucun ARIA, son en-tête le dit.

- **`useDialog` ferme en DEMANDANT**, pas en fermant : « abandonner la
  partie ». Corps différent selon qu'il y a un chronomètre ou non.
- Progression : le `Meter` existant **sans `name`** — la barre seule, que
  le composant sait déjà rendre.
- Transition : conteneur clé sur `current.id`, durées par `--motion-*`
  uniquement.
- **Le tampon dit un MOT — « POSÉE » — et jamais un verdict** : les bonnes
  réponses ne sont réellement pas connues du client avant la fin
  (`drawnQuestions` n'étale `is_right` que si `withAnswers`). Annonce par
  `useSay`.
- La visite : `quiz-playing` / `quiz-powers` / `quiz-scores` /
  `quiz-players` visent le **bouton d'ouverture** et leurs phrases sont
  réécrites — une visite ne peut pas ouvrir une modale.

### A3 — le chronomètre

`server/sql/003_quiz_timer.sql`, ajouté à `SCHEMA_FILES` (`server/src/db.ts`),
conditionnel de bout en bout :

- `quiz.seconds_per_question int` — **NULL par défaut**, donc tout quizz
  existant est sans chronomètre et rien n'est à rétro-remplir. `CHECK` 5–600.
- `quiz_answer.late boolean NOT NULL DEFAULT false`.

Le délai court depuis **la dernière action sur ce quizz**
(`max(answered_at)`, ou `started_at` pour la première) — et non « la
question précédente par rang » : `store.answer` ne vérifie aucun ordre, et
c'est le client qui se trouve marcher dans l'ordre du tirage.

**Le retard est estampillé À L'INSERT**, dans la même requête : la règle
vit là où la ligne s'écrit, et `scoresOf`/`awardQuiz` ne changent alors que
d'un mot chacun — `FILTER (WHERE c.is_right)` devient
`FILTER (WHERE c.is_right AND NOT a.late)`.

**Une réponse hors délai est ACCEPTÉE et vaut zéro**, jamais refusée :
refuser perdrait la réponse et contredirait la promesse « on ne revient pas
dessus » déjà à l'écran.

`quiz_flawless` n'a pas une ligne à changer : il exige `score === weight`,
et un retard baisse `score` sans toucher `weight`.

**La conséquence se dit deux fois à l'écran** — au tirage et avant de
commencer : « un quizz chronométré se joue d'une traite : fermer l'onglet
coûte la question en cours ». Deux aveux à écrire plutôt qu'à cacher :
acheter un pouvoir consomme du temps, et un réseau lent coûte.

### C — le sélecteur de personnes

`store.followersOf` en miroir de `subscriptionsOf`, `GET /followers` à côté
de `/follows`. **Et `NOT_BLOCKED` ajouté aux DEUX requêtes dans le même
commit** : `subscriptionsOf` ne l'applique pas aujourd'hui, là où tous ses
frères le font — « qui je suis » peut donc nommer quelqu'un qui m'a bloqué.

`src/components/hall/PeoplePicker.tsx`, un composant, trois appelants
(listes, invités d'un quizz, participants d'un défi).

- **C'est une suggestion, pas un annuaire, et pas un remplacement de la
  saisie.** Le champ libre RESTE : quelqu'un qui n'est dans aucune des deux
  listes doit rester invitable.
- **Il reste dans la colonne de vue** (`position: absolute` sous son champ) :
  l'exception assumée de la doctrine pour un menu ancré à son bouton.
- Un échec dégrade vers le champ libre, **en silence, sans `Trouble`** —
  le seul `catch` avalé légitime du lot : c'est un confort par-dessus un
  champ qui marche.

### B — les natures de défi

`server/sql/004_challenge_kinds.sql` : `kind text NOT NULL DEFAULT 'liste'`
(`CHECK IN ('liste','critique','critere')`), `target int`, `subject jsonb`.
Les valeurs restent **en français**, comme `person.sharing` : elles
s'écrivent dans les lignes.

**B2 impose l'extraction de `SEEN_DURING`**, et c'est l'édition la plus
risquée du chantier :

> Cette requête est celle par laquelle passe le paiement de **tous** les
> défis existants, elle traite trois âges de données de fiche, et
> `merit_event` étant unique, **un paiement faux ne peut pas être rejoué
> juste**. Test de non-régression **avant** l'extraction, sur un jeu qui
> contient des fiches à `watchedAt` d'avant le journal, des séances dans et
> hors période, et une fiche dont `watches` n'est pas un tableau.

Pour B2, « pendant la période » **ne peut pas être `updated_at`** : une
critique ne porte pas de date et `card.updated_at` bouge à la moindre
retouche. On livre **une séance dans la période ET 140 signes de critique**.

Pour B4, le vrai coût est la **visibilité** : sans liste, `rightsOnList` ne
peut plus servir de source. Une seule fonction `rightsOnChallenge`, et
toutes les routes passent par elle. Un défi par critère n'est **jamais
découvrable** : on y est ou on l'a créé.

**Le barème ne bouge pas.** Aucune `Kind` neuve, aucune ligne dans
`points.ts`. Une nature change CE QUI COMPTE, jamais CE QUE ÇA PAIE. Deux
variantes à refuser d'avance : un `challenge_review` mieux payé (il est
plus facile à vérifier, ce serait l'arbitrage), et un gain proportionnel à
la cible (le créateur fixerait son propre prix).

## Contrôles

À chaque étape, et pas seulement à la fin :

```
npm test && npm run lint && npx prettier --check . && npm run typecheck && npm run build
cd server && npm test && npm run typecheck && npm run boot
```

`npm run typecheck` n'est **pas** couvert par `build`. Et `npm run boot`
compte ici : `kind: 'liste'|'critique'|'critere'` est exactement la forme
que quelqu'un écrit en `enum` — que `tsc` et vitest laissent passer, et que
le serveur refuse au démarrage.

**Rien de tout cela ne demande de monter `SYNCABLE_VERSION` ni `SHAPE`** :
le premier garde les documents client, le second la forme de `Film`, et le
chantier ne touche ni l'un ni l'autre.
