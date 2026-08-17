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

| Lot                                         | Commit    |
| ------------------------------------------- | --------- |
| **A2** — le temps au tableau des scores     | `f17c1e4` |
| **LS** — `list_shared` câblé                | `19b6eec` |
| **B1** — inviter quelqu'un à un défi        | `19b6eec` |
| **A4a** — filet de tests sur `QuizView`     | `9cc89e6` |
| **A4b** — découpe en `src/views/quiz/*`     | `37db68a` |
| **A5** — les deux `Confirmation`, `Trouble` | `e9a603a` |
| **A1** — la partie en plein écran           | `b098def` |
| **A3** — le chronomètre par question        | `61395a1` |
| **C** — `GET /followers` + `PeoplePicker`   | `eab9191` |
| **B3** — la cible chiffrée                  | `34ffcfa` |
| **B2** — le défi par critique               | `325a8d2` |
| **B4a** — `rightsOnChallenge`, porte unique | `0ebc7cb` |

**Ce qui est passé dans `CLAUDE.md`** : le quizz est un écran, le retard
s'estampille à l'insert, une nature change ce qui compte et jamais ce que
ça paie, et le nom d'un champ venu du serveur s'épelle comme le serveur
l'écrit. Le reste de ce document est de l'histoire de chantier et part
avec lui.

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

## Ce qui reste

```
B4b   la nature « critere » elle-même
```

**TOUT LE RESTE EST LIVRÉ.** Ce document ne se supprime donc pas encore —
c'est sa propre règle : il part quand le chantier est fini, et une carte
périmée est pire qu'une carte absente.

### B4b — ce qui est posé, et ce qui ne l'est pas

**Posé** : `challenge.kind` accepte déjà `'critere'` au SCHÉMA, `subject
jsonb` attend son contenu, et surtout **`rightsOnChallenge` est écrite,
câblée sur les six routes, et sa branche « sans liste » est déjà là** —
on y est ou on l'a créé, jamais découvrable. C'était le vrai coût de ce
lot, celui que le plan annonçait, et il est payé : 402 tests serveur
passent sans qu'un seul ait bougé, ce qui prouve que le déplacement des
droits n'a rien élargi.

**Pas posé, et volontairement pas précipité** : trois choses, qui tiennent
ensemble.

1. **`list_id` n'est pas encore NULL-able.** Le rendre nullable est une
   ligne ; ce qui suit ne l'est pas.
2. **`SEEN_DURING` est bâtie AUTOUR de `li.tmdb_id`** — elle part de
   `list_item` et demande à `card` de confirmer. Un défi par critère n'a
   pas de `list_item` du tout : il faut partir de `card` et filtrer sur
   `subject`. Ce n'est pas une condition de plus dans la requête
   existante, c'est une SECONDE forme de comptage, et c'est le seul
   endroit du chantier où l'on ne peut pas se contenter d'ajouter un mot.
3. **Quels critères ?** Une décennie, un pays, un cinéaste — rien dans le
   plan ne le dit, et la forme de `subject` en dépend entièrement.

**Pourquoi s'arrêter là plutôt que deviner.** Cette requête PAIE, et
`merit_event` est unique : un versement faux ne peut pas être rejoué
juste. Le plan écrit lui-même que c'est le risque du chantier. Choisir
seul la liste des critères, puis écrire à la hâte un second moteur de
comptage qui crédite des points définitifs, est exactement le geste
contre lequel le filet des trois âges a été tissé. La question 3 se
tranche en une phrase ; 1 et 2 sont alors du travail ordinaire.

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
