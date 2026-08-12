import { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import { pruneOrphans } from "./db";
import { CAT_KEYS } from "./shelf-views";
import { C, F, FONT_IMPORT } from "./theme/tokens";
import { applySkin, loadSkinKey, saveSkinKey } from "./theme/applySkin";
import { uid, migrate, editLinkedWork } from "./domain/film";
import { normalize } from "./domain/search";
import { inverseOf, strengthOf } from "./domain/relations";
import { makeThread, normalizeThreads } from "./domain/threads";
import { motifById, makeCustomMotif, customMotifs } from "./domain/motifs";
import { loadThreads, saveThreads as saveFilsToDisk } from "./services/threads";
import { loadVocabulaire, saveVocabulaire, normalizeVocabulaire } from "./services/motifs";
import { store, KEYS } from "./services/storage";
import { loadFilms, knownCollection, saveFilms, forgetCache } from "./services/collection";
import { PaperGrain } from "./components/atmosphere";
import { FilmModal } from "./components/film/FilmModal";
import { FolderTabs } from "./components/layout/FolderTabs";
import { useViewport } from "./hooks/useViewport";
import { usePointerDrag } from "./hooks/usePointerDrag";
import { SkinPicker } from "./components/layout/SkinPicker";
import { Installation, MiseÀJour } from "./components/layout/Installation";
import { CompteDrawer } from "./components/layout/CompteDrawer";
import { TmdbKeyPanel } from "./components/layout/TmdbKeyPanel";
import { registerTmdbOpener } from "./services/tmdbKey";
import { useSynchro } from "./hooks/useSynchro";
import { useInstallation } from "./hooks/useInstallation";
/* The module only exists at build time: it is the plugin that makes it,
   with the address of the service worker it has just written. */
import { useRegisterSW } from "virtual:pwa-register/react";
import { SearchDrawer } from "./components/layout/SearchDrawer";
import { WALLS } from "./views/library/walls";
import { NotebookView } from "./views/NotebookView";
import { GeneriqueView } from "./views/GeneriqueView";
import { RecoView } from "./views/RecoView";
import { DetailView } from "./views/DetailView";
import { ImportView } from "./views/import/ImportView";
import { FilView } from "./views/FilView";
import { ListesView } from "./views/ListesView";
import { viewKey, saveViewIndex, deleteViewKey, ensureViews } from "./services/shelfViews";
import { ConstellationView } from "./views/ConstellationView";
import { LibraryView } from "./views/library/LibraryView";
import { AlmanacView } from "./views/AlmanacView";
import { SkinLab } from "./views/dev/SkinLab";
import { useNotes } from "./hooks/useNotes";
import { useShelfViews } from "./hooks/useShelfViews";
import { TourOverlay, TourHint, TourMenu } from "./components/tour";
import { isFirstRun, shouldHint, shouldSeed, markSeeded } from "./services/onboarding";
import {
  classeurEncoreDémo,
  filmsDeDémonstration,
  notesDeDémonstration,
  sansDémo,
  PRÉFIXE_DÉMO,
} from "./services/demo";
import { BandeauDémo } from "./components/layout/BandeauDemo";

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
  const [fils, setFils] = useState([]);
  /* The vocabulary: the motifs you wrote, and those of the catalogue you
     set aside. The catalogue itself lives in the code — see
     `domain/motifs`. The React state only serves to redraw: it is the
     domain's register that answers `motifById`, everywhere else. */
  const [vocabulaire, setVocabulaire] = useState({ custom: [], hidden: [] });
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library");
  const [selectedId, setSelectedId] = useState(null);
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
  const [ongletChoisi, setOngletChoisi] = useState({ pour: null, onglet: "film" });
  const detailOnglet = ongletChoisi.pour === selectedId ? ongletChoisi.onglet : "film";
  /* Stable from one render to the next: the tour uses it inside an
     effect, and a function rebuilt on every pass would restart it
     endlessly. Hence the ref — it carries the current card without
     entering the dependencies. */
  const ficheOuverte = useRef(null);
  /* Written AFTER the render and not during: reading or writing a ref in
     the middle of a render is what the React compiler refuses, and it is
     right — a render must be replayable without side effects. */
  useEffect(() => {
    ficheOuverte.current = selectedId;
  }, [selectedId]);
  const setDetailOnglet = useCallback(
    (onglet) => setOngletChoisi({ pour: ficheOuverte.current, onglet }),
    []
  );
  /* The person open in the Credits view, by their normalized key.
     Alongside `selectedId` and not instead of it: you open a person FROM
     a card, and going back to the card must not have forgotten which. */
  const [personne, setPersonne] = useState(null);
  const [showModal, setShowModal] = useState(false);
  /* The search that cuts across everything. A state and not a view: it
     replaces no tab, it passes over them and closes behind itself. */
  const [recherche, setRecherche] = useState(false);

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
  useEffect(() => {
    const onKey = (e) => {
      if (e.key?.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setRecherche((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [skin, setSkin] = useState(loadSkinKey);
  const [skinPicker, setSkinPicker] = useState(false);
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
    let vivant = true;
    loadFilms().then(async (chargés) => {
      if (!vivant) return;
      /* THE DEMONSTRATION BINDER, AND ONLY HERE.

         This is the only place where we know both that the collection is
         empty and that it always has been. The sowing goes through the
         store — never through `store.set` — so that the twelve cards go
         down into the vault like the others, and it comes before
         `ensureViews`: the shelf is then built on a real collection
         instead of rebuilding itself on the next render. See
         `services/demo` for what those twelve films contain, and why. */
      let migrated = chargés;
      if (!chargés.length && shouldSeed()) {
        migrated = await saveFilms(filmsDeDémonstration());
        /* The notebook only receives its page if it is empty: somebody
           may have written before having a single film. */
        if (!store.get(KEYS.notes, []).length) store.set(KEYS.notes, notesDeDémonstration());
        markSeeded();
        if (!vivant) return;
      }
      setFilms(migrated);
      notebook.load();
      const tabs = store.get("shelf-dividers", []);
      setDividers(tabs);
      setFils(loadThreads());
      setVocabulaire(loadVocabulaire());
      /* The migration reads `order` and `status`, which the store has
         just normalized: it must therefore come after, and work on the
         migrated cards — not on what comes off the disk. */
      setViews(
        ensureViews({ films: migrated, dividers: tabs, wallPrefs: store.get("wall-prefs", {}) })
      );
      setLoaded(true);
    });
    return () => {
      vivant = false;
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
  const [accountOpen, setCompteOuvert] = useState(false);
  /* RE-READ WHAT HAS JUST ARRIVED. The shelf arrangements, the notebook,
     the threads and the vocabulary are read on mount: when the
     synchronisation brings some in, they have to be asked of the disk
     again, otherwise the screen keeps the old ones without a word. */
  const relireLesDocuments = useCallback(() => {
    notebook.load();
    setFils(loadThreads());
    setVocabulaire(loadVocabulaire());
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

  const { report: synchro, synchronise: relancerSynchro } = useSynchro(
    loaded,
    setFilms,
    relireLesDocuments
  );

  const installation = useInstallation();
  const {
    needRefresh: [majPrête],
    updateServiceWorker,
  } = useRegisterSW();

  /* The first opening starts the full tour — but AFTER the load,
     otherwise it points at targets the binder has not laid down yet and
     opens nothing but a veil over the waiting screen. */
  useEffect(() => {
    if (!loaded) return;
    if (isFirstRun()) setTourId("global");
    else if (shouldHint()) setHint(true);
  }, [loaded]);

  const jouerVisite = (id) => {
    setTourMenu(false);
    setHint(false);
    setTourId(id);
  };

  /* Waving the tour away makes nothing appear at once: the reminder card
     would arrive on the very gesture that has just refused it. It waits
     for the next opening, where it has a chance of being read. */
  const fermerVisite = () => setTourId(null);

  /* Stable from one render to the next: the tour uses it inside an
     effect, and a function rebuilt on every pass would restart it
     endlessly. Re-applying the view already open costs nothing — React
     drops the update when the value does not change, and the effect
     stays quiet. */
  const visiteOuvreVue = useCallback((v) => {
    setView(v);
    setSelectedId(null);
  }, []);

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

     Every keystroke calls `saveFilms`. The first `setFilms` puts the
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
  const rangÉcriture = useRef(0);
  const saveFilms = (next) => {
    setFilms(next);
    const rang = ++rangÉcriture.current;
    saveFilms(next).then((datés) => {
      if (rang === rangÉcriture.current) setFilms(datés);
    });
  };

  /* REMOVING THE EXAMPLE. The banner only shows as long as the binder is
     NOTHING BUT the example: so we erase everything, without having to
     sort. The notebook page goes with it — it talks about the twelve
     films. */
  const retirerDémo = () => {
    saveFilms(sansDémo(films));
    notebook.replaceAll(notebook.notes.filter((n) => !n.id.startsWith(PRÉFIXE_DÉMO)));
    setSelectedId(null);
  };

  const commitFils = (next) => {
    setFils(next);
    saveFilsToDisk(next);
  };

  const commitVocabulaire = (next) => {
    setVocabulaire(next);
    saveVocabulaire(next);
  };

  /* Writing a motif of one's own. Making it SET on the open card at
     once: you never create one in the abstract, but because you have
     just watched that film and no word said it. */
  const créerMotif = (label, famille, spoiler) => {
    const propre = (label || "").trim();
    if (!propre) return null;
    const existant = [...customMotifs()].find(
      (m) => m.label.toLowerCase() === propre.toLowerCase()
    );
    if (existant) return existant.id;
    const motif = makeCustomMotif(propre, famille, spoiler);
    commitVocabulaire({ ...vocabulaire, custom: [...vocabulaire.custom, motif] });
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
  const supprimerMotif = (motifId) => {
    commitVocabulaire({
      ...vocabulaire,
      custom: vocabulaire.custom.filter((m) => m.id !== motifId),
    });
    saveFilms(
      films.map((f) =>
        (f.motifs || []).includes(motifId)
          ? { ...f, motifs: f.motifs.filter((id) => id !== motifId) }
          : f
      )
    );
    const touchés = fils.filter((f) => f.motif === motifId);
    if (touchés.length)
      commitFils(fils.map((f) => (f.motif === motifId ? { ...f, motif: null } : f)));
  };

  /* Setting aside, and not deleting: a catalogue motif is not yours, and
     erasing it from your data would see it come back on the next update.
     The cards carrying it keep it — hiding rewrites nothing. */
  const masquerMotif = (motifId, masqué) =>
    commitVocabulaire({
      ...vocabulaire,
      hidden: masqué
        ? [...new Set([...vocabulaire.hidden, motifId])]
        : vocabulaire.hidden.filter((id) => id !== motifId),
    });

  const addFilm = (film) => {
    saveFilms([film, ...films]);
    setShowModal(false);
  };

  /* Opening somebody from a card. The key is normalized HERE and once
     only: the Credits view files its dossiers under the same one, and
     two ways of writing it would make two people. */
  const ouvrirPersonne = (nom) => {
    setPersonne(normalize(nom));
    setView("generique");
  };

  /* WHAT WE DO WITH A HIT, according to its nature.

     A motif has no view of its own: so we open the video library with
     its search set on the label. That is not a makeshift — the wall
     ALREADY searches the motifs (`domain/search`), and the result is
     exactly "the cards carrying this motif", written with the tools that
     exist rather than with one more filter. */
  const ouvrirTrouvaille = {
    film: (id) => {
      setSelectedId(id);
      setView("detail");
    },
    person: (clé) => {
      setPersonne(clé);
      setView("generique");
    },
    page: () => setView("notebook"),
    motif: (label) => {
      setSelectedId(null);
      setUiFor("watched")({ ...wallUi.watched, q: label });
      setView("library");
    },
    thread: () => setView("constellation"),
  };
  const updateFilm = (film) => saveFilms(films.map((f) => (f.id === film.id ? film : f)));
  /* Filing a case renumbers a whole shelf: one write, not thirty. */
  const updateMany = (patches) =>
    saveFilms(films.map((f) => (patches[f.id] ? { ...f, ...patches[f.id] } : f)));
  const deleteFilm = (id) => {
    const next = films.filter((f) => f.id !== id);
    saveFilms(next);
    pruneOrphans(next).catch(console.error); // l'affiche part avec la fiche
    setView("library");
    setSelectedId(null);
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
    saveFilms(
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
  const faireUnFilDuMotif = (motifId) => {
    const déjà = fils.find((f) => f.motif === motifId);
    if (déjà) {
      setView("constellation");
      return;
    }
    const motif = motifById(motifId);
    if (!motif) return;
    commitFils([
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
    saveFilms(editLinkedWork(films, ownerId, workId, patch));

  /* Undoing a link: the reciprocal half goes with it. */
  const removeLink = (ownerId, workId) => {
    const owner = films.find((f) => f.id === ownerId);
    const work = (owner?.linkedWorks || []).find((w) => w.id === workId);
    if (!work) return;
    saveFilms(
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
    saveFilms(migrated);
    commitFils(normalizeThreads(fl || []));
    commitVocabulaire(normalizeVocabulaire(mo || {}));
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
    saveFilms([...toCreate, ...merged]);
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
     dossier leads back to that dossier — otherwise, following a
     cinematographer from film to film would mean finding them again
     every time. */
  const backView = personne
    ? "generique"
    : selectedFilm?.status === "watchlist"
      ? "watchlist"
      : "library";

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
          setPersonne(null);
        }}
        onAdd={() => setShowModal(true)}
        onSearch={() => setRecherche(true)}
        onSkin={() => setSkinPicker(true)}
        onKey={() => setKeyPanel(true)}
        onHelp={() => setTourMenu((o) => !o)}
        onCompte={() => setCompteOuvert(true)}
        synchro={synchro.state}
      />
      {accountOpen && (
        <CompteDrawer
          bilan={synchro}
          onFermer={() => setCompteOuvert(false)}
          onSynchroniser={relancerSynchro}
          onChangement={() => {
            setCompteOuvert(false);
            relancerSynchro();
          }}
        />
      )}
      {skinPicker && (
        <SkinPicker skin={skin} onPick={setSkin} onClose={() => setSkinPicker(false)} />
      )}
      {keyPanel && <TmdbKeyPanel onClose={() => setKeyPanel(false)} />}
      {recherche && (
        <SearchDrawer
          films={films}
          notes={notebook.notes}
          threads={fils}
          onClose={() => setRecherche(false)}
          ouvrir={ouvrirTrouvaille}
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
      <div
        data-enters
        key={`${view}:${selectedId || personne || ""}`}
        style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 2 }}
      >
        {view === "library" && !selectedId && (
          <LibraryView
            wall="watched"
            films={watched}
            ui={wallUi.watched}
            setUi={setUiFor("watched")}
            onUpdateMany={updateMany}
            {...viewProps("watched")}
            onOpen={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
          />
        )}
        {view === "watchlist" && !selectedId && (
          <LibraryView
            wall="watchlist"
            films={watchlist}
            tousLesFilms={films}
            ui={wallUi.watchlist}
            setUi={setUiFor("watchlist")}
            onUpdateMany={updateMany}
            {...viewProps("watchlist")}
            onOpen={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
          />
        )}
        {view === "detail" && selectedFilm && (
          <DetailView
            film={selectedFilm}
            films={films}
            connecte={!!synchro.person}
            /* THE TAB IS HELD HERE, as the view already is: the guided
               tour must be able to open "Links" before going there to
               find the red thread. See `visiteOuvreOnglet`. */
            onglet={detailOnglet}
            onOnglet={setDetailOnglet}
            onBack={() => {
              setView(backView);
              setSelectedId(null);
            }}
            retourVers={personne ? "RETOUR AU GÉNÉRIQUE" : undefined}
            onUpdate={updateFilm}
            onDelete={deleteFilm}
            onLinkFilm={linkFilms}
            onRemoveLink={removeLink}
            onEditLink={editLink}
            onFaireUnFil={faireUnFilDuMotif}
            vocabulaire={vocabulaire}
            onCréerMotif={créerMotif}
            onSupprimerMotif={supprimerMotif}
            onMasquerMotif={masquerMotif}
            onOpen={(id) => setSelectedId(id)}
            onOpenPerson={ouvrirPersonne}
            onAddToWatchlist={addFilm}
          />
        )}
        {view === "generique" && (
          <GeneriqueView
            films={films}
            personne={personne}
            onOpenPersonne={setPersonne}
            onOpen={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
            onAddToWatchlist={addFilm}
          />
        )}
        {view === "reco" && (
          <RecoView
            films={films}
            onAddToWatchlist={addFilm}
            onOpen={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
          />
        )}
        {view === "constellation" && (
          <ConstellationView
            films={constellationFilms}
            fils={fils}
            onLinkFilm={linkFilms}
            onOpen={(id) => {
              setSelectedId(id);
              setView("detail");
            }}
          />
        )}
        {view === "notebook" && (
          <NotebookView
            notes={notebook.notes}
            onAdd={notebook.add}
            onUpdate={notebook.update}
            onDelete={notebook.remove}
          />
        )}
        {/* The almanac reads the screening log: so it looks at the cards
            WATCHED, including those set aside in the reserve — having
            archived them does not make them unwatched. */}
        {view === "almanac" && <AlmanacView films={watched} onOpenPerson={ouvrirPersonne} />}
        {view === "fil" && <FilView connecte={!!synchro.person} />}
        {view === "listes" && <ListesView connecte={!!synchro.person} />}
        {view === "skinlab" && import.meta.env.DEV && <SkinLab />}
        {view === "import" && (
          <ImportView
            onImport={importFilms}
            films={films}
            notes={notebook.notes}
            dividers={dividers}
            views={views}
            fils={fils}
            motifs={vocabulaire}
            onRestore={restoreBackup}
          />
        )}
      </div>
      {showModal && <FilmModal onClose={() => setShowModal(false)} onSave={addFilm} />}

      {/* THE TOUR, outside the animated column.

          `[data-enters]` carries a transform for the length of its
          entrance, and a transformed ancestor becomes the containing
          block of any `position: fixed` inside it: the veil would have
          anchored on the column instead of the window, and the hole
          would have aimed beside the mark on every change of view. */}
      {majPrête ? (
        <MiseÀJour onRecharger={() => updateServiceWorker(true)} />
      ) : (
        installation.invite && (
          <Installation
            apple={installation.apple}
            onInstaller={installation.installer}
            onÉcarter={installation.dismiss}
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
      {classeurEncoreDémo(films) && <BandeauDémo onRetirer={retirerDémo} />}
      {tourMenu && <TourMenu view={view} onPlay={jouerVisite} onClose={() => setTourMenu(false)} />}
      <TourOverlay
        tourId={tourId}
        onClose={fermerVisite}
        onView={visiteOuvreVue}
        onTab={setDetailOnglet}
      />
      {hint && !tourId && (
        <TourHint onReplay={() => jouerVisite("global")} onDismiss={() => setHint(false)} />
      )}
    </div>
  );
}
