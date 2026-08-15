/* ============================================================
   LA POLITIQUE DE SÉCURITÉ DU CONTENU, EN UN SEUL ENDROIT
   ============================================================

   Un en-tête que le serveur envoie avec la page, et qui dit au
   navigateur d'où cette page a le droit de charger du code, des images,
   et à qui elle a le droit de parler. Tout le reste est refusé, même si
   la page le demande. Ça n'empêche pas une injection : ça empêche le
   code injecté d'appeler un serveur à lui pour y envoyer ce qu'il a
   récolté.

   Elle compte particulièrement ici : le classeur INJECTE DES SVG venus
   du container d'autrui — c'est pour cela que `sanitizeSvg` repasse à la
   réception. Cette politique est la seconde barrière derrière ce
   nettoyage.

   ------------------------------------------------------------
   POURQUOI CE FICHIER EXISTE
   ------------------------------------------------------------

   La politique vit en production dans le `Caddyfile`, qui est un fichier
   de configuration et non du JavaScript. Écrite là seulement, elle
   n'existerait PAS en développement : une liste blanche à laquelle il
   manque une origine ne casse rien tant que l'en-tête n'est pas posé, et
   casse en production, en silence, avec un message dans la console.

   On l'écrit donc ici, et `vite.config.ts` la pose sur `npm run preview`.
   Les deux copies ne peuvent pas diverger sans qu'on le sache :
   `csp.test.js` compare les directives de ce fichier à celles du
   `Caddyfile`.

   ------------------------------------------------------------
   PAS SUR `npm run dev`, ET C'EST VOULU
   ------------------------------------------------------------

   Le serveur de développement sert des modules non compilés, ouvre une
   websocket pour le rechargement à chaud et évalue du code à la volée.
   Une politique de production y interdirait tout cela, et on passerait
   la journée à se battre contre un en-tête qui ne protège rien sur une
   machine. `preview` sert le VRAI paquet construit : c'est là que la
   répétition a un sens.
   ============================================================ */

/**
 * Les origines qui varient d'une installation à l'autre.
 *
 * Une valeur vide se traduit par RIEN plutôt que par une chaîne creuse :
 * une directive qui se termine par un espace de trop est valide et
 * silencieuse, mais un `undefined` recopié dedans autorise une origine
 * qui s'appelle littéralement « undefined » — et donne l'impression que
 * la politique est plus large qu'elle ne l'est.
 */
export function policy({ serveur = "", mesure = "", medias = "" } = {}) {
  const join = (...parts) => parts.filter(Boolean).join(" ");

  const directives = {
    /* Tout ce qui n'est pas nommé plus bas ne vient que de nous. */
    "default-src": "'self'",
    /* Le script de mesure est servi depuis notre propre sous-domaine —
       c'est la moitié de l'intérêt d'héberger Umami soi-même. */
    "script-src": join("'self'", mesure),
    /* OBLIGATOIRE ET ASSUMÉ. Le classeur pose sa feuille de peau dans
       une balise `<style>` écrite au rendu (`FONT_IMPORT`), et les
       dix-sept peaux réécrivent des variables sur `documentElement`. Un
       nonce demanderait de le faire traverser React jusqu'à cette
       balise ; c'est faisable et ce n'est pas fait, donc on l'écrit
       plutôt que de le laisser deviner. */
    "style-src": "'self' 'unsafe-inline' https://fonts.googleapis.com",
    /* `data:` pour une affiche collée à la main, `blob:` pour celles qui
       sortent d'IndexedDB, TMDB pour la vitrine et les fiches enrichies,
       le container pour le miroir. */
    "img-src": join("'self'", "data:", "blob:", "https://image.tmdb.org", medias),
    /* GOOGLE FONTS, ET J'AVAIS ÉCRIT LE CONTRAIRE ICI.

       « Aucune police distante : le classeur n'en charge pas » — faux.
       `theme/applySkin.ts` pose une feuille de style vers
       `fonts.googleapis.com` à chaque changement de peau, et les
       fichiers de police viennent ensuite de `fonts.gstatic.com`. Deux
       domaines, deux directives : la feuille est un STYLE, les fichiers
       sont des POLICES.

       Je l'ai su en posant cette politique sur `npm run preview` et en
       regardant la console : sans cette répétition, la découverte se
       faisait en production, sur un site qui s'affiche dans la mauvaise
       fonte sans que rien ne le dise. */
    "font-src": "'self' https://fonts.gstatic.com",
    /* À qui la page a le droit de parler. TMDB y figure parce que le
       classeur l'appelle EN DIRECT quand quelqu'un pose sa propre clé ;
       `corsproxy.io` est le relais par défaut de la lecture Letterboxd. */
    "connect-src": join(
      "'self'",
      serveur,
      mesure,
      medias,
      "https://api.themoviedb.org",
      "https://corsproxy.io"
    ),
    /* Empêche qu'on encadre le site dans une page tierce pour faire
       cliquer à côté de ce qu'on croit cliquer. */
    "frame-ancestors": "'self'",
    "base-uri": "'self'",
    "form-action": "'self'",
    /* Aucune applet, aucun greffon : il n'y en a jamais eu. */
    "object-src": "'none'",
  };

  return Object.entries(directives)
    .map(([nom, valeur]) => `${nom} ${valeur}`)
    .join("; ");
}

/**
 * Les noms des directives, pour le test qui compare avec le `Caddyfile`.
 *
 * Lus DANS la politique produite, et non recopiés dans une seconde
 * liste : une liste à tenir à jour à côté de la première est la façon la
 * plus sûre d'avoir deux vérités.
 */
export const DIRECTIVES = policy()
  .split(";")
  .map((d) => d.trim().split(" ")[0])
  .filter(Boolean);
