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
    wipePartly:
      "Une partie n'a pas pu être effacée. Fermez les autres onglets du classeur et réessayez.",
    wipeMine: "Repartir de zéro",
    wipeTitle: "Tout effacer, et garder le compte ?",
    wipeBody:
      "Vos fiches, vos documents, vos listes, vos défis, vos quiz, vos décors, vos abonnements et tout votre comptoir partent pour de bon — ici comme sur le serveur. Votre pseudonyme et vos clés d'accès restent : vous n'aurez pas à vous reconnecter. Les gens que vous avez bloqués le restent, et vos signalements aussi.",
    wipeAction: "TOUT EFFACER",
    wipeFailed: "Rien n'a pu être effacé.",
    appearOnBoard: "Apparaître au classement",
    boardNobody: "NULLE PART",
    boardFollowers: "CEUX QUI ME SUIVENT",
    boardEveryone: "TOUT LE MONDE",
    boardNobodyNote:
      "Vous ne figurez sur le palmarès de personne. Vous vous voyez toujours vous-même, avec votre vrai rang.",
    boardFollowersNote:
      "Votre pseudonyme apparaît chez les gens qui vous suivent, et nulle part ailleurs.",
    boardEveryoneNote:
      "Votre pseudonyme peut apparaître au classement du monde. C'est autre chose que montrer sa collection, d'où ce réglage à part.",
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
    mediaCors:
      "Vos affiches et captures ne partent pas : le navigateur refuse le dépôt avant même de l'envoyer. Il manque presque toujours une règle CORS sur le container Azure — autorisez l'origine du site en PUT et en GET. Vos images restent entières sur cet appareil en attendant.",
    mediaRefused:
      "Le container a refusé le dépôt ({{detail}}). Un 403 vient le plus souvent d'une horloge décalée : la signature est datée. Vos images restent entières sur cet appareil.",
    mediaPullRefused:
      "Les affiches et captures faites sur vos autres appareils n'ont pas pu être rapatriées ({{detail}}). Un 429 veut dire que le serveur a refusé le débit, pas que les images sont perdues : elles sont intactes sur le container, et la prochaine ouverture réessaiera.",
    devices: "Mes appareils",
    devicesNote:
      "Une clé d'accès ne voyage pas : celle de cet ordinateur y reste. Ajoutez ici celle de votre téléphone — sur un autre PC, choisissez « un autre appareil » à la connexion et scannez le code affiché.",
    addDevice: "AJOUTER UN APPAREIL",
    addingDevice: "on attend l'appareil…",
    deviceThisOne: "cet appareil",
    devicePhone: "téléphone ou clé",
    deviceAdded: "Appareil ajouté.",
    deviceNamePlaceholder: "mon téléphone",
    forgetDevice: "RETIRER",
    forgetDeviceOne: "Retirer {{device}}",
    deviceSeen: "vu {{when}}",
    deviceNeverSeen: "jamais servi",
    addThisDevice: "Enregistrer la clé de CETTE machine",
    pairMake: "DONNER UN CODE À UN AUTRE PC",
    pairNote:
      "Sur localhost, chaque ordinateur est un domaine à lui seul : la clé du téléphone n'y sert à rien. Un code passe outre — il vaut votre compte pendant sept jours.",
    pairMadeNote:
      "Tapez-le sur l'autre ordinateur, sous « Venir d'une autre machine ». Il vaut sept jours et ne sert qu'une fois. Là-bas, enregistrez ensuite la clé de cette machine-là : le code n'aura plus lieu d'être.",
    pairClaimTitle: "Venir d'une autre machine",
    pairClaim: "ENTRER",
    pairClaimNote:
      "Le code se demande depuis l'ordinateur déjà connecté, dans « Mes appareils ». Votre collection, votre étagère et vos objets suivront à la première synchronisation.",
    deviceLastNote:
      "Votre dernière clé ne peut pas être retirée : sans elle, plus rien n'ouvre ce compte.",
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
    relayServes:
      "Votre serveur fournit déjà TMDB tant que vous êtes connecté : cette clé ne servira qu'une fois déconnecté, ou si le serveur est éteint.",
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
    seeThem: "ALLER LES VOIR",
    asWatched: "des films vus",
    queried: "{{done}} / {{total}} interrogés…",
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
    mediaWaiting: "médias en attente d'envoi",
    note: "Tout est stocké sur cette machine, captures en qualité d'origine. Exportez de temps en temps : vider les données du navigateur effacerait la collection.",
    preparing: "préparation…",
    downloaded_one: "sauvegarde de {{count}} fiche téléchargée.",
    downloaded_other: "sauvegarde de {{count}} fiches téléchargée.",
    vaultLabel: "la parole du navigateur",
    vaultKept: "garde le classeur",
    vaultFragile: "peut effacer le classeur",
    vaultNote:
      "Par défaut un navigateur se réserve le droit de reprendre cette place — après quelques semaines sans visite, ou quand le disque se remplit. Le lui demander coûte un clic et règle la question.",
    vaultAsk: "LUI DEMANDER DE GARDER LE CLASSEUR",
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
    deleteChosen_one: "Effacer {{count}} fiche",
    deleteChosen_other: "Effacer {{count}} fiches",
    deleteTitle_one: "Effacer {{count}} fiche ?",
    deleteTitle_other: "Effacer {{count}} fiches ?",
    deleteBody:
      "Elles partent de votre vidéothèque avec leurs affiches, leurs notes et leur journal de séances. Ce qui se trouve dans une liste ou dans un défi n'y est rangé que par son identifiant TMDB : cela ne bouge pas.",
    deleteAction: "EFFACER",
    filed: "rangé",
    alreadyThere: "y était déjà",
    fileIn: "Ranger dans une liste",
    fileThis: "Ranger ce film dans une liste",
    fileThese_one: "Ranger {{count}} film",
    fileThese_other: "Ranger {{count}} films",
    filedCount_one: "{{count}} rangé",
    filedCount_other: "{{count}} rangés",
    allAlreadyThere: "ils y étaient déjà",
    filingFailed: "Le rangement a échoué.",
    creationFailed: "La liste n'a pas pu être créée.",
    newListPlaceholder: "une nouvelle liste…",
    createAndFile: "Créer la liste et y ranger",
    strangers_one:
      "{{count}} film reste dehors : il n'a pas d'identité TMDB, et une liste range des œuvres, pas des copies.",
    strangers_other:
      "{{count}} films restent dehors : ils n'ont pas d'identité TMDB, et une liste range des œuvres, pas des copies.",
    noneFileable_one:
      "Ce film n'a pas d'identité TMDB : complétez-le depuis l'onglet Import et il pourra rejoindre une liste.",
    noneFileable_other:
      "Aucun de ces {{count}} films n'a d'identité TMDB : complétez-les depuis l'onglet Import et ils pourront rejoindre une liste.",
    select: "CHOISIR",
    stamp: "CHOISI",
    selectDone: "TERMINER",
    selected_one: "{{count}} film choisi",
    selected_other: "{{count}} films choisis",
    selectNone: "Touchez les affiches à ranger.",
    search: "CHERCHER",
    searchPlaceholder: "un titre à ajouter…",
    searchNote:
      "Cherchez chez TMDB : la liste peut accueillir un film que votre classeur n'a pas encore.",
    searching: "on cherche…",
    searchNobody: "TMDB ne trouve rien à ce titre.",
    searchNeedsKey: "Il faut une clé TMDB pour chercher — elle se règle au pied du rail d'onglets.",
    add: "AJOUTER",
    added: "ajouté",
  },

  elsewhere: {
    at: "chez {{pseudo}}",
    muteSomebody: "Ne plus rien voir de {{pseudo}}",
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
    filmCount_one: "{{count}} film",
    filmCount_other: "{{count}} films",
    loyalties: "Vos fidélités",
    loved: "Ceux que vous notez le mieux",
    newcomers: "Arrivés récemment",
    whatIHaveOf: "ce que j'ai de {{name}}",
    yourRating: "VOTRE NOTE",
    whatRecurs: "Ce qui revient",
    /* PAS « qui revient avec ». Sur quelqu'un que vous avez en deux
       films, tout le monde est à une fois : un titre qui promet la
       récurrence, suivi d'une liste de rencontres uniques, ment. Le
       classement met bien les vraies fidélités en tête quand il y en
       a. */
    companions: "Croisés sur ses fiches",
    noCompanion: "Personne d'autre n'est nommé sur ses fiches.",
    gapToPublic: "ÉCART AU PUBLIC",
    inAgreement: "d'accord",
    gentlerBy: "plus tendre de {{points}}",
    harsherBy: "plus sévère de {{points}}",
    gapToYou: "ÉCART À VOTRE MOYENNE",
    inAgreementToYou: "votre moyenne",
    gentlerByToYou: "au-dessus de {{points}}",
    harsherByToYou: "en dessous de {{points}}",
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
    emptyImport: "IMPORTER DEPUIS LETTERBOXD",
    emptyAdd: "ÉPINGLER UN FILM",
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
    heading: "La vidéothèque de {{pseudo}}",
    opening: "Ouverture…",
    count_one: "{{count}} film — regardé, noté, rangé par quelqu'un d'autre.",
    count_other: "{{count}} films — regardés, notés, rangés par quelqu'un d'autre.",
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

  /* LA CLÉ VIT DANS LA MACHINE, ET N'EN SORT PAS. On le dit sans
     dramatiser et sans jargon : ni « passkey », ni « WebAuthn », qui ne
     désignent rien pour qui vient de créer un compte en posant son
     doigt. */
  loneDevice: {
    title: "Votre compte ne vit que sur cet appareil",
    body: "La clé qui l'ouvre est enfermée dans cette machine : on ne peut ni la copier, ni la retrouver. Ajoutez-en une seconde, sur un téléphone, pendant que celle-ci fonctionne.",
    action: "AJOUTER UN APPAREIL",
    dismiss: "Écarter cet avertissement",
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
    body: "Un exemple, posé pour que vous ayez quelque chose à manipuler. Gardez-le le temps de faire le tour, versez vos films par-dessus, ou repartez d'un classeur vide.",
    import: "IMPORTER MES FILMS",
    remove: "PARTIR D'UN CLASSEUR VIDE",
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
  orphanViews: {
    discard: "SUPPRIMER DÉFINITIVEMENT",
    discardTitle_one: "Supprimer {{count}} vue pour de bon ?",
    discardTitle_other: "Supprimer {{count}} vues pour de bon ?",
    discardBody:
      "Elles partent d'ici et du serveur, cette fois vraiment — c'est ce que la suppression ne savait pas faire. Vos films ne bougent pas : une vue n'est qu'un rangement.",
    none: "Aucune vue d'étagère à reprendre",
    noneBlurb:
      "Rien ne traîne sur cet appareil. Si vous savez qu'il en reste sur le serveur — supprimées ici avant que la suppression ne sache voyager — vous pouvez les redemander.",
    refetch: "REDEMANDER LES VUES AU SERVEUR",
    refetchTitle: "Redemander les vues d'étagère ?",
    refetchBody:
      "Le classeur va redescendre toutes les vues que le serveur détient, y compris celles que vous aviez supprimées ici. Elles apparaîtront alors dans cette liste, à cocher ou à laisser. Rien d'autre n'est touché.",
    title_one: "{{count}} vue d'étagère retrouvée",
    title_other: "{{count}} vues d'étagère retrouvées",
    blurb:
      "Elles sont bien là, mais rien ne les listait — un défaut corrigé depuis, qui laissait une vue supprimée traîner au lieu de partir. Cochez celles que vous voulez reprendre ; les autres restent où elles sont, et vous pouvez revenir.",
    unnamed: "Vue sans nom",
    action: "REPRENDRE",
    confirmTitle_one: "Reprendre {{count}} vue ?",
    confirmTitle_other: "Reprendre {{count}} vues ?",
    confirmBody:
      "Elles reviennent à la fin de leur mur, et se suppriment ensuite comme n'importe quelle vue.",
  },

  views: {
    library: "Vidéothèque",
    watchlist: "À voir",
    credits: "Générique",
    reco: "Découvertes",
    constellation: "Constellation",
    almanac: "Almanach",
    import: "Import Letterboxd",
    thread: "Le fil",
    lists: "Listes et défis",
    quiz: "Quizz",
    counter: "Le comptoir",
    skinlab: "Peaux ⚙",
  },

  /* Les trois familles du rail. Un groupe se nomme par ce qu'il
     CONTIENT, jamais par le verbe qu'on y fait : « le classeur » dit ce
     qu'on possède, et les trois vues dessous en sont les angles. */
  groups: {
    binder: "Le classeur",
    explore: "Explorer",
    hall: "Le hall",
  },

  notebook: {
    title: "Le carnet",
    stamp: "CARNET",
    subtitle: "des pensées libres, qui n'appartiennent à aucun film en particulier",
    add: "AJOUTER LA PAGE",
    titlePlaceholder: "Titre de la note",
    bodyPlaceholder: "Écrivez librement…",
    untitled: "Sans titre",
    empty: "le carnet attend sa première page…",
  },

  counter: {
    tally: "{{merit}} de mérite, {{tokens}} jetons — ouvrir le comptoir",
    heading: "Le comptoir",
    subheading: "ce qu'on a gagné, ce qu'on en fait, et devant qui",
    noServer: "Aucun serveur n'est réglé : le comptoir se tient à plusieurs, et il n'y a personne.",
    noAccount:
      "Il faut un compte — le bouton au pied du rail. Votre vidéothèque, elle, n'en a pas besoin.",
    merit: "Mérite",
    tokens: "Jetons",
    standing: "{{place}}e au classement",
    ladder: {
      world: "le monde",
      friends: "ceux que je suis",
      empty: "Personne ici pour l'instant.",
      closed:
        "Vous ne figurez pas au classement du monde. Cela se règle dans le tiroir du compte, à côté du partage.",
    },
    shop: {
      sell: "RENDRE ({{price}})",
      sellNote: "Réservé au rôle : rend l'article et vous rembourse, pour reprendre la boutique.",
      title: "Le présentoir",
      stamp: "Tampons",
      pack: "Pochettes",
      skin: "Peaux",
      power: "Pouvoirs",
      buy: "{{price}} jetons",
      owned: "Acquis",
      wear: "porter",
      takeOff: "retirer",
      short_one: "il vous manque {{count}} jeton",
      short_other: "il vous manque {{count}} jetons",
    },
    items: {
      "stamp-habitue": "L'habitué",
      "stamp-noctambule": "Le noctambule",
      "stamp-premiere-seance": "Première séance",
      "stamp-projectionniste": "Le projectionniste",
      "pack-trois": "Une pochette de trois",
      "power-halve": "Écarter deux réponses",
      "power-redo": "Reprendre une question",
      "power-extend": "Prolonger un défi",
    },
    album: {
      title: "La planche",
      opened: "La pochette s'ouvre",
      close: "Ranger",
    },
  },

  stamps: {
    habitue: "habitué",
    noctambule: "noctambule",
    "premiere-seance": "1re séance",
    projectionniste: "projectionniste",
  },

  stickers: {
    projecteur: "Le projecteur",
    fauteuil: "Le fauteuil",
    bobine: "La bobine",
    ticket: "Le ticket",
    esquimau: "L'esquimau",
    rideau: "Le rideau",
    clap: "Le clap",
    cadran: "Le cadran",
    lanterne: "La lanterne",
    palme: "La palme",
    nitrate: "Le nitrate",
  },

  points: {
    challenge: "défi bouclé",
    challenge_half: "défi à mi-chemin",
    challenge_joined: "quelqu'un vous a rejoint",
    quiz: "quiz",
    quiz_flawless: "sans faute",
    quiz_first: "premier fini",
    watch: "une séance",
    review: "une critique",
    rating: "une note",
    list_shared: "liste partagée",
    bank_question: "question versée à la banque",
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
    decorFrom: "de {{pseudo}}",
    decorShown: "montré à mes amis",
    decorTake: "Prendre « {{label}} »",
    decorShow: "Montrer « {{label}} » à mes amis",
    decorHide: "Ne plus montrer « {{label}} »",
    cabinet: "CABINET DE CURIOSITÉS",
    dragOntoShelf: "glissez-les sur une planche, entre deux boîtiers",
    dragToBack: "glissez-les au fond du rayon, où vous voulez",
    resetTilt: "Rendre à l'objet son guingois d'origine",
    category: "CATÉGORIE",
    undoCategory: "défaire la catégorie",
    nameThisDivider: "Cliquez pour nommer cet intercalaire",
    shelfAimed: "rayon visé : {{shelf}}",
    kinds: {
      bedside: {
        title: "Films de chevet",
        tag: "ceux qu'on revoit",
      },
      main: {
        title: "La collection",
        /* PAS DE LÉGENDE, ET LA CLÉ EXISTE QUAND MÊME. Le code demandait
           `shelf.kinds.main.tag` avec `defaultValue: ""` — mais i18next
           tient une valeur par défaut VIDE pour une absence de valeur par
           défaut, et rend alors la clé : « shelf.kinds.main.tag » s'est
           donc affiché tel quel sous l'étagère. Une chaîne d'un espace
           dirait la même chose au lecteur et mentirait au test qui refuse
           les phrases vides ; c'est le code qui ne demande plus rien pour
           ce rayon-là, et cette clé porte ce qu'il faut si un jour on veut
           l'écrire. */
        tag: "tout ce qu'on garde",
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

  threadView: {
    /* CES QUINZE PHRASES ÉTAIENT EN DUR, comme celles des listes, et la
       même passe de traduction automatique en avait abîmé trois : « at
       fil », « Vous ne suivez more person », « Rien de fresh chez les
       gens que vous suivez ». Un texte en dur échappe aux deux
       catalogues, donc au test de parité. */
    heading: "Le fil",
    subheading: "ce que regardent les gens que vous suivez",
    find: "Chercher quelqu'un",
    pseudoPlaceholder: "son pseudonyme",
    look: "VOIR",
    shown_one: "{{count}} film montré",
    shown_other: "{{count}} films montrés",
    theirCollection: "SA COLLECTION",
    follow: "SUIVRE",
    unfollow: "NE PLUS SUIVRE",
    unfollowSomebody: "Ne plus suivre {{pseudo}}",
    youFollow: "Vous suivez",
    closedAgain: "refermée",
    lately: "Dernièrement, chez eux",
    opening: "Ouverture…",
    followNobody: "Vous ne suivez personne. Cherchez un pseudonyme ci-dessus.",
    nothingNew: "Rien de neuf chez les gens que vous suivez.",
    at: "chez {{pseudo}}",
  },

  listsView: {
    lastDays: "derniers jours",
    settled: "Soldé",
    extend: "PROLONGER D'UNE SEMAINE",
    worth_one: "{{points}} points acquis — il reste {{count}} jour",
    worth_other: "{{points}} points acquis — il reste {{count}} jours",
    wasWorth: "{{points}} points, comptés.",
    /* CES HUIT PHRASES ÉTAIENT ÉCRITES EN DUR DANS LA VUE, et une passe
       de traduction automatique les avait abîmées sans que rien ne le
       signale : « une nouvelle list », « on y range les films since leur
       fiche », « sous at catalogue ». Un texte en dur échappe aux deux
       catalogues, donc au test de parité — il n'y avait personne pour
       s'apercevoir qu'il ne voulait plus rien dire. */
    newList: "Une nouvelle liste",
    newListPlaceholder: "Les films qu'il faut avoir vus en mars",
    open: "OUVRIR",
    fillNote:
      "On y range les films depuis leur fiche, depuis la pastille d'une affiche, ou en cherchant chez TMDB dans la liste ouverte.",
    yours: "Vos listes",
    none: "Aucune liste pour l'instant.",
    noChallenges:
      "Aucun défi. Un défi est une liste plus une période : ouvrez une liste ci-dessus pour en lancer un.",
    empty: "Vide.",
    removeWork: "Retirer de la liste",
    public: "publique",
    at: "chez {{pseudo}}",
    noServer:
      "Aucun serveur n'est réglé : les listes et les défis se partagent, et il n'y a personne avec qui.",
    noAccount:
      "Il faut un compte — le bouton au pied du rail. Votre vidéothèque, elle, n'en a pas besoin.",
    nobodyToInvite: "Personne à inviter sous « {{pseudo}} ».",
    challenges: "Les défis",
    inviteSomebody: "inviter quelqu'un à écrire",
    startChallenge: "Lancer un défi sur cette liste",
    deleteChallenge: "Effacer ce défi",
    upcoming: "à venir",
    finished: "terminé",
    running: "en cours",
    /* LE MÊME OUBLI, LA SECONDE MOITIÉ. Onze phrases de plus dormaient
       en dur — dont deux que la même passe automatique avait rendues
       illisibles : « Person n'y participe more. » et « visible de qui
       vous follows ». Le titre de la vue lui-même n'était nulle part
       ailleurs que dans le JSX. */
    heading: "Listes et défis",
    subheading: "ce qu'on se donne à voir, seul ou à plusieurs",
    invite: "INVITER",
    removeMember: "Retirer {{pseudo}}",
    publicNote: "visible par les gens qui vous suivent",
    deleteList: "Effacer cette liste",
    challengePlaceholder: "Mars chez Varda",
    launch: "LANCER",
    join: "PARTICIPER",
    leave: "SORTIR",
    noParticipants: "Personne n'y participe encore.",
    works_one: "{{count}} film",
    works_other: "{{count}} films",
    fromList: "d'après « {{title}} »",
  },

  quizView: {
    right: "vu juste",
    wrong: "à revoir",
    outOf: "sur {{weight}} points",
    power: {
      halve: "écarter deux",
      redo: "reprendre",
    },
    heading: "Les quizz",
    subheading: "ce qu'on croit savoir, tiré au sort et mis à l'épreuve entre amis",
    newQuiz: "Composer un quizz",
    newQuizPlaceholder: "Le quizz du samedi soir",
    baskets: "Dans quelles catégories",
    levelLabel: "Niveau",
    sizeLabel: "Longueur",
    deal: "TIRER",
    dealNote:
      "Les questions sont tirées au sort dans les catégories cochées, dosées selon le niveau : il y a toujours un peu de tout. Le tirage est figé — vos invités auront exactement les mêmes.",
    thinBank:
      "Ces catégories n'ont que {{available}} questions jouables pour {{size}} demandées : le quizz sera plus court.",
    bankEmpty: "La banque est vide pour l'instant. Il n'y a rien à tirer.",
    softened:
      "La banque manquait de questions au niveau demandé : celui-ci a été complété avec le niveau voisin.",
    yours: "Ceux que vous avez tirés",
    noneDealt: "Aucun quizz tiré pour l'instant.",
    given: "Ceux qu'on vous a donnés",
    noneGiven: "Personne ne vous a encore invité à un quizz.",
    by: "de {{pseudo}}",
    questionCount_one: "{{count}} question",
    questionCount_other: "{{count}} questions",
    done: "terminé",
    underway: "commencé",
    untouched: "à faire",
    difficulty: {
      easy: "facile",
      normal: "moyen",
      hard: "difficile",
    },
    difficultyLabel: "Difficulté",
    worth: "{{n}} pt",
    points_one: "{{count}} point",
    points_other: "{{count}} points",
    progress: "{{done}} sur {{total}}",
    noTakingBack: "Une réponse posée ne se reprend pas — sauf à y dépenser un pouvoir, une fois.",
    allAnswered: "Toutes les questions sont répondues.",
    finish: "TERMINER",
    finishNote: "Terminer découvre les corrections, et ferme le quizz pour de bon.",
    overForYou: "C'est fait. On ne le rejoue pas.",
    yourScore: "{{score}} sur {{weight}}",
    gotIt: "juste · {{points}}",
    missedIt: "raté · c'était « {{answer}} »",
    scores: "Les scores",
    nobodyPlayed: "Personne n'y a encore touché.",
    stillPlaying: "en cours",
    players: "Qui joue",
    nobodyYet: "Personne encore. Un quizz ne se voit que de ceux qu'on invite.",
    invite: "INVITER",
    invitePlaceholder: "un pseudonyme",
    removePlayer: "Retirer cette personne",
    nobodyToInvite: "Personne à inviter sous « {{pseudo}} ».",
    deleteQuiz: "Effacer ce quizz",
    tendBank: "TENIR LA BANQUE",
    bankNote:
      "Les catégories et leurs questions. C'est le stock où tout le monde vient tirer — vous ne composez pas de quizz ici, vous les rendez possibles.",
    newCategory: "Une nouvelle catégorie",
    newCategoryPlaceholder: "Nouvelle Vague, Hitchcock, affiches…",
    addCategory: "AJOUTER",
    noCategories: "Aucune catégorie. C'est par là que ça commence.",
    deleteCategory: "Effacer cette catégorie",
    noQuestions: "Aucune question dans cette catégorie.",
    addQuestion: "Ajouter une question",
    editQuestion: "Modifier cette question",
    removeQuestion: "Retirer cette question",
    needsOneRight: "une seule bonne réponse",
    retired: "retirée",
    retiredNote:
      "Elle a déjà été tirée dans un quizz : elle n'est plus proposée, mais elle y reste lisible. Un score déjà fait ne se réécrit pas.",
    revive: "La remettre en circulation",
    choicesFrozen:
      "L'énoncé est corrigé. Les propositions, elles, ne bougent plus : quelqu'un a déjà répondu à cette question.",
    ask: "L'énoncé",
    askPlaceholder: "Qui a réalisé Cléo de 5 à 7 ?",
    choices: "Les propositions",
    choicePlaceholder: "Proposition {{n}}",
    markRight: "C'est celle-ci la bonne",
    removeChoice: "Retirer cette proposition",
    addChoice: "une proposition de plus",
    hint: "L'explication",
    hintPlaceholder: "Montrée une fois la réponse posée",
    image: "L'image",
    imagePlaceholder: "https://… ou bank/<id>/…",
    save: "ENREGISTRER",
    cancel: "ANNULER",
    noServer:
      "Aucun serveur n'est réglé : un quizz se joue à plusieurs, et il n'y a personne avec qui.",
    noAccount:
      "Il faut un compte — le bouton au pied du rail. Votre vidéothèque, elle, n'en a pas besoin.",
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
    price: "{{price}} jetons",
    short_one: "il vous faut {{count}} jeton",
    short_other: "il vous faut {{count}} jetons",
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
    nitrate: { label: "Nitrate", note: "la pellicule qui chauffe, la nuit autour" },
    "drive-in": { label: "Drive-in", note: "néons sur pare-brise, un soir d'été" },
    cinemascope: { label: "Cinémascope", note: "deux bandes noires, et tout le reste plus large" },
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
      hintReplay: "la faire maintenant",
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
      file: {
        title: "Ranger dans une liste, sans ouvrir la fiche",
        body: "Passez la main sur une affiche : une pastille paraît en haut à droite, et elle ouvre le choix des listes. Au doigt, gardez l'affiche appuyée. Vous pouvez y créer la liste au passage — inutile d'aller l'ouvrir ailleurs d'abord.",
      },
      choose: {
        title: "Plusieurs films d'un coup",
        body: "« Choisir » change ce que fait un clic : les affiches se cochent au lieu de s'ouvrir, et une barre en bas range toute la sélection dans la même liste. Les films sans identité TMDB restent dehors, et la barre le dit plutôt que de les taire.",
      },
      notebook: {
        title: "Le carnet",
        body: "Des pages libres, qui n'appartiennent à aucun film : une idée, une liste à faire, ce qu'on s'est dit en sortant. Elles s'ouvrent en tiroir depuis cette barre, se retrouvent dans la recherche qui traverse tout, et partent avec la sauvegarde.",
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
      standouts: {
        title: "Qui compte, chez vous",
        body: "Vos fidélités, celles et ceux que vous notez le mieux, et les noms que vos dernières fiches ont fait entrer. De quoi arriver ici sans avoir déjà un nom en tête.",
      },
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
        body: "Votre note moyenne sur ses films, son écart à votre propre moyenne — au-dessus ou en dessous de ce que vous donnez d'habitude — et votre écart à la note publique. Puis ses films, ce qui revient chez lui, et depuis quand.",
      },
      companions: {
        title: "Croisés sur ses fiches",
        body: "Le chef opérateur d'un cinéaste, le réalisateur d'un acteur : les noms qu'on rencontre sur ses films, du plus fréquent au plus rare. Chacun ouvre son propre dossier — le générique se parcourt enfin de proche en proche.",
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
      lists: {
        title: "Ranger ce film dans une liste",
        body: "Choisissez une liste, ou tapez un nom pour la créer sur-le-champ. Un film sans identité TMDB ne se range nulle part : une liste contient des œuvres, pas des copies — la même fiche chez quelqu'un d'autre ne serait pas la vôtre.",
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
        body: "Tout vit dans ce navigateur, et rien d'autre — c'est aussi là que ça se perd : vider les données du site efface la collection, et un navigateur laissé seul quelques semaines peut reprendre la place de lui-même. Demandez-lui de garder le classeur, et emportez une sauvegarde de temps en temps.",
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
      extend: {
        title: "Prolonger",
        body: "Un pouvoir acheté au comptoir, dépensé ici : sept jours de plus, deux fois au maximum, et seulement dans la semaine qui suit la fin. On repousse, on ne ressuscite pas — et un défi dont les comptes sont déjà clos ne se prolonge plus, sans quoi le classement décrirait une période sur laquelle personne n'a été mesuré.",
      },
      new: {
        title: "Ouvrir une liste",
        body: "Une liste contient des œuvres et non vos fiches : elle veut donc dire la même chose chez quelqu'un d'autre, et ne se vide pas le jour où vous effacez un film. On y range depuis la fiche, depuis la pastille d'une affiche, ou d'ici même.",
      },
      mine: {
        title: "Les vôtres, et celles à plusieurs",
        body: "Chaque liste s'ouvre d'un clic. Vous pouvez y inviter quelqu'un à écrire : il ajoute et retire des films, il ne renomme pas la liste et ne l'efface pas. Fermée par défaut — la rendre visible est une case à cocher.",
      },
      search: {
        title: "Y verser un film que vous n'avez pas",
        body: "Cherchez chez TMDB depuis la liste ouverte : c'est tout l'intérêt de ranger des œuvres et non des copies. « Venez voir ça en mars » se dit de films qu'on n'a justement pas encore — depuis une fiche, ceux-là ne pouvaient jamais être proposés.",
      },
      challenges: {
        title: "Un défi est une liste plus une période",
        body: "Un défi, c'est une liste plus une période : on demande à y participer, et le classeur compte tout seul ce que chacun a vu dans les temps. Personne ne coche « vu ». Un défi bouclé rapporte des points au comptoir — la moitié en rapporte moins, et rien du tout en dessous.",
      },
    },

    quiz: {
      label: "Les quizz",
      powers: {
        title: "Les pouvoirs",
        body: "Achetés au comptoir, dépensés ici. Écarter deux mauvaises réponses rend toujours LES MÊMES deux si vous redemandez — sinon on paierait une fois pour éplucher la question. Reprendre efface votre réponse à cette question-là, une seule fois, et la reprise reste marquée pour les autres joueurs. Sans pouvoir, cette barre n'existe pas.",
      },
      compose: {
        title: "Tirer un quizz",
        body: "On ne les écrit pas, on les tire : cochez des catégories, un niveau, une longueur, et les questions viennent au hasard de la banque. Le dosage est fixe — un quizz difficile garde des respirations, un quizz facile garde une colle — et deux quizz de même niveau et même longueur pèsent le même nombre de points. C'est ce qui rend deux scores comparables.",
      },
      bank: {
        title: "La banque",
        body: "Elle est réservée : si ce bouton est là, c'est que vous pouvez la remplir. Des catégories, et dedans des questions classées facile, moyen ou difficile — les points suivent la difficulté, on ne les saisit pas. Vous ne composez pas de quizz ici : vous les rendez possibles, pour tout le monde.",
      },
      mine: {
        title: "Ceux que vous avez tirés",
        body: "Vous ne les avez pas écrits, alors vous les jouez comme les autres : pas d'aperçu des réponses, et un vrai score au classement. C'est ici qu'on invite ses potes — le tirage est figé, ils auront exactement vos questions, dans le même ordre.",
      },
      given: {
        title: "Ceux qu'on vous a donnés",
        body: "Ouvrez-en un et il commence. Vous répondez quand vous voulez, en plusieurs fois. Une réponse posée ne se reprend pas — sauf à dépenser un pouvoir acheté au comptoir, une seule fois par question, et la reprise reste marquée pour les autres joueurs. Une fois terminé, on ne le rejoue pas.",
      },
      playing: {
        title: "Une question à la fois",
        body: "La catégorie et les points sont annoncés avant l'énoncé. La bonne réponse ne descend qu'une fois le quizz terminé — elle n'est pas cachée à l'écran, elle n'est pas dans la réponse du serveur. Terminer découvre les corrections, et les explications avec.",
      },
      players: {
        title: "Qui joue",
        body: "On invite par pseudonyme, comme pour une liste. Il n'y a pas de classement public : les scores que vous comparez sont ceux des gens que vous avez invités, et un blocage l'emporte des deux côtés.",
      },
      scores: {
        title: "Les scores",
        body: "Rien n'est stocké : le score se recalcule depuis les réponses, à chaque fois. La barre se lit sur ce que vaut le quizz entier, pas sur le meilleur score — sinon une soirée où tout le monde s'est planté aurait l'air d'un triomphe. Une barre pâle est quelqu'un qui n'a pas fini. Terminer une partie rapporte son score en mérite, et quinze de plus pour un sans-faute.",
      },
    },

    counter: {
      label: "Le comptoir",
      purse: {
        title: "Ce que vous avez gagné",
        body: "Deux compteurs sur un même billet. Le mérite se cumule et ne descend jamais : c'est lui qui vous classe. Les jetons sont le même chiffre, moins ce que vous dépensez ici — acheter ne vous coûte donc jamais une place. On gagne en bouclant des défis, en jouant des quizz, en tenant son classeur, et en faisant vivre les listes des autres.",
      },
      ladder: {
        title: "Devant qui",
        body: "« Ceux que je suis » : les gens que vous suivez, et vous. Le classement du monde, lui, n'apparaît que si vous avez accepté d'y figurer — cela se règle dans le tiroir du compte, à côté du partage. Vous vous voyez toujours, même tout en bas, et un blocage retire des deux côtés.",
      },
      shop: {
        title: "Le présentoir",
        body: "Des tampons à porter à côté de votre pseudonyme, des pochettes de vignettes, des peaux en plus, et des pouvoirs à dépenser pendant une partie. Un article trop cher reste sur l'étal et vous dit ce qui manque. Les quatorze peaux du classeur, elles, restent libres et marchent sans compte : ce qui s'achète ici est en supplément.",
      },
      album: {
        title: "La planche",
        body: "Onze vignettes, dessinées à la main, tirées au sort par le serveur — recharger la page ne rejoue pas une pochette. Les cases vides montrent ce qui manque sans montrer quoi, et les doubles se comptent : c'est ce qu'on échange du regard.",
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
      devices: {
        title: "Le même compte sur un autre ordinateur",
        body: "Une clé d'accès ne voyage pas : celle de cette machine y reste. Dans ce même tiroir, « Mes appareils » enregistre celle de votre téléphone — ensuite, sur n'importe quel autre ordinateur, choisissez « un autre appareil » à la connexion et scannez le code affiché. Rien à taper, rien à recopier.",
      },
      reminders: {
        title: "Se faire rappeler ses défis",
        body: "Toujours dans ce tiroir : la seule chose qui vous sonnera jamais est un défi qui commence ou s'achève. Rien d'autre — ni les films des autres, ni un rappel de revenir. Le réglage vaut pour cet appareil seulement.",
      },
      challenges: {
        title: "Se lancer quelque chose",
        body: "Une liste plus une période fait un défi. Personne ne coche « vu » : l'avancement se calcule depuis votre journal de séances, et le serveur n'en tire qu'un nombre — vos dates ne sortent pas d'ici.",
      },
      quiz: {
        title: "Et se poser des questions",
        body: "Un défi mesure ce qu'on regarde ; un quizz mesure ce qu'on croit savoir. On vous en donne un, vous y répondez quand vous voulez, et les scores se comparent entre invités. Une réponse posée ne se reprend pas, et un quizz terminé ne se rejoue pas.",
      },
      counter: {
        title: "Et le comptoir, au bout",
        body: "Un défi bouclé, un quizz joué, une liste qu'on fait vivre : tout cela se compte. Le comptoir dit ce que vous avez gagné, devant qui vous vous situez, et ce que vous pouvez en faire — un tampon à porter, une pochette à ouvrir. Rien de tout cela n'existe sans compte, et votre vidéothèque n'en a pas besoin.",
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
