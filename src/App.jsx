import {
  useState,
  useSyncExternalStore,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { pruneOrphans } from "./db";
import { CAT_KEYS } from "./shelf-views";
import { C, F, FONT_IMPORT } from "./theme/tokens";
import { applySkin, loadSkinKey, saveSkinKey } from "./theme/applySkin";
import { skinOf } from "./theme/skins";
import { paperLayer } from "./theme/surfaces";
import { wornPaper, watchWorn } from "./theme/owned";
import { Boundary } from "./components/ui/Boundary";
import i18n, { loadLanguage, setLanguage } from "./i18n";
import { uid, migrate, editLinkedWork } from "./domain/film";
import { normalize } from "./domain/search";
import { inverseOf, strengthOf } from "./domain/relations";
import {
  makeThread,
  normalizeThreads,
  isPlainDefault,
  countOfMotif,
  STAR_FROM,
} from "./domain/threads";
import { motifById, makeCustomMotif, customMotifs } from "./domain/motifs";
import { loadThreads, saveThreads as saveThreadsToDisk } from "./services/threads";
import {
  loadBonds,
  loadCourses,
  saveBonds as saveBondsToDisk,
  saveCourses as saveCoursesToDisk,
  saveCoursesSoon as saveCoursesToDiskSoon,
} from "./services/lineage";
import { normalizeBonds } from "./domain/bonds";
import { normalizeCourses } from "./domain/course";
import { loadVocabulary, saveVocabulary, normalizeVocabulary } from "./services/motifs";
import { store, KEYS, watchQuota, hydrateVault } from "./services/storage";
import { loadFilms, knownCollection, saveFilms, forgetCache } from "./services/collection";
import { PaperGrain } from "./components/atmosphere";
import { FilmModal } from "./components/film/FilmModal";
import { useTranslation } from "react-i18next";
import { NotebookPen } from "lucide-react";
import { FolderTabs, SubTabs, groupOf } from "./components/layout/FolderTabs";
import { NotebookDrawer } from "./components/layout/NotebookDrawer";
import { useViewport } from "./hooks/useViewport";
import { usePointerDrag } from "./hooks/usePointerDrag";
import { SkinPicker } from "./components/layout/SkinPicker";
import { LanguagePicker } from "./components/layout/LanguagePicker";
import {
  Installation,
  UpdateCard,
  LoneDeviceCard,
  QuotaCard,
  UndoCard,
} from "./components/layout/Installation";
import { AccountDrawer } from "./components/layout/AccountDrawer";
import { TmdbKeyPanel } from "./components/layout/TmdbKeyPanel";
import { registerTmdbOpener } from "./services/tmdbKey";
import { registerAccountOpener } from "./services/accountDoor";
import { useSync } from "./hooks/useSync";
import { useInstallation } from "./hooks/useInstallation";
/* The module only exists at build time: it is the plugin that makes it,
   with the address of the service worker it has just written. */
import { useRegisterSW } from "virtual:pwa-register/react";
import { SearchDrawer } from "./components/layout/SearchDrawer";
import { WALLS } from "./views/library/walls";
import { viewKey, saveViewIndex, deleteViewKey, ensureViews } from "./services/shelfViews";
import { LibraryView } from "./views/library/LibraryView";
import { DetailView } from "./views/DetailView";

import { useNotes } from "./hooks/useNotes";
import { useShelfViews } from "./hooks/useShelfViews";
import { countPlacedMotifs } from "./shelf-views";
import { saveSoon, dropSoon, noteWritten } from "./services/saving";
import { TourOverlay, TourHint, TourMenu } from "./components/tour";
import { shouldHint } from "./services/onboarding";
import { demoFilms } from "./services/demo";
import { Doorstep, Unreachable } from "./components/layout/Doorstep";
import { readPlace, placeToHash, HOME } from "./domain/address";
import { shortcutOf } from "./domain/keys";
import { startMeasuring, pageSeen, doorEvent } from "./services/measure";
import { mayNudge, noteNudge } from "./services/loneDevice";
import { markHallSeen, unseenNews } from "./services/hallNews";
import { feed } from "./hooks/useHall";
import { myKeys, whoAmI, demoPosters } from "./services/server";

/* ============================================================
   UNE VUE NE SE CHARGE QUE SI ON Y VA
   ============================================================

   Les treize vues étaient importées ici, donc rassemblées dans un seul
   paquet de neuf cent quarante kilo-octets, donc payées EN ENTIER au
   premier écran — l'almanach, la constellation et les quizz compris,
   par quelqu'un qui n'y mettra peut-être jamais les pieds. Sur un
   téléphone en 4G, c'est la vidéothèque qui attend le quizz.

   Deux restent en dur, et c'est délibéré : le classeur est ce qu'on
   ouvre, et la fiche est ce qu'on ouvre juste après. Les découper
   n'économiserait rien et ajouterait une attente au geste le plus
   fréquent de l'application.

   Les vues exportent leur composant sous leur nom et non par défaut ;
   `lazy` veut un `default`, d'où le petit passage de l'un à l'autre. */
const lazyView = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));

const CreditsView = lazyView(() => import("./views/CreditsView"), "CreditsView");
const RecoView = lazyView(() => import("./views/RecoView"), "RecoView");
const ImportView = lazyView(() => import("./views/import/ImportView"), "ImportView");
const ThreadView = lazyView(() => import("./views/ThreadView"), "ThreadView");
const ListsView = lazyView(() => import("./views/ListsView"), "ListsView");
const QuizView = lazyView(() => import("./views/QuizView"), "QuizView");
const CounterView = lazyView(() => import("./views/CounterView"), "CounterView");
const ConstellationView = lazyView(() => import("./views/ConstellationView"), "ConstellationView");
const LineageView = lazyView(() => import("./views/LineageView"), "LineageView");
const AlmanacView = lazyView(() => import("./views/AlmanacView"), "AlmanacView");
const SkinLab = lazyView(() => import("./views/dev/SkinLab"), "SkinLab");

/* The original kraft, for the very first render — before a skin has been
   applied. The same recipe lives in `theme/skins`, under the "carnet"
   skin: two places for one thing, but one of the two has to work before
   any module has run. */
const KRAFT_FALLBACK = `
  radial-gradient(circle at 18% 12%, #F5EDD8 0%, transparent 45%),
  radial-gradient(circle at 82% 68%, #F2E9D2 0%, transparent 40%),
  radial-gradient(circle at 55% 100%, #E5D6B4 0%, transparent 50%),
  #EEE3CC`;

export default function App() {
  const [films, setFilms] = useState([]);
  const notebook = useNotes();
  const shelf = useShelfViews(films);
  const { views, setViews } = shelf;
  /* Dividers are no longer living furniture: the migration poured them
     into the views. We keep them in memory so as to be able to rebuild a
     view from an old backup, and we never rewrite them. */
  const [dividers, setDividers] = useState([]);
  /* The constellation's threads: questions put to the collection, which
     must stay put from one session to the next. */
  const [fils, setThreads] = useState([]);
  /* WHAT TIES ONE FILM-MAKER TO ANOTHER, and the runs one means to watch.
     Two documents and not one: a course is written at every pixel of a
     drag, a filiation twice a month, and a course is settled where a
     filiation is not. See `services/lineage`. */
  const [bonds, setBonds] = useState([]);
  const [courses, setCourses] = useState([]);
  /* The star to land on when the map is opened from a card, as
     `t:<motif>`. Cleared by the map itself: it is a gesture, not data. */
  const [skyFocus, setSkyFocus] = useState(null);
  /* The vocabulary: the motifs you wrote, and those of the catalogue you
     set aside. The catalogue itself lives in the code — see
     `domain/motifs`. The React state only serves to redraw: it is the
     domain's register that answers `motifById`, everywhere else. */
  const [vocabulary, setVocabulary] = useState({ custom: [], hidden: [] });
  const [loaded, setLoaded] = useState(false);
  /* L'ADRESSE OUVRE LA VUE, et pas l'inverse. Lue une seule fois, à la
     construction : ensuite c'est l'état qui mène et l'adresse qui suit
     (voir plus bas). `null` — adresse vide, ou collection partagée, qui
     appartient à `main.jsx` — laisse le classeur s'ouvrir chez lui. */
  const landing = useMemo(() => readPlace(), []);
  const [view, setView] = useState(landing?.view ?? HOME);
  const [selectedId, setSelectedId] = useState(landing?.film ?? null);
  /* THE OPEN TAB OF THE FILM FOLDER — "film", "words" or "links". Here
     and not in the card: the guided tour opens it as it opens a view.
     See `OngletFiche` in `views/DetailView`.

     IT ALSO REMEMBERS THE CARD IT REFERS TO, and that is what avoids a
     reset effect. Opening a film from the red thread — that is to say
     from the "Links" tab — would otherwise lay the next card on its own
     links, which have not been read yet. A tab that only holds for the
     card where it was chosen is DEDUCED; putting it back to "film"
     inside an effect would cost one more render on every change of
     card. */
  const [chosenTab, setChosenTab] = useState({ pour: null, tab: "film" });
  const detailTab = chosenTab.pour === selectedId ? chosenTab.tab : "film";
  /* Stable from one render to the next: the tour uses it inside an
     effect, and a function rebuilt on every pass would restart it
     endlessly. Hence the ref — it carries the current card without
     entering the dependencies. */
  const openCard = useRef(null);
  /* Written AFTER the render and not during: reading or writing a ref in
     the middle of a render is what the React compiler refuses, and it is
     right — a render must be replayable without side effects. */
  useEffect(() => {
    openCard.current = selectedId;
  }, [selectedId]);
  const setDetailTab = useCallback((tab) => setChosenTab({ pour: openCard.current, tab }), []);
  /* The person open in the Credits view, by their normalized key.
     Alongside `selectedId` and not instead of it: you open a person FROM
     a card, and going back to the card must not have forgotten which. */
  const [who, setPerson] = useState(null);
  const [showModal, setShowModal] = useState(false);
  /* The search that cuts across everything. A state and not a view: it
     replaces no tab, it passes over them and closes behind itself. */
  const [search, setSearch] = useState(false);

  /* THE SITE'S SKIN. It is in React state here for one reason only: the
     picker has to know which one is applied in order to mark it. It is
     NOT through it that the site repaints — that is `applySkin`, which
     writes variables on the document's root, and the twenty-nine files
     reading the tokens know nothing about it.

     Applied in `useLayoutEffect` and not `useEffect`: between the two,
     the browser paints once, and you would see the kraft go past before
     the chosen skin on every load. */
  /* CTRL+K OPENS THE SEARCH, AND WE STEAL FROM NOBODY.

     The shortcut is the one everybody knows, but it cannot be guessed:
     the magnifier at the foot of the rail stays the visible path, and it
     is that which announces it in its tooltip.

     `metaKey` as much as `ctrlKey` — on a Mac, Ctrl+K clears to end of
     line in a field, and it is Cmd that commands. */
  const [skin, setSkin] = useState(loadSkinKey);
  /* LE PAPIER SUIT LA PEAU. Il vit au serveur — c'est un article qu'on
     porte — mais il se DESSINE, donc il doit être là au premier rendu et
     hors ligne. La mémoire locale le tient, comme pour la peau.

     ON S'Y ABONNE, ON NE LE SONDE PLUS. La première version le lisait au
     montage et le relisait au retour de focus de la fenêtre : il fallait
     donc RECHARGER LA PAGE pour voir le papier qu'on venait de porter,
     puisqu'on le porte depuis le comptoir sans jamais quitter l'onglet.
     `storage`, l'événement du stockage local, ne se déclenche que dans
     les AUTRES onglets et n'aurait rien rattrapé. Voir `watchWorn`. */
  const paper = useSyncExternalStore(watchWorn, wornPaper, wornPaper);
  const { t } = useTranslation();
  /* Le carnet est un tiroir, plus un onglet : voir `NotebookDrawer`. */
  const [notebookOpen, setNotebook] = useState(false);
  const [skinPicker, setSkinPicker] = useState(false);
  /* The language lives in i18next, not in React: `setLanguage` writes it
     there, and `useTranslation` re-renders whoever reads a sentence. This
     state only says whether the picker is open. */
  const [languagePicker, setLanguagePicker] = useState(false);
  const [language, setLanguageState] = useState(loadLanguage);
  /* The TMDB key's drawer. It registers with the service so that any
     screen deprived of a key can say "set it here" without a callback
     crossing ten components that have nothing to do with it. */
  const [keyPanel, setKeyPanel] = useState(false);
  useEffect(() => registerTmdbOpener(() => setKeyPanel(true)), []);
  useLayoutEffect(() => {
    applySkin(skin);
    saveSkinKey(skin);
  }, [skin]);

  /* ============================================================
     LA PORTE EST UNE SESSION
     ============================================================

     Le classeur ne s'ouvre plus sans compte. On demande `/me` au
     chargement, et la réponse se lit en TROIS états qui ne se
     confondent jamais :

       « asking »      on demande encore
       « in »          une personne : le classeur
       « out »         un refus : la porte, avec la visite et les démos
       « unreachable » un silence : la reconnexion

     LES DEUX DERNIERS SONT DISTINCTS ET DOIVENT LE RESTER. « Tu n'as pas
     de compte » et « on n'arrive pas à joindre le serveur » n'appellent
     pas le même geste, et les confondre proposerait une inscription à
     quelqu'un qui a déjà un compte et vient d'entrer dans un tunnel.
     `whoAmI` fait déjà la distinction — un 401/403 est un refus, tout le
     reste remonte —, on ne fait que la rendre visible.

     `attempt` sert au bouton « réessayer » : l'incrémenter rejoue
     l'effet. Pas de réessai automatique — une page qui se relance seule
     toutes les trois secondes martèle un serveur déjà en difficulté.

     ELLE EST DÉCLARÉE ICI, TOUT EN HAUT, ET CE N'EST PAS COSMÉTIQUE.
     Tout ce qui attend la porte doit pouvoir la citer dans ses
     dépendances, et un tableau de dépendances est évalué PENDANT le
     rendu — donc avant cette ligne si elle vivait plus bas. Le corps
     d'un effet, lui, tourne après : lire `session` dedans marche même
     déclarée plus bas, et c'est exactement ce qui rend le piège
     invisible. Le chargement du coffre a passé une soirée à ne jamais
     partir pour cette raison : il lisait `session` sans en dépendre,
     ne voyait donc que le « asking » du premier rendu, et l'écran
     d'attente restait à l'écran pour toujours. */
  const [session, setSession] = useState("asking");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setSession((s) => (s === "asking" ? s : "asking"));
    whoAmI()
      .then((who) => alive && setSession(who ? "in" : "out"))
      .catch(() => alive && setSession("unreachable"));
    return () => {
      alive = false;
    };
  }, [attempt]);

  /* LOADING HAS BECOME ASYNCHRONOUS, and that is the vault's price. The
     collection moves down into IndexedDB — several gigabytes instead of
     `localStorage`'s five megabytes, which was already warning that it
     was overflowing. The store (`services/collection`) knows where to
     read from, moves what it finds upstairs down there, and completes
     cards from before the status/watchedAt/tmdbId fields on the way. */
  useEffect(() => {
    /* RIEN NE SE CHARGE AVANT QUE LA PORTE SOIT PASSÉE. Le coffre est un
       cache de ce que le serveur tient ; l'ouvrir pour quelqu'un qui
       n'est pas entré montrerait la collection du dernier connecté. */
    if (session !== "in") return;
    let alive = true;
    /* LE COFFRE S'OUVRE AVANT QU'ON LISE QUOI QUE CE SOIT. Le carnet et
       l'agencement des murs y vivent désormais ; leurs lectures sont
       restées synchrones grâce au miroir, mais le miroir doit être
       monté. Tout ce qui lit un document — `notebook.load`,
       `ensureViews`, les fils, le vocabulaire — passe plus bas dans
       cette même chaîne, donc après. */
    hydrateVault()
      .then(loadFilms)
      .then(async (loaded) => {
        if (!alive) return;
        /* PLUS DE SEMIS. Les douze fiches d'exemple vivent sur la
           porte et nulle part ailleurs — voir `showcase` plus haut. */
        const migrated = loaded;
        setFilms(migrated);
        notebook.load();
        const tabs = store.get("shelf-dividers", []);
        setDividers(tabs);
        setThreads(loadThreads());
        setBonds(loadBonds());
        setCourses(loadCourses());
        setVocabulary(loadVocabulary());
        /* The migration reads `order` and `status`, which the store has
           just normalized: it must therefore come after, and work on the
           migrated cards — not on what comes off the disk. */
        setViews(
          ensureViews({ films: migrated, dividers: tabs, wallPrefs: store.get("wall-prefs", {}) })
        );
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
    /* `session` EN DÉPENDANCE, sans quoi la garde ci-dessus est un
       verrou qu'on ne rouvre jamais : au premier rendu elle vaut
       « asking », l'effet renonce, et rien ne le rejoue quand la porte
       s'ouvre. */
  }, [session]);

  /* THE GUIDED TOUR. Three states only: the tour running, the help menu,
     and the reminder card. All the rest — which steps, in what order,
     what has already been seen — lives elsewhere.

     It is mounted HERE and not in a view: it crosses the views, and
     would no longer be there on the first change of tab. */
  const [tourId, setTourId] = useState(null);
  const [tourMenu, setTourMenu] = useState(false);
  const [hint, setHint] = useState(false);

  /* ============================================================
     ANNULER LE DERNIER GESTE
     ============================================================

     Trois gestes n'avaient pas de retour : supprimer une fiche, en
     supprimer plusieurs depuis le mur, retirer l'exemple. Les deux
     derniers se font d'un clic et sans confirmation.

     LE NETTOYAGE DES ORPHELINES ATTEND LA FENÊTRE, et c'est la seule
     chose difficile ici. `pruneOrphans` efface les affiches d'IndexedDB
     ET du miroir : lancé tout de suite, il rendrait une annulation
     menteuse — les fiches reviendraient sans leurs images. On garde donc
     le nettoyage en attente, et il ne part que si personne n'annule.

     UNE SEULE ANNULATION EN RÉSERVE. La suivante fait expirer la
     précédente, nettoyage compris : empiler serait promettre de remonter
     un historique qu'on ne tient pas.

     SI L'ONGLET SE FERME PENDANT LA FENÊTRE, le nettoyage ne part pas et
     des images restent orphelines. C'est sans gravité — `pruneOrphans`
     repasse au prochain effacement — et c'est le bon sens du compromis :
     une image de trop se rattrape, une image perdue non. */
  const UNDO_MS = 8000;
  const [undo, setUndo] = useState(null);
  const undoHeld = useRef(null);
  const undoTimer = useRef(null);

  const closeUndo = useCallback((sweep) => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    const held = undoHeld.current;
    undoHeld.current = null;
    setUndo(null);
    if (sweep && held?.prune) held.prune();
  }, []);

  const offerUndo = useCallback(
    (entry) => {
      /* La précédente expire MAINTENANT, avec son nettoyage. */
      closeUndo(true);
      undoHeld.current = entry;
      setUndo(entry);
      undoTimer.current = setTimeout(() => closeUndo(true), UNDO_MS);
    },
    [closeUndo]
  );

  /* PLACÉ APRÈS L'ÉTAT DE LA VISITE, ET PAS PLUS HAUT. Cet effet était
     écrit au-dessus, avec les autres écouteurs de clavier ; il y lisait
     `setTourMenu` avant sa déclaration. Ça marchait — un effet ne
     s'exécute qu'après le rendu — et le lint le refusait quand même,
     avec raison : ce qui tient par le hasard de l'ordonnancement se
     casse à la première réorganisation. */
  /* `/` OUVRE LA RECHERCHE, `?` LA VISITE, et `Ctrl+K` garde sa place.
     Les deux premières sont des touches NUES : tout le soin est dans
     `shortcutOf`, qui refuse de les prendre pendant qu'on écrit — une
     barre oblique tapée dans une critique est une barre oblique. Voir
     `domain/keys`, où la règle est écrite et éprouvée. */
  useEffect(() => {
    const onKey = (e) => {
      const what = shortcutOf(e);
      if (!what) return;
      e.preventDefault();
      if (what === "search") setSearch((o) => !o);
      else setTourMenu((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* DRAGGING BY FINGER — mounted here, once, for the whole application.

     It belongs to no view: what it translates are the drag-and-drop
     events a touch browser does not emit, and that holds everywhere
     something can be grabbed — the shelf, the wall, the decor cabinet.
     Mounting it in the shelf would have meant mounting it again in every
     view that one day drags.

     It only installs itself under a coarse pointer. That is not a
     saving: with a mouse the real events already arrive, and a bridge
     emitting a second set would double them. */
  const { coarse } = useViewport();
  usePointerDrag(coarse);

  /* THE BINDER INSTALLS ITSELF, AND UPDATES WHEN WE SAY SO.

     Two cards, never together: the invitation to put the application on
     the home screen, and the announcement of a fresh version. The second
     goes first — we do not offer to install a version we already know to
     be out of date. */
  /* SYNCHRONISATION — mounted here because it touches the whole
     collection, and nowhere else. It only starts once the binder is
     loaded: synchronising an empty collection we have not read yet would
     erase everything on the first send. */
  /* LES DOUZE DE LA VITRINE, et elles ne vont plus nulle part ailleurs.

     Elles étaient SEMÉES dans le classeur au premier lancement, avec un
     carton qui s'excusait de les y avoir mises. Ça se tenait quand le
     produit s'ouvrait sans compte : il fallait bien montrer quelque
     chose. Maintenant que la porte les montre, les semer reviendrait à
     poser douze films qui ne sont pas les siens dans la collection de
     quelqu'un qui vient de payer — et le carton d'excuse avec.

     Les affiches viennent du serveur ; sans elles, le classeur dessine
     les initiales comme il l'a toujours fait. */
  const { t: say } = useTranslation();
  const [posters, setPosters] = useState({});
  useEffect(() => {
    if (session !== "out") return;
    demoPosters().then(setPosters);
  }, [session]);
  const showcase = useMemo(
    () => demoFilms(say).map((f) => (posters[f.id] ? { ...f, poster: posters[f.id] } : f)),
    [say, posters]
  );

  const [accountOpen, setAccountOpen] = useState(false);

  /* LA VITRINE DU HALL OUVRE UN COMPTE SUR PLACE, au lieu de désigner
     un bouton au pied du rail. Même arrangement que le cartouche de la
     clé TMDB — et posé ICI, après la déclaration de l'état : écrit plus
     haut avec les autres inscriptions, il lisait `setAccountOpen` avant
     qu'elle existe. Ça marchait, et le lint le refusait avec raison. */
  useEffect(() => registerAccountOpener(() => setAccountOpen(true)), []);
  /* RE-READ WHAT HAS JUST ARRIVED. The shelf arrangements, the notebook,
     the threads, the vocabulary, the filiations and the courses are read
     on mount: when the synchronisation brings some in, they have to be
     asked of the disk again, otherwise the screen keeps the old ones
     without a word. */
  const rereadDocuments = useCallback(() => {
    notebook.load();
    setThreads(loadThreads());
    setBonds(loadBonds());
    setCourses(loadCourses());
    setVocabulary(loadVocabulary());
    const tabs = store.get("shelf-dividers", []);
    setDividers(tabs);
    setViews(
      ensureViews({
        films: knownCollection(),
        dividers: tabs,
        wallPrefs: store.get("wall-prefs", {}),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    report: synchro,
    synchronise: rerunSync,
    noteAccount,
  } = useSync(loaded, setFilms, rereadDocuments);

  const installation = useInstallation();
  const {
    needRefresh: [updateReady],
    updateServiceWorker,
  } = useRegisterSW();

  /* ============================================================
     UN COMPTE QUI NE TIENT QU'À CET APPAREIL
     ============================================================

     La question ne se pose qu'avec un compte ouvert, et la réponse est
     chez le serveur : c'est le nombre de clés qui dit si le compte est
     enfermé dans cette machine. On la pose une fois, quand un compte
     apparaît, et jamais si on a déjà assez insisté.

     ELLE SE TAIT SUR UNE PANNE. Hors ligne, ou serveur muet, on ne sait
     pas — et une alarme sur une ignorance serait pire que le silence. */
  /* LE STOCKAGE QUI SE REMPLIT. `services/storage` ne peut pas parler —
     il est chargé avant l'écran et n'a pas de catalogue — donc il
     signale, et c'est ici qu'on l'entend. `-1` veut dire « l'écriture a
     échoué », ce qui est une autre nouvelle qu'une jauge haute. */
  const [quota, setQuota] = useState(null);
  useEffect(() => watchQuota(setQuota), []);

  /* ============================================================
     DU NEUF AU HALL
     ============================================================

     Le fil se remplit pendant qu'on range ses fiches, et rien ne le
     disait : il fallait aller voir, donc y penser, donc savoir qu'il y
     avait quelque chose — ce qui est la question.

     ON LIT LE CACHE, ON NE DEMANDE RIEN. `feed` est déjà chargé par la
     vue du fil et tenu une minute (`hooks/useHall`) ; interroger le
     serveur ici ferait une requête de plus à chaque ouverture, pour
     dessiner un point. Sans compte ou sans serveur, `known()` rend
     `null` et le point n'existe pas — ce qui est la bonne réponse.

     ET IL S'ÉTEINT EN ENTRANT, pas en sortant : c'est le fait de
     regarder qui compte, et quelqu'un qui ouvre le fil puis change
     d'avis a quand même vu ce qu'il y avait. */
  const [hallNews, setHallNews] = useState(false);
  useEffect(() => {
    const known = feed.known();
    setHallNews(unseenNews(known?.news ?? [], synchro.person?.pseudo) > 0);
  }, [view, synchro.person]);

  useEffect(() => {
    if (view !== "thread") return;
    markHallSeen();
    setHallNews(false);
  }, [view]);

  const [loneDevice, setLoneDevice] = useState(false);
  useEffect(() => {
    if (!synchro.person || !mayNudge()) return;
    let alive = true;
    myKeys()
      .then((keys) => {
        if (!alive || keys.length !== 1) return;
        setLoneDevice(true);
        /* Comptée à la POSE et non au renvoi : une carte qu'on ignore
           en changeant d'onglet a été montrée quand même, et la compter
           seulement quand on la ferme la ferait revenir sans fin. */
        noteNudge();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [synchro.person]);

  /* LA VISITE NE S'IMPOSE PLUS, ELLE SE PROPOSE.
     Elle s'ouvrait d'elle-même à la première seconde de la première
     visite : un voile opaque sur un mur garni qu'on n'avait pas encore
     eu le temps de regarder, et le premier geste offert à quelqu'un qui
     découvre le produit était de s'en débarrasser. On laisse le mur se
     manipuler, et le carton propose la visite à côté.

     APRÈS LE CHARGEMENT quand même : le carton pointe le pied du rail,
     qui n'est pas là tant que l'écran d'attente l'est. */
  useEffect(() => {
    if (!loaded) return;
    if (shouldHint()) setHint(true);
  }, [loaded]);

  const playTour = (id) => {
    setTourMenu(false);
    setHint(false);
    setTourId(id);
  };

  /* Waving the tour away makes nothing appear at once: the reminder card
     would arrive on the very gesture that has just refused it. It waits
     for the next opening, where it has a chance of being read. */
  const closeTour = () => setTourId(null);

  /* Stable from one render to the next: the tour uses it inside an
     effect, and a function rebuilt on every pass would restart it
     endlessly. Re-applying the view already open costs nothing — React
     drops the update when the value does not change, and the effect
     stays quiet. */
  const tourOpensView = useCallback((v) => {
    setView(v);
    setSelectedId(null);
  }, []);

  /* OPENING A FILM'S FOLDER — one function, and it is HELD.
     Five views were each writing the same two lines as an inline arrow,
     so every one of them received a brand-new `onOpen` at every render
     of this component. That prop travels all the way down to each card
     of the wall, where it defeated the memoisation that is supposed to
     keep five hundred of them from redrawing together. */
  const openFilm = useCallback((id) => {
    setSelectedId(id);
    setView("detail");
  }, []);

  /* L'IMPORT S'OUVRE DE QUATRE ENDROITS depuis que la porte le propose :
     le pied du rail, le carton de l'exemple, et les deux murs vides.
     Une seule fonction, tenue, pour que les quatre fassent la même
     chose — et surtout pour que `setSelectedId(null)` ne soit pas oublié
     à l'un des quatre, ce qui rendrait une page d'import sous une fiche
     restée ouverte. */
  const openImport = useCallback(() => {
    setView("import");
    setSelectedId(null);
  }, []);

  /* ============================================================
     L'ÉTAT MÈNE, L'ADRESSE SUIT
     ============================================================

     Un seul sens d'écriture, et c'est ce qui évite la boucle. Ici on
     n'écrit QUE l'adresse, jamais l'état ; l'effet d'en dessous ne lit
     QUE l'adresse pour écrire l'état, et seulement quand le navigateur
     l'a changée sous nos pieds.

     `pushState` n'émet pas `hashchange` — c'est ce qui rend la
     séparation praticable. Écrire `location.hash` en émettrait un, et
     les deux effets se répondraient.

     LE PREMIER PASSAGE REMPLACE AU LIEU D'EMPILER. Arriver sur `/` et y
     pousser `#/mur` poserait une entrée d'historique vers la même page :
     un retour arrière qui ne fait rien est pire que pas de retour du
     tout, puisqu'il faut appuyer deux fois pour sortir. */
  const addressWritten = useRef(false);
  useEffect(() => {
    const place = view === "detail" && selectedId ? { view, film: selectedId } : { view };
    /* On ne touche pas à l'adresse d'une collection partagée : cette
       page-là n'est pas la nôtre, et `main.jsx` recharge dessus. */
    if (location.hash && !readPlace()) return;
    const wanted = placeToHash(place);
    /* LE DRAPEAU SE POSE AU PREMIER PASSAGE, PAS À LA PREMIÈRE ÉCRITURE.
       La nuance a coûté une entrée d'historique : arrivé sur
       `#/fiche/…`, l'adresse voulue est déjà la bonne, on ne l'écrivait
       donc pas — et le drapeau restant baissé, le PREMIER changement de
       vue remplaçait la fiche au lieu de s'empiler par-dessus. Revenir
       en arrière sautait la fiche d'où l'on venait. */
    const first = !addressWritten.current;
    addressWritten.current = true;
    /* LA VUE SE RAPPORTE ICI, où l'on sait qu'elle a changé — y compris
       au premier passage, qui est l'arrivée et donc la page qui compte
       le plus. `pageSeen` coupe l'identifiant d'une fiche ; on lui passe
       l'endroit et jamais l'adresse, pour qu'il n'y ait pas deux façons
       de l'appeler dont une mauvaise. */
    pageSeen(place);
    if (location.hash === wanted) return;
    if (first) history.replaceState(null, "", wanted);
    else history.pushState(null, "", wanted);
  }, [view, selectedId]);

  /* La mesure se charge une fois, et seulement si une instance est
     réglée. Sans elle, rien de tout cela n'existe — pas de script, pas
     de requête. */
  useEffect(startMeasuring, []);

  /* Le retour arrière, l'avance, et l'adresse collée à la main. Les deux
     événements plutôt qu'un : `popstate` couvre les boutons du
     navigateur, `hashchange` la barre d'adresse. Ils se recouvrent
     souvent, et se rejouer est sans effet — on écrit le même état. */
  useEffect(() => {
    const follow = () => {
      const place = readPlace();
      /* Rien à nous : soit l'adresse est vide, soit c'est une collection
         partagée, et `main.jsx` s'en occupe en rechargeant. */
      if (!place) return;
      setView(place.view);
      setSelectedId(place.film ?? null);
    };
    addEventListener("popstate", follow);
    addEventListener("hashchange", follow);
    return () => {
      removeEventListener("popstate", follow);
      removeEventListener("hashchange", follow);
    };
  }, []);

  /* UNE FICHE QUI N'EXISTE PLUS. Un lien mis en favori, puis le film
     supprimé — ou l'adresse d'un autre classeur. `DetailView` ne rend
     rien sans sa fiche, donc sans cette ligne on resterait sur une
     colonne vide, avec la bonne adresse et rien dedans.

     APRÈS LE CHARGEMENT SEULEMENT : avant, la collection est vide et
     toute fiche y semble morte. */
  useEffect(() => {
    if (!loaded || view !== "detail" || !selectedId) return;
    if (films.some((f) => f.id === selectedId)) return;
    setSelectedId(null);
    setView(HOME);
  }, [loaded, view, selectedId, films]);

  /* The counterpart of `visiteOuvreVue`, one notch lower: the film
     folder's tab. Stable for the same reason — the tour uses it inside
     an effect, and a function rebuilt on every render would restart it
     endlessly. `setDetailOnglet` already is, so we pass it as it is. */

  /* THE SCREEN FIRST, THE DISK SECOND. We set the state straight away —
     a keystroke must not wait for a write — then the store returns the
     cards DATED, and it is that version we keep: it alone carries the
     `updatedAt` that will say tomorrow what to synchronise.

     The second `setFilms` costs nothing when nothing has changed: the
     store then returns the same objects, and React drops the update.

     WHAT HAPPENED TO `main`'S DEFERRED WRITE. It used to write here, via
     `store.setSoon(KEYS.films, …)`, so as not to re-serialise six
     hundred cards on every keystroke into `localStorage`. Since then the
     collection has moved into the vault: the store writes through
     IndexedDB, and `localStorage` is now only its fallback. So the cure
     applies to an ill that has moved — and deferring on the fallback
     path would amount to delaying the only copy left on the day the
     vault refuses. `store.setSoon` remains, unused here; what would need
     batching today is the write into the vault, and that is not decided
     in passing during a merge. */
  /* AND A LATE WRITE MUST NO LONGER OVERWRITE ANYTHING.

     This is the flaw that made note-taking unusable, and there was
     nothing exotic about it: you only had to type fast.

     Every keystroke calls `commitFilms`. The first `setFilms` puts the
     text on screen straight away; the write, meanwhile, goes off into
     the vault and takes a few dozen milliseconds to come back. By the
     time it does, two or three more letters have been typed — and its
     `.then` then put back a collection carrying the text from BEFORE.
     The card dropped a letter, the field rewrote itself, the cursor
     jumped, and you got "laoume s s" for "le samourai ne parle pas".

     One rank per write, and we only apply the return of the LAST one
     asked for: the previous ones have already been overtaken on screen,
     and their dates will be put back by the next one anyway — `stamp`
     recomputes them from the store's state, not from what we hand it
     here.

     `useRef` and not a module variable: two binders mounted side by side
     in a test would share the counter. */
  const writeRank = useRef(0);
  const write = (next) => {
    const rank = ++writeRank.current;
    return saveFilms(next).then((dated) => {
      if (rank === writeRank.current) setFilms(dated);
    });
  };

  const FILMS = "films";

  const commitFilms = (next) => {
    setFilms(next);
    /* ET L'ÉCRITURE DIFFÉRÉE QUI ATTENDAIT EST ABANDONNÉE. Elle porte un
       état PLUS ANCIEN que celui-ci, et partirait après lui : c'est ce
       qui faisait disparaître une capture insérée dans une critique —
       l'insertion écrivait tout de suite, la frappe d'avant écrasait
       trois cents millisecondes plus tard. */
    dropSoon(FILMS);
    /* UNE ÉCRITURE IMMÉDIATE AVANCE LA PASSE, ELLE AUSSI. Elle ne le
       faisait pas : seule la file différée prévenait, donc une note
       étoilée ou une fiche effacée attendaient le rythme de cinq
       minutes. Voir `noteWritten`. */
    noteWritten();
    return write(next);
  };

  /* LA MÊME CHOSE, MAIS PAS TOUT DE SUITE — pour ce qu'on TAPE.

     L'écran est à jour immédiatement, comme avant : c'est `setFilms` qui
     le fait, et il n'a jamais été en cause. Ce qu'on diffère est
     l'écriture, qui sérialise la collection ENTIÈRE dans le coffre — la
     faire trente fois par phrase était du travail pour rien, et c'est
     l'ill que le commentaire ci-dessus disait « déplacée » sans la
     traiter.

     LE RANG RESTE INDISPENSABLE, et il est maintenant DANS `write` :
     l'écriture différée revient toujours après la frappe suivante, et
     c'est exactement le défaut du « laoume s s ». Le grouper n'a fait
     que l'espacer.

     `saveSoon` garantit le départ avant fermeture de la page et avant
     passage en arrière-plan — voir `services/saving`. */
  const commitFilmsSoon = (next) => {
    setFilms(next);
    saveSoon(FILMS, () => write(next));
  };

  const commitThreads = (next) => {
    setThreads(next);
    saveThreadsToDisk(next);
  };

  const commitBonds = (next) => {
    setBonds(next);
    saveBondsToDisk(next);
  };

  const commitCourses = (next) => {
    setCourses(next);
    saveCoursesToDisk(next);
  };

  /* WHILE A DRAG IS RUNNING. Reordering fires on every crossed entry;
     the coalesced write turns forty of them into one, exactly as the
     typing of a review does. The gesture ends on `commitCourses`. */
  const commitCoursesSoon = (next) => {
    setCourses(next);
    saveCoursesToDiskSoon(next);
  };

  const commitVocabulary = (next) => {
    setVocabulary(next);
    saveVocabulary(next);
  };

  /* Writing a motif of one's own. Making it SET on the open card at
     once: you never create one in the abstract, but because you have
     just watched that film and no word said it. */
  const createMotif = (label, family, spoiler) => {
    const clean = (label || "").trim();
    if (!clean) return null;
    const existing = [...customMotifs()].find((m) => m.label.toLowerCase() === clean.toLowerCase());
    if (existing) return existing.id;
    const motif = makeCustomMotif(clean, family, spoiler);
    commitVocabulary({ ...vocabulary, custom: [...vocabulary.custom, motif] });
    return motif.id;
  };

  /* DELETING A MOTIF ALSO MEANS TAKING IT OFF THE CARDS.

     Leaving it asleep on twelve cards would give an identifier nothing
     can read any more: invisible on screen, very much present in the
     data, and back intact the day somebody recreates a motif of the same
     name. So we clean up, and that is why the confirmation announces the
     number of cards concerned.

     ITS SETTINGS GO WITH IT. They used to be kept, with the motif set to
     `null`: the gathering then held nothing — its members all came from
     the motif — drew nothing on the map, and could be deleted from
     nowhere. A ghost in `localStorage`, in short. The motif IS the
     gathering now, so deleting one deletes the other. */
  const deleteMotif = (motifId) => {
    commitVocabulary({
      ...vocabulary,
      custom: vocabulary.custom.filter((m) => m.id !== motifId),
    });
    commitFilms(
      films.map((f) =>
        (f.motifs || []).includes(motifId)
          ? { ...f, motifs: f.motifs.filter((id) => id !== motifId) }
          : f
      )
    );
    if (fils.some((f) => f.motif === motifId))
      commitThreads(fils.filter((f) => f.motif !== motifId));
  };

  /* Setting aside, and not deleting: a catalogue motif is not yours, and
     erasing it from your data would see it come back on the next update.
     The cards carrying it keep it — hiding rewrites nothing. */
  const hideMotif = (motifId, hidden) =>
    commitVocabulary({
      ...vocabulary,
      hidden: hidden
        ? [...new Set([...vocabulary.hidden, motifId])]
        : vocabulary.hidden.filter((id) => id !== motifId),
    });

  const addFilm = (film) => {
    commitFilms([film, ...films]);
    setShowModal(false);
  };

  /* Opening somebody from a card. The key is normalized HERE and once
     only: the Credits view files its person pages under the same one, and
     two ways of writing it would make two people. */
  const openPerson = (name) => {
    setPerson(normalize(name));
    setView("credits");
  };

  /* WHAT WE DO WITH A HIT, according to its nature.

     A motif has no view of its own: so we open the video library with
     its search set on the label. That is not a makeshift — the wall
     ALREADY searches the motifs (`domain/search`), and the result is
     exactly "the cards carrying this motif", written with the tools that
     exist rather than with one more filter. */
  const openFinding = {
    film: (id) => {
      setSelectedId(id);
      setView("detail");
    },
    person: (key) => {
      setPerson(key);
      setView("credits");
    },
    /* Une page du carnet trouvée par la recherche : le carnet n'étant
       plus une vue, on revient au classeur et on tire le tiroir. */
    page: () => {
      setSelectedId(null);
      setView("library");
      setNotebook(true);
    },
    motif: (label) => {
      setSelectedId(null);
      setUiFor("watched")({ ...wallUi.watched, q: label });
      setView("library");
    },
    thread: () => setView("constellation"),
  };
  const updateFilm = (film) => commitFilms(films.map((f) => (f.id === film.id ? film : f)));
  /* CE QU'ON TAPE PASSE PAR ICI. Même geste, écriture groupée : voir
     `commitFilmsSoon`. La fiche s'en sert pour la critique, les notes
     libres et la légende d'une capture — jamais pour un clic, qui EST
     déjà une validation. */
  const updateFilmSoon = (film) => commitFilmsSoon(films.map((f) => (f.id === film.id ? film : f)));
  /* Filing a case renumbers a whole shelf: one write, not thirty. */
  const updateMany = (patches) =>
    commitFilms(films.map((f) => (patches[f.id] ? { ...f, ...patches[f.id] } : f)));
  const deleteFilm = (id) => {
    const before = films;
    const next = films.filter((f) => f.id !== id);
    commitFilms(next);
    setView("library");
    setSelectedId(null);
    /* L'affiche part avec la fiche — mais seulement quand la fenêtre
       d'annulation s'est refermée. */
    offerUndo({
      label: "undo.film",
      films: before,
      prune: () => pruneOrphans(next).catch(console.error),
    });
  };

  /* PLUSIEURS D'UN COUP, DEPUIS LE MUR. Passer par `deleteFilm` en
     boucle aurait écrit la collection autant de fois qu'on supprime de
     films — et chaque écriture repart en synchro. Un seul filtre, une
     seule écriture, une seule tombe posée par fiche. */
  const deleteFilms = (ids) => {
    const gone = new Set(ids);
    if (gone.size === 0) return;
    const before = films;
    const next = films.filter((f) => !gone.has(f.id));
    commitFilms(next);
    offerUndo({
      label: "undo.films",
      count: gone.size,
      films: before,
      prune: () => pruneOrphans(next).catch(console.error),
    });
  };

  /* Linking two cards means writing on both sides: opening one or the
     other must show the same thread. The two halves share a pairId,
     which is what lets them be undone together. */
  /* The relation, on the other hand, FLIPS from one end to the other:
     "sequel to" on one side reads "precedes" on the other. Writing the
     same one on both sides would have each film claim to be the sequel
     of the other. */
  const linkFilms = (fromId, toId, note = "", relation, force) => {
    const a = films.find((f) => f.id === fromId);
    const b = films.find((f) => f.id === toId);
    if (!a || !b || a.id === b.id) return;
    if ((a.linkedWorks || []).some((w) => w.filmId === b.id)) return; // déjà relié

    const pairId = uid();
    const card = (target, rel) => ({
      id: uid(),
      pairId,
      type: "film",
      filmId: target.id,
      title: target.title,
      creator: target.director || "",
      note: note.trim(),
      relation: rel,
      force: force ? strengthOf(force) : undefined,
    });
    commitFilms(
      films.map((f) =>
        f.id === a.id
          ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(b, relation)] }
          : f.id === b.id
            ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(a, inverseOf(relation))] }
            : f
      )
    );
  };

  /* CHANGING SOMETHING ABOUT A MOTIF'S GATHERING.

     Nothing is created here, because there is nothing to create: a motif
     laid on two cards is already a star (`effectiveThreads`). What this
     writes is a DEVIATION from that default — a name of one's own, a
     colour, a note, a card set by hand, the star put out.

     And what stops saying anything is erased rather than kept: a row
     equal to the default is a row that will contradict the catalogue the
     day the motif is relabelled. `"fils"` holds the corrections, never a
     second copy of the vocabulary.

     The gathering does NOT enumerate the films: it holds the motif and
     recomposes itself on every read. That is what makes a card tagged
     tomorrow enter it without anyone coming back to it. */
  const patchMotifThread = (motifId, patch) => {
    const current = fils.find((f) => f.motif === motifId) || makeThread({ motif: motifId });
    const next = { ...current, ...patch, motif: motifId, id: motifId };
    const others = fils.filter((f) => f.motif !== motifId);
    commitThreads(isPlainDefault(next) ? others : [...others, next]);
  };

  /* Putting a motif's star out, or lighting it back up.

     Lighting one that the count already lights writes nothing — which is
     the point: the common case leaves no trace at all. */
  const setMotifStar = (motifId, on) =>
    patchMotifThread(motifId, {
      off: !on,
      /* Lit by hand below the count, the gathering needs a member of its
         own to exist at all — the motif alone would not reach `STAR_FROM`
         and `effectiveThreads` would drop it on the next read. */
      filmIds:
        on && countOfMotif(motifId, films) < STAR_FROM && selectedId
          ? [...new Set([...(fils.find((f) => f.motif === motifId)?.filmIds || []), selectedId])]
          : fils.find((f) => f.motif === motifId)?.filmIds || [],
    });

  /* Opening the map on one gathering rather than on the whole sky. */
  const openMotifInSky = (motifId) => {
    setSkyFocus(`t:${motifId}`);
    setView("constellation");
  };

  /* Retouching a thread already strung. The rule — what a link accepts
     being rewritten, and what its reciprocal half receives of it — lives
     in the domain, where it is tested without mounting a screen. */
  const editLink = (ownerId, workId, patch) =>
    commitFilms(editLinkedWork(films, ownerId, workId, patch));

  /* Undoing a link: the reciprocal half goes with it. */
  const removeLink = (ownerId, workId) => {
    const owner = films.find((f) => f.id === ownerId);
    const work = (owner?.linkedWorks || []).find((w) => w.id === workId);
    if (!work) return;
    commitFilms(
      films.map((f) => {
        if (f.id === ownerId)
          return { ...f, linkedWorks: f.linkedWorks.filter((w) => w.id !== workId) };
        if (work.pairId && f.id === work.filmId)
          return {
            ...f,
            linkedWorks: (f.linkedWorks || []).filter((w) => w.pairId !== work.pairId),
          };
        return f;
      })
    );
  };

  /* Restoring means replacing the whole state — the arrangement
     included. A backup from before the views (v ≤ 3) has none: we then
     rebuild them from its dividers, which is what `force` is for. */
  const restoreBackup = ({
    films: f,
    notes: n,
    dividers: d,
    views: v,
    fils: fl,
    motifs: mo,
    filiations: bd,
    parcours: cs,
  }) => {
    const migrated = migrate(f);
    /* A RESTORE IS NOT A MODIFICATION. Without this line, the store
       would compare the backup with the collection it replaces, find a
       thousand differences and date everything from now: the cards would
       lose the date they carry in the file, which is precisely what we
       are restoring. So we start again from the backup itself as the
       known state. */
    forgetCache(migrated);
    commitFilms(migrated);
    commitThreads(normalizeThreads(fl || []));
    /* A backup written before v8 has neither: an empty list and never
       `undefined`, so the doors below get the array they read. */
    commitBonds(normalizeBonds(bd || []));
    commitCourses(normalizeCourses(cs || []));
    commitVocabulary(normalizeVocabulary(mo || {}));
    if (n?.length) notebook.replaceAll(n);
    const tabs = d || [];
    setDividers(tabs);
    store.set("shelf-dividers", tabs);

    if (v?.byWall && v?.docs) {
      for (const id of Object.keys(v.docs)) store.set(viewKey(id), v.docs[id]);
      saveViewIndex(v.byWall);
      setViews({ byWall: v.byWall, docs: v.docs });
    } else {
      for (const wall of Object.keys(views.byWall))
        for (const id of views.byWall[wall]) deleteViewKey(id);
      setViews(
        ensureViews({
          films: migrated,
          dividers: tabs,
          wallPrefs: store.get("wall-prefs", {}),
          force: true,
        })
      );
    }
    return migrated.length;
  };

  /* Applies the diff already approved on screen: the updates are merged
     field by field, never a card replacement. */
  const importFilms = ({ toCreate, toUpdate }) => {
    const patches = new Map(toUpdate.map(({ film, changes }) => [film.id, changes]));
    const merged = films.map((f) => (patches.has(f.id) ? { ...f, ...patches.get(f.id) } : f));
    /* ON SYNCHRONISE TOUT DE SUITE, ET SEULEMENT ICI.

       Un import est le geste le plus gros du produit — six cents fiches
       d'un coup — et le seul qu'on VALIDE par un bouton en sachant ce
       qu'il contient. Le laisser dans la file voulait dire ouvrir le
       tiroir du compte juste après et y lire « six cents fiches
       attendent le réseau », ce qui se lit comme un import qui n'a pas
       pris.

       APRÈS L'ÉCRITURE, PAS AVANT : c'est `saveFilms` qui note ce qu'il
       y a à envoyer, et une passe partie trop tôt trouverait la file
       telle qu'elle était. D'où le `then` — `commitFilms` rend sa
       promesse pour cette raison, et pour elle seule.

       Une passe refusée ne casse rien : le rythme ordinaire reprend, et
       tout est déjà sur le disque. */
    commitFilms([...toCreate, ...merged]).then(() => rerunSync());
  };

  const selectedFilm = films.find((f) => f.id === selectedId);
  // the state of both walls survives opening a card
  /* Search and filter are the mood of the moment; the presentation, the
     sort and the shelves' width are an arrangement. Tidying your shelf
     and then finding it in disorder on reload would mean not having
     tidied it — so those three are kept on the disk. */
  const [wallUi, setWallUi] = useState(() => {
    const saved = store.get("wall-prefs", {});
    const one = (wall) => ({
      q: "",
      genreFilter: "",
      decadeFilter: null,
      grouped: false,
      sortBy: saved[wall]?.sortBy || WALLS[wall].defaultSort,
      desc: saved[wall]?.desc ?? true,
      /* L'ÉTAGÈRE EST LA VUE PRINCIPALE DE LA COLLECTION, et le mur
         est l'autre angle. Le défaut disait l'inverse : on arrivait sur
         une grille d'affiches, et le rangement — les rayons, les
         boîtes, les objets posés — demandait un clic pour exister. Ce
         classeur range ; il montre ensuite.

         `saved[wall]?.mode` passe devant : c'est un défaut, pas une
         reprise, et personne ne doit retrouver son choix renversé. */
      mode: saved[wall]?.mode || "shelf",
      /* The shelves' width is no longer a wall setting: it belongs to
         each row, in the view. All that survives here is the view we
         were looking at. */
      viewId: saved[wall]?.viewId || null,
      /* The wall's look — card size, spacing, disorder, hanging and
         background decor. It is kept as it is: it is `wallLookOf` that
         brings it back to something sensible at the moment of using it,
         including when it is missing. */
      look: saved[wall]?.look || null,
    });
    return { watched: one("watched"), watchlist: one("watchlist") };
  });
  const setUiFor = (wall) => (next) =>
    setWallUi((s) => {
      const merged = { ...s, [wall]: next };
      const keep = ({ mode, sortBy, desc, viewId, look }) => ({ mode, sortBy, desc, viewId, look });
      store.set("wall-prefs", { watched: keep(merged.watched), watchlist: keep(merged.watchlist) });
      return merged;
    });

  /* A wall's active view: the one we were looking at, or the first — the
     identifier kept on the disk may point at a view since deleted, or
     one from another browser. */
  const activeViewId = (wall) => {
    const list = views.byWall[wall] || [];
    const kept = wallUi[wall].viewId;
    return kept && list.includes(kept) ? kept : list[0] || null;
  };

  /* Recalculé quand une vue change, et pas à chaque rendu : le balayage
     traverse toutes les vues, toutes leurs rangées et leurs boîtes. */
  const placedMotifs = useMemo(() => countPlacedMotifs(views.docs), [views.docs]);

  /* Everything a wall's shelf needs, gathered in one place: the view it
     shows, the list of those to switch between, and the gestures that
     make them born, renamed or gone. */
  const viewProps = (wall) => {
    const id = activeViewId(wall);
    return {
      shelfView: id ? views.docs[id] : null,
      shelfViews: (views.byWall[wall] || []).map((x) => views.docs[x]).filter(Boolean),
      /* CE QUI EST DÉJÀ POSÉ, SUR TOUTES LES VUES ET LES DEUX MURS.

         On pose autant d'exemplaires d'un objet gagné qu'on en possède,
         et c'est ce qui donne un sens aux doubles. Le compte se fait
         donc ICI, au seul endroit qui voie `views.docs` en entier :
         une vue est une DISPOSITION de la même collection, pas une
         étagère de plus, et compter par vue aurait offert un exemplaire
         gratuit à chaque vue créée. */
      placed: placedMotifs,
      onOpenPerson: openPerson,
      onShelfView: shelf.commit,
      onPickView: (next) => setUiFor(wall)({ ...wallUi[wall], viewId: next }),
      onCreateView: (name) => setUiFor(wall)({ ...wallUi[wall], viewId: shelf.create(wall, name) }),
      onCreateDirectorView: () =>
        setUiFor(wall)({ ...wallUi[wall], viewId: shelf.createByDirector(wall) }),
      onCopyView: (from) => {
        const next = shelf.copy(from);
        if (next) setUiFor(wall)({ ...wallUi[wall], viewId: next });
      },
      onDeleteView: shelf.remove,
    };
  };

  const watched = useMemo(() => films.filter((f) => f.status !== "watchlist"), [films]);
  const watchlist = useMemo(() => films.filter((f) => f.status === "watchlist"), [films]);
  // the sky map only links what is on the shelves
  const constellationFilms = useMemo(() => watched.filter((f) => !f.archived), [watched]);
  // the wall we come from: "I have seen it" from the watchlist must lead back to the right place
  /* We come back from where we came. A card opened from a person's
     person page leads back to that page — otherwise, following a
     cinematographer from film to film would mean finding them again
     every time. */
  const backView = who ? "credits" : selectedFilm?.status === "watchlist" ? "watchlist" : "library";

  /* LES TROIS ÉCRANS DE LA PORTE, avant tout le reste. Ils viennent
     AVANT `!loaded` : charger le classeur n'a de sens qu'une fois
     entré, et l'écran d'attente parlerait d'une ouverture qui n'aura
     pas lieu. */
  if (session === "out") {
    /* LE TIROIR ET LA VISITE VIENNENT AVEC, et ce n'est pas un détail :
       la porte offre les deux gestes, et ils étaient montés PLUS BAS,
       dans l'arbre du classeur, dont on sort par ce retour. Le bouton
       « ouvrir un compte » a donc mis un instant `accountOpen` à vrai
       sans que rien n'apparaisse — un bouton qui ne fait rien est pire
       qu'un bouton absent. */
    return (
      <>
        {/* LA FEUILLE GLOBALE MANQUAIT AUX DEUX ÉCRANS DE LA PORTE, et
            elle y manquait depuis toujours. Elle n'était montée que dans
            l'arbre du classeur et dans l'écran d'attente — c'est-à-dire
            APRÈS être entré. Or c'est elle qui porte les polices, les
            deux durées de mouvement, le bloc « moins d'animations », les
            correctifs du téléphone et le contour de focus : la toute
            première page qu'on voit du produit n'avait aucun des cinq.
            Trouvé en regardant la page pour de vrai, pas en la
            relisant. */}
        <style>{FONT_IMPORT}</style>
        <PaperGrain />
        <Doorstep films={showcase} onTour={() => setTourId("global")} />
        {accountOpen && (
          <AccountDrawer
            report={synchro}
            onClose={() => setAccountOpen(false)}
            onSync={rerunSync}
            /* Un compte qui s'ouvre depuis la porte fait entrer : on
               repose la question au serveur plutôt que de deviner. */
            onAccountChange={() => setAttempt((n) => n + 1)}
          />
        )}
        {tourId && (
          <TourOverlay
            tourId={tourId}
            onClose={closeTour}
            onView={tourOpensView}
            onTab={setDetailTab}
          />
        )}
      </>
    );
  }
  if (session === "unreachable") {
    return (
      <>
        <style>{FONT_IMPORT}</style>
        <Unreachable busy={false} onRetry={() => setAttempt((n) => n + 1)} />
      </>
    );
  }

  if (!loaded || session === "asking") {
    return (
      <div
        style={{
          background: C.paper,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.inkFaded,
          fontFamily: F.hand,
          fontSize: 22,
        }}
      >
        <style>{FONT_IMPORT}</style>
        ouverture du classeur…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        position: "relative",
        /* The whole background comes from the skin — it is not a colour
           but a recipe: the kraft has lighter patches where the light
           falls, a day-for-night has its cold moon, a poster has its
           screen. The fallback value is the kraft, for the first render,
           before a skin has been applied. */
        background: `var(--page-bg, ${KRAFT_FALLBACK})`,
      }}
    >
      <style>{FONT_IMPORT}</style>
      <PaperGrain />
      {/* LE PAPIER, SOUS TOUT ET SUR LE FOND DE PEAU.

          C'est une COUCHE et non un fond : le fond de la page est une
          recette de la peau — plusieurs dégradés superposés — et lui
          ajouter une image l'aurait remplacée au lieu de s'y ajouter.

          Il prend l'encre de la peau EN COURS, résolue : un `var()`
          écrit dans un SVG embarqué ne résout rien, il n'a pas la racine
          du document pour parent. C'est la même contrainte que les
          motifs de l'étagère, et c'est pour cela que `paperLayer` prend
          une couleur et jamais un jeton.

          Il vient de la mémoire locale, comme la peau : une page qui
          attend le réseau pour savoir sur quel papier elle est écrite
          est une page qui clignote à chaque ouverture. */}
      {paperLayer(paper, skinOf(skin).c.ink) && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            ...paperLayer(paper, skinOf(skin).c.ink),
          }}
        />
      )}
      <FolderTabs
        view={view}
        setView={(v) => {
          setView(v);
          setSelectedId(null);
          /* A tab is a departure, not a return: clicking "Credits"
             opens the directory, and not the last name consulted. */
          setPerson(null);
        }}
        onAdd={() => setShowModal(true)}
        onImport={openImport}
        onSearch={() => setSearch(true)}
        onSkin={() => setSkinPicker(true)}
        onLanguage={() => setLanguagePicker(true)}
        onKey={() => setKeyPanel(true)}
        onHelp={() => setTourMenu((o) => !o)}
        onAccount={() => setAccountOpen(true)}
        sync={synchro.state}
        hallNews={hallNews}
      />
      {accountOpen && (
        <AccountDrawer
          report={synchro}
          onClose={() => setAccountOpen(false)}
          onSync={rerunSync}
          onAccountChange={(person) => {
            /* THE PERSON IS PASSED ON, NOT DROPPED. It used to be
               ignored, so who one is only became true once a whole
               synchronisation had come back — and the drawer went on
               offering to sign up somebody who had just signed in. */
            noteAccount(person);
            setAccountOpen(false);
            rerunSync();
          }}
        />
      )}
      {skinPicker && (
        <SkinPicker skin={skin} onPick={setSkin} onClose={() => setSkinPicker(false)} />
      )}
      {languagePicker && (
        <LanguagePicker
          language={language}
          onPick={(lang) => {
            setLanguage(lang);
            setLanguageState(lang);
            setLanguagePicker(false);
          }}
          onClose={() => setLanguagePicker(false)}
        />
      )}
      {keyPanel && <TmdbKeyPanel onClose={() => setKeyPanel(false)} />}
      {search && (
        <SearchDrawer
          films={films}
          notes={notebook.notes}
          threads={fils}
          onClose={() => setSearch(false)}
          ouvrir={openFinding}
        />
      )}
      {/* THE COLUMN THAT MUST BE ABLE TO SHRINK.

          `flex: 1` is not enough: a flex item keeps `min-width: auto`,
          that is to say it refuses to go below the MINIMUM width of its
          content. On the wall that minimum is small — the posters fold.
          On the shelf it is the longest row of cases, which do not
          shrink: so the column stuck at twelve hundred pixels whatever
          the window, and everything past it became a horizontal
          scrollbar on the whole page — from the moment the view opened,
          with no decor to blame.

          `minWidth: 0` gives it back the right to shrink. The row then
          measures the width it REALLY has (see `useRowCap`) and lays
          down the number of cases that fit, instead of laying ten and
          pushing the window. */}
      {/* `key` RATHER THAN A CLASS SET BY HAND. An animation only
          replays if the node is new: with no key, React reuses the same
          container from one view to the next and nothing moves after the
          first render. The key also carries the open card — moving from
          one film to another through the red thread is a change of page,
          and must read as one. */}
      {/* LA COLONNE, ET LA BARRE QUI NE TOURNE PAS AVEC ELLE.

          Les sous-onglets se rendent AU-DESSUS de `[data-enters]` et non
          dedans : cette colonne rejoue son animation d'entrée à chaque
          changement de page, et une barre placée dedans se redessinerait
          sous la main à chaque clic. Or elle est exactement ce qui reste
          en place pendant qu'on tourne les pages du groupe. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <SubTabs
          view={view}
          setView={setView}
          /* LE CARNET S'OUVRE D'ICI, et n'est plus une vue. Il tient sa
             place dans la barre du classeur — parmi les pages qu'on
             écrit sur sa collection — mais il ouvre un tiroir : ce sont
             quelques pages libres, pas un onglet permanent du rail. */
          extra={
            groupOf(view)?.key === "binder" ? (
              <button
                data-tour="notebook-open"
                onClick={() => setNotebook(true)}
                title={t("notebook.title")}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: "auto",
                  padding: "6px 2px 8px",
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: C.pine,
                }}
              >
                <NotebookPen size={12} /> {t("notebook.title")}
              </button>
            ) : null
          }
        />
        <div
          data-enters
          key={`${view}:${selectedId || who || ""}`}
          style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 2 }}
        >
          {/* L'ATTENTE EST UNE PAGE DE PAPIER, PAS UN TOURNIQUET.
            Une vue chargée à la demande met quelques dizaines de
            millisecondes à arriver, et ce qu'on met dans ce trou est vu
            à chaque premier passage sur un onglet. Un rond qui tourne y
            serait la seule pièce d'interface venue d'ailleurs, dans une
            application qui est un carnet. Une feuille vide de la hauteur
            de la colonne ne dit rien, ce qui est exactement ce qu'il y a
            à dire pendant si peu de temps — et surtout elle ne fait pas
            sauter la mise en page en arrivant. */}
          {/* LA DIGUE EST DEHORS, LE SUSPENSE DEDANS, et cet ordre est
              le seul qui marche. `Suspense` connaît l'ATTENTE, jamais
              l'ÉCHEC : un `import()` refusé — un déploiement pendant
              qu'un onglet est ouvert, un réseau coupé — le traverse et
              démonte l'arbre entier. Il n'y avait aucune frontière
              d'erreur dans tout le projet, donc une page blanche, sans
              rail ni message.

              `resetKey` porte la vue : une vue tombée doit se relever
              quand on change d'onglet, sans quoi le rail deviendrait
              inerte après la première chute. */}
          <Boundary resetKey={view} what={t("trouble.viewFell")}>
            <Suspense fallback={<div style={{ minHeight: "60vh" }} aria-hidden />}>
              {view === "library" && !selectedId && (
                <LibraryView
                  onDeleteFilms={deleteFilms}
                  wall="watched"
                  films={watched}
                  ui={wallUi.watched}
                  setUi={setUiFor("watched")}
                  onUpdateMany={updateMany}
                  {...viewProps("watched")}
                  onOpen={openFilm}
                  onImport={openImport}
                  onAdd={() => setShowModal(true)}
                />
              )}
              {view === "watchlist" && !selectedId && (
                <LibraryView
                  onDeleteFilms={deleteFilms}
                  wall="watchlist"
                  films={watchlist}
                  allFilms={films}
                  ui={wallUi.watchlist}
                  setUi={setUiFor("watchlist")}
                  onUpdateMany={updateMany}
                  {...viewProps("watchlist")}
                  onOpen={openFilm}
                  onImport={openImport}
                  onAdd={() => setShowModal(true)}
                />
              )}
              {view === "detail" && selectedFilm && (
                <DetailView
                  film={selectedFilm}
                  films={films}
                  signedIn={!!synchro.person}
                  /* THE TAB IS HELD HERE, as the view already is: the guided
               tour must be able to open "Links" before going there to
               find the red thread. See `visiteOuvreOnglet`. */
                  tab={detailTab}
                  onTab={setDetailTab}
                  onBack={() => {
                    setView(backView);
                    setSelectedId(null);
                  }}
                  /* `credits.` AND NOT `detail.`: the sentence has always lived
                 with the credits, and this asked for it under the card's
                 own heading — so the back link read
                 "detail.backToCredits", in full, on screen. */
                  backTo={who ? i18n.t("credits.backToCredits") : undefined}
                  onUpdate={updateFilm}
                  onUpdateSoon={updateFilmSoon}
                  onDelete={deleteFilm}
                  onLinkFilm={linkFilms}
                  onRemoveLink={removeLink}
                  onEditLink={editLink}
                  fils={fils}
                  onStarMotif={setMotifStar}
                  onOpenInSky={openMotifInSky}
                  vocabulary={vocabulary}
                  onCreateMotif={createMotif}
                  onDeleteMotif={deleteMotif}
                  onHideMotif={hideMotif}
                  onOpen={(id) => setSelectedId(id)}
                  onOpenPerson={openPerson}
                  onAddToWatchlist={addFilm}
                />
              )}
              {view === "credits" && (
                <CreditsView
                  films={films}
                  who={who}
                  onOpenPerson={setPerson}
                  onOpen={openFilm}
                  onAddToWatchlist={addFilm}
                />
              )}
              {view === "reco" && (
                <RecoView films={films} onAddToWatchlist={addFilm} onOpen={openFilm} />
              )}
              {view === "constellation" && (
                <ConstellationView
                  films={constellationFilms}
                  fils={fils}
                  focus={skyFocus}
                  onPatchThread={patchMotifThread}
                  onDeleteMotif={deleteMotif}
                  onLinkFilm={linkFilms}
                  onOpen={openFilm}
                />
              )}
              {/* LES FILIATIONS LISENT `films` ET NON `constellationFilms`.
                  Celui-là vaut « vus, non archivés » — exactement la
                  mauvaise moitié : on planifie ce qu'on n'a PAS vu, et
                  revoir un film est un jalon légitime. Le sélecteur met
                  « à voir » en tête, il n'exclut rien. */}
              {view === "lineage" && (
                <LineageView
                  films={films}
                  courses={courses}
                  bonds={bonds}
                  onCourses={commitCourses}
                  onCoursesSoon={commitCoursesSoon}
                  onBonds={commitBonds}
                  onOpen={openFilm}
                  onOpenPerson={openPerson}
                />
              )}
              {/* The almanac reads the screening log: so it looks at the cards
            WATCHED, including those set aside in the reserve — having
            archived them does not make them unwatched. */}
              {view === "almanac" && <AlmanacView films={watched} onOpenPerson={openPerson} />}
              {view === "thread" && <ThreadView connected={!!synchro.person} />}
              {view === "lists" && <ListsView connected={!!synchro.person} />}
              {view === "quiz" && <QuizView connected={!!synchro.person} />}
              {view === "counter" && (
                <CounterView connected={!!synchro.person} onGo={(where) => setView(where)} />
              )}
              {view === "skinlab" && import.meta.env.DEV && <SkinLab />}
              {view === "import" && (
                <ImportView
                  onImport={importFilms}
                  films={films}
                  notes={notebook.notes}
                  dividers={dividers}
                  views={views}
                  fils={fils}
                  motifs={vocabulary}
                  filiations={bonds}
                  parcours={courses}
                  onRestore={restoreBackup}
                  onSeeWall={() => {
                    setSelectedId(null);
                    setView(HOME);
                  }}
                />
              )}
            </Suspense>
          </Boundary>
        </div>
      </div>
      {notebookOpen && (
        <NotebookDrawer
          notes={notebook.notes}
          onAdd={notebook.add}
          onUpdate={notebook.update}
          onDelete={notebook.remove}
          onClose={() => setNotebook(false)}
        />
      )}
      {showModal && <FilmModal onClose={() => setShowModal(false)} onSave={addFilm} />}

      {/* THE TOUR, outside the animated column.

          `[data-enters]` carries a transform for the length of its
          entrance, and a transformed ancestor becomes the containing
          block of any `position: fixed` inside it: the veil would have
          anchored on the column instead of the window, and the hole
          would have aimed beside the mark on every change of view. */}
      {/* UNE SEULE À LA FOIS, et dans cet ordre. La version neuve
          d'abord : elle attend déjà, et rien d'autre ne se joue tant
          qu'on n'a pas rechargé. Le compte seul ensuite, parce que c'est
          le seul des trois qui puisse coûter quelque chose. L'invitation
          à installer en dernier, qui ne perd rien à attendre. */}
      {/* L'ANNULATION PASSE DEVANT TOUT : c'est la seule carte qui a une
          date limite. Les autres disent un état qui sera encore là dans
          une minute. */}
      {undo ? (
        <UndoCard
          what={t(undo.label, { count: undo.count })}
          onUndo={() => {
            const held = undoHeld.current;
            /* Sans balayage : le nettoyage tombe, donc les affiches
               restent, donc les fiches reviennent entières. */
            closeUndo(false);
            if (!held) return;
            commitFilms(held.films);
            if (held.notes) notebook.replaceAll(held.notes);
          }}
          onDismiss={() => closeUndo(true)}
        />
      ) : quota !== null ? (
        <QuotaCard
          failed={quota < 0}
          megabytes={Math.round(quota / 100_000) / 10}
          onBackup={() => {
            setQuota(null);
            openImport();
          }}
          onDismiss={() => setQuota(null)}
        />
      ) : updateReady ? (
        <UpdateCard onReload={() => updateServiceWorker(true)} />
      ) : loneDevice ? (
        <LoneDeviceCard
          onOpenAccount={() => {
            setLoneDevice(false);
            setAccountOpen(true);
          }}
          onDismiss={() => setLoneDevice(false)}
        />
      ) : (
        installation.invite && (
          <Installation
            apple={installation.apple}
            onInstall={installation.installer}
            onDismiss={installation.dismiss}
          />
        )
      )}

      {tourMenu && <TourMenu view={view} onPlay={playTour} onClose={() => setTourMenu(false)} />}
      <TourOverlay
        tourId={tourId}
        onClose={closeTour}
        onView={tourOpensView}
        onTab={setDetailTab}
      />
      {hint && !tourId && (
        <TourHint onReplay={() => playTour("global")} onDismiss={() => setHint(false)} />
      )}
    </div>
  );
}
