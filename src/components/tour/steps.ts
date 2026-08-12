/* ============================================================
   THE TOUR — what the binder tells about itself

   ┌──────────────────────────────────────────────────────────┐
   │ THIS FILE FOLLOWS THE PRODUCT.                           │
   │ Every feature added, changed, renamed or removed is      │
   │ echoed HERE in the same change, and on the target's      │
   │ `data-tour` attribute. A tour that describes the old     │
   │ product is one more lie.                                 │
   └──────────────────────────────────────────────────────────┘

   One tour per view, plus a "global" tour that crosses them keeping only
   the essentials. The global tour does not rewrite the texts: it PICKS
   from the page tours, failing which the two would diverge at the first
   change.
   ============================================================ */
import type { View } from "../layout/FolderTabs";
import { serverConfigured } from "../../services/server";

export interface TourStep {
  /** CSS selector of what we are showing. `null`: bubble in the centre. */
  target: string | null;
  title: string;
  body: string;
  /** View to open before the step — that is what makes the tour travel. */
  view?: View;
  /**
   * Tab of the film folder to open before the step.
   *
   * THE SAME MECHANISM AS `view`, EXTENDED BY ONE NOTCH — and above all
   * not a second mechanism beside it: `TourOverlay` calls `onTab` in the
   * same effect where it calls `onView`, and for the same reason. Since
   * the card is read in three tabs, four of the seven steps of the
   * "detail" tour aim at cards that the open tab does not show; without
   * this field they would be skipped like absent targets.
   *
   * The values are those of `FolderTab` (`views/DetailView`), copied here
   * rather than imported: `steps.ts` describes the product and depends on
   * no view — `View` itself is only a type in it.
   */
  tab?: "film" | "mots" | "liens";
  placement?: "right" | "bottom" | "left" | "top" | "center";
  /**
   * Target absent ⇒ step skipped without a sound. True of everything that
   * depends on content: an empty collection has neither poster, nor row,
   * nor card.
   */
  optional?: boolean;
  /**
   * The step does not exist at all without a server.
   *
   * `optional` is not enough for those that OPEN a view: the change of
   * view happens BEFORE we look for the target (see `TourOverlay`), so a
   * skipped step would still have made a page with no tab left blink. So
   * we remove it upstream, rather than skipping it downstream.
   */
  needsServer?: boolean;
}

export interface Tour {
  label: string;
  steps: TourStep[];
}

/** Raccourci de lecture : `[data-tour="…"]`. */
const at = (name: string) => `[data-tour="${name}"]`;

/* ---------- the page tours ---------- */

const library: Tour = {
  label: "La vidéothèque",
  steps: [
    {
      target: at("wall-search"),
      title: "Chercher",
      body: "Un titre, un·e cinéaste, un mot de votre critique. Sur le mur, la recherche filtre ; sur l'étagère, elle éteint ce qu'elle ne trouve pas et laisse l'agencement en place. Pour chercher au-delà des films — les gens, les motifs, les fils, le carnet — la loupe, au pied du rail ou au bout de la barre du bas, interroge tout d'un coup.",
      placement: "bottom",
    },
    {
      target: at("wall-mode"),
      title: "Le mur ou l'étagère",
      body: "Deux façons de regarder la même collection : un mur d'affiches punaisées, ou des boîtiers rangés en rayons que l'on déplace à la main.",
      placement: "bottom",
    },
    {
      target: at("wall-sort"),
      title: "Trier, ou ranger",
      body: "Sur le mur, trier est un état passager. Sur l'étagère, ranger est un geste : il réécrit l'agencement une fois, puis s'efface. Recliquer le même verbe retourne la rangée.",
      placement: "bottom",
    },
    {
      target: at("wall-filters"),
      title: "Les tamis",
      body: "Genres et décennies se cumulent : ce sont deux tamis posés l'un sur l'autre. Recliquer une étiquette allumée la retire.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("wall-views"),
      title: "Les vues nommées",
      body: "Sur l'étagère, chaque vue est un rangement à part : ses rayons, ses catégories, son bois, son décor. On en garde plusieurs, et « par réalisateur » en fabrique une d'un clic.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("wall-decor"),
      title: "L'atelier",
      body: "Le mur se peint, et les fiches ont un calibre. Sur l'étagère, le même bouton s'appelle « Atelier déco » et vit dans le menu des vues : le décor appartient à la vue, pas au rayon.",
      placement: "left",
      optional: true,
    },
    {
      target: at("wall-films"),
      title: "Une fiche s'ouvre",
      body: "Cliquez une affiche pour ouvrir son dossier : c'est là que se tiennent la critique, les motifs et le fil rouge.",
      placement: "top",
      optional: true,
    },
    /* THE GESTURE THAT CANNOT BE GUESSED, and which did not exist before
       the application fitted in one hand. With a finger, a swipe
       scrolls: so grabbing has to announce itself otherwise, and the
       long press takes care of it. Nobody finds it on their own.

       `optional` like the other steps that aim at content: an empty
       binder has no poster to show, and must be able to play the tour in
       full. */
    {
      target: at("wall-films"),
      title: "Ranger au doigt",
      body: "Sur l'étagère et sur le mur, on déplace en glissant. Au doigt, gardez l'objet appuyé un instant : il se saisit, et le balayage cesse de faire défiler. Un repère montre la fente où il tombera.",
      placement: "top",
      optional: true,
    },
  ],
};

const watchlist: Tour = {
  label: "À voir",
  steps: [
    {
      target: at("wall-films"),
      title: "Ce qui attend",
      body: "Le même mur, mais des films que vous n'avez pas encore vus. Ouvrez une fiche et le bouton « JE L'AI VU » la fait passer dans la vidéothèque en ouvrant son journal de séances.",
      placement: "top",
      optional: true,
    },
    {
      target: at("soir-ouvrir"),
      title: "Lequel ce soir ?",
      body: "La question que la pile ne savait pas entendre. Dites le temps dont vous disposez et dans quel état vous êtes : le classeur tranche, dit pourquoi, et « une autre » descend d'un cran. Ce bouton n'existe que sur cette liste — la vidéothèque, elle, est déjà vue.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("wall-mode"),
      title: "Les mêmes outils",
      body: "Recherche, tamis, tri, étagère et décor : cette liste se travaille exactement comme la vidéothèque, et garde ses propres réglages.",
      placement: "bottom",
    },
  ],
};

const credits: Tour = {
  label: "Le générique",
  steps: [
    {
      target: at("credits-search"),
      title: "Les noms que vous avez déjà",
      body: "Réalisation, interprétation, image, musique, scénario : ces noms dorment dans vos fiches depuis le premier import. Ici, ils forment un répertoire — et chacun mène à ce que vous avez de cette personne.",
      placement: "bottom",
    },
    {
      target: at("credits-roles"),
      title: "À quel titre",
      body: "Les tamis se cumulent, comme sur le mur. Par défaut le répertoire ne montre que celles et ceux qu'on croise au moins deux fois — les autres sont à un clic, sous « de passage ».",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("credits-dossier"),
      title: "Ce que quelqu'un vaut chez vous",
      body: "Votre note moyenne sur ses films, et votre écart à la note publique : où vous êtes plus tendre, où vous êtes plus sévère que la foule. Puis ses films, ce qui revient chez lui, et depuis quand.",
      placement: "right",
      optional: true,
    },
    {
      target: at("credits-tmdb"),
      title: "Ce qu'il me manque",
      body: "Sa filmographie complète, moins ce que vous avez : de quoi envoyer les absents dans « À voir » d'un clic. Ne paraît qu'avec une clé TMDB posée, depuis l'onglet Import.",
      placement: "top",
      optional: true,
    },
  ],
};

const detail: Tour = {
  label: "Un dossier film",
  steps: [
    {
      target: at("detail-catalog"),
      tab: "film",
      title: "La fiche catalogue",
      body: "Ce que le film est : titre, année, réalisation, genres, et tout ce que TMDB rapporte. Chaque champ se corrige d'un clic — c'est la seule façon de rattraper un import mal identifié. Les names soulignés d'un pointillé ouvrent leur dossier au générique.",
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-watchlog"),
      tab: "mots",
      title: "Le journal des séances",
      body: "Une ligne par visionnage, avec sa date et sa note. C'est lui qui sait qu'un film a été revu quatre fois, et qui nourrit l'almanach.",
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-ailleurs"),
      tab: "film",
      title: "Ce qu'on en dit ailleurs",
      body: "Quand un compte est ouvert, la fiche montre ce que d'autres vidéothèques publiques disent du même film : leur moyenne — sans la vôtre — et leurs critiques. Chacune se signale, et son auteur se fait taire d'un geste — le tiroir du compte liste ceux que vous avez fait taire, et leur rend la parole. Sans serveur ni compte, cette section n'existe pas.",
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-partage"),
      tab: "film",
      title: "La retirer du partage",
      body: "Un film qu'on assume chez soi sans vouloir l'afficher : cette fiche-là quitte votre collection partagée, et elle seule. Elle reste au mur, dans l'almanach et dans la constellation — c'est le dehors qui l'ignore. Ne paraît qu'avec un compte, et seulement si vous montrez votre collection à quelqu'un.",
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-review"),
      tab: "mots",
      title: "Vos mots",
      body: "La critique et les notes libres. Les photogrammes déposés sur la fiche s'y insèrent dans le texte, à l'endroit du curseur.",
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-tags"),
      tab: "mots",
      title: "Mots-keys et motifs",
      body: "Les mots-clés sont les vôtres. Les motifs sont un vocabulaire commun — « le héros meurt », « il pleut à la fin » — sur lequel une question peut porter, et dont on tire un fil.",
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-identite"),
      tab: "film",
      title: "La bonne fiche TMDB",
      body: "L'import retient le premier titre trouvé, et se trompe sur les homonymes — deux « Resurrection » ne sont pas le même film. Ici on cherche le vrai et on relie la fiche : l'équipe, la durée, le pays et les mots-clés sont réécrits, vos mots et vos séances ne bougent pas. Le signe qui trahit l'erreur, c'est un sillage qui vous propose le film que vous regardez déjà.",
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-thread"),
      tab: "liens",
      title: "Le fil rouge",
      body: "Relier deux films, en disant pourquoi : un motif partagé, une filiation, une réponse. Ces liens sont ce que la constellation dessine.",
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-sillage"),
      tab: "liens",
      title: "Dans le sillage",
      body: "Dix propositions par colonne, en trois parts : quatre tenues par les gens qui ont fait les films — même chef opérateur, même compositeur, quelqu'un à l'affiche des deux —, quatre par ce dont ils parlent, motifs et sujets communs, et deux par la foule, « vu par les mêmes gens ». Chacune dit pourquoi elle est là. À gauche votre classeur ; à droite TMDB, qui ne montre que ce que vous n'avez pas : cliquez une proposition pour lire son résumé sans quitter la page, et la mettre de côté d'un bouton.",
      placement: "top",
      /* Optional: a collection of a single film has no wake, and the
         tour must be able to play in full on an empty binder. */
      optional: true,
    },
  ],
};

const reco: Tour = {
  label: "Le bureau des découvertes",
  steps: [
    {
      target: at("reco-maison"),
      title: "Chez vous d'abord",
      body: "Avant d'aller chercher dehors : ce que votre collection contient déjà et que vous avez laissé de côté. Un film que vous aviez adoré, un motif que plus rien ne vous a fait croiser, un cinéaste que vous n'avez plus ouvert. Rien de tout cela ne sort du navigateur, et aucune clé n'est nécessaire.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("reco-dials"),
      title: "Deux molettes",
      body: "« Degré de niche » va du grand public à la pépite. « Dépaysement » va de vos goûts avérés à ce qui en sort. Tout le reste du bulletin n'est qu'un affinage.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("reco-bulletin"),
      title: "Le bulletin de commande",
      body: "Années, langue, note et votes minimum, genres cherchés ou écartés. Les propositions viennent de TMDB, lues à travers ce que votre collection dit déjà de vous.",
      placement: "top",
      optional: true,
    },
  ],
};

const constellation: Tour = {
  label: "La constellation",
  steps: [
    {
      target: at("constellation-start"),
      title: "Par où commencer",
      body: "La carte ne s'ouvre pas sur deux cents astres : vous choisissez un film, elle compose autour de lui, et vous avancez de proche en proche.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("constellation-teams"),
      title: "Suivre les équipes",
      body: "La seconde couche : en pointillé, les personnes partagées par plusieurs films. Cliquez un pointillé pour le fixer — il devient un vrai fil rouge.",
      placement: "bottom",
    },
    {
      target: at("constellation-fils"),
      title: "Les fils",
      body: "Un fil peuple le ciel au lieu de le réduire : il y fait entrer ses membres, reliés ou non. C'est ce qu'on obtient en tirant un fil depuis un motif, sur une fiche.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("constellation-ciel"),
      title: "La carte au clavier",
      body: "La carte se parcourt sans souris : une tabulation y entre, les flèches vont d'un astre au plus proche dans leur direction, Entrée le prend pour foyer — ou ouvre sa fiche quand il l'est déjà — et Échap lâche le curseur.",
      placement: "top",
      optional: true,
    },
  ],
};

const almanac: Tour = {
  label: "L'almanach",
  steps: [
    {
      target: at("almanac-year"),
      title: "Une année, ou toujours",
      body: "L'almanach lit le journal des séances : il ne compte que les vraies séances, à leur date, et non la date d'ajout des fiches. « TOUJOURS », en tête, ouvre le même report sur toute votre pratique — les douze mois y deviennent vos années.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("almanac-plates"),
      title: "Quatre planches",
      body: "Le compte, les goûts, les gens, puis les sujets. Les flèches du clavier feuillettent. La dernière planche dit de quoi vos films parlaient — mots-clés et motifs —, quels chefs opérateurs et compositeurs vous suivez sans le savoir, et sur quels titres exactement vous êtes plus tendre ou plus sévère que la foule.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("almanac-export"),
      title: "L'année en boîte",
      body: "Une image de l'année, à garder ou à montrer. C'est la seule chose d'ici qui sorte du navigateur. Elle est bâtie autour d'un millésime : sur « toujours », le bouton s'efface.",
      placement: "left",
      optional: true,
    },
  ],
};

const notebook: Tour = {
  label: "Le carnet",
  steps: [
    {
      target: at("notebook-new"),
      title: "Une page libre",
      body: "Des pensées qui n'appartiennent à aucun film en particulier. Les pages s'éditent sur place, et se rangent de la plus récente à la plus ancienne.",
      placement: "right",
    },
  ],
};

const importTour: Tour = {
  label: "Import et archives",
  steps: [
    {
      target: at("import-drop"),
      title: "Le bordereau",
      body: "Letterboxd livre un zip : déposez ses CSV un par un. watched.csv d'abord, diary.csv pour les séances. Rien n'est jamais dupliqué — repassez les fichiers autant de fois que vous voulez.",
      placement: "top",
    },
    {
      target: at("import-feed"),
      title: "Ou relever le profil",
      body: "Sans fichier, directement depuis votre profil public : les séances récentes pour tenir la collection à jour, la watchlist entière page après page.",
      placement: "top",
    },
    {
      target: at("import-complete"),
      title: "Compléter les fiches",
      body: "Letterboxd n'exporte ni réalisateur ni affiche : TMDB retrouve les deux. La clé est gratuite, et reste dans ce navigateur.",
      placement: "top",
      optional: true,
    },
    {
      target: at("import-repair"),
      title: "Rattraper une bascule",
      body: "Ne paraît que s'il y a quelque chose à rattraper : les fiches « vues » qui n'ont ni séance, ni note, ni texte, et qui étaient probablement des envies. À cocher une par une — la liste propose, vous décidez.",
      placement: "top",
      optional: true,
    },
    {
      target: at("import-backup"),
      title: "La sauvegarde",
      body: "Tout vit dans ce navigateur, et rien d'autre. Vider les données du site efface la collection : la sauvegarde est le seul filet, emportez-la de temps en temps.",
      placement: "top",
      optional: true,
    },
  ],
};

/* ---------- the global tour ---------- */

/* Takes a few steps of a page tour and attaches them to its view. We
   designate the steps BY THEIR TARGET and not by their rank: inserting a
   step in the middle of a page tour must not silently change what the
   global tour tells. An unknown target throws — it is the coverage test
   that catches it, not the user. */
const from = (view: View, tour: Tour, ...names: string[]): TourStep[] =>
  names.map((nom) => {
    const cible = at(nom);
    const s = tour.steps.find((x) => x.target === cible);
    if (!s) throw new Error(`Visite globale : « ${nom} » n'existe pas dans « ${tour.label} »`);
    return { ...s, view };
  });

const global: Tour = {
  label: "Visite complète",
  steps: [
    {
      target: null,
      title: "Bienvenue dans le classeur",
      body: "Quelques minutes pour faire le tour : les onglets, ce qu'on trouve derrière chacun, et les gestes qui ne se devinent pas. Vous pouvez partir quand vous voulez — on vous dira où reprendre.",
      placement: "center",
      view: "library",
    },
    {
      target: "[data-tab-rail]",
      title: "La tranche du classeur",
      body: "Huit pastilles, toujours là : sur la tranche gauche au bureau, couchées au bas de l'écran sur un téléphone, où le pouce les atteint. Chacune est une façon différente de regarder la même collection ; survolez-en une — ou appuyez longuement — pour lire son nom.",
      placement: "right",
      view: "library",
    },
    ...from("library", library, "wall-search", "wall-mode", "wall-films"),
    ...from("watchlist", watchlist, "wall-films", "soir-ouvrir"),
    /* NOT `credits-dossier` HERE, AND THAT IS A FIX.
       Its anchor only exists once a person is SELECTED, and the global
       tour arrives on a closed directory: the step was therefore
       permanently dead, even on a full collection. It stays in the
       Credits tour, where a folder has been opened. */
    ...from("credits", credits, "credits-search", "credits-roles"),
    /* NOT `reco-dials` EITHER, and for the same reason as
       `credits-dossier` above: the two dials live INSIDE the order
       form, which the view does not mount at all without a TMDB key. On
       a new binder — which never has one — the step opened Discoveries,
       looked for an absent anchor for seven hundred milliseconds of
       opaque veil, then moved on without a word.

       `reco-maison`, for its part, stays: the suggestions drawn from
       your own collection ask for no key, and that is precisely what
       this step tells. The dials keep their place in the Discoveries
       tour, where one arrives with what one has. */
    ...from("reco", reco, "reco-maison"),
    ...from("constellation", constellation, "constellation-start", "constellation-teams"),
    ...from("almanac", almanac, "almanac-year"),
    ...from("notebook", notebook, "notebook-new"),
    ...from("import", importTour, "import-drop", "import-backup"),
    {
      target: at("add-film"),
      title: "Épingler un film",
      body: "À la main, sans passer par l'import : l'épingle ouvre une fiche vierge. Elle est au pied du rail au bureau, au bout de la barre du bas sur un téléphone.",
      placement: "right",
      view: "library",
    },
    {
      target: at("search-all"),
      title: "Chercher partout",
      body: "Une question posée à tout le classeur d'un coup : les films, les gens des génériques, les motifs, les fils et les pages du carnet. Elle cherche jusque dans vos critiques, et vous montre le passage. Ctrl+K l'ouvre aussi.",
      placement: "right",
      view: "library",
    },
    {
      target: at("skin"),
      title: "La peau du site",
      body: "Quatorze habillages : le fond, les couleurs, les polices, les onglets. Vos cartons et le décor de vos étagères, eux, gardent leurs couleurs — ce sont vos choix, pas l'habillage.",
      placement: "right",
      view: "library",
    },
    /* THE BINDER INSTALLS ITSELF — and the card that offers it does not
       always appear: the browser decides on its own that a site is
       installable, and the card vanishes as soon as it has been waved
       away twice or is already laid down. `optional`, then, like
       everything that depends on what is before our eyes. */
    {
      target: at("install"),
      title: "Le poser sur l'écran d'accueil",
      body: "Installé, le classeur s'ouvre en plein écran, sans barre d'adresse, et fonctionne sans réseau — vos films sont chez vous, pas sur un serveur. Sur iPhone, c'est Partager puis « Sur l'écran d'accueil ».",
      placement: "top",
      view: "library",
      optional: true,
    },
    /* THE ACCOUNT — `optional` because the action is only mounted if a
       server is set. With no server there is nothing to show and the
       tour passes over it without saying so. */
    {
      target: at("compte"),
      title: "Retrouver sa collection ailleurs",
      body: "Un compte relie ce classeur à vos autres appareils : ce que vous rangez ici s'y retrouve, et inversement — les films, mais aussi l'agencement de vos étagères et les pages de votre carnet. Sans mot de passe : c'est votre téléphone ou votre ordinateur qui signe.",
      placement: "right",
      view: "library",
      optional: true,
    },
    /* SHARING LIVES IN THE SAME DRAWER AS THE ACCOUNT, and the step says
       so there too: it only exists with an account, and a second anchor
       for a panel the tour cannot open on its own would show the
       void. */
    {
      target: at("compte"),
      title: "Montrer sa vidéothèque",
      body: "Dans ce même tiroir : personne, par lien secret, ou tout le monde. Le lien ne se devine pas et se coupe quand vous voulez. Un visiteur voit vos films, vos notes chiffrées et vos critiques — jamais votre carnet ni votre journal de séances. Et une fiche s'écarte à part, depuis son dossier, sous la fiche catalogue.",
      placement: "right",
      view: "library",
      optional: true,
    },
    /* THE REMINDERS live in the same drawer as the account and sharing,
       and the step says so there too. `optional`: with no server, with
       no keys laid on it, or in a browser that cannot receive a
       notification, the action is not even mounted. */
    {
      target: at("compte"),
      title: "Se faire rappeler ses défis",
      body: "Toujours dans ce tiroir : la seule chose qui vous sonnera jamais est un défi qui commence ou s'achève. Rien d'autre — ni les films des autres, ni un rappel de revenir. Le réglage vaut pour cet appareil seulement.",
      placement: "right",
      view: "library",
      optional: true,
    },
    /* THE CHALLENGES, last before the goodbye: it is the only thing in
       this binder done with other people, and it presupposes all the
       rest. `optional` like the account — with no server the view shows
       only a sentence, and there is no landmark to point at. */
    {
      target: at("lists-challenges"),
      needsServer: true,
      title: "Se lancer quelque chose",
      body: "Une liste plus une période fait un défi. Personne ne coche « vu » : l'avancement se calcule depuis votre journal de séances, et le serveur n'en tire qu'un nombre — vos dates ne sortent pas d'ici.",
      placement: "top",
      view: "lists",
      optional: true,
    },
    {
      target: at("tmdb-key"),
      title: "La clé TMDB",
      body: "Elle est facultative : le classeur marche entièrement sans elle. Posée, elle ouvre les Découvertes, les affiches, les relevés d'équipe et le sillage d'un film — et elle reste sur votre machine. Un compte en dispense entièrement : le serveur garde alors la sienne, et vous n'avez rien à demander à personne. Partout où il en manque une, l'écran vous le dit et vous ramène ici.",
      placement: "right",
      view: "library",
    },
    {
      target: at("help"),
      title: "Rejouer la visite",
      body: "Ce bouton la rouvre quand vous voulez, en entier ou seulement pour la page où vous êtes. Bonne collection.",
      placement: "right",
      view: "library",
    },
  ],
};

/* THE FEED — the only view that does not speak of your collection. Its
   steps are `optional`: with no server, no account, or nobody followed,
   half these landmarks do not exist, and a tour that points at the void
   is worse than a shorter tour. */
const thread: Tour = {
  label: "Le fil",
  steps: [
    {
      target: at("thread-search"),
      title: "Trouver quelqu'un",
      body: "On cherche par pseudonyme, et on ne trouve que les gens qui ont choisi de montrer leur collection. Il n'y a pas d'annuaire : ce classeur n'est pas un reseau social, et personne n'y figure sans l'avoir voulu.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("thread-follows"),
      title: "Ceux que vous suivez",
      body: "Suivre est un geste qu'on fait seul et qu'on defait seul : personne n'accepte, personne n'est prevenu. Si quelqu'un referme sa collection, il reste dans la liste — son fil se tait, et reparlera s'il rouvre.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("thread-news"),
      title: "Ce qu'ils regardent",
      body: "Les films recemment touches chez les gens que vous suivez, avec leur note et leur critique. Jamais leurs notes personnelles ni leur journal de seances — pas plus que les votres ne sortent d'ici.",
      placement: "top",
      optional: true,
    },
  ],
};

/* THE LISTS AND THE CHALLENGES. The same precautions as the feed: with
   no server or account, none of this exists, and a tour that points at
   the void is worse than a shorter tour. */
const lists: Tour = {
  label: "Listes et defis",
  steps: [
    {
      target: at("lists-new"),
      title: "Ouvrir une liste",
      body: "Une liste contient des oeuvres et non vos fiches : elle veut donc dire la meme chose chez quelqu'un d'autre, et ne se vide pas le jour ou vous effacez un film. On y range depuis la fiche du film, sous le catalogue.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("lists-mine"),
      title: "Les votres, et celles a plusieurs",
      body: "Chaque liste s'ouvre d'un clic. Vous pouvez y inviter quelqu'un a ecrire : il ajoute et retire des films, il ne renomme pas la liste et ne l'efface pas. Fermee par defaut — la rendre visible est une case a cocher.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("lists-challenges"),
      title: "Un defi est une liste plus une periode",
      body: "Personne ne coche « vu » : l'avancement se calcule depuis votre journal de seances, et seules les seances datees dans la periode comptent. Le serveur en tire un nombre, jamais vos dates — et seulement pour ceux qui ont demande a participer.",
      placement: "top",
      optional: true,
    },
  ],
};

/* ---------- the registry ---------- */

/* WHAT DOES NOT EXIST IS NOT VISITED. With no server — the published
   site's case — the feed and the challenges have no tab; their steps
   therefore have nothing to show, and the tour must describe the product
   as it is for whoever is playing it. */
const prune = (t: Tour): Tour =>
  serverConfigured() ? t : { ...t, steps: t.steps.filter((s) => !s.needsServer) };

export const TOURS: Record<string, Tour> = Object.fromEntries(
  Object.entries({
    global,
    library,
    watchlist,
    credits,
    detail,
    reco,
    constellation,
    almanac,
    notebook,
    import: importTour,
    thread,
    lists,
  }).map(([key, t]) => [key, prune(t)])
);

/** A view's tour, if there is one. `detail` has one, `skinlab` does not. */
export const tourForView = (view: string): Tour | undefined =>
  view === "global" ? undefined : TOURS[view];
