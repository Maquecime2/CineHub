import {
  useState,
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
import i18n, { loadLanguage, setLanguage } from "./i18n";
import { uid, migrate, editLinkedWork } from "./domain/film";
import { normalize } from "./domain/search";
import { inverseOf, strengthOf } from "./domain/relations";
import { makeThread, normalizeThreads } from "./domain/threads";
import { motifById, makeCustomMotif, customMotifs } from "./domain/motifs";
import { loadThreads, saveThreads as saveThreadsToDisk } from "./services/threads";
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
} from "./components/layout/Installation";
import { AccountDrawer } from "./components/layout/AccountDrawer";
import { TmdbKeyPanel } from "./components/layout/TmdbKeyPanel";
import { registerTmdbOpener } from "./services/tmdbKey";
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
import { TourOverlay, TourHint, TourMenu } from "./components/tour";
import { shouldHint, shouldSeed, markSeeded } from "./services/onboarding";
import { binderStillDemo, demoFilms, demoNotes, withoutDemo, DEMO_PREFIX } from "./services/demo";
import { DemoBanner } from "./components/layout/DemoBanner";
import { readPlace, placeToHash, HOME } from "./domain/address";
import { shortcutOf } from "./domain/keys";
import { startMeasuring, pageSeen, doorEvent } from "./services/measure";
import { mayNudge, noteNudge } from "./services/loneDevice";
import { myKeys } from "./services/server";

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

  const [skin, setSkin] = useState(loadSkinKey);
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

  /* LOADING HAS BECOME ASYNCHRONOUS, and that is the vault's price. The
     collection moves down into IndexedDB — several gigabytes instead of
     `localStorage`'s five megabytes, which was already warning that it
     was overflowing. The store (`services/collection`) knows where to
     read from, moves what it finds upstairs down there, and completes
     cards from before the status/watchedAt/tmdbId fields on the way. */
  useEffect(() => {
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
        /* THE DEMONSTRATION BINDER, AND ONLY HERE.

           This is the only place where we know both that the collection is
           empty and that it always has been. The sowing goes through the
           store — never through `store.set` — so that the twelve cards go
           down into the vault like the others, and it comes before
           `ensureViews`: the shelf is then built on a real collection
           instead of rebuilding itself on the next render. See
           `services/demo` for what those twelve films contain, and why. */
        let migrated = loaded;
        if (!loaded.length && shouldSeed()) {
          /* Sown in the language in force AT THAT MOMENT, and never sown
             again: the example becomes the reader's own cards, which they
             may rename and rewrite. Re-translating them on a change of
             language would overwrite what somebody had just written. */
          migrated = await saveFilms(demoFilms(i18n.t.bind(i18n)));
          /* The notebook only receives its page if it is empty: somebody
             may have written before having a single film. */
          if (!store.get(KEYS.notes, []).length)
            store.set(KEYS.notes, demoNotes(i18n.t.bind(i18n)));
          markSeeded();
          if (!alive) return;
        }
        setFilms(migrated);
        notebook.load();
        const tabs = store.get("shelf-dividers", []);
        setDividers(tabs);
        setThreads(loadThreads());
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
  }, []);

  /* THE GUIDED TOUR. Three states only: the tour running, the help menu,
     and the reminder card. All the rest — which steps, in what order,
     what has already been seen — lives elsewhere.

     It is mounted HERE and not in a view: it crosses the views, and
     would no longer be there on the first change of tab. */
  const [tourId, setTourId] = useState(null);
  const [tourMenu, setTourMenu] = useState(false);
  const [hint, setHint] = useState(false);

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
  const [accountOpen, setAccountOpen] = useState(false);
  /* RE-READ WHAT HAS JUST ARRIVED. The shelf arrangements, the notebook,
     the threads and the vocabulary are read on mount: when the
     synchronisation brings some in, they have to be asked of the disk
     again, otherwise the screen keeps the old ones without a word. */
  const rereadDocuments = useCallback(() => {
    notebook.load();
    setThreads(loadThreads());
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
  const commitFilms = (next) => {
    setFilms(next);
    const rank = ++writeRank.current;
    saveFilms(next).then((dated) => {
      if (rank === writeRank.current) setFilms(dated);
    });
  };

  /* REMOVING THE EXAMPLE. The banner only shows as long as the binder is
     NOTHING BUT the example: so we erase everything, without having to
     sort. The notebook page goes with it — it talks about the twelve
     films. */
  const removeDemo = () => {
    commitFilms(withoutDemo(films));
    notebook.replaceAll(notebook.notes.filter((n) => !n.id.startsWith(DEMO_PREFIX)));
    setSelectedId(null);
    /* Retirer l'exemple est le geste de quelqu'un qui a décidé de rester
       — c'est à ce titre qu'on le compte, et non pour l'exemple. */
    doorEvent("porte:demo-retiree");
  };

  const commitThreads = (next) => {
    setThreads(next);
    saveThreadsToDisk(next);
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

     The threads built on it lose their source and keep the members set
     by hand: a thread is not destroyed by its motif disappearing, it
     becomes a list again. */
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
    const touched = fils.filter((f) => f.motif === motifId);
    if (touched.length)
      commitThreads(fils.map((f) => (f.motif === motifId ? { ...f, motif: null } : f)));
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
  /* Filing a case renumbers a whole shelf: one write, not thirty. */
  const updateMany = (patches) =>
    commitFilms(films.map((f) => (patches[f.id] ? { ...f, ...patches[f.id] } : f)));
  const deleteFilm = (id) => {
    const next = films.filter((f) => f.id !== id);
    commitFilms(next);
    pruneOrphans(next).catch(console.error); // l'affiche part avec la fiche
    setView("library");
    setSelectedId(null);
  };

  /* PLUSIEURS D'UN COUP, DEPUIS LE MUR. Passer par `deleteFilm` en
     boucle aurait écrit la collection autant de fois qu'on supprime de
     films — et chaque écriture repart en synchro. Un seul filtre, une
     seule écriture, une seule tombe posée par fiche. */
  const deleteFilms = (ids) => {
    const gone = new Set(ids);
    if (gone.size === 0) return;
    const next = films.filter((f) => !gone.has(f.id));
    commitFilms(next);
    pruneOrphans(next).catch(console.error);
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

  /* Turning a motif into a question put to the whole collection.

     The thread does NOT enumerate the films at the moment it is created:
     it holds the motif, and recomposes itself on every read. That is
     what makes a card tagged tomorrow enter it without anyone coming
     back to it — a frozen thread would be wrong within a week.

     Setting the same motif again does not create a duplicate: we reopen
     the one that already exists. */
  const makeThreadFromMotif = (motifId) => {
    const existing = fils.find((f) => f.motif === motifId);
    if (existing) {
      setView("constellation");
      return;
    }
    const motif = motifById(motifId);
    if (!motif) return;
    commitThreads([
      ...fils,
      makeThread({
        label: motif.label,
        motif: motifId,
        color: CAT_KEYS[fils.length % CAT_KEYS.length],
      }),
    ]);
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
  const restoreBackup = ({ films: f, notes: n, dividers: d, views: v, fils: fl, motifs: mo }) => {
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
    commitFilms([...toCreate, ...merged]);
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
      mode: saved[wall]?.mode || "wall",
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

  /* Everything a wall's shelf needs, gathered in one place: the view it
     shows, the list of those to switch between, and the gestures that
     make them born, renamed or gone. */
  const viewProps = (wall) => {
    const id = activeViewId(wall);
    return {
      shelfView: id ? views.docs[id] : null,
      shelfViews: (views.byWall[wall] || []).map((x) => views.docs[x]).filter(Boolean),
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

  if (!loaded) {
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
                onDelete={deleteFilm}
                onLinkFilm={linkFilms}
                onRemoveLink={removeLink}
                onEditLink={editLink}
                onMakeThread={makeThreadFromMotif}
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
                onLinkFilm={linkFilms}
                onOpen={openFilm}
              />
            )}
            {/* The almanac reads the screening log: so it looks at the cards
            WATCHED, including those set aside in the reserve — having
            archived them does not make them unwatched. */}
            {view === "almanac" && <AlmanacView films={watched} onOpenPerson={openPerson} />}
            {view === "thread" && <ThreadView connected={!!synchro.person} />}
            {view === "lists" && <ListsView connected={!!synchro.person} />}
            {view === "quiz" && <QuizView connected={!!synchro.person} />}
            {view === "counter" && <CounterView connected={!!synchro.person} />}
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
                onRestore={restoreBackup}
                onSeeWall={() => {
                  setSelectedId(null);
                  setView(HOME);
                }}
              />
            )}
          </Suspense>
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
      {quota !== null ? (
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

      {/* THE EXAMPLE ANNOUNCES ITSELF, AND ON EVERY VIEW: it is the whole
          collection that is not yours, not one tab.

          MOUNTED HERE AND NOT IN THE VIEW COLUMN, and through `Layer`
          like everything that floats. Placed in the flow above the view,
          it pushed everything down by some sixty pixels — and the
          almanac, which promises to fit in the window with no scrollbar,
          started scrolling by exactly that height. A taped card moves
          nothing, and it is the shape the binder already gives its other
          sentences (see `Installation`). */}
      {binderStillDemo(films) && <DemoBanner onRemove={removeDemo} onImport={openImport} />}
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
