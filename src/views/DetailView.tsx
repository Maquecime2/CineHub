/* ============================================================
   VUE — DOSSIER FILM
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Link2,
  Paperclip,
  Moon,
  Archive,
  ArchiveRestore,
  X,
} from "lucide-react";
import { C, F } from "../theme/tokens";
import { underlineInput, tap } from "../theme/styles";
import { uid, withWatches, initialsOf } from "../domain/film";
import { searchFilms } from "../domain/search";
import { putImage } from "../db";
import { imageSize, shrinkImage } from "../services/images";
import {
  Cardstock,
  Confirmation,
  Guideline,
  Label,
  InkStars,
  SectionTitle,
} from "../components/ui";
import type { ConfirmRequest } from "../components/ui";
import { TagEditor } from "../components/ui/TagEditor";
import { MotifPicker } from "../components/film/MotifPicker";
import { MOTIFS, suggestMotifs } from "../domain/motifs";
import type { Motif, MotifFamily } from "../domain/motifs";
import { fetchKeywords } from "../tmdb";
import { useTmdbKey } from "../services/tmdbKey";
import { StampCorner, Tape } from "../components/atmosphere";
import { PosterArt } from "../components/film/PosterArt";
import { PosterPicker } from "../components/film/PosterPicker";
import { FilmIdentity } from "../components/film/FilmIdentity";
import { TmdbFacts } from "../components/film/TmdbFacts";
import { Elsewhere } from "../components/film/Elsewhere";
import { AddToList } from "../components/film/AddToList";
import { HideFromSharing } from "../components/film/HideFromSharing";
import { TmdbLink } from "../components/film/TmdbLink";
import { WatchLog } from "../components/film/WatchLog";
import { ThreadBoard } from "../components/film/ThreadBoard";
import { LINK_TYPES } from "../components/film/linkTypes";
import { STRENGTHS, ENTERABLE_RELATIONS, strengthOf } from "../domain/relations";
import { SillagePanel } from "./detail/SillagePanel";
import { StillsStrip } from "../components/stills/StillsStrip";
import { StillLightbox } from "../components/stills/StillLightbox";
import { RichField } from "../components/stills/RichField";
import type { Film, Strength, LinkPatch, LinkType, Relation, Still } from "../types";

/** The card's two text fields, where a still can be inserted. */
type TextField = "review" | "notes";

/* ============================================================
   THE FOLDER'S THREE DIVIDERS
   ============================================================

   The card lined up eleven blocks of equal weight in four flexible
   columns. "Flexible" means they fold when room runs short — and the
   order in which they fold depends on the width of the window, that is
   to say on nothing: the log of screenings could end up above or below
   the review depending on whether the browser had been opened wide.

   Three dividers, and one question per divider:

     LE FILM   — what the work IS. Catalogue, TMDB reading, identity.
     MES MOTS  — what YOU have made of it. Screenings, review, notes,
                 stills, keywords, patterns, filing.
     LES LIENS — what it touches around it. The red thread you have
                 strung, and the wake the machine proposes.

   THE TAB IS CONTROLLED FROM `App`, and that is not over-engineering:
   the guided tour must be able to OPEN the tab of a step before looking
   for its target, exactly as it already opens the view. A purely local
   tab would make four of the seven steps of the "detail" tour impossible
   to play. See `onglet` in `TourStep`. */
export type OngletFiche = "film" | "mots" | "liens";

const ONGLETS: { clé: OngletFiche; label: string }[] = [
  { clé: "film", label: "LE FILM" },
  { clé: "mots", label: "MES MOTS" },
  { clé: "liens", label: "LES LIENS" },
];

function BarreOnglets({
  valeur,
  onChange,
}: {
  valeur: OngletFiche;
  onChange: (o: OngletFiche) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Les parties du dossier"
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        marginBottom: 24,
        borderBottom: `1px solid ${C.line}`,
        paddingBottom: 9,
      }}
    >
      {ONGLETS.map((o) => {
        const actif = o.clé === valeur;
        return (
          <button
            key={o.clé}
            role="tab"
            aria-selected={actif}
            onClick={() => onChange(o.clé)}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 14px",
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: "var(--tag-tracking)",
              color: actif ? C.card : C.inkFaded,
              background: actif ? C.burgundy : "transparent",
              border: `1px solid ${actif ? C.burgundy : C.line}`,
              borderRadius: "var(--tag-radius)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface DetailViewProps {
  film: Film;
  onBack: () => void;
  /** What the back button announces. Default: "RETOUR AU MUR". */
  retourVers?: string;
  onUpdate: (f: Film) => void;
  onDelete: (id: string) => void;
  films?: Film[];
  /** Links two cards of the wall: the link is laid on both sides, the
   *  relation reversed at the other end. */
  onLinkFilm: (
    aId: string,
    bId: string,
    note: string,
    relation?: Relation,
    force?: Strength
  ) => void;
  onRemoveLink: (filmId: string, workId: string) => void;
  /** Touches up a thread: the model decides what it accepts. */
  onEditLink: (filmId: string, workId: string, patch: LinkPatch) => void;
  onOpen: (id: string) => void;
  /** Opens the folder of somebody in the credits, by their written name. */
  onOpenPerson?: (nom: string) => void;
  /** Files a proposal from the wake into the "à voir" list. */
  onAddToWatchlist?: (f: Film) => void;
  /** Turns a pattern into a question asked of the whole collection. */
  onFaireUnFil?: (motifId: string) => void;
  /** Your own vocabulary: your patterns, and the catalogue ones set aside. */
  vocabulaire?: { custom: Motif[]; hidden: string[] };
  /** Returns the identifier of the written pattern, to lay it on the card at once. */
  onCréerMotif?: (label: string, famille: MotifFamily, spoiler: boolean) => string | null;
  onSupprimerMotif?: (motifId: string) => void;
  onMasquerMotif?: (motifId: string, masqué: boolean) => void;
  /** An account is open: the card can then read what is said of it elsewhere. */
  signedIn?: boolean;
  /**
   * The open divider, held by `App`.
   *
   * When absent, the card keeps one of its own — that is the case of a
   * test or of an isolated mount. When present, it wins: that is what
   * lets the guided tour open the tab of its target.
   */
  onglet?: OngletFiche;
  onOnglet?: (o: OngletFiche) => void;
}

export function DetailView({
  film,
  onBack,
  retourVers,
  onUpdate,
  onDelete,
  films = [],
  onLinkFilm,
  onRemoveLink,
  onFaireUnFil,
  onEditLink,
  onOpen,
  onOpenPerson,
  onAddToWatchlist,
  vocabulaire = { custom: [], hidden: [] },
  onCréerMotif,
  onSupprimerMotif,
  onMasquerMotif,
  signedIn = false,
  onglet: ongletContrôlé,
  onOnglet,
}: DetailViewProps) {
  const apiKey = useTmdbKey();
  /* The local fallback follows the controlled one rather than fight it:
     one or the other answers, never both at once. */
  const [ongletLocal, setOngletLocal] = useState<OngletFiche>("film");
  const onglet = ongletContrôlé ?? ongletLocal;
  const changerOnglet = (o: OngletFiche) => {
    setOngletLocal(o);
    onOnglet?.(o);
  };
  /* A single request at a time, carried by the view: the three gestures
     that raise it — deleting the card, setting it aside, deleting a
     pattern — have nothing in common but the fact that one may have made
     a mistake. */
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("book");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkCreator, setLinkCreator] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [linkRelation, setLinkRelation] = useState<Relation | "">("");
  const [linkForce, setLinkForce] = useState<Strength>(2);
  const [picked, setPicked] = useState<Film | null>(null); // fiche existante retenue
  // the vocabulary already used in the collection, so as not to fragment it
  const allTags = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.themes || []))).sort(),
    [films]
  );

  const stills = film.stills || [];
  const [lightbox, setLightbox] = useState<number | null>(null); // index de la capture ouverte
  const [focusField, setFocusField] = useState<TextField>("review"); // champ où « insérer » écrit
  const [busy, setBusy] = useState(0);
  const inserters = useRef<Partial<Record<TextField, (token: string) => string>>>({}); // insertion à la position du curseur
  const insertToken = (n: number) => {
    const next = inserters.current[focusField]?.(`[img:${n}]`);
    if (next != null) onUpdate({ ...film, [focusField]: next });
  };

  /* Storing images in the film strip. `insert` serves pasting: pasting a
     still while writing must also lay the token at the cursor, otherwise
     one would have to go back down and fetch it from the strip. */
  const addStills = async (files: FileList | File[] | null, { insert = false } = {}) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(list.length);
    const added: Still[] = [];
    for (const file of list) {
      try {
        /* The original file is stored AS IT IS: no resizing, no
           re-encoding. A PNG stays a PNG, pixel for pixel. It is the
           lightbox and the backup that use it.
           Beside it, a light thumbnail serves the strip and the text:
           displaying a 4K image in a 110 px cell would be ruinous for
           nothing. */
        const key = `still-${film.id}-${uid()}`;
        const thumbKey = `${key}-thumb`;
        await putImage(key, file);
        await putImage(thumbKey, await shrinkImage(file, 480));
        const dim = await imageSize(file);
        added.push({
          id: uid(),
          key,
          thumbKey,
          caption: "",
          ...dim,
          bytes: file.size,
          type: file.type,
        });
      } catch (e) {
        console.error(e);
      }
      setBusy((b) => b - 1);
    }
    setBusy(0);
    if (!added.length) return;

    // a single write: stills and text leave together, otherwise the
    // second update would start again from a card without the stills
    const patch = { ...film, stills: [...stills, ...added] };
    if (insert) {
      const tokens = added.map((_, i) => `[img:${stills.length + i + 1}]`).join("");
      const next = inserters.current[focusField]?.(tokens);
      if (next != null) patch[focusField] = next;
    }
    onUpdate(patch);
  };

  /* Pasting is listened for on the whole card: depending on the
     browser, a Ctrl+V outside an input field does not bubble up to a
     container. */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items || [])]
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f !== null);
      if (!files.length) return; // un collage de texte reste un collage de texte
      e.preventDefault();
      // the review field is an editable div, not a textarea
      const el = document.activeElement as HTMLElement | null;
      const inField = el?.isContentEditable || ["TEXTAREA", "INPUT"].includes(el?.tagName ?? "");
      addStills(files, { insert: inField });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [film, stills.length, focusField]);

  /* When one searches for a film, we offer those of the collection —
     film library and watchlist together. Nothing forces choosing one:
     the field stays free for the films one does not own yet. */
  const already = new Set((film.linkedWorks || []).map((w) => w.filmId).filter(Boolean));
  const suggestions = useMemo(() => {
    if (linkType !== "film") return [];
    const q = linkTitle.trim();
    if (!q) return [];
    return searchFilms(
      films.filter((f) => f.id !== film.id && !already.has(f.id)),
      q,
      6
    );
  }, [films, film.id, linkTitle, linkType, film.linkedWorks]);

  /* WHAT TMDB PROPOSES — asked for when the card opens, and only if one
     has a key and an identifier. A single call, never in bulk: these are
     proposals to be read over, not a harvest. */
  const [proposés, setProposés] = useState<Motif[]>([]);
  useEffect(() => {
    let vivant = true;
    setProposés([]);
    if (!film.tmdbId || !apiKey) return;
    fetchKeywords(film.tmdbId, apiKey)
      .then((mots: { id?: number; name?: string }[]) => {
        if (!vivant) return;
        setProposés(suggestMotifs(mots));
        /* WE STORE THEM ON THE WAY. They were asked for and then thrown
           away: only the pattern proposals came out of them, and the
           wake then had nothing thematic to hold on to. Keeping them
           here means that opening a card improves it — and those one
           never opens wait for "complete the cards".

           We only write if the card carried none: a write on every
           opening would save the whole collection for nothing. */
        if (film.keywords == null)
          onUpdate({
            ...film,
            keywords: mots.map((m) => m.name || "").filter(Boolean),
          });
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
    /* The key is a dependency: laying it in the drawer must catch up
       with an already open card, failing which one would have to close
       it for the proposals to arrive. */
  }, [film.id, film.tmdbId, apiKey]);

  const addLink = () => {
    // a kept card becomes a real reciprocal link, not a label
    if (picked) {
      onLinkFilm(film.id, picked.id, linkNote, linkRelation || undefined, linkForce);
      setPicked(null);
      setLinkTitle("");
      setLinkCreator("");
      setLinkNote("");
      setLinkRelation("");
      setLinkForce(2);
      return;
    }
    if (!linkTitle.trim()) return;
    const work = {
      id: uid(),
      type: linkType,
      title: linkTitle.trim(),
      creator: linkCreator.trim(),
      note: linkNote.trim(),
    };
    onUpdate({ ...film, linkedWorks: [...(film.linkedWorks || []), work] });
    setLinkTitle("");
    setLinkCreator("");
    setLinkNote("");
  };
  /* Those of the catalogue that have been set aside: the picker offers
     them on the way back, otherwise calling them back would mean digging
     into the code. */
  const masqués = useMemo(
    () => MOTIFS.filter((m) => vocabulaire.hidden.includes(m.id)),
    [vocabulaire.hidden]
  );

  const removeLink = (id: string) => onRemoveLink(film.id, id);
  const editLink = (id: string, patch: LinkPatch) => onEditLink(film.id, id, patch);

  return (
    /* NO CEILING ON THE PAGE, A CEILING ON THE READING.

       A page ceiling left a plain emptiness on the right on a large
       screen, and that was the wrong place to put it: what becomes
       illegible as it widens is not the card, it is the LINE OF TEXT. So
       we cap the review column (see below) and let all the rest — the
       poster, the rail, the red thread — take up the table. */
    <div style={{ padding: "34px 44px 70px", position: "relative" }}>
      <StampCorner text="DOSSIER" />
      <button
        onClick={onBack}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: C.inkFaded,
          fontFamily: F.mono,
          fontSize: 11.5,
          marginBottom: 22,
        }}
      >
        {/* Le bouton dit où il ramène. Une fiche ouverte depuis un
            dossier de personne n'y renvoie pas au mur, et l'annoncer
            ainsi serait un mensonge de plus. */}
        <ArrowLeft size={14} /> {retourVers || "RETOUR AU MUR"}
      </button>

      {/* ---- LA COUVERTURE, QUI NE CHANGE PAS D'ONGLET ----

          L'affiche et le titre restent au-dessus des intercalaires :
          c'est ce qui fait qu'on ne perd pas de vue le film dont on
          parle en changeant de page, et c'est la seule chose des onze
          blocs d'avant qui n'appartienne à aucun des trois. */}
      <div
        style={{
          display: "flex",
          gap: 26,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div style={{ flex: "0 0 176px", minWidth: 0 }}>
          <div
            style={{
              background: C.card,
              padding: "10px 10px 13px",
              boxShadow: "3px 6px 14px rgba(30,20,10,0.28)",
              position: "relative",
            }}
          >
            <Tape
              color={C.burgundy}
              rotate={-5}
              style={{ top: -10, left: "50%", marginLeft: -35 }}
            />
            <PosterArt film={film} height={214} clipSeed={11} initials={initialsOf(film.title)} />
          </div>
          <PosterPicker film={film} onUpdate={onUpdate} />
        </div>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          {/* En lecture seule, et c'est délibéré : le titre s'ÉDITE dans
              la fiche catalogue, qui est le seul endroit qui le corrige.
              Deux champs pour une même valeur donnent tôt ou tard deux
              valeurs. */}
          <div
            style={{
              fontFamily: F.title,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 34,
              lineHeight: 1.08,
              color: C.ink,
            }}
          >
            {film.title || "Sans titre"}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 11.5, color: C.inkFaded, marginTop: 7 }}>
            {[film.year || null, film.director || null].filter(Boolean).join("  ·  ")}
          </div>
        </div>
      </div>

      <BarreOnglets valeur={onglet} onChange={changerOnglet} />

      {/* ============================================================
          ONGLET « LE FILM » — ce que l'œuvre EST
          ============================================================ */}
      {onglet === "film" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, maxWidth: 620 }}>
            <Cardstock tour="detail-catalog">
              <Label>Fiche catalogue</Label>
              {/* Titre, année, réalisateur·rice et genres : en lecture ici, et
                rattrapables d'un clic — c'est la seule façon de corriger une
                fiche que l'import a mal identifiée. */}
              <FilmIdentity film={film} onUpdate={onUpdate} onOpenPerson={onOpenPerson} />
              {film.status === "watchlist" ? (
                <button
                  /* It used to lay `watchedAt` on its own. Since a log
                   exists, that would make a film seen on such a date and
                   seen zero times — two contradictory assertions from the
                   first click. `withWatches` writes both at once. */
                  onClick={() =>
                    onUpdate(
                      withWatches({ ...film, status: "watched" }, [
                        ...(film.watches || []),
                        {
                          date: new Date().toISOString().slice(0, 10),
                          rating: film.rating || null,
                        },
                      ])
                    )
                  }
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    marginTop: 12,
                    display: "block",
                    textAlign: "center",
                    padding: "8px 0",
                    background: C.pine,
                    color: C.card,
                    fontFamily: F.mono,
                    fontSize: 10.5,
                    letterSpacing: 1,
                    boxSizing: "border-box",
                    width: "100%",
                  }}
                >
                  JE L'AI VU
                </button>
              ) : (
                <>
                  <div style={{ marginTop: 10 }}>
                    <InkStars
                      value={film.rating || 0}
                      onChange={(v) => onUpdate({ ...film, rating: v })}
                      size={18}
                    />
                  </div>
                  <button
                    onClick={() => onUpdate({ ...film, status: "watchlist" })}
                    style={{
                      all: "unset",
                      ...tap,
                      cursor: "pointer",
                      marginTop: 8,
                      color: C.inkFaded,
                      fontFamily: F.mono,
                      fontSize: 10,
                    }}
                  >
                    remettre « à voir »
                  </button>
                </>
              )}
              {/* LE JOURNAL EST PARTI DANS « MES MOTS », et c'est le
                découpage lui-même qui le request : une séance datée est
                ce que VOUS avez fait du film, pas ce qu'il est. Il est
                aussi ce qui vaut le plus de place, et il en avait deux
                cent quarante pixels dans la colonne d'affiche. */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                {(film.genres || []).map((g) => (
                  <span
                    key={g}
                    style={{
                      fontFamily: F.mono,
                      fontSize: 9.5,
                      border: `1px solid ${C.burgundy}`,
                      color: C.burgundy,
                      borderRadius: 12,
                      padding: "2px 8px",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
              {/* Tout ce que la récolte rapporte et qu'on ne lisait nulle
                part : durée, pays, langue, équipe, casting. C'est là
                qu'on voit ce qui manque, et qu'on le redemande. */}
              <TmdbFacts film={film} onUpdate={onUpdate} onOpenPerson={onOpenPerson} />
              {/* Ce que d'autres vidéothèques publiques disent du même
                film. Se tait entièrement sans serveur, sans compte, ou
                quand personne n'a rien dit — une fiche qui vit seule ne
                réclame pas un compte. */}
              <Elsewhere film={film} signedIn={signedIn} />
              <AddToList film={film} signedIn={signedIn} />
              {/* Le troisième bloc qui ne parle que du dehors, à côté
                  des deux autres : ce que les autres voient de cette
                  fiche, et le droit de la leur retirer. */}
              <HideFromSharing film={film} signedIn={signedIn} />
            </Cardstock>
          </div>

          {/* L'IDENTITÉ, ET NON LE RANGEMENT — d'où un carton à part, et
              d'où sa présence ICI. Elle répare ce que la fiche EST quand
              l'import l'a confondue avec un homonyme : c'est du même
              onglet que le catalogue qu'elle corrige, et non du même que
              vos mots. On ne s'en sert qu'une fois par fiche, et jamais
              sur la plupart. */}
          <div style={{ flex: "1 1 260px", maxWidth: 380, minWidth: 0 }}>
            <Cardstock tour="detail-identite">
              <TmdbLink film={film} onUpdate={onUpdate} />
            </Cardstock>
          </div>
        </div>
      )}

      {/* ============================================================
          ONGLET « MES MOTS » — ce que VOUS en avez fait
          ============================================================ */}
      {onglet === "mots" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* 760 px : au-delà, l'œil perd la ligne suivante en revenant à la
            marge. C'est la seule colonne qui ait une raison d'être bornée. */}
          <div style={{ flex: "1 1 420px", maxWidth: 760, minWidth: 0, position: "relative" }}>
            {/* LE JOURNAL DES SÉANCES, EN TÊTE DE VOS MOTS. Il est la
              donnée la plus riche de la fiche et la seule que l'almanach
              lise ; il n'avait qu'un quart de colonne. */}
            {film.status !== "watchlist" && (
              <Cardstock tour="detail-watchlog" style={{ marginBottom: 18 }}>
                <WatchLog film={film} onUpdate={onUpdate} />
              </Cardstock>
            )}
            <Paperclip
              size={26}
              color={C.inkFaded}
              style={{
                position: "absolute",
                top: -14,
                left: -22,
                transform: "rotate(-25deg)",
                opacity: 0.7,
              }}
            />
            {/* Le champ actif reçoit les captures qu'on insère. Le liseré n'est
              plus une auréole posée AUTOUR du bloc mais le filet du carton
              lui-même, qui change d'encre : c'est le même objet, désigné. */}
            <Cardstock
              tour="detail-review"
              onFocusCapture={() => setFocusField("review")}
              style={{
                borderColor: focusField === "review" && stills.length > 0 ? C.burgundy : C.line,
              }}
            >
              <RichField
                label="Critique personnelle"
                minHeight={120}
                value={film.review || ""}
                onChange={(review) => onUpdate({ ...film, review })}
                stills={stills}
                onOpenStill={setLightbox}
                onInsertToken={(fn) => {
                  inserters.current.review = fn;
                }}
                placeholder="Écrivez ici, à main levée…"
              />
            </Cardstock>
            <Cardstock
              onFocusCapture={() => setFocusField("notes")}
              style={{
                marginTop: 18,
                borderColor: focusField === "notes" && stills.length > 0 ? C.burgundy : C.line,
              }}
            >
              <RichField
                label="Notes libres"
                minHeight={70}
                value={film.notes || ""}
                onChange={(notes) => onUpdate({ ...film, notes })}
                stills={stills}
                onOpenStill={setLightbox}
                onInsertToken={(fn) => {
                  inserters.current.notes = fn;
                }}
                placeholder="Scènes, citations, fragments…"
              />
            </Cardstock>

            {/* LA PELLICULE, SOUS LE TEXTE QU'ELLE ILLUSTRE.

              Elle était tout en bas de la page. Or « insérer » pose la
              vignette à l'endroit du curseur, dans le champ où l'on écrit :
              la planche et le texte se répondent à chaque geste, et les
              tenir à deux écrans l'un de l'autre obligeait à faire l'aller-
              retour pour chaque image. */}
            <div style={{ marginTop: 18 }}>
              <StillsStrip
                film={film}
                onUpdate={onUpdate}
                onOpen={setLightbox}
                onInsert={insertToken}
                highlight={lightbox}
                onAddFiles={addStills}
                busy={busy}
              />
            </div>
          </div>

          {/* LE RAIL D'ANNOTATION — ce qu'on FAIT du film, et non ce qu'il est.

            Ces quatre blocs vivaient dans la colonne de gauche, avec sept
            autres, dans deux cent vingt pixels. Une puce un peu longue y
            débordait, et le tout se lisait comme un entonnoir. Ils sont ici
            parce qu'ils forment une famille : vos mots, vos motifs, le rayon
            où le film se range, et la sortie définitive. La fiche catalogue,
            à gauche, ne décrit plus que le film lui-même. */}
          <div
            style={{
              flex: "1 1 260px",
              maxWidth: 340,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <Cardstock>
              <Label>Mots-clés</Label>
              <TagEditor
                tags={film.themes || []}
                allTags={allTags}
                onChange={(themes) => onUpdate({ ...film, themes })}
              />
            </Cardstock>
            {/* Les motifs, sous les mots-clés et non à leur place : les uns
              sont vos mots, les autres le vocabulaire commun sur lequel
              une question peut porter. */}
            <Cardstock tour="detail-tags">
              <Label>Motifs</Label>
              <MotifPicker
                motifs={film.motifs || []}
                suggestions={proposés}
                onChange={(motifs) => onUpdate({ ...film, motifs })}
                onFaireUnFil={onFaireUnFil}
                masqués={masqués}
                onMasquer={onMasquerMotif}
                /* Creating and laying are one single gesture: one does
                 not write a pattern in the abstract, but because one is
                 looking at THIS film and no word said it. */
                onCréer={
                  onCréerMotif
                    ? (label, famille, spoiler) => {
                        const id = onCréerMotif(label, famille, spoiler);
                        if (id && !(film.motifs || []).includes(id))
                          onUpdate({ ...film, motifs: [...(film.motifs || []), id] });
                      }
                    : undefined
                }
                onSupprimer={
                  onSupprimerMotif
                    ? (motif) => {
                        const combien = films.filter((f) =>
                          (f.motifs || []).includes(motif.id)
                        ).length;
                        setRequest({
                          title: `Supprimer « ${motif.label} » ?`,
                          body: combien
                            ? `Ce motif est posé sur ${combien} fiche${combien > 1 ? "s" : ""} — il en sera retiré.`
                            : "Ce motif n'est posé sur aucune fiche.",
                          action: "supprimer le motif",
                          severe: true,
                          onConfirm: () => onSupprimerMotif(motif.id),
                        });
                      }
                    : undefined
                }
              />
            </Cardstock>
            {/* Les deux rangements de l'étagère, atteignables sans y aller :
              ils changent le rayon, pas la fiche. */}
            <Cardstock style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Label>Ce qu'on en fait</Label>
              {/* Pas de chevet pour un film qu'on n'a pas vu : le rayon
                  est celui qu'on revoit, et l'étagère de la watchlist ne
                  l'ouvre pas. Le bouton n'y aurait rien changé de
                  visible. */}
              {film.status !== "watchlist" && (
                <button
                  onClick={() =>
                    onUpdate({
                      ...film,
                      bedside: !film.bedside,
                      archived: film.bedside ? film.archived : false,
                    })
                  }
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: F.mono,
                    fontSize: 10,
                    color: film.bedside ? C.burgundy : C.inkFaded,
                  }}
                >
                  <Moon size={12} />{" "}
                  {film.bedside ? "retirer des films de chevet" : "film de chevet"}
                </button>
              )}
              <button
                /* Putting back on the shelf asks nothing: it is the
                 gesture that undoes the other, and making somebody
                 confirm a step backwards mostly teaches them to click
                 without reading. */
                onClick={() => {
                  const remise = { ...film, archived: !film.archived, bedside: false };
                  if (film.archived) return onUpdate({ ...film, archived: false });
                  setRequest({
                    title: "Mettre cette fiche de côté ?",
                    body: "Elle quitte le mur et la constellation, sans être détruite — on la remet en rayon quand on veut.",
                    action: "mettre de côté",
                    onConfirm: () => onUpdate(remise),
                  });
                }}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: film.archived ? C.slate : C.inkFaded,
                }}
              >
                {film.archived ? (
                  <>
                    <ArchiveRestore size={12} /> remettre en rayon
                  </>
                ) : (
                  <>
                    <Archive size={12} /> mettre de côté
                  </>
                )}
              </button>
              {/* La sortie définitive se tient à l'écart des deux rangements :
                mettre de côté et supprimer se ressemblent assez pour qu'on
                les confonde, et l'un des deux ne se rattrape pas. */}
              <button
                onClick={() =>
                  setRequest({
                    title: `Supprimer « ${film.title} » ?`,
                    body: "La fiche, ses notes, ses captures et ses fils partent avec elle. Rien ne se rattrape — « mettre de côté » range sans détruire.",
                    action: "supprimer",
                    severe: true,
                    onConfirm: () => onDelete(film.id),
                  })
                }
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  color: C.inkFaded,
                  fontFamily: F.mono,
                  fontSize: 10,
                  borderTop: `1px solid ${C.line}`,
                  paddingTop: 10,
                  marginTop: 2,
                }}
              >
                <Trash2 size={12} /> supprimer définitivement
              </button>
            </Cardstock>
          </div>
        </div>
      )}

      {/* ============================================================
          ONGLET « LES LIENS » — ce que le film touche autour de lui
          ============================================================ */}
      {onglet === "liens" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* LE FIL ROUGE, MONTÉ EN COLONNE.

            Il vivait tout en bas, sur toute la largeur, et n'y tenait qu'un
            bandeau : les cartons épinglés s'alignaient sur une rangée pendant
            que la moitié droite de l'écran restait vide. Le panneau
            d'enquête est ce qui aime le plus la place — il la prend ici, et
            les fiches s'y empilent en colonne comme sur un vrai mur.

            En dessous de la largeur qu'il lui faut, il repasse sous les
            autres colonnes : c'est là qu'il était, l'ordre de lecture ne
            change pas. */}
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <Cardstock tour="detail-thread">
              <SectionTitle icon={<Link2 size={15} color={C.burgundy} />}>
                Le fil rouge
              </SectionTitle>
              <Guideline>
                les œuvres qui répondent à ce film — livres, peintures, autres films
              </Guideline>

              <ThreadBoard
                film={film}
                onRemove={removeLink}
                onEdit={editLink}
                films={films}
                onOpen={onOpen}
              />

              <div
                style={{
                  marginTop: 30,
                  border: `1px dashed ${C.line}`,
                  padding: 16,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <Label>Type</Label>
                  <select
                    value={linkType}
                    onChange={(e) => {
                      setLinkType(e.target.value as LinkType);
                      setPicked(null);
                    }}
                    style={{
                      ...underlineInput,
                      fontFamily: F.mono,
                      fontSize: 12,
                      width: 120,
                    }}
                  >
                    {LINK_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
                  <Label>
                    {linkType === "film" ? "Chercher dans la collection" : "Titre de l'œuvre"}
                  </Label>
                  {picked ? (
                    // a kept card: we show this is a real reference, not a text
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: `1px solid ${C.burgundy}`,
                        padding: "5px 10px",
                        marginTop: 2,
                      }}
                    >
                      <Link2 size={13} color={C.burgundy} />
                      <span style={{ fontFamily: F.body, fontSize: 14, color: C.ink }}>
                        {picked.title}
                        {picked.year ? ` (${picked.year})` : ""}
                      </span>
                      <button
                        onClick={() => setPicked(null)}
                        style={{
                          all: "unset",
                          ...tap,
                          cursor: "pointer",
                          color: C.inkFaded,
                          marginLeft: "auto",
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <input
                      style={underlineInput}
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder={
                        linkType === "film" ? "un titre déjà au mur, ou un titre libre" : "Titre"
                      }
                    />
                  )}
                  {suggestions.length > 0 && !picked && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        background: C.card,
                        border: `1px solid ${C.line}`,
                        boxShadow: "2px 6px 14px rgba(30,20,10,0.3)",
                        maxHeight: 210,
                        overflowY: "auto",
                      }}
                    >
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setPicked(s);
                            setLinkCreator(s.director || "");
                          }}
                          style={{
                            all: "unset",
                            ...tap,
                            cursor: "pointer",
                            display: "block",
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "7px 11px",
                            borderBottom: `1px solid ${C.line}`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = C.paperDark;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span style={{ fontFamily: F.body, fontSize: 13.5, color: C.ink }}>
                            {s.title}
                          </span>
                          <span
                            style={{
                              fontFamily: F.mono,
                              fontSize: 9.5,
                              color: C.inkFaded,
                              marginLeft: 6,
                            }}
                          >
                            {s.year || "s.d."}
                            {s.director ? ` · ${s.director}` : ""}
                            {s.status === "watchlist" ? " · à voir" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {linkType === "film" &&
                    !picked &&
                    linkTitle.trim() &&
                    suggestions.length === 0 && (
                      <div
                        style={{
                          fontFamily: F.hand,
                          fontSize: 15,
                          color: C.inkFaded,
                          marginTop: 3,
                        }}
                      >
                        pas au mur — sera relié comme simple mention
                      </div>
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <Label>Auteur·rice / artiste</Label>
                  <input
                    style={underlineInput}
                    value={linkCreator}
                    onChange={(e) => setLinkCreator(e.target.value)}
                    placeholder="Nom"
                    disabled={!!picked}
                  />
                </div>
                {/* La nature du fil n'a de sens qu'entre deux fiches : une
              mention libre n'est reliée qu'à elle-même. Le champ n'apparaît
              donc qu'une fois la fiche retenue. */}
                {picked && (
                  <>
                    <div style={{ minWidth: 160 }}>
                      <Label>Nature du lien</Label>
                      <select
                        value={linkRelation}
                        onChange={(e) => setLinkRelation(e.target.value as Relation | "")}
                        style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12 }}
                      >
                        <option value="">— sans plus de précision —</option>
                        {ENTERABLE_RELATIONS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <Label>Strength</Label>
                      <select
                        value={linkForce}
                        onChange={(e) => setLinkForce(strengthOf(Number(e.target.value)))}
                        style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12 }}
                      >
                        {STRENGTHS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div style={{ flex: 1.4, minWidth: 180 }}>
                  <Label>Pourquoi ce lien ?</Label>
                  <input
                    style={underlineInput}
                    value={linkNote}
                    onChange={(e) => setLinkNote(e.target.value)}
                    placeholder="La résonance entre les deux"
                  />
                </div>
                <button
                  onClick={addLink}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    background: C.burgundy,
                    color: C.card,
                    padding: "8px 16px",
                    fontFamily: F.mono,
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={13} /> relier
                </button>
              </div>
            </Cardstock>
            {/* LE SILLAGE, SOUS LE FIL ROUGE ET DANS LE MÊME ONGLET.

              Il était tout en bas de la page entière, après les motifs.
              Le découpage lui donne sa vraie place : le fil rouge est ce
              que VOUS avez relié, le sillage ce que la machine propose de
              relier — deux réponses à la même question, qui gagnent à se
              lire l'une sous l'autre. C'est aussi la sortie naturelle de
              la fiche : on referme rarement un dossier sans se demander
              « et ensuite ? ». */}
            <SillagePanel
              film={film}
              films={films}
              onOpen={onOpen}
              onAddToWatchlist={onAddToWatchlist}
            />
          </div>
        </div>
      )}
      <Confirmation request={request} onClose={() => setRequest(null)} />
      {lightbox != null && (
        <StillLightbox
          stills={stills}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </div>
  );
}
