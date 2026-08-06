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
import { normaliser } from "./domain/search";
import { inverseDe, forceDe } from "./domain/relations";
import { makeFil, normalizeFils } from "./domain/fils";
import { motifById, makeMotifPerso, motifsPerso } from "./domain/motifs";
import { loadFils, saveFils as saveFilsToDisk } from "./services/fils";
import { loadVocabulaire, saveVocabulaire, normalizeVocabulaire } from "./services/motifs";
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
import { GeneriqueView } from "./views/GeneriqueView";
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
import { AlmanacView } from "./views/AlmanacView";
import { SkinLab } from "./views/dev/SkinLab";
import { useNotes } from "./hooks/useNotes";
import { useShelfViews } from "./hooks/useShelfViews";
import { TourOverlay, TourHint, TourMenu } from "./components/tour";
import { isFirstRun, shouldHint } from "./services/onboarding";

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
  /* Les fils de la constellation : des questions posées à la collection,
     qui doivent rester posées d'une session à l'autre. */
  const [fils, setFils] = useState([]);
  /* Le vocabulaire : les motifs que vous avez écrits, et ceux du catalogue
     que vous avez écartés. Le catalogue lui-même vit dans le code — voir
     `domain/motifs`. L'état React ne sert qu'à redessiner : c'est le
     registre du domaine qui répond à `motifById`, partout ailleurs. */
  const [vocabulaire, setVocabulaire] = useState({ perso: [], masqués: [] });
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library");
  const [selectedId, setSelectedId] = useState(null);
  /* La personne ouverte au Générique, par sa clé normalisée. À côté de
     `selectedId` et non à sa place : on ouvre une personne DEPUIS une
     fiche, et revenir à la fiche ne doit pas avoir oublié laquelle. */
  const [personne, setPersonne] = useState(null);
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
    setFils(loadFils());
    setVocabulaire(loadVocabulaire());
    /* La migration lit `order` et `status`, que `migrate` vient de
       normaliser : elle doit donc passer après, et sur les fiches
       migrées — pas sur ce qui sort du disque. */
    setViews(
      ensureViews({ films: migrated, dividers: tabs, wallPrefs: store.get("wall-prefs", {}) })
    );
    setLoaded(true);
  }, []);

  /* LA VISITE GUIDÉE. Trois états seulement : la visite en cours, le
     menu d'aide, et la fiche de rappel. Tout le reste — quelles étapes,
     dans quel ordre, ce qui a déjà été vu — vit ailleurs.

     Elle est montée ICI et non dans une vue : elle traverse les vues, et
     ne serait plus là au premier changement d'onglet. */
  const [tourId, setTourId] = useState(null);
  const [tourMenu, setTourMenu] = useState(false);
  const [hint, setHint] = useState(false);

  /* La première ouverture lance la visite complète — mais APRÈS le
     chargement, sinon elle pointe des cibles que le classeur n'a pas
     encore posées et n'ouvre qu'un voile sur l'écran d'attente. */
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

  /* Écarter la visite ne fait rien paraître tout de suite : la fiche de
     rappel arriverait sur le geste même qui vient de la refuser. Elle
     attend la prochaine ouverture, où elle a une chance d'être lue. */
  const fermerVisite = () => setTourId(null);

  /* Stable d'un rendu à l'autre : la visite s'en sert dans un effet, et
     une fonction refaite à chaque passage le relancerait sans fin.
     Reposer la vue déjà ouverte ne coûte rien — React abandonne la mise
     à jour quand la valeur ne change pas, et l'effet se tait. */
  const visiteOuvreVue = useCallback((v) => {
    setView(v);
    setSelectedId(null);
  }, []);

  const saveFilms = (next) => {
    setFilms(next);
    store.set("films", next);
  };

  const commitFils = (next) => {
    setFils(next);
    saveFilsToDisk(next);
  };

  const commitVocabulaire = (next) => {
    setVocabulaire(next);
    saveVocabulaire(next);
  };

  /* Écrire un motif à soi. Le rendre aussitôt POSÉ sur la fiche ouverte :
     on ne le crée jamais dans l'abstrait, mais parce qu'on vient de voir
     ce film-là et qu'aucun mot ne le disait. */
  const créerMotif = (label, famille, spoiler) => {
    const propre = (label || "").trim();
    if (!propre) return null;
    const existant = [...motifsPerso()].find((m) => m.label.toLowerCase() === propre.toLowerCase());
    if (existant) return existant.id;
    const motif = makeMotifPerso(propre, famille, spoiler);
    commitVocabulaire({ ...vocabulaire, perso: [...vocabulaire.perso, motif] });
    return motif.id;
  };

  /* SUPPRIMER UN MOTIF, C'EST AUSSI LE RETIRER DES FICHES.

     Le laisser dormir sur douze fiches donnerait un identifiant que plus
     rien ne sait lire : invisible à l'écran, bien présent dans les
     données, et de retour intact le jour où l'on recrée un motif du même
     nom. On nettoie donc, et c'est pour cela que la confirmation annonce
     le nombre de fiches concernées.

     Les fils bâtis dessus perdent leur source et gardent leurs membres
     posés à la main : un fil n'est pas détruit par la disparition de son
     motif, il redevient une liste. */
  const supprimerMotif = (motifId) => {
    commitVocabulaire({
      ...vocabulaire,
      perso: vocabulaire.perso.filter((m) => m.id !== motifId),
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

  /* Écarter, et non supprimer : un motif du catalogue n'est pas à vous, et
     l'effacer de vos données le verrait revenir à la mise à jour suivante.
     Les fiches qui le portent le gardent — masquer ne réécrit rien. */
  const masquerMotif = (motifId, masqué) =>
    commitVocabulaire({
      ...vocabulaire,
      masqués: masqué
        ? [...new Set([...vocabulaire.masqués, motifId])]
        : vocabulaire.masqués.filter((id) => id !== motifId),
    });

  const addFilm = (film) => {
    saveFilms([film, ...films]);
    setShowModal(false);
  };

  /* Ouvrir quelqu'un depuis une fiche. La clé est normalisée ICI et une
     seule fois : le Générique range ses dossiers sous la même, et deux
     façons de l'écrire feraient deux personnes. */
  const ouvrirPersonne = (nom) => {
    setPersonne(normaliser(nom));
    setView("generique");
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
  /* La relation, elle, se RENVERSE d'un bout à l'autre : « fait suite à »
     d'un côté se lit « précède » de l'autre. Écrire la même des deux
     côtés ferait dire à chaque film qu'il est la suite de l'autre. */
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
      force: force ? forceDe(force) : undefined,
    });
    saveFilms(
      films.map((f) =>
        f.id === a.id
          ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(b, relation)] }
          : f.id === b.id
            ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(a, inverseDe(relation))] }
            : f
      )
    );
  };

  /* Faire d'un motif une question posée à toute la collection.

     Le fil n'énumère PAS les films au moment où on le crée : il retient le
     motif, et se recompose à chaque lecture. C'est ce qui fait qu'une fiche
     taguée demain y entre sans qu'on y revienne — un fil figé serait faux
     au bout d'une semaine.

     Reposer le même motif ne crée pas un doublon : on rouvre celui qui
     existe déjà. */
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
      makeFil({
        label: motif.label,
        motif: motifId,
        couleur: CAT_KEYS[fils.length % CAT_KEYS.length],
      }),
    ]);
    setView("constellation");
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
  const restoreBackup = ({ films: f, notes: n, dividers: d, views: v, fils: fl, motifs: mo }) => {
    const migrated = migrate(f);
    saveFilms(migrated);
    commitFils(normalizeFils(fl || []));
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
      /* L'allure du mur — calibre des fiches, écartement, désordre,
         accroche et décor de fond. Elle est gardée telle quelle : c'est
         `wallLookOf` qui la ramène à quelque chose de sensé au moment de
         s'en servir, y compris quand elle manque. */
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
  /* On revient d'où l'on vient. Une fiche ouverte depuis un dossier de
     personne ramène à ce dossier — sans quoi, suivre un chef opérateur
     de film en film demanderait de le retrouver à chaque fois. */
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
        /* Le fond entier vient de la peau — ce n'est pas une couleur mais
           une recette : le kraft a des nappes plus claires là où la
           lumière tombe, une nuit américaine a sa lune froide, une
           affiche a sa trame. La valeur de repli est le kraft, pour
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
          /* Un onglet est un départ, pas un retour : cliquer « Générique »
             ouvre le répertoire, et non le dernier nom consulté. */
          setPersonne(null);
        }}
        onAdd={() => setShowModal(true)}
        onSkin={() => setSkinPicker(true)}
        onHelp={() => setTourMenu((o) => !o)}
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
      {/* `key` PLUTÔT QU'UNE CLASSE POSÉE À LA MAIN. Une animation ne se
          rejoue que si le nœud est neuf : sans clé, React réemploie le
          même conteneur d'une vue à l'autre et rien ne bouge après le
          premier rendu. La clé porte aussi la fiche ouverte — passer
          d'un film à un autre depuis le fil rouge est un changement de
          page, et doit se lire comme tel. */}
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
        {/* L'almanach lit le journal des séances : il regarde donc les
            fiches VUES, y compris celles mises de côté dans la réserve —
            les avoir archivées ne les rend pas non vues. */}
        {view === "almanac" && <AlmanacView films={watched} />}
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

      {/* LA VISITE, hors de la colonne animée.

          `[data-enters]` porte une transformation le temps de son
          entrée, et un ancêtre transformé devient le bloc conteneur de
          tout `position: fixed` qu'il contient : le voile s'y serait
          ancré sur la colonne au lieu de la fenêtre, et le trou aurait
          visé à côté à chaque changement de vue. */}
      {tourMenu && <TourMenu view={view} onPlay={jouerVisite} onClose={() => setTourMenu(false)} />}
      <TourOverlay tourId={tourId} onClose={fermerVisite} onView={visiteOuvreVue} />
      {hint && !tourId && (
        <TourHint onReplay={() => jouerVisite("global")} onDismiss={() => setHint(false)} />
      )}
    </div>
  );
}
