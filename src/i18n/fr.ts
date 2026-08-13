/* ============================================================
   LE CATALOGUE FRANÇAIS — la langue d'origine du produit
   ============================================================

   C'est ici que vivent les phrases de l'écran, et nulle part ailleurs.
   Une chaîne écrite en dur dans une vue est une chaîne qui ne se traduit
   pas : le test de parité (`src/i18n/catalogue.test.ts`) surveille les
   clés, pas les oublis d'extraction — celui-là ne se voit qu'à l'œil.

   L'ORDRE SUIT LE PRODUIT, pas l'alphabet : `common` d'abord, puis une
   section par onglet, puis les catalogues de données (motifs, peaux,
   décors) et la visite guidée. On retrouve une phrase en pensant à
   l'endroit où on l'a vue.
   ============================================================ */

const fr = {
  /* The words the whole product reuses. A "Fermer" written in fifteen
     files is fifteen chances of translating fourteen of them. */
  common: {
    close: "Fermer",
    cancel: "Annuler",
    save: "Enregistrer",
    delete: "Supprimer",
    copy: "COPIER",
    copied: "COPIÉ",
    loading: "chargement…",
    none: "aucun",
  },

  account: {
    title: "Votre compte",
    signedInNote: "Votre collection se retrouve sur vos autres appareils.",
    signedOutNote:
      "Un compte sert à retrouver votre collection ailleurs. Le classeur marche très bien sans.",
    sync: "Synchronisation",
    syncNow: "Synchroniser maintenant",
    never: "jamais encore",
    justNow: "à l'instant",
    minutesAgo: "il y a {{count}} minutes",
    hoursAgo_one: "il y a {{count}} heure",
    hoursAgo_other: "il y a {{count}} heures",
    noServer: "Aucun serveur réglé.",
    noServerShort: "aucun serveur",
    allStaysHere: "Tout reste ici.",
    running: "En cours…",
    upToDate: "À jour, {{when}}.",
    unreachable: "Serveur injoignable. Rien à envoyer, rien de perdu.",
    pending_one: "{{count}} fiche attend le réseau.",
    pending_other: "{{count}} fiches attendent le réseau.",
    refused: "Le serveur a refusé.",
    cancelled: "Geste annulé.",
    failed: "Ça n'a pas marché.",
    handle: "Pseudonyme",
    passkeyNote:
      "Pas de mot de passe : votre téléphone ou votre ordinateur signe à votre place, avec ce qui le déverrouille déjà.",
    signUp: "CRÉER UN COMPTE",
    signIn: "J'EN AI DÉJÀ UN",
    signOut: "SE DÉCONNECTER",
    yourData: "Vos données",
    takeEverything: "TOUT EMPORTER",
    exportFailed: "L'export a échoué.",
    deleteTitle: "Effacer votre compte ?",
    deleteBody:
      "La copie de votre collection sur le serveur est effacée, avec vos clés d'accès et vos sessions. Votre classeur, lui, reste entier sur cet appareil — mais vos autres appareils ne se synchroniseront plus.",
    deleteAction: "EFFACER LE COMPTE",
    deleteMine: "EFFACER MON COMPTE",
    deleteFailed: "L'effacement a échoué.",
    footer:
      "Votre collection entière est copiée sur votre compte, notes et séances comprises. Rien n'est public : le partage se décide fiche par fiche, et n'emportera jamais vos notes.",
    silenced: "Ceux que vous avez fait taire",
    unblock: "RENDRE LA PAROLE",
    unblockOne: "Rendre la parole à {{pseudo}}",
    unblockNote:
      "Leurs critiques reparaîtront sous les fiches. Vous ne les suivrez pas pour autant — le blocage avait défait le lien, et le défaire ne le renoue pas.",
    reminders: "Les rappels",
    notificationsDenied:
      "Ce navigateur a refusé les notifications. Cela se rouvre dans ses réglages de site, pas ici.",
    remindStart: "ME RAPPELER MES DÉFIS",
    remindStop: "NE PLUS ME RAPPELER",
    remindNote:
      "Un défi qui commence, un défi qui s'achève — rien d'autre ne vous sonnera. Le réglage vaut pour cet appareil seulement.",
    showCollection: "Montrer ma collection",
    shareNobody: "PERSONNE",
    shareLink: "PAR LIEN",
    shareEveryone: "TOUT LE MONDE",
    shareDefaultNote: "Par défaut, personne ne voit votre collection.",
    shareNobodyNote: "Personne. Les liens déjà donnés ne valent plus rien.",
    shareLinkNote: "Qui a le lien. Il ne se devine pas, et se coupe quand vous voulez.",
    shareEveryoneNote: "Qui connaît votre pseudonyme.",
    shareNeverNote: "Vos notes et votre journal de séances ne sont jamais montrés.",
  },

  tmdbKey: {
    title: "Clé TMDB",
    kicker: "CLÉ TMDB",
    note: "elle ouvre les Découvertes, les affiches, les fiches d'équipe et le sillage — elle reste sur votre machine, elle ne part nulle part",
    field: "VOTRE CLÉ (API KEY V3)",
    placeholder: "collez-la ici",
    trying: "on essaie…",
    tryAndSave: "Essayer et enregistrer",
    works: "elle marche",
    unknown: "TMDB ne reconnaît pas cette clé.",
    failedWith: "Échec : {{error}}. Clé erronée, ou TMDB injoignable.",
    offline: "Impossible de joindre TMDB — êtes-vous en ligne ?",
    whereFrom:
      "une clé est gratuite : compte TMDB → Paramètres → API. Sans elle, le classeur marche entièrement — seuls l'enrichissement et les propositions venues du dehors se taisent.",
    remove: "retirer la clé de cette machine",
    missing: "Aucune clé TMDB — à régler au pied du rail d'onglets.",
  },

  search: {
    films: "Films",
    people: "Au générique",
    motifs: "Motifs",
    threads: "Fils",
    pages: "Carnet",
    placeholder: "un titre, un nom, un motif, un mot que vous avez écrit…",
    fieldLabel: "Chercher dans tout le classeur",
    escape: "ÉCHAP",
    prompt:
      "Deux lettres suffisent. La question est posée aux films, aux gens des génériques, aux motifs, aux fils et aux pages du carnet — d'un coup.",
    nothing: "Rien de ce nom dans le classeur.",
    untitled: "Sans titre",
    filmCount_one: "{{count}} film",
    filmCount_other: "{{count}} films",
    carriedBy_one: "{{count}} fiche le porte",
    carriedBy_other: "{{count}} fiches le portent",
    onNoCard: "sur aucune fiche",
  },

  /* The capacities somebody appears in. The KEYS are the French words
     because that is what a card carries on disk — they are identifiers,
     like the motif ids, and renaming them would be a migration. */
  roles: {
    réalisation: "réalisation",
    interprétation: "interprétation",
    image: "image",
    musique: "musique",
    scénario: "scénario",
    thème: "thème",
  },

  wake: {
    namedLink: "{{link}} — {{value}}",
    andMore: "{{start}}, + {{more}}",
    link: {
      cinematography: "même chef op",
      music: "même compositeur",
      directing: "même réalisation",
      writing: "même scénario",
      motif: "motif partagé",
      theme: "thème partagé",
      keyword: "sujet commun",
      actor: "à l'affiche des deux",
      crowd: "vu par les mêmes gens",
    },
    more: {
      motif_one: "{{count}} motif",
      motif_other: "{{count}} motifs",
      keyword_one: "{{count}} sujet commun",
      keyword_other: "{{count}} sujets communs",
      theme_one: "{{count}} thème",
      theme_other: "{{count}} thèmes",
      actor_one: "{{count}} nom à l'affiche",
      actor_other: "{{count}} noms à l'affiche",
      other_one: "{{count}} autre",
      other_other: "{{count}} autres",
    },
    afar: {
      named: "{{link}} {{value}}",
      two: "{{first}} · {{second}}",
      andCount: "{{two}}, + {{count}}",
      cinematography: "du même chef op",
      music: "du même compositeur",
      directing: "de la même réalisation",
      writing: "du même scénario",
      actor: "avec",
      motif: "même motif",
      theme: "même thème",
      keyword: "même sujet",
      crowd: "vu par les mêmes gens",
    },
  },

  /* THE DISCOVERIES DRAWN FROM YOUR OWN COLLECTION. `domain/athome`
     emits these keys and nothing else — it is pure, and does not know
     which language is in force. */
  import: {
    oneFileAtATime: "un fichier à la fois, dans l'ordre indiqué ci-dessous",
    whichFiles: "QUELS FICHIERS DÉPOSER",
    zipNote: "Letterboxd vous livre un zip : dézippez-le, puis déposez ces fichiers un par un.",
    file: {
      watched: "tous les films vus — la base de la collection",
      ratings: "vos notes ; complète les fiches déjà créées",
      diary: "chaque séance, une par une : c'est lui qui compte les visionnages",
      watchlist: "vos envies ; atterrit dans l'onglet « À voir »",
    },
    orderNote:
      "L'ordre compte peu, mais watched.csv d'abord évite d'oublier les films vus sans note. diary.csv est le seul à porter une ligne par séance : c'est de lui que viennent le nombre de visionnages et l'évolution de vos notes. Rien n'est jamais dupliqué — repassez les fichiers autant de fois que vous voulez.",
    orReadProfile: "OU RELEVER VOTRE PROFIL",
    profileNote:
      "Sans fichier, directement depuis votre profil public. « Séances » ne rend que vos cinquante dernières : de quoi tenir la collection à jour, pas de quoi la bâtir. « Watchlist » la relève entière, page après page.",
    letterboxdHandle: "Pseudo Letterboxd",
    handlePlaceholder: "votre-pseudo",
    viewings: "SÉANCES",
    watchlist: "WATCHLIST",
    page: "PAGE {{done}}/{{total}}",
    relayNote:
      "Letterboxd interdit la lecture de son flux depuis un autre site : un intermédiaire va le chercher à votre place. Celui par défaut est un service public — il peut ralentir ou disparaître. {url} est remplacé par l'adresse du flux. En local, ce réglage ne sert pas : le serveur de développement relaie lui-même.",
    noUsableRow: "Aucune ligne exploitable trouvée dans ce fichier.",
    feedEmpty: "Ce flux ne contient aucune séance.",
    keyValid: "clé valide",
    keyRefused: "clé refusée",
    linesRead: "lignes lues",
    distinctFilms: "films distincts",
    withRating: "avec une note",
    withoutRating: "sans note",
    rewatchesGrouped: "revoyures regroupées",
    linesWithoutTitle: "lignes sans titre, ignorées",
    unreadableCsv: "Impossible de lire ce fichier CSV.",
    emptyWatchlist: "Cette watchlist est vide.",
    tmdbApiKey: "Clé API TMDB",
    pasteKeyHere: "collez votre clé ici",
    tmdbNote:
      "Letterboxd n'exporte ni le réalisateur ni les affiches. TMDB retrouve les deux (clé gratuite sur themoviedb.org).",
    replaceLogNote:
      "D'ordinaire les journaux se complètent, et rien ne se perd. Coché, le journal des films cités est remplacé par celui-ci : c'est ce qu'il faut pour effacer une séance en trop, et c'est aussi ce qui efface les séances ajoutées à la main.",
    directorsFound: "réalisateurs trouvés",
    filmsNotIdentified: "films non identifiés",
    finished: "IMPORT TERMINÉ",
    created: "fiches créées",
    updated: "fiches mises à jour",
    unchanged: "déjà à jour, inchangées",
  },

  /* The relay's and the feed's failures. The service throws a CODE — see
     `LetterboxdError` — and never a sentence. */
  letterboxd: {
    noHandle: "Indiquez d'abord votre pseudo Letterboxd.",
    relaySilent: "Le relais n'a pas répondu. Il est peut-être hors service — voyez « relais ».",
    notAFeed:
      "La réponse n'est pas un flux Letterboxd. Vérifiez le pseudo, ou le relais si vous en avez réglé un.",
    notAWatchlist:
      "Cette page n'a pas la forme d'une watchlist Letterboxd. Vérifiez le pseudo, que le profil est public, ou le relais si vous en avez réglé un.",
    feedStatus: "Le flux a répondu {{status}}. Le pseudo est-il le bon ?",
    watchlistStatus:
      "La watchlist a répondu {{status}}. Le pseudo est-il le bon, et le profil public ?",
  },

  complete: {
    title: "COMPLÉTER LES FICHES DEPUIS TMDB",
    toComplete: "fiches à compléter",
    alreadyUpToDate: "fiches déjà à jour",
    noKeywords: "fiches sans mots-clés TMDB",
    allFull: "Tout est déjà rempli — rien à demander à TMDB.",
    intro:
      "Va chercher le casting, l'équipe, la durée, le pays, la langue et les mots-clés des fiches qui n'en ont pas. Les mots-clés sont ce qui permet au sillage d'un film de rapprocher deux fiches autrement que par les noms de leur équipe. Rien n'est écrit avant que vous ayez vu le détail.",
    asking: "{{done}} / {{total}} interrogés…",
    running: "EN COURS…",
    completeN: "COMPLÉTER {{count}} FICHE(S)",
    reaskHint: "Redemande les mots-clés, y compris pour les fiches qui avaient répondu vide",
    reaskKeywords: "REDEMANDER LES MOTS-CLÉS ({{count}})",
    writeChanges: "ÉCRIRE LES {{count}} MODIFICATIONS",
    needsKey:
      "Il faut de quoi interroger TMDB : une clé, plus haut — ou un compte, qui vous en dispense.",
    noAnswer: "TMDB n'a pas répondu.",
    done_one: "{{count}} fiche complétée.",
    done_other: "{{count}} fiches complétées.",
  },

  repair: {
    title: "RETROUVER DES FICHES BASCULÉES PAR ERREUR",
    ticked: "cochées",
    intro:
      "Une version antérieure de « compléter les fiches » faisait passer en « vu » les fiches qu'elle enrichissait. Ces fiches-là n'ont ni séance, ni date, ni note, ni texte : personne ne les a jamais ouvertes, elles étaient probablement des envies. Probablement seulement — relisez la liste, un film vu et jamais commenté lui ressemble",
    tickAll: "TOUT COCHER",
    untickAll: "TOUT DÉCOCHER",
    putBackN: "REMETTRE {{count}} FICHE(S) EN « À VOIR »",
    confirmTitle: "Remettre {{count}} fiche(s) en « à voir » ?",
    confirmBody:
      "Elles quittent la vidéothèque pour l'onglet À voir. Rien n'est effacé : notes, motifs et fils restent attachés, et une fiche remise se rebascule d'un clic depuis son dossier.",
    confirmAction: "REMETTRE EN « À VOIR »",
    done_one: "{{count}} fiche remise dans « À voir ».",
    done_other: "{{count}} fiches remises dans « À voir ».",
  },

  backup: {
    title: "COFFRE À AFFICHES ET SAUVEGARDE",
    postersStored: "affiches rangées dans la base",
    spaceUsed: "place occupée",
    note: "Tout est stocké sur cette machine, captures en qualité d'origine. Exportez de temps en temps : vider les données du navigateur effacerait la collection.",
    preparing: "préparation…",
    downloaded_one: "sauvegarde de {{count}} fiche téléchargée.",
    downloaded_other: "sauvegarde de {{count}} fiches téléchargée.",
  },

  film: {
    year: "Année",
    director: "Réalisateur·rice",
    themes: "Thèmes (virgules)",
    themesPlaceholder: "Mémoire, Solitude",
    firstImpression: "Première impression",
    pinToWall: "ÉPINGLER CETTE FICHE AU MUR",
  },

  facts: {
    title: "RELEVÉ TMDB",
    refresh: "rafraîchir",
    refreshHint: "redemander cette fiche à TMDB",
    unknownTitle: "TMDB ne connaît pas ce titre.",
    filledIn_one: "{{count}} champ complété.",
    filledIn_other: "{{count}} champs complétés.",
    nothingMore: "TMDB ne donne rien de plus que ce qui est déjà là.",
    runtime: "DURÉE",
    country: "PAYS",
    language: "LANGUE",
    tmdbRating: "NOTE TMDB",
    cast: "CASTING",
    keywords: "MOTS-CLÉS",
    tmdbId: "ID TMDB",
  },

  link: {
    noFilmByThatTitle: "TMDB ne connaît aucun film de ce titre.",
    fetching: "récupération de la fiche…",
    linkedTo: "relié à « {{title}} »{{year}}.",
    noIdentifier: "aucun identifiant — la fiche n'est reliée à rien",
    searchPlaceholder: "titre à chercher",
    replacesNote:
      "choisir remplace l'équipe, la durée, le pays, la note et les mots-clés — vos mots, vos notes et vos séances ne bougent pas",
  },

  identity: {
    found: "trouvé : {{title}}{{year}}",
  },

  poster: {
    noneFound: "Aucune affiche trouvée pour ce film.",
    couldNotSave: "Cette image n'a pas pu être enregistrée.",
    pasteHint: "clic droit sur une affiche → « copier l'adresse de l'image », puis Entrée",
  },

  watchlog: {
    removeOne: "Retirer cette séance",
    removeOneOn: "Retirer la séance du {{date}}",
  },

  lists: {
    filed: "rangé",
    alreadyThere: "y était déjà",
  },

  elsewhere: {
    filedBy_one: "{{count}} vidéothèque le range",
    filedBy_other: "{{count}} vidéothèques le rangent",
    reportPrompt: "Qu'est-ce qui ne va pas dans ce qu'a écrit {{pseudo}} ?",
    reported: "signalé — nous le lirons",
  },

  sharing: {
    hide: "ÉCARTER DU PARTAGE",
    hidden: "ÉCARTÉE DU PARTAGE",
    shownNote:
      "Elle paraît dans votre collection partagée, avec sa note et votre critique. Vos notes libres et votre journal de séances ne sortent jamais.",
  },

  credits: {
    stamp: "GÉNÉRIQUE",
    intro:
      "Les noms que votre collection porte déjà — celles et ceux qui ont réalisé, joué, éclairé, composé, écrit. {{count}} en tout.",
    gone: "Cette personne n'apparaît plus dans aucune fiche.",
    namePlaceholder: "un nom…",
    regularsOnly: "les habitués seulement",
    passingThrough: "+ {{count}} de passage",
    noNames:
      "Aucun nom pour l'instant. Complétez vos fiches par TMDB, depuis l'onglet Import, et le générique se remplira tout seul.",
    nobodyByThatName: "Personne de ce nom.",
    nobodyAmongRegulars:
      "Personne à ce titre parmi les habitués — ouvrez « de passage » pour voir le reste.",
    nobodyInThatRole: "Personne à ce titre.",
    backToCredits: "le générique",
    gapToPublic: "ÉCART AU PUBLIC",
    inAgreement: "d'accord",
    gentlerBy: "plus tendre de {{points}}",
    harsherBy: "plus sévère de {{points}}",
    personIntro_one: "{{roles}} — {{count}} film chez vous",
    personIntro_other: "{{roles}} — {{count}} films chez vous",
    ofWhichWaiting: ", dont {{count}} en attente",
    seen: "Vus",
    waiting: "En attente",
    whatIsMissing: "Ce qu'il me manque",
    missingNote:
      "Sa filmographie complète, moins ce que vous avez déjà. Rien n'est ajouté sans vous.",
    askTmdb: "demander à TMDB",
    tmdbNobody: "TMDB ne connaît personne de ce nom.",
    tmdbDown: "TMDB indisponible ({{error}}).",
    missingCount_one: "{{count}} film que vous n'avez pas — à ce titre-là.",
    missingCount_other: "{{count}} films que vous n'avez pas — à ce titre-là.",
    nothingMissing: "Rien ne manque : vous avez tout ce que TMDB lui connaît.",
    yearUnknown: "année inconnue",
    inWatchlist: "dans À voir",
    addToWatchlist: "+ à voir",
  },

  walls: {
    sort: {
      watched: "vus récemment",
      added: "ajoutés",
      addedShort: "ajout",
      title: "A–Z",
      year: "année",
      rating: "note",
      director: "réalisateur",
    },
    watched: {
      stamp: "CATALOGUE",
      title: "Votre vidéothèque",
      subtitle: "un mur d'affiches, de notes et de souvenirs de séances",
      emptyTitle: "Le mur est encore vide",
      emptyBody: "Épinglez votre premier film pour commencer la collection.",
    },
    watchlist: {
      stamp: "À VOIR",
      title: "Le coin des envies",
      subtitle: "les films mis de côté, en attente d'une séance",
      emptyTitle: "Aucune envie en attente",
      emptyBody: "Importez votre watchlist Letterboxd, ou épinglez un film « à voir ».",
    },
  },

  library: {
    search: "Chercher",
    searchPlaceholder: "un titre, un·e cinéaste…",
    genre: "Genre",
    decade: "Décennie",
    sort: "Trier",
    arrange: "Ranger",
    clickToReverse: "cliquer pour inverser",
    rewritesArrangement: "Réécrit l'agencement de cette vue",
    presentation: "Présentation",
    wall: "MUR",
    shelf: "ÉTAGÈRE",
    byDirector: "PAR RÉALISATEUR",
    byDirectorAdd: "+ PAR RÉALISATEUR",
    oneRowPerDirector: "Une ligne et une boîte par réalisateur",
    unknownDirector: "Réalisateur inconnu",
    shelfWood: "BOIS DE L'ÉTAGÈRE",
    decor: "Décor",
    decorStudio: "ATELIER DÉCO…",
    decorHint: "Peindre le mur, changer la matière des planches",
    wallStudio: "ATELIER DU MUR…",
    wallStudioHint: "Peindre le mur, régler la taille et le désordre des fiches",
    setAside_one: "{{count}} film de côté — voir l'étagère",
    setAside_other: "{{count}} films de côté — voir l'étagère",
    nothingToShow: "Rien à afficher",
    tryAnotherSearch: "Essayez une autre recherche.",
  },

  almanac: {
    emptyTitle: "Aucune séance datée pour l'instant.",
    emptyBody:
      "L'almanach se remplit tout seul dès qu'une fiche porte une date — en notant une séance sur une fiche, ou en relevant son journal depuis l'onglet d'import.",
    plate1: "Le compte et le rythme",
    plate2: "Les goûts",
    plate3: "Les gens et le monde",
    plate4: "Les sujets et les artisans",
    previousPeriod: "période précédente",
    nextPeriod: "période suivante",
    previousPlate: "planche précédente",
    nextPlate: "planche suivante",
    orArrows: "ou les flèches du clavier",
    exportHint: "Une image de cette année, à garder ou à montrer",
    yearInABox: "l'année en boîte",
    developing: "on développe…",
    exportFailed: "raté — réessayer",
    nothingToNote: "rien à noter",

    viewings: "SÉANCES",
    daysInARow: "JOURS D'AFFILÉE",
    fromTo: "du {{from}} au {{to}}",
    theYears: "Les années",
    theMonths: "Les mois",
    daysWithViewing: "Jours avec séance",
    ofThePeriod: "De la période",
    ofTheYear: "De l'année",
    oneEvery: "une séance tous les {{days}} jours",
    hoursOfCinema: "Les heures de cinéma",
    inFrontOfAScreen: "DEVANT UN ÉCRAN",
    noRuntimes:
      "aucune durée connue — le bouton « compléter les fiches », dans l'onglet Import, va les chercher",
    atLeast_one: "au moins — {{count}} séance sans durée connue",
    atLeast_other: "au moins — {{count}} séances sans durée connue",

    noRatedViewing: "aucune séance notée",
    noRatedViewingThisYear: "aucune séance notée cette année",
    starViewings_one: "{{stars}} ★ — {{count}} séance",
    starViewings_other: "{{stars}} ★ — {{count}} séances",
    agreeWithPublic: "d'accord avec le public, sur {{count}} séances",
    gentlerThan: "plus tendre que le public de {{points}} point(s), sur {{count}} séances",
    harsherThan: "plus sévère que le public de {{points}} point(s), sur {{count}} séances",
    noReleaseYear: "aucune année de sortie renseignée",
    median: "Médiane",
    yearsOld_one: "{{count}} an",
    yearsOld_other: "{{count}} ans",
    decadesVisited: "Les décennies visitées",
    ratedViewings_one: "{{count}} séance notée",
    ratedViewings_other: "{{count}} séances notées",
    changedMind: "Ce qui a changé d'avis",
    noDrift: "aucune note n'a bougé entre deux séances",
    allYearsTogether: "toutes années confondues — on ne se ravise pas en douze mois",

    filmmakers: "Les cinéastes",
    loyalties: "Les fidélités",
    loyaltiesAndFinds: "Fidélités et découvertes",
    metAgain: "RETROUVÉS",
    discovered: "DÉCOUVERTS ({{count}})",
    worldCrossed: "Le monde traversé",
    noCountry:
      "aucun pays renseigné — « compléter les fiches », dans l'onglet Import, va les chercher",
    countriesCrossed: "PAYS TRAVERSÉS",

    noKeyword: "aucun mot-clé — « compléter les fiches », dans l'onglet Import, va les chercher",
    noMotif: "aucun motif posé — ils se choisissent sur une fiche, sous la critique",
    craftspeople: "Les artisans",
    noRecurringCrew:
      "personne ne revient deux fois derrière la caméra — « compléter les fiches », dans l'onglet Import, remplit les équipes",
    gentlerHarsher: "Plus tendre, plus sévère",
    noPublicScore: "aucune séance notée dont on connaisse aussi la note publique",
    youOutOfTen: "VOUS, SUR 10",
    thePublic: "LE PUBLIC",
    yourIndulgences: "VOS INDULGENCES",
    yourSeverities: "VOS SÉVÉRITÉS",
  },

  yearInBox: {
    title: "L'ANNÉE EN BOÎTE",
    viewings_one: "séance",
    viewings_other: "séances",
    films_one: "film",
    films_other: "films",
    rewatches_one: "revoyure",
    rewatches_other: "revoyures",
    onAverage: "de moyenne",
    ofCinema: "de cinéma",
    mostWatched: "Le plus revu cette année : {{name}}.",
    aYearOfViewings: "Une année de séances, tenue à la main.",
    decade: "années {{decade}}",
    averageAge: "{{years}} ans de moyenne",
    signature: "CINÉ HUB · archive personnelle",
    couldNotDraw: "l'image n'a pas pu être produite",
  },

  reco: {
    allLanguages: "toutes",
    obscurity: "Degré de niche",
    gem: "pépite",
    changeOfScene: "Dépaysement",
    withinMyTastes: "dans mes goûts",
    to: "À",
    tmdbRatingAtLeast: "Note TMDB ≥",
    genresSought: "Genres recherchés",
    genresSetAside: "Genres écartés",
    nothingComesBack:
      "Rien ne remonte avec ces réglages — élargissez les années ou baissez la note minimale.",
    needsKey:
      "Chercher des films au-dehors demande une clé — elle reste dans ce navigateur et sert aussi à l'enrichissement des fiches.",
    needsKeyWithHome:
      "Les propositions ci-dessus viennent de votre collection et n'ont besoin de rien. Pour en chercher au-dehors, il faut une clé — elle reste dans ce navigateur et sert aussi à l'enrichissement des fiches.",
  },

  shared: {
    noCollection: "Pas de collection à cette adresse. Le lien a peut-être été refermé.",
    couldNotOpen: "Cette collection n'a pas pu être ouverte.",
  },

  skinLab: {
    typedLabel: "Étiquette tapée",
    underlinedField: "un champ souligné",
  },

  athome: {
    rewatch: "À revoir",
    years_one: "{{count}} an",
    years_other: "{{count}} ans",
    months_one: "{{count}} mois",
    months_other: "{{count}} mois",
    reason: {
      rewatch: "{{stars}}★ chez vous, et pas revu depuis {{since}}",
      motif_one: "{{count}} film porte ce motif, et rien depuis {{since}}",
      motif_other: "{{count}} films portent ce motif, et rien depuis {{since}}",
      director_one: "{{count}} film chez vous, {{average}}★ de moyenne, rien depuis {{since}}",
      director_other: "{{count}} films chez vous, {{average}}★ de moyenne, rien depuis {{since}}",
    },
  },

  tonight: {
    fits: "{{minutes}} min — ça tient",
    overruns: "{{minutes}} min, soit {{over}} de trop",
    runtime: "{{minutes}} min",
    unknownRuntime: "durée inconnue",
    genreYouLike: "genre que vous aimez : {{genre}}",
    waiting_one: "en attente depuis {{count}} an",
    waiting_other: "en attente depuis {{count}} ans",
  },

  install: {
    title: "Le classeur tient sur votre écran d'accueil",
    appleBefore: "Touchez ",
    appleAfter:
      " en bas de Safari, puis « Sur l'écran d'accueil ». Il s'ouvrira en plein écran, et même sans réseau.",
    body: "Il s'ouvre alors en plein écran, sans barre d'adresse, et même sans réseau.",
    action: "INSTALLER",
    dismiss: "Écarter",
  },

  update: {
    title: "Une nouvelle version est prête",
    body: "Elle s'installera au rechargement. Rien de ce que vous avez rangé ne bouge.",
    action: "RECHARGER",
  },

  /* THE EXAMPLE BINDER'S OWN WORDS. Twelve cards sown once, on the first
     opening, in the language then in force — see `services/demo`. Titles
     are the RELEASE titles of each country, not translations: an English
     reader looks for "Spirited Away" and a French one for "Le Voyage de
     Chihiro", and neither would find the other. */
  demoBinder: {
    films: {
      chihiro: {
        title: "Le Voyage de Chihiro",
        genres: "Animation, Fantastique, Aventure",
        themes: "l'enfance, le travail",
        review:
          "Revu dix ans après, et c'est le train sur l'eau qui reste — pas les monstres. Le film le plus calme jamais fait sur le fait de grandir.",
      },
      mulholland: {
        title: "Mulholland Drive",
        genres: "Thriller, Mystère, Drame",
        themes: "le cinéma, les rêves",
        review:
          "La boîte bleue ne s'explique pas, elle se subit. J'ai mis trois visionnages à cesser de chercher la clé, et c'est là que le film a commencé.",
        notes: "Revoir en pensant à Persona. La scène du Silencio, seule, vaut le détour.",
      },
      mood: {
        title: "In the Mood for Love",
        genres: "Romance, Drame",
        themes: "le renoncement",
        review:
          "Deux personnes qui ne se touchent jamais, et le film entier est une caresse. Le ralenti dans l'escalier, à chaque fois.",
      },
      "jour-sans-fin": {
        title: "Un jour sans fin",
        genres: "Comédie, Fantastique, Romance",
        themes: "la répétition",
        review:
          "La meilleure comédie jamais faite sur l'idée qu'on ne devient quelqu'un qu'à l'usure.",
      },
      alien: {
        title: "Alien, le huitième passager",
        genres: "Horreur, Science-fiction",
        themes: "l'espace, le corps",
        review:
          "Un film de couloirs. Tout ce qui fait peur est hors champ, et la seule chose qu'on voie vraiment est la fatigue des gens.",
      },
      "blade-runner": {
        title: "Blade Runner",
        genres: "Science-fiction, Thriller",
        themes: "la mémoire, l'artificiel",
        review:
          "Le monologue final est écrit sur le plateau, et c'est la plus belle chose du film. La pluie y fait le travail de la musique.",
      },
      "paris-texas": {
        title: "Paris, Texas",
        genres: "Drame",
        themes: "l'abandon, le désert",
        review:
          "La scène du peep-show tient quinze minutes sur deux voix et une vitre. Rien de ce que j'ai vu depuis ne s'en approche.",
      },
      "perfect-days": {
        title: "Perfect Days",
        genres: "Drame",
        themes: "la routine, le travail",
      },
      "400-coups": {
        title: "Les Quatre Cents Coups",
        genres: "Drame",
        themes: "l'enfance, l'école",
        review:
          "L'arrêt sur image sur la plage est la première fin de film qui refuse de conclure. Tout le reste de la Nouvelle Vague en sort.",
      },
      samourai: {
        title: "Le Samouraï",
        genres: "Policier, Drame",
        themes: "la solitude, le code",
        review:
          "Dix minutes sans un mot pour ouvrir. Melville filme un rituel, pas un métier — et Delon ne joue rien, ce qui est exactement ce qu'il fallait.",
      },
      stalker: {
        title: "Stalker",
        genres: "Science-fiction, Drame",
        themes: "la foi, le désir",
        review:
          "Trois hommes marchent vers une pièce qui exauce, et aucun n'ose entrer. Le film dure ce qu'il faut pour qu'on comprenne pourquoi.",
        notes: "Vu fatigué, à revoir un dimanche matin. Le passage sépia du retour m'a échappé.",
      },
      portrait: {
        title: "Portrait de la jeune fille en feu",
        genres: "Romance, Drame, Histoire",
        themes: "le regard, la peinture",
        review:
          "Un film sur ce que c'est que d'être regardée en retour. Le dernier plan tient sur un visage et un opéra, et il suffit.",
      },
    },
    threads: {
      0: "Le même homme, trois ans plus tard, et déjà toute la question : ce qui est vivant, et ce qui ne fait que le paraître.",
      1: "Quarante ans entre les deux, et le même geste : filmer un homme qui se tait jusqu'à ce que le silence dise quelque chose.",
      2: "Deux amours qui tiennent entièrement dans ce qu'on n'ose pas faire, et deux dernières images qui refusent de refermer.",
      3: "Henri Decaë à l'image des deux. Le même Paris, à huit ans d'écart : gris pour un enfant qui court, gris pour un homme qui attend.",
    },
    book: {
      title: "Les androïdes rêvent-ils de moutons électriques ?",
      note: "Le film garde la question et jette l'intrigue. Le roman, lui, est un livre sur les animaux.",
    },
    note: {
      title: "Ce que je cherche en ce moment",
      body: "Des films qui font confiance au silence. Melville, Wenders, Sciamma dans la seconde moitié — à chaque fois, la scène qui compte est celle où personne ne parle.\n\nÀ suivre : les chefs opérateurs plutôt que les cinéastes. Decaë revient deux fois sans que je l'aie cherché.",
    },
  },

  demo: {
    title: "Ces douze films ne sont pas à vous",
    body: "Un exemple, posé pour que la visite ait quelque chose à montrer. Gardez-le le temps de faire le tour, ou retirez-le tout de suite.",
    remove: "LES RETIRER",
  },

  language: {
    title: "La langue",
    close: "Fermer le choix de langue",
    open: "La langue du classeur",
    fr: "Français",
    en: "English",
    frNote: "la langue d'origine du classeur",
    enNote: "the binder, in English",
  },

  /* THE NAMES OF THE TABS — read by the rail, and by anything that has
     to name a view outside it. */
  views: {
    library: "Vidéothèque",
    watchlist: "À voir",
    credits: "Générique",
    reco: "Découvertes",
    constellation: "Constellation",
    almanac: "Almanach",
    notebook: "Carnet",
    import: "Import Letterboxd",
    thread: "Le fil",
    lists: "Listes et défis",
    skinlab: "Peaux ⚙",
  },

  rail: {
    addFilm: "Épingler un nouveau film",
    searchAll: "Chercher partout",
    searchAllHint: "Chercher partout (Ctrl+K)",
    skin: "Changer la peau du site",
    tmdbKey: "La clé TMDB",
    account: "Votre compte et la synchronisation",
    help: "La visite guidée",
  },

  surfaces: {
    paints: {
      platre: "Plâtre",
      lin: "Lin",
      craie: "Craie",
      ocre: "Ocre pâle",
      terracotta: "Terracotta",
      rose: "Rose ancien",
      sauge: "Sauge",
      eucalyptus: "Eucalyptus",
      ciel: "Ciel délavé",
      atelier: "Bleu de travail",
      anthracite: "Anthracite",
      nuit: "Nuit",
    },
    patterns: {
      rayuresFines: "Rayures fines",
      rayuresLarges: "Rayures larges",
      quadrillage: "Quadrillage",
      damier: "Damier",
      pois: "Pois",
      chevrons: "Chevrons",
      ecailles: "Écailles",
      fleurs: "Petites fleurs",
      tirets: "Tirets",
    },
    textures: {
      grain: "Grain",
      crepi: "Crépi",
      toile: "Toile",
      beton: "Béton",
    },
    materials: {
      chene: "Chêne",
      noyer: "Noyer",
      teck: "Teck",
      ebene: "Ébène",
      bouleau: "Bouleau",
      ceruse: "Cérusé",
      merisier: "Merisier",
      acier: "Acier brossé",
      laiton: "Laiton",
      noirMat: "Noir mat",
      verre: "Verre",
      verreFume: "Verre fumé",
      beton: "Béton ciré",
      ardoise: "Ardoise",
      marbre: "Marbre",
      blanc: "Laqué blanc",
      vert: "Vert atelier",
      bleu: "Bleu nuit",
      rouge: "Rouge grenat",
      moutarde: "Moutarde",
    },
    families: {
      bois: "Bois",
      metal: "Métal",
      verre: "Verre",
      pierre: "Pierre",
      peint: "Peint",
    },
    finishes: {
      mat: "Mat",
      satine: "Satiné",
      laque: "Laqué",
    },
  },

  shelf: {
    woods: {
      kraft: "Kraft",
      noyer: "Noyer",
      ceruse: "Cérusé",
      nuit: "Nuit",
      atelier: "Atelier",
    },
    decor: {
      divider: "Intercalaire",
      plant: "Plante verte",
      cactus: "Cactus",
      statuette: "Statuette",
      cat: "Chat en céramique",
      candle: "Bougie",
      mug: "Tasse",
      clock: "Réveil",
      books: "Pile de livres",
      frame: "Cadre photo",
      postcard: "Carte postale",
      wallclock: "Horloge",
      garland: "Guirlande",
      pennant: "Fanions",
      ivy: "Lierre suspendu",
      tape: "Ruban adhésif",
    },
    unfiledFilms: "Les films pas encore rangés",
    rowSettings: "Réglages de cette ligne",
    addCategoryHere: "+ une catégorie ici",
    addRow: "Ajouter une ligne à la fin du rayon",
    closeDrawer: "Fermer le tiroir",
    openSetAside: "Ouvrir les films mis de côté",
    close: "FERMER",
    setAside: "MIS DE CÔTÉ",
    toStand: "à poser",
    toHang: "à accrocher",
    toStandTitle: "À POSER",
    toHangTitle: "À ACCROCHER",
    categoryColour: "Couleur de la catégorie",
    noColour: "sans couleur",
    hidden: "masqué",
    nothingImported: "rien d'importé pour l'instant",
    cabinet: "CABINET DE CURIOSITÉS",
    dragOntoShelf: "glissez-les sur une planche, entre deux boîtiers",
    dragToBack: "glissez-les au fond du rayon, où vous voulez",
    resetTilt: "Rendre à l'objet son guingois d'origine",
    category: "CATÉGORIE",
    undoCategory: "défaire la catégorie",
    nameThisDivider: "Cliquez pour nommer cet intercalaire",
    kinds: {
      bedside: {
        title: "Films de chevet",
        tag: "ceux qu'on revoit",
      },
      main: {
        title: "La collection",
      },
      reserve: {
        title: "Mis de côté",
        tag: "gardés, pas jetés",
      },
    },
  },
  wallStudio: {
    wallTab: "MUR",
    cardsTab: "FICHES",
    cardSize: "TAILLE DES FICHES",
    spacing: "ÉCARTEMENT",
    disorder: "DÉSORDRE",
    untouched: "le mur est encore tel qu'on l'a trouvé",
    ownWall: "ce mur est à cette collection — l'autre garde le sien",
  },

  wallLook: {
    xl: "très grand",
    tight: "serré",
    airy: "aéré",
    tidy: "rangé",
    scattered: "dispersé",
  },

  decorStudio: {
    material: "MATÉRIAU",
    fromTheme: "au thème",
    reset: "Effacer le décor et revenir au bois du thème",
  },

  stills: {
    notSynced:
      "Cette image est restée sur l'appareil qui l'a importée : les captures ne se synchronisent pas encore.",
    pasteHint: "Ctrl+V pour coller · « insérer » place la vignette à l'endroit du curseur",
    caption: "légender…",
    close: "fermer (Échap)",
    previous: "précédente (←)",
  },

  motifs: {
    /* The picker's own words. The motifs THEMSELVES are below, under
       `labels`; these are the buttons around them. */
    chooseMotifs: "CHOISIR DES MOTIFS",
    closeList: "REFERMER LA LISTE",
    searchPlaceholder: "chercher un motif…",
    noneByThatName: "aucun motif de ce nom",
    create: "créer « {{name}} »",
    yourOwn: "LE VÔTRE",
    newMotif: "Nouveau motif",
    newPlaceholder: "« il pleut sans arrêt », puis Entrée",
    familyOf: "Famille du motif",
    tellsTheEnding: "il raconte la fin",
    endingMotif: "motif de fin",
    spoilerHint: "Ce motif raconte la fin — cliquez pour le lire",
    suggestedByTmdb: "PROPOSÉ PAR TMDB —",
    makeThread: "EN FAIRE UN FIL",
    gatherAll: "Rassembler tous les films portant « {{name}} »",
    removeOne: "Retirer « {{name}} »",
    deleteOne: "Supprimer le motif {{name}}",
    hideOne: "Écarter le motif {{name}}",
    putBack: "Le remettre dans la liste",
    setAside: "ÉCARTÉS ({{count}})",

    families: {
      fate: "Ce qui arrive aux personnages",
      ending: "La dernière image",
      narrative: "La façon de raconter",
      figures: "Les figures",
      tone: "Le ton",
      world: "Le monde",
    },
    labels: {
      "hero-dies": "Le héros meurt",
      sacrifice: "Il se sacrifie",
      "everyone-dies": "Personne n'en réchappe",
      "sole-survivor": "Un seul en réchappe",
      grief: "Le deuil d'un proche",
      "revenge-fulfilled": "La vengeance aboutit",
      "revenge-in-vain": "La vengeance ne répare rien",
      betrayal: "Trahi par un proche",
      flight: "La fuite",
      downfall: "L'ascension puis la chute",
      "impossible-love": "L'amour impossible",
      reunion: "Se retrouver après des années",
      confinement: "Enfermé, littéralement",
      "loss-of-reason": "La raison qui s'en va",
      "open-ending": "Fin ouverte",
      "final-revelation": "Tout bascule à la fin",
      "back-to-the-start": "On revient au point de départ",
      "false-happy-ending": "Une fin heureuse à laquelle on ne croit pas",
      "final-freeze-frame": "Un dernier plan qui se fige",
      "distant-epilogue": "Un épilogue des années après",
      "non-linear-narrative": "Récit désordonné",
      "unreliable-narrator": "Le narrateur ment",
      "single-setting": "Huis clos",
      "ensemble-film": "Film choral",
      "road-movie": "Road movie",
      "story-within-a-story": "Un film dans le film",
      "voice-over": "Porté par une voix off",
      "real-time": "En temps réel",
      "time-loop": "La même journée qui recommence",
      chapters: "Découpé en chapitres",
      flashback: "Raconté depuis après",
      mockumentary: "Faux documentaire",
      "long-take": "De longs plans-séquences",
      "literary-adaptation": "Vient d'un livre",
      "the-double": "Le double",
      "lost-mentor": "Le mentor qu'on perd",
      "wrong-man": "Le faux coupable",
      "child-witness": "Un enfant qui regarde",
      siblings: "Une histoire de fratrie",
      "absent-father": "Le père absent",
      "mismatched-duo": "Un duo dépareillé",
      "group-falling-apart": "Une bande qui se défait",
      "artist-at-work": "Quelqu'un qui fabrique quelque chose",
      "authority-figure": "L'institution comme adversaire",
      ghost: "Un mort qui reste là",
      melancholy: "Mélancolie",
      slapstick: "Burlesque",
      unease: "Malaise",
      contemplative: "Contemplatif",
      irony: "Ironie froide",
      tenderness: "Tendresse",
      fever: "Fièvre, tout va trop vite",
      sensuality: "Sensualité",
      paranoia: "Paranoïa",
      dreamlike: "Onirique",
      "sprawling-city": "La grande ville qui avale",
      "stifling-countryside": "La campagne étouffante",
      winter: "L'hiver, la neige",
      "crushing-summer": "Un été écrasant",
      sea: "La mer",
      "near-future": "Un futur tout proche",
      "after-the-end": "Après la fin du monde",
      "war-in-the-background": "La guerre, en arrière-plan",
      "world-of-work": "Le travail, vraiment montré",
      "family-single-setting": "La maison de famille",
      "the-night": "Ça se passe la nuit",
      exile: "Loin de chez soi",
    },
  },

  palette: {
    families: {
      warm: "Chaudes",
      golden: "Dorées",
      cool: "Froides",
      green: "Végétales",
      neutral: "Neutres",
    },
  },
  /* THE NATURE OF A THREAD, in the reading direction it is written in:
     "fait écho à" is what one reads BETWEEN two cards. */
  relations: {
    echo: "fait écho à",
    diptych: "forme un diptyque avec",
    "same-fate": "même destin que",
    answers: "répond à",
    "answered-by": "a reçu une réponse de",
    adapts: "adapte",
    "adapted-into": "a été adapté par",
    "sequel-to": "fait suite à",
    precedes: "précède",
    "remake-of": "refait",
    "remade-by": "a été refait par",
    strength1: "un fil ténu",
    strength2: "une vraie parenté",
    strength3: "le même film, deux fois",
  },

  threads: {
    linkedCard: "fiche liée",
    workKind: "Nature de l'œuvre",
    resonance: "la résonance entre les deux",
    saveHint: "Enregistrer (Entrée)",
    cancelHint: "Renoncer (Échap)",
    cardDeleted: "fiche supprimée",
    rewriteNote: "Réécrire la note — le titre appartient à la fiche liée",
  },

  detail: {
    reviewPlaceholder: "Écrivez ici, à main levée…",
    notesPlaceholder: "Scènes, citations, fragments…",
    keywords: "Mots-clés",
    motifOnNoCard: "Ce motif n'est posé sur aucune fiche.",
    setAsideTitle: "Mettre cette fiche de côté ?",
    setAsideBody:
      "Elle quitte le mur et la constellation, sans être détruite — on la remet en rayon quand on veut.",
    setAsideAction: "mettre de côté",
    deleteBody:
      "La fiche, ses notes, ses captures et ses fils partent avec elle. Rien ne se rattrape — « mettre de côté » range sans détruire.",
    searchCollection: "Chercher dans la collection",
    workTitle: "Titre de l'œuvre",
    title: "Titre",
    titleOnWallOrFree: "un titre déjà au mur, ou un titre libre",
    toWatchTag: "à voir",
    noFurtherDetail: "— sans plus de précision —",
    resonance: "La résonance entre les deux",
  },

  wakePanel: {
    setAside: "mettre de côté",
    setAsideDone: "mis de côté",
    votes: "votes",
    unrated: "pas noté",
  },

  tonightDrawer: {
    guessMood: "deviner l'humeur d'un film que vous n'avez pas encore annoté",
    nothingAnswers: "Rien dans « à voir » ne répond — ou la liste est vide.",
    allReviewed: "Vous les avez tous passés en revue.",
  },

  listsView: {
    challenges: "Les défis",
    inviteSomebody: "inviter quelqu'un à écrire",
    startChallenge: "Lancer un défi sur cette liste",
    deleteChallenge: "Effacer ce défi",
    upcoming: "à venir",
    finished: "terminé",
    running: "en cours",
  },

  constellation: {
    aFilm: "film",
    aThread: "fil",
    aWork: "œuvre",
    mapFocus: "foyer de la carte",
    linkCount_one: "{{count}} lien",
    linkCount_other: "{{count}} liens",
    withCrews: "vos fils, et les parentés trouvées dans les génériques",
    byHandOnly: "seulement ce que vous avez relié à la main — attrapez une étoile pour la déplacer",
    followCrews: "SUIVRE LES ÉQUIPES",
    dottedNote:
      "en pointillé : une personne partagée par deux ou trois films. Cliquez un pointillé pour le fixer — il devient alors un vrai fil rouge.",
    fedBy: "alimenté par « {{motif}} »",
    handmadeThread: "fil écrit à la main",
    whereToBegin: "Par où commencer",
    whereToBeginNote:
      "choisissez un film — la carte ne montrera que lui et ses voisins, et vous avancerez de proche en proche",
    showWholeSky: "OU VOIR TOUT LE CIEL, EN L'ÉTAT",
    focus: "FOYER",
    goBack: "← REVENIR ({{count}})",
    widen: "ÉLARGIR",
    narrow: "RESSERRER",
    changeStart: "CHANGER DE DÉPART",
    clickHint: "un clic déplace le foyer · un double-clic ouvre la fiche",
    jumpTo: "sauter à un autre film…",
    noneCarryThose: "Aucun des films reliés ne porte ces mots-clés — élargissez la sélection.",
    nothingLinkedYet:
      "Ouvrez un film, descendez au « fil rouge » et reliez-lui un livre, une peinture ou un autre film. Seuls les films reliés apparaissent ici.",
    tally: "{{films}} FILM(S) RELIÉ(S) · {{threads}} FIL(S)",
    tallyCrews: " · DONT {{count}} PAR LES ÉQUIPES",
    tallyTotal: " · {{count}} RELIÉ(S) AU TOTAL",
    mapLabel:
      "Carte du ciel — flèches pour aller d'un astre à l'autre, Entrée pour l'ouvrir, Échap pour lâcher",
  },

  linkTypes: {
    book: "Livre",
    painting: "Peinture",
    film: "Film",
    other: "Autre œuvre",
  },

  skins: {
    carnet: { label: "Carnet d'archiviste", note: "papier kraft, encre sépia, fil rouge" },
    veilleuse: { label: "Veilleuse", note: "le même carnet, lu de nuit" },
    cinematheque: {
      label: "Cinémathèque",
      note: "velours rouge, dorures, écran encore noir",
    },
    bauhaus: { label: "Bauhaus", note: "trois couleurs primaires et pas une de plus" },
    "nuit-americaine": {
      label: "Nuit américaine",
      note: "le jour tourné pour la nuit, filtre bleu",
    },
    kodachrome: { label: "Kodachrome", note: "diapositive oubliée dans sa boîte" },
    herbier: { label: "Herbier", note: "planches séchées, étiquettes manuscrites" },
    bleu: { label: "Bleu d'architecte", note: "traits blancs sur papier ozalid" },
    pulp: { label: "Pulp", note: "poche corné, orange criard, papier jauni" },
    fanzine: { label: "Fanzine", note: "photocopie ratée, noir, blanc et un rouge" },
    pastel: { label: "Pastel", note: "tout est rond, tout est doux" },
    japon: { label: "Papier Japon", note: "indigo, blanc cassé, un sceau rouge" },
    sepia: { label: "Sépia", note: "une photographie qu'on a trop regardée" },
    affiche: { label: "Affiche polonaise", note: "papier grisâtre, trois encres qui se cognent" },
  },

  tour: {
    /* The engine's own words — the buttons of the bubble, the help menu,
       the reminder card. They belong to no step. */
    ui: {
      skip: "passer",
      back: "retour",
      next: "SUIVANT",
      finish: "TERMINER",
      menuTitle: "LA VISITE GUIDÉE",
      globalNote: "le tour du classeur, d'un onglet à l'autre — {{count}} étapes",
      thisPage: "Cette page",
      pageNote_one: "{{name}} — {{count}} étape",
      pageNote_other: "{{name}} — {{count}} étapes",
      noPageTour: "cette page n'a pas de visite à elle",
      keys: "les flèches du clavier feuillettent, Échap referme",
      hintKicker: "LA VISITE",
      hintBody: "Elle vous attend au pied des onglets, sous le « ? ».",
      hintReplay: "la reprendre maintenant",
      dismissHint: "Effacer ce rappel",
    },

    library: {
      label: "La vidéothèque",
      search: {
        title: "Chercher",
        body: "Un titre, un·e cinéaste, un mot de votre critique. Sur le mur, la recherche filtre ; sur l'étagère, elle éteint ce qu'elle ne trouve pas et laisse l'agencement en place. Pour chercher au-delà des films — les gens, les motifs, les fils, le carnet — la loupe, au pied du rail ou au bout de la barre du bas, interroge tout d'un coup.",
      },
      mode: {
        title: "Le mur ou l'étagère",
        body: "Deux façons de regarder la même collection : un mur d'affiches punaisées, ou des boîtiers rangés en rayons que l'on déplace à la main.",
      },
      sort: {
        title: "Trier, ou ranger",
        body: "Sur le mur, trier est un état passager. Sur l'étagère, ranger est un geste : il réécrit l'agencement une fois, puis s'efface. Recliquer le même verbe retourne la rangée.",
      },
      filters: {
        title: "Les tamis",
        body: "Genres et décennies se cumulent : ce sont deux tamis posés l'un sur l'autre. Recliquer une étiquette allumée la retire.",
      },
      views: {
        title: "Les vues nommées",
        body: "Sur l'étagère, chaque vue est un rangement à part : ses rayons, ses catégories, son bois, son décor. On en garde plusieurs, et « par réalisateur » en fabrique une d'un clic.",
      },
      decor: {
        title: "L'atelier",
        body: "Le mur se peint, et les fiches ont un calibre. Sur l'étagère, le même bouton s'appelle « Atelier déco » et vit dans le menu des vues : le décor appartient à la vue, pas au rayon.",
      },
      open: {
        title: "Une fiche s'ouvre",
        body: "Cliquez une affiche pour ouvrir son dossier : c'est là que se tiennent la critique, les motifs et le fil rouge.",
      },
      drag: {
        title: "Ranger au doigt",
        body: "Sur l'étagère et sur le mur, on déplace en glissant. Au doigt, gardez l'objet appuyé un instant : il se saisit, et le balayage cesse de faire défiler. Un repère montre la fente où il tombera.",
      },
    },

    watchlist: {
      label: "À voir",
      waiting: {
        title: "Ce qui attend",
        body: "Le même mur, mais des films que vous n'avez pas encore vus. Ouvrez une fiche et le bouton « JE L'AI VU » la fait passer dans la vidéothèque en ouvrant son journal de séances.",
      },
      tonight: {
        title: "Lequel ce soir ?",
        body: "La question que la pile ne savait pas entendre. Dites le temps dont vous disposez et dans quel état vous êtes : le classeur tranche, dit pourquoi, et « une autre » descend d'un cran. Ce bouton n'existe que sur cette liste — la vidéothèque, elle, est déjà vue.",
      },
      tools: {
        title: "Les mêmes outils",
        body: "Recherche, tamis, tri, étagère et décor : cette liste se travaille exactement comme la vidéothèque, et garde ses propres réglages.",
      },
    },

    credits: {
      label: "Le générique",
      names: {
        title: "Les noms que vous avez déjà",
        body: "Réalisation, interprétation, image, musique, scénario : ces noms dorment dans vos fiches depuis le premier import. Ici, ils forment un répertoire — et chacun mène à ce que vous avez de cette personne.",
      },
      roles: {
        title: "À quel titre",
        body: "Les tamis se cumulent, comme sur le mur. Par défaut le répertoire ne montre que celles et ceux qu'on croise au moins deux fois — les autres sont à un clic, sous « de passage ».",
      },
      page: {
        title: "Ce que quelqu'un vaut chez vous",
        body: "Votre note moyenne sur ses films, et votre écart à la note publique : où vous êtes plus tendre, où vous êtes plus sévère que la foule. Puis ses films, ce qui revient chez lui, et depuis quand.",
      },
      missing: {
        title: "Ce qu'il me manque",
        body: "Sa filmographie complète, moins ce que vous avez : de quoi envoyer les absents dans « À voir » d'un clic. Ne paraît qu'avec une clé TMDB posée, depuis l'onglet Import.",
      },
    },

    detail: {
      label: "Un dossier film",
      catalog: {
        title: "La fiche catalogue",
        body: "Ce que le film est : titre, année, réalisation, genres, et tout ce que TMDB rapporte. Chaque champ se corrige d'un clic — c'est la seule façon de rattraper un import mal identifié. Les noms soulignés d'un pointillé ouvrent leur dossier au générique.",
      },
      watchlog: {
        title: "Le journal des séances",
        body: "Une ligne par visionnage, avec sa date et sa note. C'est lui qui sait qu'un film a été revu quatre fois, et qui nourrit l'almanach.",
      },
      elsewhere: {
        title: "Ce qu'on en dit ailleurs",
        body: "Quand un compte est ouvert, la fiche montre ce que d'autres vidéothèques publiques disent du même film : leur moyenne — sans la vôtre — et leurs critiques. Chacune se signale, et son auteur se fait taire d'un geste — le tiroir du compte liste ceux que vous avez fait taire, et leur rend la parole. Sans serveur ni compte, cette section n'existe pas.",
      },
      sharing: {
        title: "La retirer du partage",
        body: "Un film qu'on assume chez soi sans vouloir l'afficher : cette fiche-là quitte votre collection partagée, et elle seule. Elle reste au mur, dans l'almanach et dans la constellation — c'est le dehors qui l'ignore. Ne paraît qu'avec un compte, et seulement si vous montrez votre collection à quelqu'un.",
      },
      review: {
        title: "Vos mots",
        body: "La critique et les notes libres. Les photogrammes déposés sur la fiche s'y insèrent dans le texte, à l'endroit du curseur.",
      },
      tags: {
        title: "Mots-clés et motifs",
        body: "Les mots-clés sont les vôtres. Les motifs sont un vocabulaire commun — « le héros meurt », « il pleut à la fin » — sur lequel une question peut porter, et dont on tire un fil.",
      },
      identity: {
        title: "La bonne fiche TMDB",
        body: "L'import retient le premier titre trouvé, et se trompe sur les homonymes — deux « Resurrection » ne sont pas le même film. Ici on cherche le vrai et on relie la fiche : l'équipe, la durée, le pays et les mots-clés sont réécrits, vos mots et vos séances ne bougent pas. Le signe qui trahit l'erreur, c'est un sillage qui vous propose le film que vous regardez déjà.",
      },
      thread: {
        title: "Le fil rouge",
        body: "Relier deux films, en disant pourquoi : un motif partagé, une filiation, une réponse. Ces liens sont ce que la constellation dessine.",
      },
      wake: {
        title: "Dans le sillage",
        body: "Dix propositions par colonne, en trois parts : quatre tenues par les gens qui ont fait les films — même chef opérateur, même compositeur, quelqu'un à l'affiche des deux —, quatre par ce dont ils parlent, motifs et sujets communs, et deux par la foule, « vu par les mêmes gens ». Chacune dit pourquoi elle est là. À gauche votre classeur ; à droite TMDB, qui ne montre que ce que vous n'avez pas : cliquez une proposition pour lire son résumé sans quitter la page, et la mettre de côté d'un bouton.",
      },
    },

    reco: {
      label: "Le bureau des découvertes",
      home: {
        title: "Chez vous d'abord",
        body: "Avant d'aller chercher dehors : ce que votre collection contient déjà et que vous avez laissé de côté. Un film que vous aviez adoré, un motif que plus rien ne vous a fait croiser, un cinéaste que vous n'avez plus ouvert. Rien de tout cela ne sort du navigateur, et aucune clé n'est nécessaire.",
      },
      dials: {
        title: "Deux molettes",
        body: "« Degré de niche » va du grand public à la pépite. « Dépaysement » va de vos goûts avérés à ce qui en sort. Tout le reste du bulletin n'est qu'un affinage.",
      },
      order: {
        title: "Le bulletin de commande",
        body: "Années, langue, note et votes minimum, genres cherchés ou écartés. Les propositions viennent de TMDB, lues à travers ce que votre collection dit déjà de vous.",
      },
    },

    constellation: {
      label: "La constellation",
      start: {
        title: "Par où commencer",
        body: "La carte ne s'ouvre pas sur deux cents astres : vous choisissez un film, elle compose autour de lui, et vous avancez de proche en proche.",
      },
      teams: {
        title: "Suivre les équipes",
        body: "La seconde couche : en pointillé, les personnes partagées par plusieurs films. Cliquez un pointillé pour le fixer — il devient un vrai fil rouge.",
      },
      threads: {
        title: "Les fils",
        body: "Un fil peuple le ciel au lieu de le réduire : il y fait entrer ses membres, reliés ou non. C'est ce qu'on obtient en tirant un fil depuis un motif, sur une fiche.",
      },
      keyboard: {
        title: "La carte au clavier",
        body: "La carte se parcourt sans souris : une tabulation y entre, les flèches vont d'un astre au plus proche dans leur direction, Entrée le prend pour foyer — ou ouvre sa fiche quand il l'est déjà — et Échap lâche le curseur.",
      },
    },

    almanac: {
      label: "L'almanach",
      year: {
        title: "Une année, ou toujours",
        body: "L'almanach lit le journal des séances : il ne compte que les vraies séances, à leur date, et non la date d'ajout des fiches. « TOUJOURS », en tête, ouvre le même report sur toute votre pratique — les douze mois y deviennent vos années.",
      },
      plates: {
        title: "Quatre planches",
        body: "Le compte, les goûts, les gens, puis les sujets. Les flèches du clavier feuillettent. La dernière planche dit de quoi vos films parlaient — mots-clés et motifs —, quels chefs opérateurs et compositeurs vous suivez sans le savoir, et sur quels titres exactement vous êtes plus tendre ou plus sévère que la foule.",
      },
      export: {
        title: "L'année en boîte",
        body: "Une image de l'année, à garder ou à montrer. C'est la seule chose d'ici qui sorte du navigateur. Elle est bâtie autour d'un millésime : sur « toujours », le bouton s'efface.",
      },
    },

    notebook: {
      label: "Le carnet",
      new: {
        title: "Une page libre",
        body: "Des pensées qui n'appartiennent à aucun film en particulier. Les pages s'éditent sur place, et se rangent de la plus récente à la plus ancienne.",
      },
    },

    import: {
      label: "Import et archives",
      drop: {
        title: "Le bordereau",
        body: "Letterboxd livre un zip : déposez ses CSV un par un. watched.csv d'abord, diary.csv pour les séances. Rien n'est jamais dupliqué — repassez les fichiers autant de fois que vous voulez.",
      },
      feed: {
        title: "Ou relever le profil",
        body: "Sans fichier, directement depuis votre profil public : les séances récentes pour tenir la collection à jour, la watchlist entière page après page.",
      },
      complete: {
        title: "Compléter les fiches",
        body: "Letterboxd n'exporte ni réalisateur ni affiche : TMDB retrouve les deux. La clé est gratuite, et reste dans ce navigateur.",
      },
      repair: {
        title: "Rattraper une bascule",
        body: "Ne paraît que s'il y a quelque chose à rattraper : les fiches « vues » qui n'ont ni séance, ni note, ni texte, et qui étaient probablement des envies. À cocher une par une — la liste propose, vous décidez.",
      },
      backup: {
        title: "La sauvegarde",
        body: "Tout vit dans ce navigateur, et rien d'autre. Vider les données du site efface la collection : la sauvegarde est le seul filet, emportez-la de temps en temps.",
      },
    },

    thread: {
      label: "Le fil",
      find: {
        title: "Trouver quelqu'un",
        body: "On cherche par pseudonyme, et on ne trouve que les gens qui ont choisi de montrer leur collection. Il n'y a pas d'annuaire : ce classeur n'est pas un réseau social, et personne n'y figure sans l'avoir voulu.",
      },
      follows: {
        title: "Ceux que vous suivez",
        body: "Suivre est un geste qu'on fait seul et qu'on défait seul : personne n'accepte, personne n'est prévenu. Si quelqu'un referme sa collection, il reste dans la liste — son fil se tait, et reparlera s'il rouvre.",
      },
      news: {
        title: "Ce qu'ils regardent",
        body: "Les films récemment touchés chez les gens que vous suivez, avec leur note et leur critique. Jamais leurs notes personnelles ni leur journal de séances — pas plus que les vôtres ne sortent d'ici.",
      },
    },

    lists: {
      label: "Listes et défis",
      new: {
        title: "Ouvrir une liste",
        body: "Une liste contient des œuvres et non vos fiches : elle veut donc dire la même chose chez quelqu'un d'autre, et ne se vide pas le jour où vous effacez un film. On y range depuis la fiche du film, sous le catalogue.",
      },
      mine: {
        title: "Les vôtres, et celles à plusieurs",
        body: "Chaque liste s'ouvre d'un clic. Vous pouvez y inviter quelqu'un à écrire : il ajoute et retire des films, il ne renomme pas la liste et ne l'efface pas. Fermée par défaut — la rendre visible est une case à cocher.",
      },
      challenges: {
        title: "Un défi est une liste plus une période",
        body: "Personne ne coche « vu » : l'avancement se calcule depuis votre journal de séances, et seules les séances datées dans la période comptent. Le serveur en tire un nombre, jamais vos dates — et seulement pour ceux qui ont demandé à participer.",
      },
    },

    global: {
      label: "Visite complète",
      welcome: {
        title: "Bienvenue dans le classeur",
        body: "Quelques minutes pour faire le tour : les onglets, ce qu'on trouve derrière chacun, et les gestes qui ne se devinent pas. Vous pouvez partir quand vous voulez — on vous dira où reprendre.",
      },
      rail: {
        title: "La tranche du classeur",
        body: "Huit pastilles, toujours là : sur la tranche gauche au bureau, couchées au bas de l'écran sur un téléphone, où le pouce les atteint. Chacune est une façon différente de regarder la même collection ; survolez-en une — ou appuyez longuement — pour lire son nom.",
      },
      addFilm: {
        title: "Épingler un film",
        body: "À la main, sans passer par l'import : l'épingle ouvre une fiche vierge. Elle est au pied du rail au bureau, au bout de la barre du bas sur un téléphone.",
      },
      searchAll: {
        title: "Chercher partout",
        body: "Une question posée à tout le classeur d'un coup : les films, les gens des génériques, les motifs, les fils et les pages du carnet. Elle cherche jusque dans vos critiques, et vous montre le passage. Ctrl+K l'ouvre aussi.",
      },
      skin: {
        title: "La peau du site",
        body: "Quatorze habillages : le fond, les couleurs, les polices, les onglets. Vos cartons et le décor de vos étagères, eux, gardent leurs couleurs — ce sont vos choix, pas l'habillage.",
      },
      language: {
        title: "Français ou anglais",
        body: "Le classeur se lit dans les deux langues, et le choix reste sur cet appareil : lu en français sur le téléphone, en anglais au bureau, sans que l'un impose à l'autre. Ce que vous avez écrit — vos notes, vos critiques, vos motifs — ne bouge pas : c'est à vous, pas au produit.",
      },
      install: {
        title: "Le poser sur l'écran d'accueil",
        body: "Installé, le classeur s'ouvre en plein écran, sans barre d'adresse, et fonctionne sans réseau — vos films sont chez vous, pas sur un serveur. Sur iPhone, c'est Partager puis « Sur l'écran d'accueil ».",
      },
      account: {
        title: "Retrouver sa collection ailleurs",
        body: "Un compte relie ce classeur à vos autres appareils : ce que vous rangez ici s'y retrouve, et inversement — les films, mais aussi l'agencement de vos étagères et les pages de votre carnet. Sans mot de passe : c'est votre téléphone ou votre ordinateur qui signe.",
      },
      sharing: {
        title: "Montrer sa vidéothèque",
        body: "Dans ce même tiroir : personne, par lien secret, ou tout le monde. Le lien ne se devine pas et se coupe quand vous voulez. Un visiteur voit vos films, vos notes chiffrées et vos critiques — jamais votre carnet ni votre journal de séances. Et une fiche s'écarte à part, depuis son dossier, sous la fiche catalogue.",
      },
      reminders: {
        title: "Se faire rappeler ses défis",
        body: "Toujours dans ce tiroir : la seule chose qui vous sonnera jamais est un défi qui commence ou s'achève. Rien d'autre — ni les films des autres, ni un rappel de revenir. Le réglage vaut pour cet appareil seulement.",
      },
      challenges: {
        title: "Se lancer quelque chose",
        body: "Une liste plus une période fait un défi. Personne ne coche « vu » : l'avancement se calcule depuis votre journal de séances, et le serveur n'en tire qu'un nombre — vos dates ne sortent pas d'ici.",
      },
      tmdbKey: {
        title: "La clé TMDB",
        body: "Elle est facultative : le classeur marche entièrement sans elle. Posée, elle ouvre les Découvertes, les affiches, les relevés d'équipe et le sillage d'un film — et elle reste sur votre machine. Un compte en dispense entièrement : le serveur garde alors la sienne, et vous n'avez rien à demander à personne. Partout où il en manque une, l'écran vous le dit et vous ramène ici.",
      },
      replay: {
        title: "Rejouer la visite",
        body: "Ce bouton la rouvre quand vous voulez, en entier ou seulement pour la page où vous êtes. Bonne collection.",
      },
    },
  },
} as const;

export default fr;
