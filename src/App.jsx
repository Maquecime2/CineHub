import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import {
  Pin,
  Paperclip,
  Plus,
  X,
  Trash2,
  ArrowLeft,
  Upload,
  Star,
  BookOpen,
  Palette,
  Clapperboard,
  Sparkles,
  Link2,
  LayoutGrid,
  Library,
  Archive,
  ArchiveRestore,
  Moon,
} from "lucide-react";
import Papa from "papaparse";
import { enrichRows, checkApiKey, listPosters, POSTER_BASE, POSTER_THUMB } from "./tmdb";
import { buildTaste } from "./taste";
import { gatherCandidates, rank, DEFAULT_QUERY } from "./reco";
import {
  IDB_PREFIX,
  isIdbPoster,
  idbKeyOf,
  putImage,
  getImage,
  deleteImage,
  posterStats,
  pruneOrphans,
  exportBackup,
  importBackup,
} from "./db";
import {
  SHELF_KINDS,
  CAT_KEYS,
  VIEW_VERSION,
  belongs,
  isUnplaced,
  makeView,
  makeCat,
  makeDecor,
  reconcileView,
  moveItem,
  sortIntoRows,
  buildViewsFromLegacy,
  duplicateView,
  reflowView,
  layoutView,
  layoutByDirector,
  upgradeView,
  DEFAULT_CAP,
  capFor,
  patchRow,
  addRow,
  removeRow,
  clearRow,
  addCat,
  patchCat,
  removeCat,
  patchDecor,
  removeDecor,
} from "./shelf-views";
import { C, F, FONT_IMPORT, GRAIN } from "./theme/tokens";
import { applySkin, loadSkinKey, saveSkinKey } from "./theme/applySkin";

/* Le kraft d'origine, pour le tout premier rendu — avant qu'une peau
   ait ete posee. La meme recette vit dans `theme/skins`, sous la peau
   « carnet » : deux endroits pour une chose, mais l'un des deux doit
   pouvoir servir sans qu'aucun module ait tourne. */
const KRAFT_FALLBACK = `
  radial-gradient(circle at 18% 12%, #F5EDD8 0%, transparent 45%),
  radial-gradient(circle at 82% 68%, #F2E9D2 0%, transparent 40%),
  radial-gradient(circle at 55% 100%, #E5D6B4 0%, transparent 50%),
  #EEE3CC`;
import { tapeColor, hueOf } from "./theme/ink";
import { hash, seededRand, tiltOf, usesPin, nudgeOf, fileNoOf, tornClip } from "./domain/seeded";
import { uid, makeFilm, migrate, editLinkedWork } from "./domain/film";
import { slugOf, filmKey, parseRating, parseLetterboxdCsv, diffImport } from "./domain/importing";
import { workKey, buildSky, relax } from "./domain/sky";
import { store } from "./services/storage";
import { underlineInput, ruledTextarea } from "./theme/styles";
import { LINK_TYPES } from "./components/film/linkTypes";
import {
  PaperGrain,
  CoffeeRing,
  TapeResidue,
  InkUnderline,
  FileNumber,
  Tape,
  PushPin,
  StampCorner,
} from "./components/atmosphere";
import { InkStars, Label } from "./components/ui";
import { PosterArt } from "./components/film/PosterArt";
import { FilmPolaroid } from "./components/film/FilmPolaroid";
import { FilmModal } from "./components/film/FilmModal";
import { FolderTabs } from "./components/layout/FolderTabs";
import { SkinPicker } from "./components/layout/SkinPicker";
import { FilmWall } from "./views/library/FilmWall";
import { WALLS } from "./views/library/walls";
import { ThreadBoard } from "./components/film/ThreadBoard";
import { IdbImage } from "./components/stills/IdbImage";
import { StillLightbox } from "./components/stills/StillLightbox";
import { RichText } from "./components/stills/RichText";
import { RichField } from "./components/stills/RichField";
import { StillsStrip } from "./components/stills/StillsStrip";
import { STILL_TOKEN } from "./components/stills/tokens";
import { NotebookView } from "./views/NotebookView";
import { RecoView } from "./views/RecoView";
import { DetailView } from "./views/DetailView";
import { ImportView } from "./views/import/ImportView";
import {
  viewKey,
  saveViewIndex,
  saveView,
  deleteViewKey,
  ensureViews,
} from "./services/shelfViews";
import {
  SHELF_KIND,
  BOX_W,
  BOX_H,
  GAP_X,
  GAP_Y,
  CAT_COLORS,
  catInk,
  THEMES,
  themeOf,
  DECOR_TYPES,
  DECOR_BY_KEY,
  DECOR_SIZES,
  MARK_W,
  MARK_H,
  DROP_MARK_STYLE,
} from "./components/shelf/constants";
import { ConstellationView } from "./views/ConstellationView";
import { TagChip, TagEditor } from "./components/ui/TagEditor";
import { PosterPicker } from "./components/film/PosterPicker";
import { imageSize, shrinkImage } from "./services/images";
import { LibraryView } from "./views/library/LibraryView";
import { useNotes } from "./hooks/useNotes";
import { useShelfViews } from "./hooks/useShelfViews";

/* Réexportés le temps de la migration : shelf-views et les tests les
   importent encore depuis ce fichier. */
export { makeFilm, migrate, slugOf, filmKey, parseRating, parseLetterboxdCsv, diffImport };

export default function App() {
  const [films, setFilms] = useState([]);
  const notebook = useNotes();
  const shelf = useShelfViews(films);
  const { views, setViews } = shelf;
  /* Les intercalaires ne sont plus du mobilier vivant : la migration les a
     versés dans les vues. On les garde en mémoire pour pouvoir refabriquer
     une vue depuis une vieille sauvegarde, et on ne les réécrit jamais. */
  const [dividers, setDividers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library");
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  /* LA PEAU DU SITE. Elle est ici en etat React pour une seule raison :
     le selecteur doit savoir laquelle est posee pour la marquer. Ce
     n'est PAS par elle que le site se repeint — c'est `applySkin` qui
     ecrit des variables sur la racine du document, et les vingt-neuf
     fichiers qui lisent les jetons n'en savent rien.

     Posee en `useLayoutEffect` et non `useEffect` : entre les deux, le
     navigateur peint une fois, et l'on verrait le kraft passer avant la
     peau choisie a chaque chargement. */
  const [skin, setSkin] = useState(loadSkinKey);
  const [skinPicker, setSkinPicker] = useState(false);
  useLayoutEffect(() => {
    applySkin(skin);
    saveSkinKey(skin);
  }, [skin]);

  useEffect(() => {
    // les fiches d'avant les champs status/watchedAt/tmdbId sont complétées ici
    const migrated = migrate(store.get("films", []));
    setFilms(migrated);
    store.set("films", migrated);
    notebook.load();
    const tabs = store.get("shelf-dividers", []);
    setDividers(tabs);
    /* La migration lit `order` et `status`, que `migrate` vient de
       normaliser : elle doit donc passer après, et sur les fiches
       migrées — pas sur ce qui sort du disque. */
    setViews(
      ensureViews({ films: migrated, dividers: tabs, wallPrefs: store.get("wall-prefs", {}) })
    );
    setLoaded(true);
  }, []);

  const saveFilms = (next) => {
    setFilms(next);
    store.set("films", next);
  };

  const addFilm = (film) => {
    saveFilms([film, ...films]);
    setShowModal(false);
  };
  const updateFilm = (film) => saveFilms(films.map((f) => (f.id === film.id ? film : f)));
  /* Ranger un boîtier renumérote tout un rayon : une écriture, pas trente. */
  const updateMany = (patches) =>
    saveFilms(films.map((f) => (patches[f.id] ? { ...f, ...patches[f.id] } : f)));
  const deleteFilm = (id) => {
    const next = films.filter((f) => f.id !== id);
    saveFilms(next);
    pruneOrphans(next).catch(console.error); // l'affiche part avec la fiche
    setView("library");
    setSelectedId(null);
  };

  /* Relier deux fiches, c'est écrire des deux côtés : ouvrir l'un ou l'autre
     doit montrer le même fil. Les deux moitiés partagent un pairId, ce qui
     permet de les défaire ensemble. */
  const linkFilms = (fromId, toId, note = "") => {
    const a = films.find((f) => f.id === fromId);
    const b = films.find((f) => f.id === toId);
    if (!a || !b || a.id === b.id) return;
    if ((a.linkedWorks || []).some((w) => w.filmId === b.id)) return; // déjà relié

    const pairId = uid();
    const card = (target) => ({
      id: uid(),
      pairId,
      type: "film",
      filmId: target.id,
      title: target.title,
      creator: target.director || "",
      note: note.trim(),
    });
    saveFilms(
      films.map((f) =>
        f.id === a.id
          ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(b)] }
          : f.id === b.id
            ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(a)] }
            : f
      )
    );
  };

  /* Retoucher un fil déjà tendu. La règle — ce qu'un lien accepte qu'on
     réécrive, et ce que sa moitié réciproque en reçoit — vit dans le
     domaine, où elle se teste sans monter d'écran. */
  const editLink = (ownerId, workId, patch) =>
    saveFilms(editLinkedWork(films, ownerId, workId, patch));

  /* Défaire un lien : la moitié réciproque part avec lui. */
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

  /* Restaurer, c'est remplacer l'état entier — y compris le rangement.
     Une sauvegarde d'avant les vues (v ≤ 3) n'en contient pas : on les
     refabrique alors depuis ses intercalaires, ce à quoi sert `force`. */
  const restoreBackup = ({ films: f, notes: n, dividers: d, views: v }) => {
    const migrated = migrate(f);
    saveFilms(migrated);
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

  /* Applique le diff déjà validé à l'écran : les mises à jour sont fusionnées
     champ par champ, jamais un remplacement de fiche. */
  const importFilms = ({ toCreate, toUpdate }) => {
    const patches = new Map(toUpdate.map(({ film, changes }) => [film.id, changes]));
    const merged = films.map((f) => (patches.has(f.id) ? { ...f, ...patches.get(f.id) } : f));
    saveFilms([...toCreate, ...merged]);
  };

  const selectedFilm = films.find((f) => f.id === selectedId);
  // l'état des deux murs survit à l'ouverture d'une fiche
  /* Recherche et filtre sont de l'humeur du moment ; la présentation, le tri
     et la largeur des rayons sont un rangement. Ranger son étagère puis la
     retrouver en désordre au rechargement, ce serait ne pas l'avoir rangée —
     ces trois-là sont donc gardés sur le disque. */
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
      /* La largeur des rayons n'est plus un réglage de mur : elle
         appartient à chaque rangée, dans la vue. Ne survit ici que la
         vue qu'on regardait. */
      viewId: saved[wall]?.viewId || null,
    });
    return { watched: one("watched"), watchlist: one("watchlist") };
  });
  const setUiFor = (wall) => (next) =>
    setWallUi((s) => {
      const merged = { ...s, [wall]: next };
      const keep = ({ mode, sortBy, desc, viewId }) => ({ mode, sortBy, desc, viewId });
      store.set("wall-prefs", { watched: keep(merged.watched), watchlist: keep(merged.watchlist) });
      return merged;
    });

  /* La vue active d'un mur : celle qu'on regardait, ou la première —
     l'identifiant gardé sur le disque peut désigner une vue supprimée
     depuis, ou d'un autre navigateur. */
  const activeViewId = (wall) => {
    const list = views.byWall[wall] || [];
    const kept = wallUi[wall].viewId;
    return kept && list.includes(kept) ? kept : list[0] || null;
  };

  /* Tout ce dont l'étagère d'un mur a besoin, rassemblé en un endroit :
     la vue qu'elle montre, la liste de celles entre lesquelles basculer,
     et les gestes qui les font naître, se renommer ou disparaître. */
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
  // la carte du ciel ne relie que ce qui est en rayon
  const constellationFilms = useMemo(() => watched.filter((f) => !f.archived), [watched]);
  // le mur d'où l'on vient : « je l'ai vu » depuis la watchlist doit ramener au bon endroit
  const backView = selectedFilm?.status === "watchlist" ? "watchlist" : "library";

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
        /* Le fond entier vient de la peau — ce n'est pas une couleur mais
           une recette : le kraft a des nappes plus claires là où la
           lumière tombe, un terminal a ses lignes de balayage, une peau
           néon un halo. La valeur de repli est le kraft d'origine, pour
           le premier rendu, avant qu'une peau soit posée. */
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
        }}
        onAdd={() => setShowModal(true)}
        onSkin={() => setSkinPicker(true)}
      />
      {skinPicker && (
        <SkinPicker skin={skin} onPick={setSkin} onClose={() => setSkinPicker(false)} />
      )}
      {/* LA COLONNE QUI DOIT POUVOIR RÉTRÉCIR.

          `flex: 1` ne suffit pas : un objet flex garde `min-width: auto`,
          c'est-à-dire qu'il refuse de descendre sous la largeur MINIMALE
          de son contenu. Sur le mur, ce minimum est petit — les affiches
          se replient. Sur l'étagère, c'est la plus longue rangée de
          boîtiers, qui ne rétrécissent pas : la colonne se plantait donc
          à mille deux cents pixels quelle que soit la fenêtre, et tout ce
          qui dépassait devenait une barre de défilement horizontale sur
          la page entière — dès l'ouverture de la vue, sans qu'aucun décor
          y soit pour rien.

          `minWidth: 0` lui rend le droit de rétrécir. La rangée mesure
          alors la largeur qu'elle a VRAIMENT (voir `useRowCap`) et pose
          le nombre de boîtiers qui y tiennent, au lieu d'en poser dix et
          de pousser la fenêtre. */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 2 }}>
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
            onBack={() => {
              setView(backView);
              setSelectedId(null);
            }}
            onUpdate={updateFilm}
            onDelete={deleteFilm}
            onLinkFilm={linkFilms}
            onRemoveLink={removeLink}
            onEditLink={editLink}
            onOpen={(id) => setSelectedId(id)}
          />
        )}
        {view === "reco" && <RecoView films={films} onAddToWatchlist={addFilm} />}
        {view === "constellation" && (
          <ConstellationView
            films={constellationFilms}
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
        {view === "import" && (
          <ImportView
            onImport={importFilms}
            films={films}
            notes={notebook.notes}
            dividers={dividers}
            views={views}
            onRestore={restoreBackup}
          />
        )}
      </div>
      {showModal && <FilmModal onClose={() => setShowModal(false)} onSave={addFilm} />}
    </div>
  );
}
