/* ============================================================
   LA VISITE — ce que le classeur raconte de lui-même

   ┌──────────────────────────────────────────────────────────┐
   │ CE FICHIER SUIT LE PRODUIT.                              │
   │ Toute fonctionnalité ajoutée, modifiée, renommée ou      │
   │ retirée se répercute ICI dans le même changement, et sur │
   │ l'attribut `data-tour` de la cible. Une visite qui       │
   │ décrit l'ancien produit est un mensonge de plus.         │
   └──────────────────────────────────────────────────────────┘

   Une visite par vue, plus une visite « global » qui les traverse en
   n'en gardant que l'essentiel. La visite globale ne réécrit pas les
   textes : elle PIOCHE dans les visites de page, faute de quoi les deux
   divergeraient au premier changement.
   ============================================================ */
import type { View } from "../layout/FolderTabs";

export interface TourStep {
  /** Sélecteur CSS de ce qu'on montre. `null` : bulle au centre. */
  target: string | null;
  title: string;
  body: string;
  /** Vue à ouvrir avant l'étape — c'est ce qui fait voyager la visite. */
  view?: View;
  placement?: "right" | "bottom" | "left" | "top" | "center";
  /**
   * Cible absente ⇒ étape sautée sans bruit. Vrai de tout ce qui dépend
   * du contenu : une collection vide n'a ni affiche, ni rangée, ni fiche.
   */
  optional?: boolean;
}

export interface Tour {
  label: string;
  steps: TourStep[];
}

/** Raccourci de lecture : `[data-tour="…"]`. */
const at = (name: string) => `[data-tour="${name}"]`;

/* ---------- les visites de page ---------- */

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
    /* LE GESTE QUI NE SE DEVINE PAS, et qui n'existait pas avant que
       l'application se tienne dans une main. Au doigt, un balayage fait
       défiler : la saisie doit donc s'annoncer autrement, et c'est
       l'appui maintenu qui s'en charge. Personne ne le trouve tout seul.

       `optional` comme les autres étapes qui visent du contenu : un
       classeur vide n'a pas d'affiche à montrer, et doit pouvoir jouer
       la visite en entier. */
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

const generique: Tour = {
  label: "Le générique",
  steps: [
    {
      target: at("generique-search"),
      title: "Les noms que vous avez déjà",
      body: "Réalisation, interprétation, image, musique, scénario : ces noms dorment dans vos fiches depuis le premier import. Ici, ils forment un répertoire — et chacun mène à ce que vous avez de cette personne.",
      placement: "bottom",
    },
    {
      target: at("generique-roles"),
      title: "À quel titre",
      body: "Les tamis se cumulent, comme sur le mur. Par défaut le répertoire ne montre que celles et ceux qu'on croise au moins deux fois — les autres sont à un clic, sous « de passage ».",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("generique-dossier"),
      title: "Ce que quelqu'un vaut chez vous",
      body: "Votre note moyenne sur ses films, et votre écart à la note publique : où vous êtes plus tendre, où vous êtes plus sévère que la foule. Puis ses films, ce qui revient chez lui, et depuis quand.",
      placement: "right",
      optional: true,
    },
    {
      target: at("generique-tmdb"),
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
      title: "La fiche catalogue",
      body: "Ce que le film est : titre, année, réalisation, genres, et tout ce que TMDB rapporte. Chaque champ se corrige d'un clic — c'est la seule façon de rattraper un import mal identifié. Les noms soulignés d'un pointillé ouvrent leur dossier au générique.",
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-watchlog"),
      title: "Le journal des séances",
      body: "Une ligne par visionnage, avec sa date et sa note. C'est lui qui sait qu'un film a été revu quatre fois, et qui nourrit l'almanach.",
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-ailleurs"),
      title: "Ce qu'on en dit ailleurs",
      body: "Quand un compte est ouvert, la fiche montre ce que d'autres vidéothèques publiques disent du même film : leur moyenne — sans la vôtre — et leurs critiques. Chacune se signale, et son auteur se fait taire d'un geste. Sans serveur ni compte, cette section n'existe pas.",
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-review"),
      title: "Vos mots",
      body: "La critique et les notes libres. Les photogrammes déposés sur la fiche s'y insèrent dans le texte, à l'endroit du curseur.",
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-tags"),
      title: "Mots-clés et motifs",
      body: "Les mots-clés sont les vôtres. Les motifs sont un vocabulaire commun — « le héros meurt », « il pleut à la fin » — sur lequel une question peut porter, et dont on tire un fil.",
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-identite"),
      title: "La bonne fiche TMDB",
      body: "L'import retient le premier titre trouvé, et se trompe sur les homonymes — deux « Resurrection » ne sont pas le même film. Ici on cherche le vrai et on relie la fiche : l'équipe, la durée, le pays et les mots-clés sont réécrits, vos mots et vos séances ne bougent pas. Le signe qui trahit l'erreur, c'est un sillage qui vous propose le film que vous regardez déjà.",
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-thread"),
      title: "Le fil rouge",
      body: "Relier deux films, en disant pourquoi : un motif partagé, une filiation, une réponse. Ces liens sont ce que la constellation dessine.",
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-sillage"),
      title: "Dans le sillage",
      body: "Dix propositions par colonne, en trois parts : quatre tenues par les gens qui ont fait les films — même chef opérateur, même compositeur, quelqu'un à l'affiche des deux —, quatre par ce dont ils parlent, motifs et sujets communs, et deux par la foule, « vu par les mêmes gens ». Chacune dit pourquoi elle est là. À gauche votre classeur ; à droite TMDB, qui ne montre que ce que vous n'avez pas : cliquez une proposition pour lire son résumé sans quitter la page, et la mettre de côté d'un bouton.",
      placement: "top",
      /* Optionnelle : une collection d'un seul film n'a pas de sillage,
         et la visite doit pouvoir se jouer en entier sur un classeur
         vide. */
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
      body: "L'almanach lit le journal des séances : il ne compte que les vraies séances, à leur date, et non la date d'ajout des fiches. « TOUJOURS », en tête, ouvre le même bilan sur toute votre pratique — les douze mois y deviennent vos années.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("almanac-plates"),
      title: "Trois planches",
      body: "Le compte, les goûts, les gens. Les flèches du clavier feuillettent. Sous vos notes se lit votre écart à la note publique — où vous êtes plus tendre, où vous êtes plus sévère que la foule.",
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

/* ---------- la visite globale ---------- */

/* Prend quelques étapes d'une visite de page et les rattache à sa vue.
   On désigne les étapes PAR LEUR CIBLE et non par leur rang : insérer
   une étape au milieu d'une visite de page ne doit pas changer en
   silence ce que la visite globale raconte. Une cible inconnue lève —
   c'est le test de couverture qui l'attrape, pas l'utilisateur. */
const from = (view: View, tour: Tour, ...noms: string[]): TourStep[] =>
  noms.map((nom) => {
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
    ...from("generique", generique, "generique-search", "generique-dossier"),
    ...from("reco", reco, "reco-maison", "reco-dials"),
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
    /* LE CLASSEUR S'INSTALLE — et la fiche qui le propose ne paraît pas
       toujours : le navigateur décide seul qu'un site est installable,
       et elle disparaît dès qu'on l'a écartée deux fois ou qu'elle est
       déjà posée. `optional`, donc, comme tout ce qui dépend de ce
       qu'on a sous les yeux. */
    {
      target: at("installer"),
      title: "Le poser sur l'écran d'accueil",
      body: "Installé, le classeur s'ouvre en plein écran, sans barre d'adresse, et fonctionne sans réseau — vos films sont chez vous, pas sur un serveur. Sur iPhone, c'est Partager puis « Sur l'écran d'accueil ».",
      placement: "top",
      view: "library",
      optional: true,
    },
    /* LE COMPTE — `optional` parce que l'action n'est montée que si un
       serveur est réglé. Sans serveur, il n'y a rien à montrer et la
       visite passe outre sans le dire. */
    {
      target: at("compte"),
      title: "Retrouver sa collection ailleurs",
      body: "Un compte relie ce classeur à vos autres appareils : ce que vous rangez ici s'y retrouve, et inversement — les films, mais aussi l'agencement de vos étagères et les pages de votre carnet. Sans mot de passe : c'est votre téléphone ou votre ordinateur qui signe.",
      placement: "right",
      view: "library",
      optional: true,
    },
    /* LE PARTAGE VIT DANS LE MÊME TIROIR QUE LE COMPTE, et l'étape le
       dit là aussi : il n'existe qu'avec un compte, et une seconde
       ancre pour un panneau que la visite ne peut pas ouvrir seule
       montrerait le vide. */
    {
      target: at("compte"),
      title: "Montrer sa vidéothèque",
      body: "Dans ce même tiroir : personne, par lien secret, ou tout le monde. Le lien ne se devine pas et se coupe quand vous voulez. Un visiteur voit vos films, vos notes chiffrées et vos critiques — jamais votre carnet ni votre journal de séances, et vous pouvez écarter une fiche à part.",
      placement: "right",
      view: "library",
      optional: true,
    },
    /* LES RAPPELS vivent dans le même tiroir que le compte et le
       partage, et l'étape le dit là aussi. `optional` : sans serveur,
       sans clés posées dessus, ou dans un navigateur qui ne sait pas
       recevoir de notification, l'action n'est même pas montée. */
    {
      target: at("compte"),
      title: "Se faire rappeler ses défis",
      body: "Toujours dans ce tiroir : la seule chose qui vous sonnera jamais est un défi qui commence ou s'achève. Rien d'autre — ni les films des autres, ni un rappel de revenir. Le réglage vaut pour cet appareil seulement.",
      placement: "right",
      view: "library",
      optional: true,
    },
    /* LES DÉFIS, en dernier avant l'au revoir : c'est la seule chose de
       ce classeur qui se fasse à plusieurs, et elle suppose tout le
       reste. `optional` comme le compte — sans serveur, la vue
       n'affiche qu'une phrase, et il n'y a pas de repère à montrer. */
    {
      target: at("listes-defis"),
      title: "Se lancer quelque chose",
      body: "Une liste plus une période fait un défi. Personne ne coche « vu » : l'avancement se calcule depuis votre journal de séances, et le serveur n'en tire qu'un nombre — vos dates ne sortent pas d'ici.",
      placement: "top",
      view: "listes",
      optional: true,
    },
    {
      target: at("tmdb-key"),
      title: "La clé TMDB",
      body: "Elle est facultative : le classeur marche entièrement sans elle. Posée, elle ouvre les Découvertes, les affiches, les relevés d'équipe et le sillage d'un film. Elle reste sur votre machine. Partout où elle manque, l'écran vous le dit et vous ramène ici.",
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

/* LE FIL — la seule vue qui ne parle pas de votre collection. Ses
   etapes sont `optional` : sans serveur, sans compte, ou sans personne
   suivie, la moitie de ces reperes n'existe pas, et une visite qui
   pointe le vide est pire qu'une visite plus courte. */
const fil: Tour = {
  label: "Le fil",
  steps: [
    {
      target: at("fil-chercher"),
      title: "Trouver quelqu'un",
      body: "On cherche par pseudonyme, et on ne trouve que les gens qui ont choisi de montrer leur collection. Il n'y a pas d'annuaire : ce classeur n'est pas un reseau social, et personne n'y figure sans l'avoir voulu.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("fil-abonnements"),
      title: "Ceux que vous suivez",
      body: "Suivre est un geste qu'on fait seul et qu'on defait seul : personne n'accepte, personne n'est prevenu. Si quelqu'un referme sa collection, il reste dans la liste — son fil se tait, et reparlera s'il rouvre.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("fil-nouvelles"),
      title: "Ce qu'ils regardent",
      body: "Les films recemment touches chez les gens que vous suivez, avec leur note et leur critique. Jamais leurs notes personnelles ni leur journal de seances — pas plus que les votres ne sortent d'ici.",
      placement: "top",
      optional: true,
    },
  ],
};

/* LES LISTES ET LES DEFIS. Memes precautions que le fil : sans serveur
   ni compte, rien de tout cela n'existe, et une visite qui pointe le
   vide est pire qu'une visite plus courte. */
const listes: Tour = {
  label: "Listes et defis",
  steps: [
    {
      target: at("listes-nouvelle"),
      title: "Ouvrir une liste",
      body: "Une liste contient des oeuvres et non vos fiches : elle veut donc dire la meme chose chez quelqu'un d'autre, et ne se vide pas le jour ou vous effacez un film. On y range depuis la fiche du film, sous le catalogue.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("listes-mes-listes"),
      title: "Les votres, et celles a plusieurs",
      body: "Chaque liste s'ouvre d'un clic. Vous pouvez y inviter quelqu'un a ecrire : il ajoute et retire des films, il ne renomme pas la liste et ne l'efface pas. Fermee par defaut — la rendre visible est une case a cocher.",
      placement: "bottom",
      optional: true,
    },
    {
      target: at("listes-defis"),
      title: "Un defi est une liste plus une periode",
      body: "Personne ne coche « vu » : l'avancement se calcule depuis votre journal de seances, et seules les seances datees dans la periode comptent. Le serveur en tire un nombre, jamais vos dates — et seulement pour ceux qui ont demande a participer.",
      placement: "top",
      optional: true,
    },
  ],
};

/* ---------- le registre ---------- */

export const TOURS: Record<string, Tour> = {
  global,
  library,
  watchlist,
  generique,
  detail,
  reco,
  constellation,
  almanac,
  notebook,
  import: importTour,
  fil,
  listes,
};

/** La visite d'une vue, s'il y en a une. `detail` en a une, `skinlab` non. */
export const tourForView = (view: string): Tour | undefined =>
  view === "global" ? undefined : TOURS[view];
