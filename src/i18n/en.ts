/* ============================================================
   THE ENGLISH CATALOGUE
   ============================================================

   It mirrors `fr.ts` key for key — the parity test refuses anything else.
   What it does NOT do is translate word for word: the French says
   "papier kraft, encre sépia, fil rouge" and the English says the same
   thing to an English ear, which is not the same words.

   The house voice carries over: concrete nouns, no exclamation marks, and
   a sentence that says what a thing IS rather than what it does.
   ============================================================ */

const en = {
  common: {
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    copy: "COPY",
    copied: "COPIED",
    loading: "loading…",
    none: "none",
  },

  account: {
    wipePartly: "Part of it could not be erased. Close the binder's other tabs and try again.",
    wipeMine: "Start from nothing",
    wipeTitle: "Erase everything, and keep the account?",
    wipeBody:
      "Your cards, your documents, your lists, your challenges, your quizzes, your decors, your subscriptions and your whole counter go for good — here and on the server. Your pseudonym and your access keys stay: you will not have to sign in again. The people you have blocked stay blocked, and your reports stay too.",
    wipeAction: "ERASE EVERYTHING",
    wipeFailed: "Nothing could be erased.",
    appearOnBoard: "Appear on the board",
    boardNobody: "NOWHERE",
    boardFollowers: "THOSE WHO FOLLOW ME",
    boardEveryone: "EVERYONE",
    boardNobodyNote: "You are on nobody's board. You always see yourself, with your true rank.",
    boardFollowersNote: "Your pseudonym shows up for the people who follow you, and nowhere else.",
    boardEveryoneNote:
      "Your pseudonym may appear on the world's board. That is not the same as showing your collection, hence the separate setting.",
    title: "Your account",
    signedInNote: "Your collection is found again on your other devices.",
    signedOutNote:
      "An account is what finds your collection elsewhere. The binder works perfectly well without one.",
    sync: "Synchronisation",
    syncNow: "Synchronise now",
    never: "not yet",
    justNow: "just now",
    minutesAgo: "{{count}} minutes ago",
    hoursAgo_one: "{{count}} hour ago",
    hoursAgo_other: "{{count}} hours ago",
    noServer: "No server set.",
    noServerShort: "no server",
    allStaysHere: "Everything stays here.",
    running: "Under way…",
    upToDate: "Up to date, {{when}}.",
    unreachable: "Server out of reach. Nothing to send, nothing lost.",
    pending_one: "{{count}} card is waiting for the network.",
    pending_other: "{{count}} cards are waiting for the network.",
    refused: "The server refused.",
    cancelled: "Gesture called off.",
    failed: "That did not work.",
    handle: "Handle",
    passkeyNote:
      "No password: your telephone or your computer signs in your place, with whatever already unlocks it.",
    signUp: "CREATE AN ACCOUNT",
    signIn: "I ALREADY HAVE ONE",
    signOut: "SIGN OUT",
    yourData: "Your data",
    takeEverything: "TAKE EVERYTHING",
    exportFailed: "The export failed.",
    deleteTitle: "Erase your account?",
    deleteBody:
      "The copy of your collection on the server is erased, along with your passkeys and your sessions. Your binder stays whole on this device — but your other devices will synchronise no longer.",
    deleteAction: "ERASE THE ACCOUNT",
    deleteMine: "ERASE MY ACCOUNT",
    deleteFailed: "The erasure failed.",
    footer:
      "Your whole collection is copied onto your account, notes and viewings included. Nothing is public: sharing is decided card by card, and will never carry your notes away.",
    silenced: "Those you have silenced",
    unblock: "GIVE THE VOICE BACK",
    unblockOne: "Give {{pseudo}} their voice back",
    unblockNote:
      "Their reviews will show under the cards again. You will not be following them for all that — blocking undid the link, and undoing the block does not tie it again.",
    reminders: "Reminders",
    notificationsDenied:
      "This browser refused notifications. That is reopened in its site settings, not here.",
    remindStart: "REMIND ME OF MY CHALLENGES",
    remindStop: "STOP REMINDING ME",
    remindNote:
      "A challenge starting, a challenge ending — nothing else will ring you. The setting holds for this device only.",
    showCollection: "Show my collection",
    shareNobody: "NOBODY",
    shareLink: "BY LINK",
    shareEveryone: "EVERYBODY",
    shareDefaultNote: "By default, nobody sees your collection.",
    shareNobodyNote: "Nobody. Links already given are worth nothing now.",
    shareEveryoneNote: "Whoever knows your handle.",
    shareLinkNote: "Whoever holds the link. It cannot be guessed, and is cut whenever you like.",
    shareNeverNote: "Your notes and your viewing log are never shown.",
    mediaCors:
      "Your posters and screenshots are not going out: the browser refuses the upload before even sending it. A CORS rule on the Azure container is almost always what is missing — allow the site's origin in PUT and GET. Your images stay whole on this device meanwhile.",
    mediaRefused:
      "The container refused the upload ({{detail}}). A 403 most often comes from a clock that has drifted: the signature is dated. Your images stay whole on this device.",
    mediaPullRefused:
      "The posters and screenshots made on your other devices could not be fetched back ({{detail}}). A 429 means the server refused the traffic, not that the images are lost: they are whole on the container, and the next opening will try again.",
    usage: "Space on our side",
    usageMedia: "posters and stills mirrored",
    usageDecors: "decoration objects filed",
    usageNote:
      "These ceilings only cover what the server hosts. Your binder itself has no limit: filing, rating, searching, importing and exporting stay unbounded and account-free.",
    devices: "My devices",
    devicesNote:
      "A passkey does not travel: this computer's stays in it. Add your telephone's here — then on another computer choose “another device” when signing in, and scan the code it shows.",
    addDevice: "ADD A DEVICE",
    addingDevice: "waiting for the device…",
    deviceThisOne: "this device",
    devicePhone: "telephone or key",
    deviceAdded: "Device added.",
    deviceNamePlaceholder: "my telephone",
    forgetDevice: "REMOVE",
    forgetDeviceOne: "Remove {{device}}",
    deviceSeen: "used {{when}}",
    deviceNeverSeen: "never used",
    addThisDevice: "Register THIS machine's key",
    pairMake: "GIVE A CODE TO ANOTHER COMPUTER",
    pairNote:
      "On localhost each computer is a domain of its own, so the telephone's key is of no use there. A code crosses that — it is worth your account for seven days.",
    pairMadeNote:
      "Type it on the other computer, under “Coming from another machine”. It lasts seven days and works once. Over there, register that machine's own key afterwards, and the code has no further use.",
    pairClaimTitle: "Coming from another machine",
    pairClaim: "ENTER",
    pairClaimNote:
      "The code is asked for from the computer already signed in, under “My devices”. Your collection, your shelf and your objects will follow at the first synchronisation.",
    deviceLastNote: "Your last key cannot be removed: without it, nothing opens this account.",
  },

  tmdbKey: {
    title: "TMDB key",
    kicker: "TMDB KEY",
    note: "it opens the Discoveries, the posters, the crew cards and the wake — it stays on your machine, it goes nowhere",
    field: "YOUR KEY (API KEY V3)",
    placeholder: "paste it here",
    trying: "trying…",
    tryAndSave: "Try it and save",
    works: "it works",
    unknown: "TMDB does not recognise this key.",
    failedWith: "Failed: {{error}}. Wrong key, or TMDB out of reach.",
    offline: "Cannot reach TMDB — are you online?",
    whereFrom:
      "a key is free: TMDB account → Settings → API. Without one the binder works entirely — only the enrichment and the proposals from outside go quiet.",
    relayServes:
      "Your server already provides TMDB while you are signed in: this key will only be used once you sign out, or if the server is down.",
    remove: "take the key off this machine",
    missing: "No TMDB key — to be set at the foot of the tab rail.",
  },

  search: {
    films: "Films",
    people: "In the credits",
    motifs: "Motifs",
    threads: "Threads",
    pages: "Notebook",
    placeholder: "a title, a name, a motif, a word you wrote yourself…",
    fieldLabel: "Search the whole binder",
    escape: "ESC",
    prompt:
      "Two letters are enough. The question goes to the films, the people in the credits, the motifs, the threads and the notebook pages — all at once.",
    nothing: "Nothing by that name in the binder.",
    untitled: "Untitled",
    filmCount_one: "{{count}} film",
    filmCount_other: "{{count}} films",
    carriedBy_one: "{{count}} card carries it",
    carriedBy_other: "{{count}} cards carry it",
    onNoCard: "on no card",
  },

  roles: {
    réalisation: "directing",
    interprétation: "acting",
    image: "cinematography",
    musique: "music",
    scénario: "screenwriting",
    thème: "theme",
  },

  wake: {
    namedLink: "{{link}} — {{value}}",
    andMore: "{{start}}, + {{more}}",
    link: {
      cinematography: "same cinematographer",
      music: "same composer",
      directing: "same director",
      writing: "same writer",
      motif: "shared motif",
      theme: "shared theme",
      keyword: "shared subject",
      actor: "billed in both",
      crowd: "watched by the same people",
    },
    more: {
      motif_one: "{{count}} motif",
      motif_other: "{{count}} motifs",
      keyword_one: "{{count}} shared subject",
      keyword_other: "{{count}} shared subjects",
      theme_one: "{{count}} theme",
      theme_other: "{{count}} themes",
      actor_one: "{{count}} billed name",
      actor_other: "{{count}} billed names",
      other_one: "{{count}} other",
      other_other: "{{count}} others",
    },
    afar: {
      named: "{{link}} {{value}}",
      two: "{{first}} · {{second}}",
      andCount: "{{two}}, + {{count}}",
      cinematography: "same cinematographer,",
      music: "same composer,",
      directing: "same director,",
      writing: "same writer,",
      actor: "with",
      motif: "same motif",
      theme: "same theme",
      keyword: "same subject",
      crowd: "watched by the same people",
    },
  },

  import: {
    oneFileAtATime: "one file at a time, in the order given below",
    whichFiles: "WHICH FILES TO DROP",
    zipNote: "Letterboxd delivers a zip: unzip it, then drop these files one by one.",
    file: {
      watched: "every film watched — the base of the collection",
      ratings: "your ratings; completes the cards already created",
      diary: "each viewing, one by one: this is what counts the watches",
      watchlist: "your wishes; lands in the “To watch” tab",
    },
    orderNote:
      "The order matters little, but watched.csv first avoids forgetting the films watched without a rating. diary.csv is the only one carrying a line per viewing: it is where the watch count and the drift of your ratings come from. Nothing is ever duplicated — run the files through as often as you like.",
    orReadProfile: "OR READ YOUR PROFILE",
    profileNote:
      "With no file, straight from your public profile. “Viewings” returns only your last fifty: enough to keep the collection up to date, not enough to build it. “Watchlist” reads the whole of it, page after page.",
    letterboxdHandle: "Letterboxd handle",
    handlePlaceholder: "your-handle",
    viewings: "VIEWINGS",
    watchlist: "WATCHLIST",
    page: "PAGE {{done}}/{{total}}",
    relayNote:
      "Letterboxd forbids reading its feed from another site: a middleman goes and fetches it for you. The default one is a public service — it may slow down or vanish. {url} is replaced by the feed's address. Locally this setting is of no use: the development server relays it itself.",
    noUsableRow: "No usable row found in this file.",
    feedEmpty: "This feed contains no viewing.",
    keyValid: "key valid",
    keyRefused: "key refused",
    linesRead: "lines read",
    distinctFilms: "distinct films",
    withRating: "with a rating",
    withoutRating: "without a rating",
    rewatchesGrouped: "rewatches grouped",
    linesWithoutTitle: "lines with no title, ignored",
    unreadableCsv: "This CSV file cannot be read.",
    emptyWatchlist: "This watchlist is empty.",
    tmdbApiKey: "TMDB API key",
    pasteKeyHere: "paste your key here",
    tmdbNote:
      "Letterboxd exports neither the director nor the posters. TMDB finds both (free key at themoviedb.org).",
    replaceLogNote:
      "Ordinarily the logs complete each other, and nothing is lost. Ticked, the log of the films named is replaced by this one: that is what is needed to erase a viewing too many, and it is also what erases the viewings added by hand.",
    directorsFound: "directors found",
    filmsNotIdentified: "films not identified",
    finished: "IMPORT FINISHED",
    seeThem: "GO AND SEE THEM",
    asWatched: "films watched",
    queried: "{{done}} / {{total}} queried…",
    created: "cards created",
    updated: "cards updated",
    unchanged: "already up to date, unchanged",
  },

  letterboxd: {
    noHandle: "Give your Letterboxd handle first.",
    relaySilent: "The relay did not answer. It may be out of service — see “relay”.",
    notAFeed:
      "The answer is not a Letterboxd feed. Check the handle, or the relay if you have set one.",
    notAWatchlist:
      "This page does not have the shape of a Letterboxd watchlist. Check the handle, that the profile is public, or the relay if you have set one.",
    feedStatus: "The feed answered {{status}}. Is the handle the right one?",
    watchlistStatus:
      "The watchlist answered {{status}}. Is the handle the right one, and the profile public?",
  },

  complete: {
    title: "COMPLETE THE CARDS FROM TMDB",
    toComplete: "cards to complete",
    alreadyUpToDate: "cards already up to date",
    noKeywords: "cards with no TMDB keywords",
    allFull: "Everything is already filled in — nothing to ask TMDB for.",
    intro:
      "Goes and fetches the cast, the crew, the running time, the country, the language and the keywords of the cards that have none. The keywords are what lets a film's wake bring two cards together other than by their crew's names. Nothing is written before you have seen the detail.",
    asking: "{{done}} / {{total}} asked…",
    running: "UNDER WAY…",
    completeN: "COMPLETE {{count}} CARD(S)",
    reaskHint: "Asks for the keywords again, including for cards that came back empty",
    reaskKeywords: "ASK FOR THE KEYWORDS AGAIN ({{count}})",
    writeChanges: "WRITE THE {{count}} CHANGES",
    needsKey:
      "Something is needed to ask TMDB: a key, above — or an account, which does away with it.",
    noAnswer: "TMDB did not answer.",
    done_one: "{{count}} card completed.",
    done_other: "{{count}} cards completed.",
  },

  repair: {
    title: "FIND CARDS MOVED BY MISTAKE",
    ticked: "ticked",
    intro:
      "An earlier version of “complete the cards” moved the cards it enriched to “watched”. Those cards have no viewing, no date, no rating and no text: nobody has ever opened them, they were probably wishes. Probably only — read the list again, a film watched and never written about looks just like one",
    tickAll: "TICK EVERYTHING",
    untickAll: "UNTICK EVERYTHING",
    putBackN: "PUT {{count}} CARD(S) BACK IN “TO WATCH”",
    confirmTitle: "Put {{count}} card(s) back in “to watch”?",
    confirmBody:
      "They leave the library for the To watch tab. Nothing is erased: notes, motifs and threads stay attached, and a card put back moves over again in one click from its folder.",
    confirmAction: "PUT BACK IN “TO WATCH”",
    done_one: "{{count}} card put back in “To watch”.",
    done_other: "{{count}} cards put back in “To watch”.",
  },

  backup: {
    title: "POSTER VAULT AND BACKUP",
    postersStored: "posters filed in the store",
    spaceUsed: "space taken",
    mediaWaiting: "media waiting to be sent",
    note: "Everything is stored on this machine, stills at their original quality. Export now and then: clearing the browser's data would erase the collection.",
    preparing: "preparing…",
    downloaded_one: "backup of {{count}} card downloaded.",
    downloaded_other: "backup of {{count}} cards downloaded.",
    vaultLabel: "the browser's word",
    vaultKept: "keeps the binder",
    vaultFragile: "may erase the binder",
    vaultNote:
      "By default a browser reserves the right to reclaim this space — after a few weeks without a visit, or when the disk fills up. Asking costs one click and settles it.",
    vaultAsk: "ASK IT TO KEEP THE BINDER",
  },

  film: {
    year: "Year",
    director: "Director",
    themes: "Themes (commas)",
    themesPlaceholder: "Memory, Solitude",
    firstImpression: "First impression",
    pinToWall: "PIN THIS CARD TO THE WALL",
  },

  facts: {
    title: "TMDB RECORD",
    refresh: "refresh",
    refreshHint: "ask TMDB for this card again",
    unknownTitle: "TMDB does not know this title.",
    filledIn_one: "{{count}} field filled in.",
    filledIn_other: "{{count}} fields filled in.",
    nothingMore: "TMDB gives nothing more than what is already here.",
    runtime: "RUNNING TIME",
    country: "COUNTRY",
    language: "LANGUAGE",
    tmdbRating: "TMDB RATING",
    cast: "CAST",
    keywords: "KEYWORDS",
    tmdbId: "TMDB ID",
  },

  link: {
    noFilmByThatTitle: "TMDB knows no film by that title.",
    fetching: "fetching the card…",
    linkedTo: "linked to “{{title}}”{{year}}.",
    noIdentifier: "no identifier — the card is linked to nothing",
    searchPlaceholder: "title to look for",
    replacesNote:
      "choosing replaces the crew, the running time, the country, the rating and the keywords — your words, your notes and your viewings do not move",
  },

  identity: {
    found: "found: {{title}}{{year}}",
  },

  poster: {
    noneFound: "No poster found for this film.",
    couldNotSave: "This image could not be saved.",
    pasteHint: "right-click a poster → “copy image address”, then Enter",
  },

  watchlog: {
    removeOne: "Remove this viewing",
    removeOneOn: "Remove the viewing of {{date}}",
  },

  lists: {
    deleteChosen_one: "Erase {{count}} card",
    deleteChosen_other: "Erase {{count}} cards",
    deleteTitle_one: "Erase {{count}} card?",
    deleteTitle_other: "Erase {{count}} cards?",
    deleteBody:
      "They leave your video library with their posters, their notes and their screening log. What sits in a list or a challenge is filed there by its TMDB identifier only: that does not move.",
    deleteAction: "ERASE",
    filed: "filed",
    alreadyThere: "was already there",
    fileIn: "File in a list",
    fileThis: "File this film in a list",
    fileThese_one: "File {{count}} film",
    fileThese_other: "File {{count}} films",
    filedCount_one: "{{count}} filed",
    filedCount_other: "{{count}} filed",
    allAlreadyThere: "they were already there",
    filingFailed: "The filing failed.",
    creationFailed: "The list could not be created.",
    newListPlaceholder: "a new list…",
    createAndFile: "Create the list and file into it",
    strangers_one:
      "{{count}} film stays out: it has no TMDB identity, and a list holds works, not copies.",
    strangers_other:
      "{{count}} films stay out: they have no TMDB identity, and a list holds works, not copies.",
    noneFileable_one:
      "This film has no TMDB identity: complete it from the Import tab and it will be able to join a list.",
    noneFileable_other:
      "None of these {{count}} films has a TMDB identity: complete them from the Import tab and they will be able to join a list.",
    select: "CHOOSE",
    stamp: "CHOSEN",
    selectDone: "DONE",
    selected_one: "{{count}} film chosen",
    selected_other: "{{count}} films chosen",
    selectNone: "Touch the posters you want to file.",
    search: "SEARCH",
    searchPlaceholder: "a title to add…",
    searchNote: "Search TMDB: a list can hold a film your binder does not have yet.",
    searching: "searching…",
    searchNobody: "TMDB finds nothing by that title.",
    searchNeedsKey: "Searching needs a TMDB key — it is set at the foot of the tab rail.",
    add: "ADD",
    added: "added",
  },

  elsewhere: {
    at: "at {{pseudo}}’s",
    muteSomebody: "See nothing more from {{pseudo}}",
    filedBy_one: "{{count}} library files it",
    filedBy_other: "{{count}} libraries file it",
    reportPrompt: "What is wrong with what {{pseudo}} wrote?",
    reported: "reported — we will read it",
  },

  sharing: {
    hide: "TAKE OUT OF THE SHARING",
    hidden: "TAKEN OUT OF THE SHARING",
    shownNote:
      "It appears in your shared collection, with its rating and your review. Your loose notes and your viewing log never leave.",
  },

  credits: {
    stamp: "CREDITS",
    intro:
      "The names your collection already carries — those who directed, acted, lit, scored, wrote. {{count}} in all.",
    gone: "This person appears on no card any more.",
    namePlaceholder: "a name…",
    regularsOnly: "regulars only",
    passingThrough: "+ {{count}} passing through",
    noNames:
      "No names yet. Complete your cards through TMDB, from the Import tab, and the credits will fill themselves in.",
    nobodyByThatName: "Nobody by that name.",
    nobodyAmongRegulars:
      "Nobody in that capacity among the regulars — open “passing through” to see the rest.",
    nobodyInThatRole: "Nobody in that capacity.",
    backToCredits: "the credits",
    filmCount_one: "{{count}} film",
    filmCount_other: "{{count}} films",
    loyalties: "Your loyalties",
    loved: "Those you rate highest",
    newcomers: "Recently arrived",
    whatIHaveOf: "what I have of {{name}}",
    yourRating: "YOUR RATING",
    whatRecurs: "What recurs",
    /* NOT "who comes back with them". On somebody you hold in two
       films, everybody is met once: a heading promising recurrence,
       followed by a list of single meetings, lies. The ranking still
       puts the real loyalties first when there are any. */
    companions: "Met on their cards",
    noCompanion: "Nobody else is named on their cards.",
    gapToPublic: "GAP TO THE PUBLIC",
    inAgreement: "in agreement",
    gentlerBy: "gentler by {{points}}",
    harsherBy: "harsher by {{points}}",
    gapToYou: "GAP TO YOUR AVERAGE",
    inAgreementToYou: "your average",
    gentlerByToYou: "above by {{points}}",
    harsherByToYou: "below by {{points}}",
    personIntro_one: "{{roles}} — {{count}} film in your house",
    personIntro_other: "{{roles}} — {{count}} films in your house",
    ofWhichWaiting: ", of which {{count}} waiting",
    seen: "Watched",
    waiting: "Waiting",
    whatIsMissing: "What I am missing",
    missingNote:
      "Their full filmography, minus what you already hold. Nothing is added without you.",
    askTmdb: "ask TMDB",
    tmdbNobody: "TMDB knows nobody by that name.",
    tmdbDown: "TMDB unavailable ({{error}}).",
    missingCount_one: "{{count}} film you do not have — in that capacity.",
    missingCount_other: "{{count}} films you do not have — in that capacity.",
    nothingMissing: "Nothing is missing: you hold everything TMDB knows of them.",
    yearUnknown: "year unknown",
    inWatchlist: "in To watch",
    addToWatchlist: "+ to watch",
  },

  walls: {
    sort: {
      watched: "recently watched",
      added: "added",
      addedShort: "added",
      title: "A–Z",
      year: "year",
      rating: "rating",
      director: "director",
    },
    watched: {
      stamp: "CATALOGUE",
      title: "Your library",
      subtitle: "a wall of posters, notes and memories of viewings",
      emptyTitle: "The wall is still bare",
      emptyBody: "Pin your first film to begin the collection.",
    },
    watchlist: {
      stamp: "TO WATCH",
      title: "The wishes corner",
      subtitle: "the films set aside, waiting for an evening",
      emptyTitle: "Nothing waiting yet",
      emptyBody: "Import your Letterboxd watchlist, or pin a film “to watch”.",
    },
  },

  library: {
    search: "Search",
    searchPlaceholder: "a title, a filmmaker…",
    genre: "Genre",
    decade: "Decade",
    sort: "Sort",
    arrange: "File",
    clickToReverse: "click to reverse",
    rewritesArrangement: "Rewrites this view's arrangement",
    presentation: "Presentation",
    wall: "WALL",
    shelf: "SHELF",
    byDirector: "BY DIRECTOR",
    byDirectorAdd: "+ BY DIRECTOR",
    oneRowPerDirector: "One row and one case per director",
    unknownDirector: "Director unknown",
    shelfWood: "SHELF WOOD",
    decor: "Decor",
    decorStudio: "DECOR WORKSHOP…",
    decorHint: "Paint the wall, change the shelves' material",
    wallStudio: "WALL WORKSHOP…",
    wallStudioHint: "Paint the wall, set the size and the disorder of the cards",
    setAside_one: "{{count}} film set aside — see the shelf",
    setAside_other: "{{count}} films set aside — see the shelf",
    nothingToShow: "Nothing to show",
    tryAnotherSearch: "Try another search.",
    emptyImport: "IMPORT FROM LETTERBOXD",
    emptyAdd: "PIN A FILM",
  },

  almanac: {
    emptyTitle: "No dated viewing yet.",
    emptyBody:
      "The almanac fills itself as soon as a card carries a date — by noting a viewing on a card, or by reading your log from the import tab.",
    plate1: "The count and the rhythm",
    plate2: "The tastes",
    plate3: "The people and the world",
    plate4: "The subjects and the craftspeople",
    previousPeriod: "previous period",
    nextPeriod: "next period",
    previousPlate: "previous plate",
    nextPlate: "next plate",
    orArrows: "or the keyboard arrows",
    exportHint: "An image of this year, to keep or to show",
    yearInABox: "the year in a box",
    developing: "developing…",
    exportFailed: "failed — try again",
    nothingToNote: "nothing to note",

    viewings: "VIEWINGS",
    daysInARow: "DAYS IN A ROW",
    fromTo: "from {{from}} to {{to}}",
    theYears: "The years",
    theMonths: "The months",
    daysWithViewing: "Days with a viewing",
    ofThePeriod: "Of the period",
    ofTheYear: "Of the year",
    oneEvery: "one viewing every {{days}} days",
    hoursOfCinema: "The hours of cinema",
    inFrontOfAScreen: "IN FRONT OF A SCREEN",
    noRuntimes:
      "no running time known — the “complete the cards” button, in the Import tab, goes and fetches them",
    atLeast_one: "at least — {{count}} viewing with no running time known",
    atLeast_other: "at least — {{count}} viewings with no running time known",

    noRatedViewing: "no rated viewing",
    noRatedViewingThisYear: "no rated viewing this year",
    starViewings_one: "{{stars}} ★ — {{count}} viewing",
    starViewings_other: "{{stars}} ★ — {{count}} viewings",
    agreeWithPublic: "in agreement with the public, over {{count}} viewings",
    gentlerThan: "gentler than the public by {{points}} point(s), over {{count}} viewings",
    harsherThan: "harsher than the public by {{points}} point(s), over {{count}} viewings",
    noReleaseYear: "no release year on record",
    median: "Median",
    yearsOld_one: "{{count}} year",
    yearsOld_other: "{{count}} years",
    decadesVisited: "The decades visited",
    ratedViewings_one: "{{count}} rated viewing",
    ratedViewings_other: "{{count}} rated viewings",
    changedMind: "What changed its mind",
    noDrift: "no score moved between two viewings",
    allYearsTogether: "all years together — one does not think again in twelve months",

    filmmakers: "The filmmakers",
    loyalties: "The loyalties",
    loyaltiesAndFinds: "Loyalties and discoveries",
    metAgain: "MET AGAIN",
    discovered: "DISCOVERED ({{count}})",
    worldCrossed: "The world crossed",
    noCountry:
      "no country on record — “complete the cards”, in the Import tab, goes and fetches them",
    countriesCrossed: "COUNTRIES CROSSED",

    noKeyword: "no keyword — “complete the cards”, in the Import tab, goes and fetches them",
    noMotif: "no motif set — they are chosen on a card, under the review",
    craftspeople: "The craftspeople",
    noRecurringCrew:
      "nobody comes back twice behind the camera — “complete the cards”, in the Import tab, fills the crews in",
    gentlerHarsher: "Gentler, harsher",
    noPublicScore: "no rated viewing whose public score is also known",
    youOutOfTen: "YOU, OUT OF 10",
    thePublic: "THE PUBLIC",
    yourIndulgences: "YOUR INDULGENCES",
    yourSeverities: "YOUR SEVERITIES",
  },

  yearInBox: {
    title: "THE YEAR IN A BOX",
    viewings_one: "viewing",
    viewings_other: "viewings",
    films_one: "film",
    films_other: "films",
    rewatches_one: "rewatch",
    rewatches_other: "rewatches",
    onAverage: "on average",
    ofCinema: "of cinema",
    mostWatched: "Most watched this year: {{name}}.",
    aYearOfViewings: "A year of viewings, kept by hand.",
    decade: "the {{decade}}s",
    averageAge: "{{years}} years old on average",
    signature: "CINÉ HUB · personal archive",
    couldNotDraw: "the image could not be produced",
  },

  reco: {
    allLanguages: "all",
    obscurity: "Degree of obscurity",
    gem: "gem",
    changeOfScene: "Change of scene",
    withinMyTastes: "within my tastes",
    to: "To",
    tmdbRatingAtLeast: "TMDB rating ≥",
    genresSought: "Genres sought",
    genresSetAside: "Genres set aside",
    nothingComesBack:
      "Nothing comes back with these settings — widen the years or lower the minimum rating.",
    needsKey:
      "Looking for films outside asks for a key — it stays in this browser and also serves to complete the cards.",
    needsKeyWithHome:
      "The proposals above come from your collection and need nothing. To look for some outside, a key is needed — it stays in this browser and also serves to complete the cards.",
  },

  shared: {
    heading: "{{pseudo}}'s video library",
    opening: "Opening…",
    count_one: "{{count}} film — watched, rated, filed by somebody else.",
    count_other: "{{count}} films — watched, rated, filed by somebody else.",
    noCollection: "No collection at this address. The link may have been closed again.",
    couldNotOpen: "This collection could not be opened.",
  },

  skinLab: {
    typedLabel: "Typed label",
    underlinedField: "an underlined field",
  },

  athome: {
    rewatch: "Worth seeing again",
    years_one: "{{count}} year",
    years_other: "{{count}} years",
    months_one: "{{count}} month",
    months_other: "{{count}} months",
    reason: {
      rewatch: "{{stars}}★ in your house, and not seen again for {{since}}",
      motif_one: "{{count}} film carries this motif, and nothing for {{since}}",
      motif_other: "{{count}} films carry this motif, and nothing for {{since}}",
      director_one: "{{count}} film in your house, {{average}}★ on average, nothing for {{since}}",
      director_other:
        "{{count}} films in your house, {{average}}★ on average, nothing for {{since}}",
    },
  },

  tonight: {
    fits: "{{minutes}} min — that fits",
    overruns: "{{minutes}} min, which is {{over}} too many",
    runtime: "{{minutes}} min",
    unknownRuntime: "running time unknown",
    genreYouLike: "a genre you like: {{genre}}",
    waiting_one: "waiting for {{count}} year",
    waiting_other: "waiting for {{count}} years",
  },

  install: {
    title: "The binder fits on your home screen",
    appleBefore: "Tap ",
    appleAfter:
      " at the bottom of Safari, then “Add to Home Screen”. It will open full screen, and even with no network.",
    body: "It then opens full screen, with no address bar, and even with no network.",
    action: "INSTALL",
    dismiss: "Set aside",
  },

  update: {
    title: "A new version is ready",
    body: "It will lay itself down on the next reload. Nothing you have filed moves.",
    action: "RELOAD",
  },

  /* The key lives inside the machine and does not leave it. Said without
     drama and without jargon: neither "passkey" nor "WebAuthn", which
     name nothing to somebody who has just made an account with a
     fingertip. */
  /* Two pieces of news, two sentences. "It is filling up" leaves time to
     act; "the write failed" means what is on screen is not on the disk,
     which is not the same conversation. */
  quota: {
    title: "The storage space is filling up",
    body: "About {{megabytes}} MB used of the 5 the browser grants.",
    fullTitle: "The storage space is full",
    fullBody:
      "Your last change could NOT be written: it is on screen, not on the disk. Take a backup away before closing this tab.",
    advice:
      "Posters brought in from your own disk are the heaviest: prefer an image address, or TMDB enrichment, which only file a link.",
    action: "EXPORT A BACKUP",
    dismiss: "Dismiss this warning",
  },

  loneDevice: {
    title: "Your account only lives on this device",
    body: "The key that opens it is locked inside this machine: it cannot be copied, and it cannot be recovered. Add a second one, on a phone, while this one still works.",
    action: "ADD A DEVICE",
    dismiss: "Dismiss this warning",
  },

  demoBinder: {
    films: {
      chihiro: {
        title: "Spirited Away",
        genres: "Animation, Fantasy, Adventure",
        themes: "childhood, work",
        review:
          "Seen again ten years on, and it is the train over the water that stays — not the monsters. The calmest film ever made about growing up.",
      },
      mulholland: {
        title: "Mulholland Drive",
        genres: "Thriller, Mystery, Drama",
        themes: "cinema, dreams",
        review:
          "The blue box is not explained, it is undergone. It took me three viewings to stop looking for the key, and that is where the film began.",
        notes: "Watch again thinking of Persona. The Silencio scene alone is worth the trip.",
      },
      mood: {
        title: "In the Mood for Love",
        genres: "Romance, Drama",
        themes: "renunciation",
        review:
          "Two people who never touch, and the whole film is a caress. The slow motion on the staircase, every time.",
      },
      "jour-sans-fin": {
        title: "Groundhog Day",
        genres: "Comedy, Fantasy, Romance",
        themes: "repetition",
        review:
          "The best comedy ever made about the idea that one only becomes somebody by wearing down.",
      },
      alien: {
        title: "Alien",
        genres: "Horror, Science fiction",
        themes: "space, the body",
        review:
          "A film of corridors. Everything frightening is off screen, and the only thing one really sees is how tired the people are.",
      },
      "blade-runner": {
        title: "Blade Runner",
        genres: "Science fiction, Thriller",
        themes: "memory, the artificial",
        review:
          "The closing monologue was written on set, and it is the finest thing in the film. The rain does the work of the score.",
      },
      "paris-texas": {
        title: "Paris, Texas",
        genres: "Drama",
        themes: "abandonment, the desert",
        review:
          "The peep-show scene holds for fifteen minutes on two voices and a pane of glass. Nothing I have seen since comes near it.",
      },
      "perfect-days": {
        title: "Perfect Days",
        genres: "Drama",
        themes: "routine, work",
      },
      "400-coups": {
        title: "The 400 Blows",
        genres: "Drama",
        themes: "childhood, school",
        review:
          "The freeze frame on the beach is the first film ending that refuses to conclude. All the rest of the New Wave comes out of it.",
      },
      samourai: {
        title: "Le Samouraï",
        genres: "Crime, Drama",
        themes: "solitude, the code",
        review:
          "Ten minutes without a word to open on. Melville films a ritual, not a trade — and Delon plays nothing, which is exactly what was needed.",
      },
      stalker: {
        title: "Stalker",
        genres: "Science fiction, Drama",
        themes: "faith, desire",
        review:
          "Three men walk towards a room that grants wishes, and none of them dares go in. The film lasts as long as it takes to understand why.",
        notes:
          "Watched tired, to be seen again on a Sunday morning. The sepia passage on the way back went past me.",
      },
      portrait: {
        title: "Portrait of a Lady on Fire",
        genres: "Romance, Drama, History",
        themes: "the gaze, painting",
        review:
          "A film about what it is to be looked at in return. The last shot holds on a face and an opera, and that is enough.",
      },
    },
    threads: {
      0: "The same man, three years later, and already the whole question: what is alive, and what merely looks it.",
      1: "Forty years between the two, and the same gesture: filming a man who says nothing until the silence says something.",
      2: "Two loves that hold entirely in what one does not dare do, and two last images that refuse to close.",
      3: "Henri Decaë behind the camera on both. The same Paris, eight years apart: grey for a child running, grey for a man waiting.",
    },
    book: {
      title: "Do Androids Dream of Electric Sheep?",
      note: "The film keeps the question and throws the plot away. The novel, for its part, is a book about animals.",
    },
    note: {
      title: "What I am after just now",
      body: "Films that trust silence. Melville, Wenders, Sciamma in the second half — every time, the scene that counts is the one where nobody speaks.\n\nTo follow: the cinematographers rather than the directors. Decaë comes back twice without my having looked for him.",
    },
  },

  demo: {
    title: "These twelve films are not yours",
    body: "An example, laid down so you have something to handle. Keep it while you look around, bring your own films in over it, or start from an empty binder.",
    import: "IMPORT MY FILMS",
    remove: "START FROM AN EMPTY BINDER",
  },

  /* The texts a public address has to carry. The order of the privacy
     section states the doctrine: what does NOT leave first, because that
     is the product's promise and the first thing people come to check. */
  legal: {
    title: "Legal and terms",
    since: "in force since {{date}}",
    toFill: "to be filled in",
    incomplete:
      "These notices are incomplete: the publisher has not named itself yet. They must be completed before opening to the public.",
    publisher: "The publisher",
    hostedBy: "Hosting: {{host}}",

    privacy: "What we know about you",
    privacyLocal:
      "Your collection lives in your browser. Cards, notes, reviews, screenings, the arrangement of your walls and your posters only leave your machine if you open an account, and only so they can be copied onto our servers and handed back to you on your other devices. With no account, we know nothing of what you file.",
    privacyServer:
      "With an account, we keep a handle you choose, the access keys of your devices, the copy of your collection and documents, and whatever you publish willingly in the hall. No email address is asked for, and no password exists.",
    privacyMeasure:
      "We measure site traffic with an Umami instance we host ourselves: no cookie, no profile, and never a card identifier — a film's address is trimmed before being counted, so the measurement cannot learn what you own.",
    privacyRights:
      "At any time you can take away everything we hold, erase your account's data while keeping the account, or delete the account entirely: all three are in this drawer, and none of them touches what is on your machine.",

    terms: "The terms",
    termsFree:
      "The binder is free and stays free: filing, rating, searching, importing and exporting work offline, without an account, and will never be charged for.",
    termsPaid:
      "What is paid for is what we host — the mirror of your media, shared decors and the hall — because it costs us. Skins are bought with tokens earned by playing, and are not sold for money.",
    termsStop:
      "If you stop paying, nothing local is taken back from you: what goes dark is what lived on our side. A skin once bought is yours for good.",
    termsConduct:
      "In the hall, nothing illegal and nothing aimed at a person. An account used to harm may be closed, and you can block or report from the pages concerned.",
  },

  /* Undoing the last gesture. The title says WHAT WAS DONE, not "are you
     sure": the question no longer arises, the deed is done, and we only
     offer to come back on it. */
  undo: {
    film: "Card deleted",
    films_one: "{{count}} card deleted",
    films_other: "{{count}} cards deleted",
    demo: "The example has been taken away",
    body: "You can go back on this for a few seconds.",
    action: "UNDO",
    dismiss: "Keep the deletion",
  },

  language: {
    title: "Language",
    close: "Close the language picker",
    open: "The binder's language",
    fr: "Français",
    en: "English",
    frNote: "le classeur dans sa langue d'origine",
    enNote: "the binder, in English",
  },

  orphanViews: {
    discard: "DELETE FOR GOOD",
    discardTitle_one: "Delete {{count}} view for good?",
    discardTitle_other: "Delete {{count}} views for good?",
    discardBody:
      "They leave this device and the server, really this time — which is what deletion did not know how to do. Your films do not move: a view is only an arrangement.",
    none: "No shelf view to take back",
    noneBlurb:
      "Nothing is lying about on this device. If you know some remain on the server — deleted here before deletion knew how to travel — you can ask for them again.",
    refetch: "ASK THE SERVER FOR THE VIEWS",
    refetchTitle: "Ask for the shelf views again?",
    refetchBody:
      "The binder will pull down every view the server holds, including the ones you deleted here. They will then appear in this list, to tick or to leave. Nothing else is touched.",
    title_one: "{{count}} shelf view found again",
    title_other: "{{count}} shelf views found again",
    blurb:
      "They are there, but nothing listed them — a fault since fixed, which left a deleted view lying about instead of going. Tick the ones you want back; the others stay where they are, and you can come back.",
    unnamed: "Unnamed view",
    action: "TAKE BACK",
    confirmTitle_one: "Take {{count}} view back?",
    confirmTitle_other: "Take {{count}} views back?",
    confirmBody:
      "They come back at the end of their wall, and are deleted afterwards like any view.",
  },

  views: {
    library: "Library",
    watchlist: "To watch",
    credits: "Credits",
    reco: "Discoveries",
    constellation: "Constellation",
    almanac: "Almanac",
    import: "Letterboxd import",
    thread: "The feed",
    lists: "Lists and challenges",
    quiz: "Quizzes",
    counter: "The counter",
    skinlab: "Skins ⚙",
  },

  /* The rail's three families. A group is named after what it HOLDS,
     never after the verb one does in it. */
  groups: {
    binder: "The binder",
    explore: "Explore",
    hall: "The hall",
  },

  notebook: {
    title: "The notebook",
    stamp: "NOTEBOOK",
    subtitle: "free thoughts, belonging to no film in particular",
    add: "ADD THE PAGE",
    titlePlaceholder: "Title of the note",
    bodyPlaceholder: "Write freely…",
    untitled: "Untitled",
    empty: "the notebook is waiting for its first page…",
  },

  counter: {
    tally: "{{merit}} merit, {{tokens}} tokens — open the counter",
    heading: "The counter",
    subheading: "what one has earned, what one does with it, and in front of whom",
    noServer: "No server is set: a counter is a place one shares, and there is nobody here.",
    noAccount:
      "It takes an account — the button at the foot of the rail. Your video library does not need one.",
    merit: "Merit",
    tokens: "Tokens",
    standing: "{{place}}th on the board",
    ladder: {
      world: "the world",
      friends: "those I follow",
      empty: "Nobody here yet.",
      closed:
        "You do not appear on the world's board. That is set in the account drawer, beside sharing.",
    },
    shop: {
      sell: "RETURN ({{price}})",
      sellNote:
        "Reserved to the role: gives the item back and refunds you, to run through the shop again.",
      title: "The display case",
      stamp: "Stamps",
      pack: "Packets",
      skin: "Skins",
      power: "Powers",
      buy: "{{price}} tokens",
      owned: "Owned",
      wear: "wear",
      takeOff: "take off",
      short_one: "you are {{count}} token short",
      short_other: "you are {{count}} tokens short",
    },
    items: {
      "stamp-habitue": "The regular",
      "stamp-noctambule": "The night owl",
      "stamp-premiere-seance": "First screening",
      "stamp-projectionniste": "The projectionist",
      "pack-trois": "A packet of three",
      "power-halve": "Set two answers aside",
      "power-redo": "Take a question back",
      "power-extend": "Push a challenge back",
    },
    album: {
      title: "The sheet",
      opened: "The packet opens",
      close: "Put away",
    },
  },

  stamps: {
    habitue: "regular",
    noctambule: "night owl",
    "premiere-seance": "1st screening",
    projectionniste: "projectionist",
  },

  stickers: {
    projecteur: "The projector",
    fauteuil: "The seat",
    bobine: "The reel",
    ticket: "The ticket",
    esquimau: "The ice cream",
    rideau: "The curtain",
    clap: "The clapperboard",
    cadran: "The dial",
    lanterne: "The lantern",
    palme: "The palm",
    nitrate: "The nitrate",
  },

  points: {
    challenge: "challenge completed",
    challenge_half: "challenge half way",
    challenge_joined: "somebody joined you",
    quiz: "quiz",
    quiz_flawless: "flawless",
    quiz_first: "first to finish",
    watch: "a screening",
    review: "a review",
    rating: "a rating",
    list_shared: "list shared",
    bank_question: "question given to the bank",
  },

  rail: {
    addFilm: "Pin a new film",
    searchAll: "Search everywhere",
    searchAllHint: "Search everywhere (Ctrl+K)",
    skin: "Change the skin of the site",
    tmdbKey: "The TMDB key",
    account: "Your account and synchronisation",
    help: "The guided tour",
  },

  surfaces: {
    paints: {
      platre: "Plaster",
      lin: "Linen",
      craie: "Chalk",
      ocre: "Pale ochre",
      terracotta: "Terracotta",
      rose: "Old rose",
      sauge: "Sage",
      eucalyptus: "Eucalyptus",
      ciel: "Faded sky",
      atelier: "Workwear blue",
      anthracite: "Anthracite",
      nuit: "Night",
    },
    patterns: {
      rayuresFines: "Fine stripes",
      rayuresLarges: "Wide stripes",
      quadrillage: "Grid",
      damier: "Chequerboard",
      pois: "Dots",
      chevrons: "Chevrons",
      ecailles: "Scales",
      fleurs: "Small flowers",
      tirets: "Dashes",
    },
    textures: {
      grain: "Grain",
      crepi: "Render",
      toile: "Canvas",
      beton: "Concrete",
    },
    materials: {
      chene: "Oak",
      noyer: "Walnut",
      teck: "Teak",
      ebene: "Ebony",
      bouleau: "Birch",
      ceruse: "Limed oak",
      merisier: "Cherry",
      acier: "Brushed steel",
      laiton: "Brass",
      noirMat: "Matt black",
      verre: "Glass",
      verreFume: "Smoked glass",
      beton: "Polished concrete",
      ardoise: "Slate",
      marbre: "Marble",
      blanc: "Lacquered white",
      vert: "Workshop green",
      bleu: "Midnight blue",
      rouge: "Garnet red",
      moutarde: "Mustard",
    },
    families: {
      bois: "Wood",
      metal: "Metal",
      verre: "Glass",
      pierre: "Stone",
      peint: "Painted",
    },
    finishes: {
      mat: "Matt",
      satine: "Satin",
      laque: "Lacquered",
    },
  },

  shelf: {
    woods: {
      kraft: "Kraft",
      noyer: "Walnut",
      ceruse: "Limed oak",
      nuit: "Night",
      atelier: "Workshop",
    },
    decor: {
      divider: "Divider",
      plant: "Houseplant",
      cactus: "Cactus",
      statuette: "Statuette",
      cat: "Ceramic cat",
      candle: "Candle",
      mug: "Mug",
      clock: "Alarm clock",
      books: "Stack of books",
      frame: "Photo frame",
      postcard: "Postcard",
      wallclock: "Wall clock",
      garland: "Garland",
      pennant: "Bunting",
      ivy: "Hanging ivy",
      tape: "Sticky tape",
    },
    unfiledFilms: "The films not filed yet",
    rowSettings: "Settings for this row",
    addCategoryHere: "+ a category here",
    addRow: "Add a row at the end of the shelf",
    closeDrawer: "Close the drawer",
    openSetAside: "Open the films set aside",
    close: "CLOSE",
    setAside: "SET ASIDE",
    toStand: "to stand",
    toHang: "to hang",
    toStandTitle: "TO STAND",
    toHangTitle: "TO HANG",
    categoryColour: "Colour of the category",
    noColour: "no colour",
    hidden: "hidden",
    nothingImported: "nothing imported yet",
    decorFrom: "from {{pseudo}}",
    decorShown: "shown to my friends",
    decorTake: "Take “{{label}}”",
    decorShow: "Show “{{label}}” to my friends",
    decorHide: "Stop showing “{{label}}”",
    cabinet: "CABINET OF CURIOSITIES",
    dragOntoShelf: "drag them onto a board, between two cases",
    dragToBack: "drag them to the back of the shelf, wherever you like",
    resetTilt: "Give the object back its original lean",
    category: "CATEGORY",
    undoCategory: "undo the category",
    nameThisDivider: "Click to name this divider",
    shelfAimed: "shelf aimed at: {{shelf}}",
    kinds: {
      bedside: {
        title: "Bedside films",
        tag: "the ones you watch again",
      },
      main: {
        title: "The collection",
        tag: "everything one keeps",
      },
      reserve: {
        title: "Set aside",
        tag: "kept, not thrown away",
      },
    },
  },
  wallStudio: {
    wallTab: "WALL",
    cardsTab: "CARDS",
    cardSize: "CARD SIZE",
    spacing: "SPACING",
    disorder: "DISORDER",
    untouched: "the wall is still as it was found",
    ownWall: "this wall belongs to this collection — the other keeps its own",
  },

  wallLook: {
    xl: "very large",
    tight: "tight",
    airy: "airy",
    tidy: "tidy",
    scattered: "scattered",
  },

  decorStudio: {
    material: "MATERIAL",
    fromTheme: "from the theme",
    reset: "Clear the decor and go back to the theme's wood",
  },

  stills: {
    notSynced: "This image stayed on the device that imported it: stills do not synchronise yet.",
    pasteHint: "Ctrl+V to paste · “insert” places the thumbnail where the cursor is",
    caption: "caption…",
    close: "close (Escape)",
    previous: "previous (←)",
  },

  motifs: {
    chooseMotifs: "CHOOSE MOTIFS",
    closeList: "CLOSE THE LIST",
    searchPlaceholder: "look for a motif…",
    noneByThatName: "no motif by that name",
    create: "create “{{name}}”",
    yourOwn: "YOUR OWN",
    newMotif: "New motif",
    newPlaceholder: "“it rains without stopping”, then Enter",
    familyOf: "Family of the motif",
    tellsTheEnding: "it gives the ending away",
    endingMotif: "ending motif",
    spoilerHint: "This motif gives the ending away — click to read it",
    suggestedByTmdb: "SUGGESTED BY TMDB —",
    makeThread: "DRAW A THREAD",
    gatherAll: "Gather every film carrying “{{name}}”",
    removeOne: "Remove “{{name}}”",
    deleteOne: "Delete the motif {{name}}",
    hideOne: "Set the motif {{name}} aside",
    putBack: "Put it back in the list",
    setAside: "SET ASIDE ({{count}})",

    families: {
      fate: "What happens to the characters",
      ending: "The last image",
      narrative: "The way it is told",
      figures: "The figures",
      tone: "The tone",
      world: "The world",
    },
    labels: {
      "hero-dies": "The hero dies",
      sacrifice: "He sacrifices himself",
      "everyone-dies": "Nobody gets out",
      "sole-survivor": "Only one gets out",
      "revenge-fulfilled": "The revenge comes off",
      "revenge-in-vain": "The revenge mends nothing",
      betrayal: "Betrayed by someone close",
      downfall: "The rise, then the fall",
      "impossible-love": "The love that cannot be",
      reunion: "Meeting again years later",
      confinement: "Shut in, literally",
      "loss-of-reason": "Reason going",
      grief: "Mourning someone close",
      flight: "On the run",
      "open-ending": "An open ending",
      "final-revelation": "Everything turns over at the end",
      "back-to-the-start": "Back where we began",
      "false-happy-ending": "A happy ending nobody believes",
      "final-freeze-frame": "A last shot that freezes",
      "distant-epilogue": "An epilogue years later",
      "non-linear-narrative": "Told out of order",
      "unreliable-narrator": "The narrator lies",
      "single-setting": "One room, no way out",
      "road-movie": "Road movie",
      "story-within-a-story": "A film inside the film",
      "voice-over": "Carried by a voice over",
      "real-time": "In real time",
      "time-loop": "The same day starting again",
      flashback: "Told from afterwards",
      "long-take": "Long unbroken takes",
      "literary-adaptation": "Out of a book",
      "ensemble-film": "An ensemble piece",
      chapters: "Cut into chapters",
      mockumentary: "A false documentary",
      "lost-mentor": "The mentor one loses",
      "wrong-man": "The wrong man",
      "child-witness": "A child watching",
      siblings: "A story of brothers and sisters",
      "absent-father": "The absent father",
      "mismatched-duo": "An ill-matched pair",
      "group-falling-apart": "A gang coming apart",
      "artist-at-work": "Somebody making something",
      "authority-figure": "The institution as adversary",
      ghost: "A dead man who stays",
      "the-double": "The double",
      unease: "Unease",
      melancholy: "Melancholy",
      contemplative: "Contemplative",
      slapstick: "Slapstick",
      irony: "Cold irony",
      tenderness: "Tenderness",
      fever: "Fever, everything too fast",
      sensuality: "Sensuality",
      paranoia: "Paranoia",
      dreamlike: "Dreamlike",
      "sprawling-city": "The big city swallowing it",
      "stifling-countryside": "The stifling countryside",
      "crushing-summer": "A crushing summer",
      winter: "Winter, the snow",
      sea: "The sea",
      "the-night": "It happens at night",
      "near-future": "A future close at hand",
      "after-the-end": "After the end of the world",
      "war-in-the-background": "The war, in the background",
      "world-of-work": "Work, really shown",
      "family-single-setting": "The family house",
      exile: "Far from home",
    },
  },

  palette: {
    families: {
      warm: "Warm",
      golden: "Golden",
      cool: "Cool",
      green: "Green",
      neutral: "Neutral",
    },
  },
  relations: {
    echo: "echoes",
    diptych: "forms a diptych with",
    "same-fate": "shares a fate with",
    answers: "answers",
    "answered-by": "was answered by",
    adapts: "adapts",
    "adapted-into": "was adapted by",
    "sequel-to": "follows on from",
    precedes: "comes before",
    "remake-of": "remakes",
    "remade-by": "was remade by",
    strength1: "a slender thread",
    strength2: "a real kinship",
    strength3: "the same film, twice",
  },

  threads: {
    linkedCard: "linked card",
    workKind: "Kind of work",
    resonance: "the resonance between the two",
    saveHint: "Save (Enter)",
    cancelHint: "Give up (Escape)",
    cardDeleted: "card deleted",
    rewriteNote: "Rewrite the note — the title belongs to the linked card",
  },

  detail: {
    reviewPlaceholder: "Write here, freehand…",
    notesPlaceholder: "Scenes, quotations, fragments…",
    keywords: "Keywords",
    motifOnNoCard: "This motif is set on no card.",
    setAsideTitle: "Set this card aside?",
    setAsideBody:
      "It leaves the wall and the constellation, without being destroyed — it goes back on the shelf whenever you like.",
    setAsideAction: "set aside",
    deleteBody:
      "The card, its notes, its stills and its threads go with it. Nothing can be caught back — “set aside” files without destroying.",
    searchCollection: "Search the collection",
    workTitle: "Title of the work",
    title: "Title",
    titleOnWallOrFree: "a title already on the wall, or a free title",
    toWatchTag: "to watch",
    noFurtherDetail: "— no further detail —",
    resonance: "The resonance between the two",
  },

  wakePanel: {
    setAside: "set aside",
    setAsideDone: "set aside",
    votes: "votes",
    unrated: "unrated",
  },

  tonightDrawer: {
    guessMood: "guess the mood of a film you have not written about yet",
    nothingAnswers: "Nothing in “to watch” answers — or the list is empty.",
    allReviewed: "You have been through them all.",
  },

  threadView: {
    heading: "The feed",
    subheading: "what the people you follow are watching",
    find: "Find somebody",
    pseudoPlaceholder: "their pseudonym",
    look: "LOOK",
    shown_one: "{{count}} film shown",
    shown_other: "{{count}} films shown",
    theirCollection: "THEIR COLLECTION",
    follow: "FOLLOW",
    unfollow: "UNFOLLOW",
    unfollowSomebody: "Stop following {{pseudo}}",
    youFollow: "You follow",
    closedAgain: "closed again",
    lately: "Lately, at theirs",
    opening: "Opening…",
    followNobody: "You follow nobody. Look up a pseudonym above.",
    nothingNew: "Nothing new at the people you follow.",
    at: "at {{pseudo}}",
  },

  listsView: {
    lastDays: "last days",
    settled: "Settled",
    extend: "PUSH BACK A WEEK",
    worth_one: "{{points}} points earned — {{count}} day left",
    worth_other: "{{points}} points earned — {{count}} days left",
    wasWorth: "{{points}} points, counted.",
    newList: "A new list",
    newListPlaceholder: "The films to have seen by March",
    open: "OPEN",
    fillNote:
      "Films are filed into it from their card, from a poster's badge, or by searching TMDB inside the open list.",
    yours: "Your lists",
    none: "No list yet.",
    loading: "asking the server…",
    noChallenges:
      "No challenge. A challenge is a list and a period: open a list above to start one.",
    empty: "Empty.",
    removeWork: "Remove from the list",
    public: "public",
    at: "at {{pseudo}}'s",
    noServer:
      "No server is set: lists and challenges are things one shares, and there is nobody to share them with.",
    noAccount:
      "It takes an account — the button at the foot of the rail. Your video library does not need one.",
    nobodyToInvite: "Nobody to invite under “{{pseudo}}”.",
    challenges: "The challenges",
    inviteSomebody: "invite somebody to write",
    startChallenge: "Start a challenge on this list",
    deleteChallenge: "Erase this challenge",
    upcoming: "upcoming",
    finished: "finished",
    running: "under way",
    heading: "Lists and challenges",
    subheading: "what one gives oneself to watch, alone or together",
    invite: "INVITE",
    removeMember: "Remove {{pseudo}}",
    publicNote: "visible to the people who follow you",
    deleteList: "Erase this list",
    challengePlaceholder: "March with Varda",
    launch: "START",
    join: "JOIN",
    leave: "LEAVE",
    noParticipants: "Nobody has joined yet.",
    works_one: "{{count}} film",
    works_other: "{{count}} films",
    fromList: "after “{{title}}”",
  },

  quizView: {
    right: "correct",
    wrong: "to revisit",
    outOf: "out of {{weight}} points",
    power: {
      halve: "set two aside",
      redo: "take back",
    },
    heading: "The quizzes",
    subheading: "what one thinks one knows, dealt at random and put to friends",
    newQuiz: "Compose a quiz",
    newQuizPlaceholder: "Saturday night's quiz",
    baskets: "Out of which categories",
    levelLabel: "Level",
    sizeLabel: "Length",
    deal: "DEAL",
    dealNote:
      "The questions are drawn at random from the categories ticked, dosed by level: there is always a bit of everything. The deal is frozen — the people you invite get exactly the same ones.",
    thinBank:
      "These categories hold only {{available}} playable questions for the {{size}} asked: the quiz will be shorter.",
    bankEmpty: "The bank is empty for now. There is nothing to deal.",
    softened:
      "The bank was short of questions at the level asked for: this one was filled up from the neighbouring level.",
    yours: "The ones you dealt",
    noneDealt: "No quiz dealt yet.",
    given: "The ones you were given",
    noneGiven: "Nobody has invited you to a quiz yet.",
    by: "by {{pseudo}}",
    questionCount_one: "{{count}} question",
    questionCount_other: "{{count}} questions",
    done: "finished",
    underway: "started",
    untouched: "to do",
    difficulty: {
      easy: "easy",
      normal: "middling",
      hard: "hard",
    },
    difficultyLabel: "Difficulty",
    worth: "{{n}} pt",
    points_one: "{{count}} point",
    points_other: "{{count}} points",
    progress: "{{done}} of {{total}}",
    noTakingBack:
      "An answer once laid down is not taken back — unless a power is spent on it, once.",
    allAnswered: "Every question is answered.",
    finish: "FINISH",
    finishNote: "Finishing uncovers the corrections, and closes the quiz for good.",
    overForYou: "That is done. It is not played again.",
    yourScore: "{{score}} out of {{weight}}",
    gotIt: "right · {{points}}",
    missedIt: "missed · it was “{{answer}}”",
    scores: "The scores",
    nobodyPlayed: "Nobody has touched it yet.",
    stillPlaying: "under way",
    players: "Who plays",
    nobodyYet: "Nobody yet. A quiz is seen only by those one invites.",
    invite: "INVITE",
    invitePlaceholder: "a pseudonym",
    removePlayer: "Remove this person",
    nobodyToInvite: "Nobody to invite under “{{pseudo}}”.",
    deleteQuiz: "Erase this quiz",
    tendBank: "TEND THE BANK",
    bankNote:
      "The categories and their questions. This is the stock everybody draws from — you do not compose quizzes here, you make them possible.",
    newCategory: "A new category",
    newCategoryPlaceholder: "New Wave, Hitchcock, posters…",
    addCategory: "ADD",
    noCategories: "No category. That is where it starts.",
    deleteCategory: "Erase this category",
    noQuestions: "No question in this category.",
    addQuestion: "Add a question",
    editQuestion: "Edit this question",
    removeQuestion: "Withdraw this question",
    needsOneRight: "one right answer only",
    retired: "withdrawn",
    retiredNote:
      "It has already been dealt into a quiz: it is no longer offered, but it stays readable there. A score already made is not rewritten.",
    revive: "Put it back into circulation",
    choicesFrozen:
      "The wording is corrected. The propositions do not move any more: somebody has already answered this question.",
    ask: "The question",
    askPlaceholder: "Who directed Cléo from 5 to 7?",
    choices: "The propositions",
    choicePlaceholder: "Proposition {{n}}",
    markRight: "This is the right one",
    removeChoice: "Remove this proposition",
    addChoice: "one more proposition",
    hint: "The explanation",
    hintPlaceholder: "Shown once the answer is in",
    image: "The picture",
    imagePlaceholder: "https://… or bank/<id>/…",
    save: "SAVE",
    cancel: "CANCEL",
    noServer: "No server is set: a quiz is played together, and there is nobody to play it with.",
    noAccount:
      "It takes an account — the button at the foot of the rail. Your video library does not need one.",
  },

  constellation: {
    aFilm: "film",
    aThread: "thread",
    aWork: "work",
    mapFocus: "focus of the map",
    linkCount_one: "{{count}} link",
    linkCount_other: "{{count}} links",
    withCrews: "your threads, and the kinships found in the credits",
    byHandOnly: "only what you linked by hand — grab a star to move it",
    followCrews: "FOLLOW THE CREWS",
    dottedNote:
      "dotted: somebody shared by two or three films. Click a dotted line to pin it — it becomes a real red thread.",
    fedBy: "fed by “{{motif}}”",
    handmadeThread: "thread written by hand",
    whereToBegin: "Where to begin",
    whereToBeginNote:
      "choose a film — the map will show only it and its neighbours, and you will move on from one to the next",
    showWholeSky: "OR SEE THE WHOLE SKY, AS IT IS",
    focus: "FOCUS",
    goBack: "← BACK ({{count}})",
    widen: "WIDEN",
    narrow: "NARROW",
    changeStart: "CHANGE THE STARTING POINT",
    clickHint: "a click moves the focus · a double-click opens the card",
    jumpTo: "jump to another film…",
    noneCarryThose: "None of the linked films carries those keywords — widen the selection.",
    nothingLinkedYet:
      "Open a film, go down to the “red thread” and link it to a book, a painting or another film. Only linked films appear here.",
    tally: "{{films}} LINKED FILM(S) · {{threads}} THREAD(S)",
    tallyCrews: " · OF WHICH {{count}} BY THE CREWS",
    tallyTotal: " · {{count}} LINKED IN ALL",
    mapLabel:
      "Sky map — arrows to move from one star to another, Enter to open it, Escape to let go",
  },

  linkTypes: {
    book: "Book",
    painting: "Painting",
    film: "Film",
    other: "Another work",
  },

  skins: {
    price: "{{price}} tokens",
    short_one: "{{count}} token needed",
    short_other: "{{count}} tokens needed",
    carnet: { label: "Archivist's notebook", note: "kraft paper, sepia ink, a red thread" },
    veilleuse: { label: "Night light", note: "the same notebook, read after dark" },
    cinematheque: {
      label: "Cinematheque",
      note: "red velvet, gilding, the screen still black",
    },
    bauhaus: { label: "Bauhaus", note: "three primary colours and not one more" },
    "nuit-americaine": {
      label: "Day for night",
      note: "daylight shot for night, through a blue filter",
    },
    kodachrome: { label: "Kodachrome", note: "a slide left forgotten in its box" },
    herbier: { label: "Herbarium", note: "dried plates, handwritten labels" },
    bleu: { label: "Architect's blue", note: "white lines on ozalid paper" },
    pulp: { label: "Pulp", note: "a dog-eared paperback, loud orange, yellowed paper" },
    fanzine: { label: "Fanzine", note: "a botched photocopy: black, white and one red" },
    pastel: { label: "Pastel", note: "everything round, everything soft" },
    japon: { label: "Japanese paper", note: "indigo, off-white, one red seal" },
    sepia: { label: "Sepia", note: "a photograph looked at too often" },
    affiche: { label: "Polish poster", note: "greyish paper, three inks knocking together" },
    nitrate: { label: "Nitrate", note: "film stock warming, night all around" },
    "drive-in": { label: "Drive-in", note: "neon on a windscreen, a summer evening" },
    cinemascope: { label: "Cinemascope", note: "two black bars, and everything else wider" },
  },

  tour: {
    ui: {
      skip: "skip",
      back: "back",
      next: "NEXT",
      finish: "DONE",
      menuTitle: "THE GUIDED TOUR",
      globalNote: "the tour of the binder, from one tab to the next — {{count}} steps",
      thisPage: "This page",
      pageNote_one: "{{name}} — {{count}} step",
      pageNote_other: "{{name}} — {{count}} steps",
      noPageTour: "this page has no tour of its own",
      keys: "the keyboard arrows leaf through, Escape closes",
      hintKicker: "THE TOUR",
      hintBody: "It is waiting for you at the foot of the tabs, under the “?”.",
      hintReplay: "take it now",
      dismissHint: "Dismiss this reminder",
    },

    library: {
      label: "The library",
      search: {
        title: "Searching",
        body: "A title, a filmmaker, a word from your own review. On the wall, the search filters; on the shelf, it dims what it cannot find and leaves the arrangement standing. To search beyond the films — people, motifs, threads, the notebook — the magnifier, at the foot of the rail or at the end of the bottom bar, asks everything at once.",
      },
      mode: {
        title: "The wall or the shelf",
        body: "Two ways of looking at the same collection: a wall of pinned posters, or cases filed in rows that you move by hand.",
      },
      sort: {
        title: "Sorting, or filing",
        body: "On the wall, sorting is a passing state. On the shelf, filing is a gesture: it rewrites the arrangement once, then steps aside. Clicking the same verb again turns the row around.",
      },
      filters: {
        title: "The sieves",
        body: "Genres and decades stack up: two sieves laid one on the other. Clicking a lit label again takes it off.",
      },
      views: {
        title: "Named views",
        body: "On the shelf, each view is a filing of its own: its rows, its categories, its wood, its decor. You keep several, and “by director” builds one in a click.",
      },
      decor: {
        title: "The workshop",
        body: "The wall can be painted, and the cards have a gauge. On the shelf, the same button is called “Decor workshop” and lives in the views menu: the decor belongs to the view, not to the row.",
      },
      open: {
        title: "A card opens",
        body: "Click a poster to open its folder: that is where the review, the motifs and the red thread are kept.",
      },
      drag: {
        title: "Filing with a finger",
        body: "On the shelf and on the wall, you move things by dragging. With a finger, hold the object down for a moment: it takes hold, and swiping stops scrolling. A marker shows the slot it will fall into.",
      },
      file: {
        title: "Filing into a list, without opening the card",
        body: "Move the hand over a poster: a badge appears at the top right, and it opens the choosing of a list. With a finger, hold the poster down. You can make the list on the way — no need to go and open one elsewhere first.",
      },
      choose: {
        title: "Several films at once",
        body: "“Choose” changes what a click does: posters tick instead of opening, and a bar at the foot files the whole selection into the same list. Films with no TMDB identity stay out, and the bar says so rather than passing over them.",
      },
      notebook: {
        title: "The notebook",
        body: "Free pages, belonging to no film: an idea, a list to make, what you said to each other on the way out. They open as a drawer from this bar, are found again by the search that crosses everything, and leave with the backup.",
      },
    },

    watchlist: {
      label: "To watch",
      waiting: {
        title: "What is waiting",
        body: "The same wall, but films you have not seen yet. Open a card and the “I’VE SEEN IT” button moves it into the library, opening its viewing log.",
      },
      tonight: {
        title: "Which one tonight?",
        body: "The question the pile never knew how to hear. Say how much time you have and what state you are in: the binder decides, says why, and “another one” steps down a notch. This button exists only on this list — the library has already been watched.",
      },
      tools: {
        title: "The same tools",
        body: "Search, sieves, sorting, shelf and decor: this list is worked exactly like the library, and keeps settings of its own.",
      },
    },

    credits: {
      label: "The credits",
      standouts: {
        title: "Who counts, in your house",
        body: "Your loyalties, those you rate highest, and the names your latest cards brought in. Enough to arrive here without already having a name in mind.",
      },
      names: {
        title: "The names you already have",
        body: "Directing, acting, cinematography, music, screenwriting: these names have been asleep in your cards since the first import. Here they form a directory — and each one leads to what you hold of that person.",
      },
      roles: {
        title: "In what capacity",
        body: "The sieves stack up, as on the wall. By default the directory shows only those you meet at least twice — the rest are one click away, under “passing through”.",
      },
      page: {
        title: "What somebody is worth in your house",
        body: "Your average score on their films, their gap to your own average — above or below what you usually give — and your gap to the public score. Then their films, what keeps coming back in them, and since when.",
      },
      companions: {
        title: "Met on their cards",
        body: "A film-maker's cinematographer, an actor's director: the names you meet on their films, from the most frequent to the rarest. Each one opens its own folder — the credits can at last be walked through step by step.",
      },
      missing: {
        title: "What I am missing",
        body: "Their full filmography, minus what you hold: enough to send the absentees into “To watch” in a click. Appears only with a TMDB key laid down, from the Import tab.",
      },
    },

    detail: {
      label: "A film folder",
      catalog: {
        title: "The catalogue card",
        body: "What the film is: title, year, direction, genres, and everything TMDB reports. Every field is corrected in a click — it is the only way to catch up with a badly identified import. Names underlined with a dotted rule open their folder in the credits.",
      },
      watchlog: {
        title: "The viewing log",
        body: "One line per viewing, with its date and its score. It is what knows a film has been seen again four times, and what feeds the almanac.",
      },
      elsewhere: {
        title: "What is said elsewhere",
        body: "With an account open, the card shows what other public libraries say of the same film: their average — without yours — and their reviews. Each one can be reported, and its author silenced in one gesture — the account drawer lists those you have silenced, and gives them their voice back. With no server and no account, this section does not exist.",
      },
      sharing: {
        title: "Taking it out of the sharing",
        body: "A film you stand by at home without wanting it on display: that card, and only that one, leaves your shared collection. It stays on the wall, in the almanac and in the constellation — it is the outside that ignores it. Appears only with an account, and only if you are showing your collection to somebody.",
      },
      review: {
        title: "Your words",
        body: "The review and the loose notes. Stills dropped on the card slot into the text, where the cursor is.",
      },
      tags: {
        title: "Keywords and motifs",
        body: "The keywords are yours. The motifs are a shared vocabulary — “the hero dies”, “it rains at the end” — that a question can bear on, and that a thread can be drawn from.",
      },
      lists: {
        title: "Filing this film into a list",
        body: "Choose a list, or type a name to make one on the spot. A film with no TMDB identity is filed nowhere: a list holds works, not copies — the same card in somebody else's house would not be yours.",
      },
      identity: {
        title: "The right TMDB card",
        body: "The import keeps the first title it finds, and gets namesakes wrong — two “Resurrection”s are not the same film. Here you look for the real one and bind the card to it: crew, running time, country and keywords are rewritten, your words and your viewings do not move. The sign that betrays the error is a wake proposing the film you are already looking at.",
      },
      thread: {
        title: "The red thread",
        body: "Linking two films, and saying why: a shared motif, a lineage, an answer. These links are what the constellation draws.",
      },
      wake: {
        title: "In the wake",
        body: "Ten proposals per column, in three parts: four held by the people who made the films — same cinematographer, same composer, somebody billed in both —, four by what they talk about, shared motifs and subjects, and two by the crowd, “watched by the same people”. Each says why it is there. On the left your binder; on the right TMDB, which shows only what you do not have: click a proposal to read its summary without leaving the page, and set it aside with one button.",
      },
    },

    reco: {
      label: "The discoveries desk",
      home: {
        title: "Your own house first",
        body: "Before going looking outside: what your collection already holds and you have left aside. A film you had loved, a motif nothing has made you meet again, a filmmaker you have not opened since. None of this leaves the browser, and no key is needed.",
      },
      dials: {
        title: "Two dials",
        body: "“Degree of obscurity” runs from the mainstream to the gem. “Change of scene” runs from your proven tastes to what steps outside them. All the rest of the order form is only fine-tuning.",
      },
      order: {
        title: "The order form",
        body: "Years, language, minimum score and vote count, genres sought or set aside. The proposals come from TMDB, read through what your collection already says about you.",
      },
    },

    constellation: {
      label: "The constellation",
      start: {
        title: "Where to begin",
        body: "The map does not open on two hundred stars: you choose a film, it composes around it, and you move on from neighbour to neighbour.",
      },
      teams: {
        title: "Following the crews",
        body: "The second layer: dotted, the people shared by several films. Click a dotted line to pin it — it becomes a real red thread.",
      },
      threads: {
        title: "The threads",
        body: "A thread peoples the sky instead of narrowing it: it brings its members in, linked or not. That is what you get by drawing a thread from a motif, on a card.",
      },
      keyboard: {
        title: "The map from the keyboard",
        body: "The map can be crossed without a mouse: a tab enters it, the arrows go from one star to the nearest one in their direction, Enter takes it as the focus — or opens its card when it already is — and Escape lets the cursor go.",
      },
    },

    almanac: {
      label: "The almanac",
      year: {
        title: "One year, or ever",
        body: "The almanac reads the viewing log: it counts only real viewings, at their date, and not the date the cards were added. “EVER”, at the top, opens the same report on your whole practice — the twelve months become your years there.",
      },
      plates: {
        title: "Four plates",
        body: "The count, the tastes, the people, then the subjects. The keyboard arrows leaf through. The last plate says what your films were about — keywords and motifs —, which cinematographers and composers you follow without knowing it, and on exactly which titles you are gentler or harsher than the crowd.",
      },
      export: {
        title: "The year in a box",
        body: "An image of the year, to keep or to show. It is the only thing here that leaves the browser. It is built around a vintage: on “ever”, the button fades away.",
      },
    },

    import: {
      label: "Import and archives",
      drop: {
        title: "The docket",
        body: "Letterboxd delivers a zip: drop its CSVs one by one. watched.csv first, diary.csv for the viewings. Nothing is ever duplicated — run the files through as often as you like.",
      },
      feed: {
        title: "Or read the profile",
        body: "With no file, straight from your public profile: recent viewings to keep the collection up to date, the whole watchlist page after page.",
      },
      complete: {
        title: "Completing the cards",
        body: "Letterboxd exports neither director nor poster: TMDB finds both. The key is free, and stays in this browser.",
      },
      repair: {
        title: "Undoing a wrong move",
        body: "Appears only if there is something to undo: the “seen” cards with no viewing, no score and no text, which were probably wishes. To be ticked one by one — the list proposes, you decide.",
      },
      backup: {
        title: "The backup",
        body: "Everything lives in this browser, and nowhere else — which is also where it can be lost: clearing the site data erases the collection, and a browser left alone for weeks may reclaim the space itself. Ask it to keep the binder, and take a backup away now and then.",
      },
    },

    thread: {
      label: "The feed",
      find: {
        title: "Finding somebody",
        body: "You search by handle, and you find only people who have chosen to show their collection. There is no directory: this binder is not a social network, and nobody appears in it without having wanted to.",
      },
      follows: {
        title: "Those you follow",
        body: "Following is a gesture made alone and undone alone: nobody accepts, nobody is told. If somebody closes their collection again, they stay on the list — their feed goes quiet, and will speak again if they reopen.",
      },
      news: {
        title: "What they are watching",
        body: "Films recently touched by the people you follow, with their score and their review. Never their private notes nor their viewing log — no more than yours leave here.",
      },
    },

    lists: {
      label: "Lists and challenges",
      extend: {
        title: "Pushing back",
        body: "A power bought at the counter, spent here: seven more days, twice at most, and only within the week after the end. One pushes back, one does not resurrect — and a challenge already settled cannot be extended, or the board would describe a period nobody was measured over.",
      },
      new: {
        title: "Opening a list",
        body: "A list holds works and not your cards: it therefore means the same thing in somebody else's house, and does not empty the day you erase a film. You file into it from the card, from a poster's badge, or from here.",
      },
      mine: {
        title: "Yours, and the shared ones",
        body: "Each list opens in a click. You can invite somebody to write in it: they add and remove films, they do not rename the list and do not erase it. Closed by default — making it visible is a tick box.",
      },
      search: {
        title: "Pouring in a film you have not got",
        body: "Search TMDB from the open list: that is the whole point of holding works rather than copies. “Come and see this in March” is said about films one has precisely not got yet — from a card alone, those could never be proposed.",
      },
      challenges: {
        title: "A challenge is a list and a period",
        body: "A list and a period make a challenge: one asks to take part, and the binder counts by itself what each has seen in time. Nobody ticks “seen”. A challenge carried through earns points at the counter — half of one earns less, and under half earns nothing.",
      },
    },

    quiz: {
      label: "The quizzes",
      powers: {
        title: "The powers",
        body: "Bought at the counter, spent here. Setting two wrong answers aside always gives back THE SAME two if you ask again — otherwise one would pay once and peel the question bare. Taking back clears your answer to that question, once only, and the retake stays marked for the other players. With no power, this bar does not exist.",
      },
      compose: {
        title: "Dealing a quiz",
        body: "One does not write them, one deals them: tick some categories, a level, a length, and the questions come at random out of the bank. The mix is fixed — a hard quiz keeps a couple of easy ones to breathe, an easy one keeps a sting — and two quizzes of the same level and length weigh the same number of points. That is what makes two scores comparable.",
      },
      bank: {
        title: "The bank",
        body: "It is reserved: if this button is here, you may fill it. Categories, and inside them questions classed easy, middling or hard — the points follow the difficulty, they are not typed in. You do not compose quizzes here: you make them possible, for everybody.",
      },
      mine: {
        title: "The ones you dealt",
        body: "You did not write them, so you play them like anybody else: no preview of the answers, and a real score on the board. This is where you invite your friends — the deal is frozen, they get exactly your questions, in the same order.",
      },
      given: {
        title: "The ones you were given",
        body: "Open one and it begins. You answer whenever you like, over as many sittings as you like. An answer once laid down is not taken back — unless a power bought at the counter is spent on it, once per question, and the retake stays marked for the other players. Once finished it is not played again.",
      },
      playing: {
        title: "One question at a time",
        body: "The category and the points are announced before the question. The right answer only comes down once the quiz is finished — it is not hidden on screen, it is not in the server's reply. Finishing uncovers the corrections, and the explanations with them.",
      },
      players: {
        title: "Who plays",
        body: "One invites by pseudonym, as for a list. There is no public leaderboard: the scores you compare are those of the people you invited, and a block wins in both directions.",
      },
      scores: {
        title: "The scores",
        body: "Nothing is stored: the score is recomputed from the answers, every time. The bar reads against what the whole quiz is worth, not against the best score — otherwise an evening where everybody floundered would look like a triumph. A pale bar is somebody who has not finished. Finishing a game earns its score in merit, and fifteen more for a flawless run.",
      },
    },

    counter: {
      label: "The counter",
      purse: {
        title: "What you have earned",
        body: "Two counters on one ticket. Merit adds up and never goes down: it is what ranks you. Tokens are the same figure, minus what you spend here — so buying something never costs you a place. One earns by finishing challenges, playing quizzes, keeping one's binder, and making other people's lists live.",
      },
      ladder: {
        title: "In front of whom",
        body: "“Those I follow”: the people you follow, and you. The world's board only appears if you have agreed to be on it — that is set in the account drawer, beside sharing. You always see yourself, even at the very bottom, and a block removes on both sides.",
      },
      shop: {
        title: "The display case",
        body: "Stamps to wear beside your pseudonym, packets of stickers, extra skins, and powers to spend during a game. Something too dear stays on the shelf and tells you what is missing. The binder's fourteen skins stay free and work with no account: what is sold here comes on top.",
      },
      album: {
        title: "The sheet",
        body: "Eleven stickers, drawn by hand, dealt by the server — reloading the page does not re-open a packet. The empty squares show what is missing without showing what it is, and doubles are counted: they are what one swaps.",
      },
    },
    global: {
      label: "Full tour",
      welcome: {
        title: "Welcome to the binder",
        body: "A few minutes to go round: the tabs, what is behind each of them, and the gestures that cannot be guessed. You can leave whenever you like — we will tell you where to pick up.",
      },
      rail: {
        title: "The spine of the binder",
        body: "Eight tabs, always there: on the left edge at a desk, laid along the bottom of the screen on a telephone, where the thumb reaches them. Each is a different way of looking at the same collection; hover over one — or press and hold — to read its name.",
      },
      addFilm: {
        title: "Pinning a film",
        body: "By hand, without going through the import: the pin opens a blank card. It sits at the foot of the rail at a desk, at the end of the bottom bar on a telephone.",
      },
      searchAll: {
        title: "Searching everywhere",
        body: "One question put to the whole binder at once: the films, the people in the credits, the motifs, the threads and the notebook pages. It searches right into your reviews, and shows you the passage. Ctrl+K opens it too.",
      },
      skin: {
        title: "The skin of the site",
        body: "Fourteen skins: the ground, the colours, the typefaces, the tabs. Your cases and the decor of your shelves keep their colours — those are your choices, not the skin.",
      },
      language: {
        title: "French or English",
        body: "The binder reads in both languages, and the choice stays on this device: read in French on the telephone, in English at the desk, without one imposing on the other. What you have written — your notes, your reviews, your motifs — does not move: it is yours, not the product's.",
      },
      install: {
        title: "Laying it on the home screen",
        body: "Installed, the binder opens full screen, with no address bar, and works with no network — your films are at home, not on a server. On iPhone it is Share, then “Add to Home Screen”.",
      },
      account: {
        title: "Finding your collection elsewhere",
        body: "An account links this binder to your other devices: what you file here is found there, and the other way round — the films, but also the arrangement of your shelves and the pages of your notebook. With no password: it is your telephone or your computer that signs.",
      },
      sharing: {
        title: "Showing your library",
        body: "In that same drawer: nobody, by secret link, or everybody. The link cannot be guessed and is cut whenever you like. A visitor sees your films, your numbered scores and your reviews — never your notebook nor your viewing log. And a single card is set apart, from its folder, under the catalogue card.",
      },
      devices: {
        title: "The same account on another computer",
        body: "A passkey does not travel: this machine's stays in it. In that same drawer, “My devices” registers your telephone's — then on any other computer, choose “another device” when signing in and scan the code it shows. Nothing to type, nothing to copy out.",
      },
      reminders: {
        title: "Being reminded of your challenges",
        body: "Still in that drawer: the only thing that will ever ring you is a challenge starting or ending. Nothing else — neither other people's films, nor a nudge to come back. The setting holds for this device only.",
      },
      challenges: {
        title: "Setting yourself something",
        body: "A list and a period make a challenge. Nobody ticks “seen”: progress is computed from your viewing log, and the server draws only a number from it — your dates do not leave here.",
      },
      quiz: {
        title: "And asking each other things",
        body: "A challenge measures what one watches; a quiz measures what one thinks one knows. You are given one, you answer whenever you like, and the scores are compared among the people invited. An answer once laid down is not taken back, and a finished quiz is not played again.",
      },
      counter: {
        title: "And the counter, at the end",
        body: "A challenge finished, a quiz played, a list one keeps alive: all of it counts. The counter says what you have earned, where you stand, and what you may do with it — a stamp to wear, a packet to open. None of this exists without an account, and your video library does not need one.",
      },
      tmdbKey: {
        title: "The TMDB key",
        body: "It is optional: the binder works entirely without it. Laid down, it opens the Discoveries, the posters, the crew records and a film's wake — and it stays on your machine. An account does away with it entirely: the server then keeps its own, and you have nothing to ask anybody. Wherever one is missing, the screen tells you and brings you back here.",
      },
      replay: {
        title: "Playing the tour again",
        body: "This button reopens it whenever you like, in full or only for the page you are on. Happy collecting.",
      },
    },
  },
} as const;

export default en;
