/* ============================================================
   VUE — DOSSIER FILM
   ============================================================ */
import { useTranslation } from "react-i18next";
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
import { WakePanel } from "./detail/WakePanel";
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
export type CardTab = "film" | "mots" | "liens";

const CARD_TABS: { key: CardTab; label: string }[] = [
  { key: "film", label: "LE FILM" },
  { key: "mots", label: "MES MOTS" },
  { key: "liens", label: "LES LIENS" },
];

function TabBar({ valeur, onChange }: { valeur: CardTab; onChange: (o: CardTab) => void }) {
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
      {CARD_TABS.map((o) => {
        const active = o.key === valeur;
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
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
              color: active ? C.card : C.inkFaded,
              background: active ? C.burgundy : "transparent",
              border: `1px solid ${active ? C.burgundy : C.line}`,
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
  backTo?: string;
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
  onOpenPerson?: (name: string) => void;
  /** Files a proposal from the wake into the "à voir" list. */
  onAddToWatchlist?: (f: Film) => void;
  /** Turns a pattern into a question asked of the whole collection. */
  onMakeThread?: (motifId: string) => void;
  /** Your own vocabulary: your patterns, and the catalogue ones set aside. */
  vocabulary?: { custom: Motif[]; hidden: string[] };
  /** Returns the identifier of the written pattern, to lay it on the card at once. */
  onCreateMotif?: (label: string, family: MotifFamily, spoiler: boolean) => string | null;
  onDeleteMotif?: (motifId: string) => void;
  onHideMotif?: (motifId: string, hidden: boolean) => void;
  /** An account is open: the card can then read what is said of it elsewhere. */
  signedIn?: boolean;
  /**
   * The open divider, held by `App`.
   *
   * When absent, the card keeps one of its own — that is the case of a
   * test or of an isolated mount. When present, it wins: that is what
   * lets the guided tour open the tab of its target.
   */
  tab?: CardTab;
  onTab?: (o: CardTab) => void;
}

export function DetailView({
  film,
  onBack,
  backTo,
  onUpdate,
  onDelete,
  films = [],
  onLinkFilm,
  onRemoveLink,
  onMakeThread,
  onEditLink,
  onOpen,
  onOpenPerson,
  onAddToWatchlist,
  vocabulary = { custom: [], hidden: [] },
  onCreateMotif,
  onDeleteMotif,
  onHideMotif,
  signedIn = false,
  tab: ongletContrôlé,
  onTab,
}: DetailViewProps) {
  const { t: t2 } = useTranslation();
  const apiKey = useTmdbKey();
  /* The local fallback follows the controlled one rather than fight it:
     one or the other answers, never both at once. */
  const [ongletLocal, setOngletLocal] = useState<CardTab>("film");
  const tab = ongletContrôlé ?? ongletLocal;
  const changeTab = (o: CardTab) => {
    setOngletLocal(o);
    onTab?.(o);
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
  const inserters = useRef<Partial<Record<TextField, (token: string) => string>>>({}); // insertion at the caret's position
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
  const [suggested, setSuggested] = useState<Motif[]>([]);
  useEffect(() => {
    let alive = true;
    setSuggested([]);
    if (!film.tmdbId || !apiKey) return;
    fetchKeywords(film.tmdbId, apiKey)
      .then((words: { id?: number; name?: string }[]) => {
        if (!alive) return;
        setSuggested(suggestMotifs(words));
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
            keywords: words.map((m) => m.name || "").filter(Boolean),
          });
      })
      .catch(() => {});
    return () => {
      alive = false;
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
  const hiddenOnes = useMemo(
    () => MOTIFS.filter((m) => vocabulary.hidden.includes(m.id)),
    [vocabulary.hidden]
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
        {/* The button says where it takes you back to. A card opened
            from somebody's folder does not send you back to the wall
            from there, and announcing it that way would be one more
            lie. */}
        <ArrowLeft size={14} /> {backTo || "RETOUR AU MUR"}
      </button>

      {/* ---- THE COVER, WHICH DOES NOT CHANGE TAB ----

          The poster and the title stay above the dividers: that is what
          keeps the film one is speaking of in sight while changing page,
          and it is the only one of the eleven previous blocks that
          belongs to none of the three. */}
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
          {/* Read-only, and that is deliberate: the title is EDITED in
              the catalogue card, which is the only place that corrects
              it. Two fields for one value give two values sooner or
              later. */}
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

      <TabBar valeur={tab} onChange={changeTab} />

      {/* ============================================================
          TAB "LE FILM" — what the work IS
          ============================================================ */}
      {tab === "film" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, maxWidth: 620 }}>
            <Cardstock tour="detail-catalog">
              <Label>Fiche catalogue</Label>
              {/* Title, year, director and genres: read-only here, and
                fixable in one click — it is the only way to correct a
                card the import identified wrongly. */}
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
              {/* THE LOG HAS MOVED TO "MES MOTS", and the cutting up
                itself demands it: a dated screening is what YOU have done
                with the film, not what it is. It is also what deserves
                the most room, and it had two hundred and forty pixels of
                it in the poster column. */}
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
              {/* Everything the harvest brings back and that could be
                read nowhere: runtime, country, language, crew, cast. It
                is there that one sees what is missing, and asks for it
                again. */}
              <TmdbFacts film={film} onUpdate={onUpdate} onOpenPerson={onOpenPerson} />
              {/* What other public film libraries say about the same
                film. Stays entirely silent with no server, no account,
                or when nobody has said anything — a card that lives alone
                does not clamour for an account. */}
              <Elsewhere film={film} signedIn={signedIn} />
              <AddToList film={film} signedIn={signedIn} />
              {/* The third block that speaks only of the outside,
                  beside the other two: what others see of this card, and
                  the right to take it away from them. */}
              <HideFromSharing film={film} signedIn={signedIn} />
            </Cardstock>
          </div>

          {/* IDENTITY, AND NOT FILING — hence a card of its own, and
              hence its presence HERE. It repairs what the card IS when
              the import confused it with a namesake: it belongs to the
              same tab as the catalogue it corrects, and not to the same
              as your words. One uses it once per card, and never on most
              of them. */}
          <div style={{ flex: "1 1 260px", maxWidth: 380, minWidth: 0 }}>
            <Cardstock tour="detail-identite">
              <TmdbLink film={film} onUpdate={onUpdate} />
            </Cardstock>
          </div>
        </div>
      )}

      {/* ============================================================
          TAB "MES MOTS" — what YOU have made of it
          ============================================================ */}
      {tab === "mots" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* 760 px: beyond that, the eye loses the next line on coming
            back to the margin. It is the only column that has a reason to
            be bounded. */}
          <div style={{ flex: "1 1 420px", maxWidth: 760, minWidth: 0, position: "relative" }}>
            {/* THE LOG OF SCREENINGS, AT THE HEAD OF YOUR WORDS. It is
              the richest data on the card and the only one the almanac
              reads; it had but a quarter of a column. */}
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
            {/* The active field receives the stills one inserts. The
              border is no longer a halo laid AROUND the block but the
              card's own thin line, changing ink: it is the same object,
              pointed at. */}
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

            {/* THE FILM STRIP, UNDER THE TEXT IT ILLUSTRATES.

              It was right at the bottom of the page. But "insert" lays
              the thumbnail where the cursor is, in the field one is
              writing in: the board and the text answer each other at
              every gesture, and keeping them two screens apart forced a
              round trip for every image. */}
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

          {/* THE ANNOTATION RAIL — what one DOES with the film, and not
            what it is.

            These four blocks used to live in the left column, with seven
            others, in two hundred and twenty pixels. A slightly long
            bullet overflowed there, and the whole read like a funnel.
            They are here because they form a family: your words, your
            patterns, the shelf where the film is filed, and the final
            exit. The catalogue card, on the left, now describes only the
            film itself. */}
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
            {/* The patterns, under the keywords and not in their place:
              the ones are your words, the others the common vocabulary a
              question can bear on. */}
            <Cardstock tour="detail-tags">
              <Label>Motifs</Label>
              <MotifPicker
                motifs={film.motifs || []}
                suggestions={suggested}
                onChange={(motifs) => onUpdate({ ...film, motifs })}
                onMakeThread={onMakeThread}
                hiddenOnes={hiddenOnes}
                onHide={onHideMotif}
                /* Creating and laying are one single gesture: one does
                 not write a pattern in the abstract, but because one is
                 looking at THIS film and no word said it. */
                onCreate={
                  onCreateMotif
                    ? (label, family, spoiler) => {
                        const id = onCreateMotif(label, family, spoiler);
                        if (id && !(film.motifs || []).includes(id))
                          onUpdate({ ...film, motifs: [...(film.motifs || []), id] });
                      }
                    : undefined
                }
                onSupprimer={
                  onDeleteMotif
                    ? (motif) => {
                        const howMany = films.filter((f) =>
                          (f.motifs || []).includes(motif.id)
                        ).length;
                        setRequest({
                          title: `Supprimer « ${motif.label} » ?`,
                          body: howMany
                            ? `Ce motif est posé sur ${howMany} fiche${howMany > 1 ? "s" : ""} — il en sera retiré.`
                            : "Ce motif n'est posé sur aucune fiche.",
                          action: "supprimer le motif",
                          severe: true,
                          onConfirm: () => onDeleteMotif(motif.id),
                        });
                      }
                    : undefined
                }
              />
            </Cardstock>
            {/* The shelf's two filings, reachable without going there:
              they change the shelf, not the card. */}
            <Cardstock style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Label>Ce qu'on en fait</Label>
              {/* No bedside for a film one has not seen: that shelf is
                  the one of what gets rewatched, and the watchlist's
                  shelf does not open it. The button would have changed
                  nothing visible there. */}
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
                  const putBackOne = { ...film, archived: !film.archived, bedside: false };
                  if (film.archived) return onUpdate({ ...film, archived: false });
                  setRequest({
                    title: "Mettre cette fiche de côté ?",
                    body: "Elle quitte le mur et la constellation, sans être détruite — on la remet en rayon quand on veut.",
                    action: "mettre de côté",
                    onConfirm: () => onUpdate(putBackOne),
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
              {/* The final exit keeps its distance from the two filings:
                setting aside and deleting look alike enough to be
                confused, and one of the two cannot be undone. */}
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
          TAB "LES LIENS" — what the film touches around it
          ============================================================ */}
      {tab === "liens" && (
        <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* THE RED THREAD, MOUNTED AS A COLUMN.

            It used to live right at the bottom, across the full width,
            and held only a strip there: the pinned cards lined up on one
            row while the right half of the screen stayed empty. The
            investigation board is what loves room most — it takes it
            here, and the cards pile up in a column as on a real wall.

            Below the width it needs, it goes back under the other
            columns: that is where it was, the reading order does not
            change. */}
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
                        {t2(`linkTypes.${t.key}`)}
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
                {/* The kind of the thread only makes sense between two
              cards: a free-form mention is linked only to itself. So the
              field only appears once the card has been chosen. */}
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
            {/* THE WAKE, UNDER THE RED THREAD AND IN THE SAME TAB.

              It was right at the bottom of the whole page, after the
              patterns. The cutting up gives it its true place: the red
              thread is what YOU have linked, the wake what the machine
              proposes to link — two answers to the same question, which
              gain from being read one under the other. It is also the
              card's natural way out: one rarely closes a folder without
              wondering "and then?". */}
            <WakePanel
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
