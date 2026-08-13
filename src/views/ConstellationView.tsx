import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  Dispatch,
  SetStateAction,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Sparkles, Users, Spool } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { tap } from "../theme/styles";
import {
  buildSky,
  buildSkyWithCrew,
  neighbourhood,
  relax,
  neighbourInDirection,
} from "../domain/sky";
import type { Direction } from "../domain/sky";
import { CoffeeRing, StampCorner, InkUnderline } from "../components/atmosphere";
import type { Film, KinshipRole, LinkType, PlacedNode, SkyLink, SkyNode } from "../types";
import { Label } from "../components/ui";
import { TagChip } from "../components/ui/TagEditor";
import { catInk } from "../theme/palette";
import { relationDef, strengthOf } from "../domain/relations";
import { linkTypeOf } from "../components/film/linkTypes";
import { motifById } from "../domain/motifs";
import { searchFilms } from "../domain/search";
import type { Thread } from "../domain/threads";

/* ============================================================
   VIEW — CONSTELLATION: a sky chart drawn in ink.
   Every film is a star, every linked work a more discreet body. A
   work cited by two films becomes a bridge: that is where the
   constellations form.
   ============================================================ */
const LEGEND: [LinkType, string][] = [
  ["film", "Film"],
  ["book", "Livre"],
  ["painting", "Peinture"],
  ["other", "Autre œuvre"],
];

const LINK_INK: Record<LinkType, string> = {
  film: C.burgundy,
  book: C.cobalt,
  painting: C.moss,
  other: C.ochre,
};

/* ONE INK PER KIND OF KINSHIP. "Decaë" says nothing; "image · Decaë"
   says one is following a cinematographer, and the colour says it
   without one having to read. `thème` stands apart — it is the only one
   that comes from you and not from a credit list — hence the ink of
   identity. */
const KIN_INK: Record<KinshipRole, string> = {
  réalisation: C.slate,
  interprétation: C.ochre,
  image: C.cobalt,
  musique: C.moss,
  scénario: C.pine,
  thème: C.burgundy,
};

/** The ink of a suggested thread: that of its first reason. */
const inkOf = (l: SkyLink): string => {
  const r = l.why?.[0]?.role;
  return r ? KIN_INK[r] : C.slate;
};
export function ConstellationView({
  films,
  onOpen,
  onLinkFilm,
  fils = [],
}: {
  films: Film[];
  onOpen: (id: string) => void;
  /** Fixes a suggested kinship: it becomes a real red thread, reciprocal. */
  onLinkFilm?: (fromId: string, toId: string, note?: string) => void;
  /** The named gatherings — "the films where the hero dies". */
  fils?: Thread[];
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<string | null>(null);
  /** The aimed-at thread, by its rank — enough to thicken and label it. */
  const [hoverLink, setHoverLink] = useState<number | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [moved, setMoved] = useState<Record<string, PlacedNode>>({});
  const svgRef = useRef<SVGSVGElement | null>(null);
  // where the pointer set off from: beyond a few pixels it is a drag, not a click
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);

  const allTags = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.themes || []))).sort(),
    [films]
  );
  const allGenres = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(),
    [films]
  );
  const toggle = (setter: Dispatch<SetStateAction<string[]>>) => (v: string) =>
    setter((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  /* FOLLOWING THE CREWS — off by default, and that is not timidity: the
     hand-drawn chart is this screen's promise, and a second layer lit by
     default would pass off as yours what comes from the machine. One
     lights it when one wants to see further. */
  const [crews, setÉquipes] = useState(false);

  /* THE FOCUS — the remedy for the tangle, and it is not a graphical
     one.

     A graph of two hundred bodies cannot be read in ANY layout: it is
     not a problem of placement but of quantity. And the reader has only
     one question at a time anyway — "what holds close to this one". So
     we start from a film and show its neighbours; clicking a neighbour
     moves the focus onto it.

     `null` means "the whole chart", which stays one button away: the
     tangle is sometimes what one came to see. */
  const [foyer, setFoyer] = useState<string | null>(null);
  const [portee, setPortee] = useState(1);
  /* The films crossed, so that one can retrace one's steps. */
  const [path, setChemin] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  /* THE PINS — the films one went and fetched oneself.

     They hold to the sky by no thread: it is the search that laid them
     there, and that is quite right — one is precisely looking for a film
     not yet linked, to see what it might join. Like the positions
     grabbed with the mouse, they do not survive the page: they are
     gestures, not data. */
  const [pins, setPins] = useState<string[]>([]);
  /* The threads one has put out. We keep the ONES PUT OUT and not the
     lit ones: a thread just created must appear without one having to
     light it. */
  const [mutedThreads, setMutedThreads] = useState<string[]>([]);
  const activeThreads = useMemo(
    () => fils.filter((f) => !mutedThreads.includes(f.id)),
    [fils, mutedThreads]
  );

  const W = 1100,
    H = 760;
  const full = useMemo(
    () =>
      crews
        ? buildSkyWithCrew(films, { tags, genres }, {}, { threads: activeThreads, pinned: pins })
        : buildSky(films, { tags, genres }, { threads: activeThreads, pinned: pins }),
    [films, tags, genres, crews, activeThreads, pins]
  );
  /* The cutting out happens AFTER the building: the whole chart still
     exists, we merely show a part of it. */
  const { nodes, links } = useMemo(
    () => (foyer ? neighbourhood(full.nodes, full.links, foyer, portee) : full),
    [full, foyer, portee]
  );

  const linkedTotal = useMemo(
    () => films.filter((f) => (f.linkedWorks || []).length > 0).length,
    [films]
  );
  const placed = useMemo(() => relax(nodes, links, W, H), [nodes, links]);

  /* The films to start from: the most linked first, they are the ones
     from which one will travel furthest. */
  const departs = useMemo(
    () =>
      [...full.nodes]
        .filter((n) => n.kind === "film")
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 40),
    [full.nodes]
  );

  /* SEARCHING THE WHOLE COLLECTION, AND NOT ONLY THE SKY.

     The search looked only at the bodies already placed — that is, at
     the films already linked. But one almost always searches for the
     opposite: a film one is thinking of, no longer knowing whether it is
     linked, and which one would precisely like to hook onto something.
     Finding nothing made one believe it was not in the collection.

     So a result outside the chart is pinned with one click: it enters
     the sky, alone, and becomes the focus — from where one sees what it
     might join. */
  const inTheSky = useMemo(
    () => new Set(full.nodes.filter((n) => n.kind === "film").map((n) => n.filmId as string)),
    [full.nodes]
  );
  const results = useMemo(
    () => (query.trim() ? searchFilms(films, query, 12) : []),
    [films, query]
  );

  const pin = (filmId: string) => {
    setPins((cur) => (cur.includes(filmId) ? cur : [...cur, filmId]));
    setFocus(`f:${filmId}`);
    setQuery("");
  };

  const setFocus = (id: string) => {
    setFoyer((current) => {
      if (current && current !== id) setChemin((c) => [...c, current]);
      return id;
    });
    setMoved({});
  };
  const goBack = () => {
    setChemin((c) => {
      const previous = c[c.length - 1];
      setFoyer(previous ?? null);
      return c.slice(0, -1);
    });
    setMoved({});
  };

  const pos = useCallback((p: PlacedNode) => moved[p.id] || p, [moved]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);

  /* ------------------------------------------------------------
     TRAVELLING BY KEYBOARD
     ------------------------------------------------------------

     The chart could only be read with the pointer. Without a mouse, no
     path existed towards a body: the richest view of the binder was the
     only entirely closed one.

     A SINGLE TAB STOP for the whole sky, and the arrows inside it.
     Making three hundred bodies tabbable would mean three hundred key
     presses to cross the view, which is a polite way of keeping it
     closed. It is the usual pattern of grids and maps.

     `curseur` doubles the hover rather than replace it: both designate
     "the body being spoken of right now", and the lighting up of the
     neighbours must answer to both the same way. */
  const [curseur, setCurseur] = useState<string | null>(null);
  const currentStar = curseur ? byId.get(curseur) : undefined;

  /* A body erased by a change of filter must not leave a ghost cursor
     behind it — nor the synthetic voice announce a body that is no
     longer there. */
  useEffect(() => {
    if (curseur && !byId.has(curseur)) setCurseur(null);
  }, [byId, curseur]);

  /* The same gesture as a click, so that keyboard and pointer cannot
     diverge: two copies of this rule would end up answering the same key
     differently. */
  const openOrFocus = (n: PlacedNode) => {
    if (n.kind === "work") return;
    if (n.kind === "thread") setFocus(n.id);
    else if (n.id === foyer) onOpen(n.filmId as string);
    else setFocus(n.id);
  };

  const byKeyboard = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    const arrows: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const direction = arrows[e.key];
    if (direction) {
      const next = neighbourInDirection(placed, curseur, direction);
      /* We only swallow the key IF we have moved: otherwise the page
         would stop scrolling while there is nothing on that side, and
         one would believe the chart frozen. */
      if (next) {
        e.preventDefault();
        setCurseur(next.id);
      }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && currentStar) {
      e.preventDefault();
      openOrFocus(currentStar);
      return;
    }
    /* Escape puts the cursor down without leaving the chart: one leaves
       the exploration, not the view. A second press lets the browser do
       as it pleases. */
    if (e.key === "Escape" && curseur) {
      e.preventDefault();
      setCurseur(null);
    }
  };

  /* What the screen reader announces. A film carries its rating, a work
     its type, a thread what it gathers — the same thing as the visible
     label, because two different descriptions of the same body would be
     two different charts. */
  const describeStar = (n: PlacedNode): string =>
    [
      n.label,
      n.sub,
      n.kind === "film" ? "film" : n.kind === "thread" ? "fil" : "œuvre",
      n.id === foyer ? "foyer de la carte" : "",
      `${n.degree} lien${n.degree > 1 ? "s" : ""}`,
    ]
      .filter(Boolean)
      .join(", ");

  // the set of bodies a hover lights up
  const lit = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    links.forEach((l) => {
      if (l.a === hover) set.add(l.b);
      if (l.b === hover) set.add(l.a);
    });
    return set;
  }, [hover, links]);

  const toSvg = (e: ReactPointerEvent) => {
    const r = (svgRef.current as SVGSVGElement).getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const radiusOf = (n: PlacedNode) =>
    n.kind === "film"
      ? 7 + (n.rating || 0) * 1.6
      : /* Un fil est plus gros que ses membres : il en est le centre, et
           sa taille dit combien il en rassemble. */
        n.kind === "thread"
        ? 11 + Math.min(n.degree, 10)
        : 4 + Math.min(n.refs ?? 0, 4);

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <StampCorner text="CARTE DU CIEL" />
      <CoffeeRing style={{ top: 150, right: 90 }} rotate={-25} />
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 46,
          color: C.ink,
          position: "relative",
          zIndex: 2,
        }}
      >
        La constellation
      </div>
      <InkUnderline width={300} />
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 22,
          color: C.inkFaded,
          marginTop: 2,
          position: "relative",
          zIndex: 2,
        }}
      >
        {crews
          ? "vos fils, et les parentés trouvées dans les génériques"
          : "seulement ce que vous avez relié à la main — attrapez une étoile pour la déplacer"}
      </div>

      {/* L'INTERRUPTEUR — la seconde couche, qu'on allume si on veut. */}
      <button
        onClick={() => setÉquipes((v) => !v)}
        data-tour="constellation-teams"
        aria-pressed={crews}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          marginTop: 14,
          position: "relative",
          zIndex: 3,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontFamily: F.mono,
          fontSize: 10.5,
          letterSpacing: "var(--tag-tracking)",
          padding: "5px 11px",
          color: crews ? C.card : C.slate,
          background: crews ? C.slate : "transparent",
          border: `1px solid ${C.slate}`,
          borderRadius: "var(--tag-radius)",
        }}
      >
        <Users size={13} />
        SUIVRE LES ÉQUIPES
      </button>
      {crews && (
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 17,
            color: C.inkFaded,
            marginTop: 6,
            position: "relative",
            zIndex: 2,
          }}
        >
          en pointillé : une personne partagée par deux ou trois films. Cliquez un pointillé pour le
          fixer — il devient alors un vrai fil rouge.
        </div>
      )}

      {/* THE THREADS. Unlike the filters below, they POPULATE the sky: a
          thread brings its members in, linked or not. That is what makes
          it possible to ask for "les films où le héros meurt" and get it
          drawn, rather than dig through a list. */}
      {fils.length > 0 && (
        <div
          data-tour="constellation-fils"
          style={{ marginTop: 16, position: "relative", zIndex: 3 }}
        >
          <Label>Fils</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {fils.map((thread) => {
              const on = !mutedThreads.includes(thread.id);
              const ink = catInk(thread.color);
              const motif = thread.motif ? motifById(thread.motif) : undefined;
              return (
                <button
                  key={thread.id}
                  onClick={() =>
                    setMutedThreads((cur) =>
                      cur.includes(thread.id)
                        ? cur.filter((x) => x !== thread.id)
                        : [...cur, thread.id]
                    )
                  }
                  title={motif ? `alimenté par « ${motif.label} »` : "fil composé à la main"}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: F.mono,
                    fontSize: 10,
                    padding: "3px 10px",
                    borderRadius: "var(--tag-radius)",
                    border: `1px solid ${ink}`,
                    color: on ? C.card : ink,
                    background: on ? ink : "transparent",
                  }}
                >
                  <Spool size={11} />
                  {thread.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* filters: keywords and genres. They shrink the sky, they do not populate it. */}
      {(allTags.length > 0 || allGenres.length > 0) && (
        <div
          style={{
            marginTop: 20,
            position: "relative",
            zIndex: 3,
            borderBottom: `1px dashed ${C.line}`,
            paddingBottom: 14,
          }}
        >
          {allTags.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Label>
                Mots-keys {tags.length > 0 && <span style={{ color: C.pine }}>· cumulatifs</span>}
              </Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {allTags.map((t) => (
                  <TagChip
                    key={t}
                    tag={t}
                    active={tags.includes(t)}
                    onClick={() => toggle(setTags)(t)}
                  />
                ))}
              </div>
            </div>
          )}
          {allGenres.length > 0 && (
            <div>
              <Label>Genres</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {allGenres.map((g) => {
                  const on = genres.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggle(setGenres)(g)}
                      style={{
                        all: "unset",
                        ...tap,
                        cursor: "pointer",
                        fontFamily: F.mono,
                        fontSize: 10,
                        padding: "3px 10px",
                        borderRadius: 12,
                        border: `1px solid ${C.burgundy}`,
                        color: on ? C.card : C.burgundy,
                        background: on ? C.burgundy : "transparent",
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {(tags.length > 0 || genres.length > 0) && (
            <button
              onClick={() => {
                setTags([]);
                setGenres([]);
              }}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginTop: 10,
                color: C.inkFaded,
                fontFamily: F.mono,
                fontSize: 10,
              }}
            >
              tout afficher
            </button>
          )}
        </div>
      )}

      {/* THE CHOICE OF A STARTING POINT — as long as no focus is laid,
          we do not show the graph. That is the whole remedy: instead of
          suffering two hundred bodies and looking for a way in, one
          chooses a film, and the chart composes itself around it.

          The films offered are the most linked: they are the ones from
          which one will travel furthest. */}
      {foyer == null && full.nodes.length > 0 && (
        <div
          data-tour="constellation-start"
          style={{
            marginTop: 18,
            padding: "16px 18px",
            border: `1px dashed ${C.line}`,
            background: alpha(C.card, 0.7),
            position: "relative",
            zIndex: 3,
          }}
        >
          <Label>Par où commencer</Label>
          <div
            style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, margin: "2px 0 10px" }}
          >
            choisissez un film — la carte ne montrera que lui et ses voisins, et vous avancerez de
            proche en proche
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="chercher dans toute la collection…"
            style={{
              width: "100%",
              maxWidth: 320,
              boxSizing: "border-box",
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${C.line}`,
              outline: "none",
              fontFamily: F.body,
              fontSize: 14,
              color: C.ink,
              padding: "4px 2px",
              marginBottom: 10,
            }}
          />
          <Results
            query={query}
            results={results}
            departs={departs}
            inTheSky={inTheSky}
            onFoyer={setFocus}
            onÉpingler={pin}
          />
          <button
            onClick={() => setFoyer(null)}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              marginTop: 12,
              fontFamily: F.mono,
              fontSize: 10,
              color: C.inkFaded,
              borderBottom: `1px solid ${C.line}`,
            }}
            onClickCapture={() => setPortee(1)}
          >
            OU VOIR TOUT LE CIEL, EN L&apos;ÉTAT
          </button>
        </div>
      )}

      {/* THE BREADCRUMB TRAIL — one advances step by step, so one must
          be able to retrace one's steps. */}
      {foyer != null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 14,
            position: "relative",
            zIndex: 3,
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>
            FOYER
          </span>
          <span style={{ fontFamily: F.title, fontSize: 17, fontWeight: 700, color: C.ink }}>
            {full.nodes.find((n) => n.id === foyer)?.label ?? "—"}
          </span>
          {path.length > 0 && (
            <button onClick={goBack} style={smallButton(false)}>
              ← REVENIR ({path.length})
            </button>
          )}
          <button onClick={() => setPortee(portee === 1 ? 2 : 1)} style={smallButton(portee === 2)}>
            {portee === 1 ? "ÉLARGIR" : "RESSERRER"}
          </button>
          <button
            onClick={() => {
              setFoyer(null);
              setChemin([]);
            }}
            style={smallButton(false)}
          >
            CHANGER DE DÉPART
          </button>
          <span style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
            un clic déplace le foyer · un double-clic ouvre la fiche
          </span>
        </div>
      )}

      {/* THE SEARCH STAYS WITHIN REACH ONCE THE FOCUS IS LAID.

          It only served to choose a starting point and vanished
          afterwards — but it is while exploring that one thinks of a
          film, and one had to go back to reach it. It is also the only
          way to jump from one end of the sky to the other without going
          through the neighbours. */}
      {foyer != null && (
        <div style={{ marginTop: 12, position: "relative", zIndex: 3 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="sauter à un autre film…"
            style={{
              width: "100%",
              maxWidth: 320,
              boxSizing: "border-box",
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${C.line}`,
              outline: "none",
              fontFamily: F.body,
              fontSize: 14,
              color: C.ink,
              padding: "4px 2px",
              marginBottom: 8,
            }}
          />
          {query.trim() && (
            <Results
              query={query}
              results={results}
              departs={departs}
              inTheSky={inTheSky}
              onFoyer={setFocus}
              onÉpingler={pin}
            />
          )}
        </div>
      )}

      {placed.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            color: C.inkFaded,
            position: "relative",
            zIndex: 2,
          }}
        >
          <Sparkles size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div
            style={{
              fontFamily: F.title,
              fontSize: 20,
              color: C.ink,
              marginBottom: 6,
            }}
          >
            {tags.length || genres.length
              ? "Aucun fil sous ces filtres"
              : "Le ciel est encore noir"}
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 19,
              maxWidth: 460,
              margin: "0 auto",
            }}
          >
            {tags.length || genres.length
              ? "Aucun des films reliés ne porte ces mots-clés — élargissez la sélection."
              : "Ouvrez un film, descendez au « fil rouge » et reliez-lui un livre, une peinture ou un autre film. Seuls les films reliés apparaissent ici."}
          </div>
        </div>
      ) : (
        <>
          {/* the legend, in the manner of an old map's cartouche */}
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 10.5,
              color: C.inkFaded,
              marginTop: 18,
              letterSpacing: 1,
              position: "relative",
              zIndex: 2,
            }}
          >
            {placed.filter((n) => n.kind === "film").length} FILM(S) RELIÉ(S) · {links.length}{" "}
            FIL(S)
            {crews && ` · DONT ${links.filter((l) => l.kind === "crew").length} PAR LES ÉQUIPES`}
            {(tags.length || genres.length) > 0 && ` · ${linkedTotal} RELIÉ(S) AU TOTAL`}
          </div>
          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              marginTop: 10,
              marginBottom: 10,
              position: "relative",
              zIndex: 2,
            }}
          >
            {crews &&
              (Object.keys(KIN_INK) as KinshipRole[]).map((r) => (
                <span
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontFamily: F.mono,
                    fontSize: 9.5,
                    color: C.inkFaded,
                    letterSpacing: 0.8,
                  }}
                >
                  <span style={{ width: 14, height: 0, borderTop: `2px dashed ${KIN_INK[r]}` }} />
                  {r.toUpperCase()}
                </span>
              ))}
            {LEGEND.map(([k, l]) => (
              <span
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                  letterSpacing: 1,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: LINK_INK[k],
                    boxShadow: `0 0 6px ${LINK_INK[k]}88`,
                  }}
                />
                {l.toUpperCase()}
              </span>
            ))}
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 2,
              background: `radial-gradient(ellipse at 50% 45%, ${alpha(C.card, 0.8)}, transparent 72%)`,
              border: `1px dashed ${C.line}`,
              boxShadow: "inset 0 0 40px rgba(30,20,10,0.06)",
            }}
          >
            <svg
              ref={svgRef}
              data-tour="constellation-ciel"
              viewBox={`0 0 ${W} ${H}`}
              /* A SINGLE TAB STOP FOR THE WHOLE CHART, and the arrows
                 inside it: three hundred tabbable bodies would ask for
                 three hundred key presses to cross the view.
                 `application` warns the screen reader that it must let
                 the arrows through instead of taking them for its own
                 navigation. */
              role="application"
              tabIndex={0}
              aria-label="Carte du ciel — flèches pour aller d'un astre à l'autre, Entrée pour l'ouvrir, Échap pour lâcher"
              aria-activedescendant={curseur ? `astre-${curseur}` : undefined}
              onKeyDown={byKeyboard}
              onFocus={() => {
                /* Entering the chart lays the cursor somewhere: a
                   focused frame with nothing designated inside it does
                   not say what to do with the next key. */
                if (!curseur) setCurseur(foyer ?? placed[0]?.id ?? null);
              }}
              onBlur={() => setCurseur(null)}
              style={{
                width: "100%",
                display: "block",
                cursor: drag ? "grabbing" : "default",
                touchAction: "none",
                outline: curseur ? `2px solid ${alpha(C.cobalt, 0.5)}` : "none",
                outlineOffset: 2,
              }}
              onPointerMove={(e) => {
                if (!drag) return;
                const p = toSvg(e);
                setMoved((m) => ({
                  ...m,
                  [drag]: { ...(byId.get(drag) as PlacedNode), x: p.x, y: p.y },
                }));
              }}
              onPointerUp={() => setDrag(null)}
              onPointerLeave={() => {
                setDrag(null);
                setHover(null);
              }}
            >
              {/* the faded grid of an astronomical chart */}
              <defs>
                <pattern id="sky-grid" width="55" height="55" patternUnits="userSpaceOnUse">
                  <path
                    d="M55 0 L0 0 0 55"
                    fill="none"
                    stroke={C.line}
                    strokeWidth="0.6"
                    opacity="0.4"
                  />
                </pattern>
                <filter id="halo" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect width={W} height={H} fill="url(#sky-grid)" />

              {/* the threads: a light catenary, as on the investigation board */}
              {links.map((l, i) => {
                const na = byId.get(l.a),
                  nb = byId.get(l.b);
                if (!na || !nb) return null;
                const a = pos(na),
                  b = pos(nb);
                const on = !lit || (lit.has(l.a) && lit.has(l.b));
                const mx = (a.x + b.x) / 2,
                  my = (a.y + b.y) / 2 + Math.abs(b.x - a.x) * 0.09 + 10;
                // card to card: a solid stroke, it is the strongest link
                const peer = l.kind === "peer";
                /* A KINSHIP IS NOT DRAWN LIKE A RED THREAD. A long,
                   pale dashed line, in slate ink: what comes from the
                   machine must be told apart from what comes from you
                   without having to click to find out. */
                const crew = l.kind === "crew";
                /* A thread (the gathering) is not a kinship: it is
                   drawn in the thread's tint, in a continuous but thin
                   stroke — it gathers without claiming to link two by
                   two. */
                const gatheringThread = l.kind === "thread";
                const d = `M ${a.x} ${a.y} Q ${mx} ${my}, ${b.x} ${b.y}`;
                /* What the thread tells when aimed at: the kinship
                   found by the machine, or the relation one has written
                   oneself — which reads in the direction of the
                   stroke. */
                const reasons = gatheringThread
                  ? (byId.get(l.a)?.label ?? "")
                  : peer
                    ? /* THE NAMED RELATION, then WHAT WAS WRITTEN UNDER THE
                         LINK. A thread may have neither: it is still a
                         thread, and it has to say so — without that
                         fallback, the strongest line on the map was the
                         only one to hover in silence. */
                      [relationDef(l.relation)?.label, l.note].filter(Boolean).join(" — ") ||
                      "fil écrit à la main"
                    : /* A POINTER TO A WORK SPEAKS TOO. The "crew" branch
                         also gathered the citations, which have no
                         `why`: the thread to the book was therefore
                         mute. It says what was written under the link,
                         and failing that the nature of the work aimed at
                         with its author. */
                      l.kind === "cite"
                      ? l.note ||
                        [t(`linkTypes.${linkTypeOf(nb.type || "other").key}`), nb.sub]
                          .filter(Boolean)
                          .join(" · ")
                      : (l.why || []).map((w) => `${w.role} · ${w.name}`).join(", ");
                const fixer =
                  crew && onLinkFilm
                    ? () => onLinkFilm(l.a.slice(2), l.b.slice(2), reasons)
                    : undefined;
                const aimed = hoverLink === i;
                const threadTint = gatheringThread
                  ? catInk(byId.get(l.a)?.color || "burgundy")
                  : null;
                const ink = threadTint ?? (crew ? inkOf(l) : peer ? C.burgundy : C.vermillion);
                // a strong link thickens the stroke: it is the only thing it has to say here
                const peerThickness = 1.4 + strengthOf(l.force) * 0.6;
                return (
                  <g key={i}>
                    <path
                      d={d}
                      fill="none"
                      stroke={ink}
                      /* A thread one can click must say so BEFORE one
                         clicks: on hover it thickens and darkens, which
                         no tooltip does fast enough. */
                      strokeWidth={
                        aimed
                          ? (peer ? peerThickness : 1.4) + 1.2
                          : peer
                            ? peerThickness
                            : gatheringThread
                              ? 1.2
                              : 1.4
                      }
                      strokeDasharray={
                        peer ? "none" : crew ? "7 6" : gatheringThread ? "1 5" : "2.5 4"
                      }
                      strokeLinecap="round"
                      opacity={
                        on
                          ? aimed
                            ? 1
                            : peer
                              ? 0.8
                              : crew
                                ? 0.5
                                : gatheringThread
                                  ? 0.55
                                  : 0.6
                          : 0.08
                      }
                      style={{
                        transition: "opacity .18s ease, stroke-width .12s ease",
                        pointerEvents: "none",
                      }}
                    />
                    {/* THE LABEL, in the middle of the thread and only
                        on hover: it names the kind of the kinship, which
                        a colour alone cannot do. */}
                    {aimed && reasons && (
                      <g style={{ pointerEvents: "none" }}>
                        <rect
                          x={mx - Math.min(reasons.length * 3.4, 190) / 2 - 6}
                          y={(a.y + b.y) / 2 + 2}
                          width={Math.min(reasons.length * 3.4, 190) + 12}
                          height={19}
                          rx={2}
                          fill={C.card}
                          stroke={ink}
                          strokeWidth="0.8"
                        />
                        <text
                          x={mx}
                          y={(a.y + b.y) / 2 + 15}
                          textAnchor="middle"
                          style={{ fontFamily: F.mono, fontSize: 10, fill: C.ink }}
                        >
                          {reasons.length > 54 ? `${reasons.slice(0, 53)}…` : reasons}
                        </text>
                      </g>
                    )}
                    {/* WHAT RECEIVES THE MOUSE, and it is wide.

                        A stroke a pixel and a half thick cannot be
                        aimed at: one has to hit it to the pixel, and a
                        catenary is not even straight. Hence this
                        transparent path laid over it, twenty-six pixels
                        thick — wide enough to fall on without thinking,
                        thin enough for two neighbouring threads to stay
                        distinct.

                        It exists for EVERY thread and no longer only for
                        those one can fix: the hover must name the
                        kinship even when there is nothing to click. */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={26}
                      style={{ cursor: fixer ? "pointer" : "default" }}
                      onPointerEnter={() => setHoverLink(i)}
                      onPointerLeave={() => setHoverLink(null)}
                      onClick={fixer}
                    >
                      {/* The browser's tooltip doubles the drawn label:
                          it survives on a thread aimed at the edge of
                          the sky, and it is what the tools that do not
                          see the SVG read. Every thread has one, not
                          only the one that can be fixed. */}
                      {(fixer || reasons) && (
                        <title>{fixer ? `Fixer ce fil — ${reasons}` : reasons}</title>
                      )}
                    </path>
                  </g>
                );
              })}

              {placed.map((n) => {
                const p = pos(n);
                const r = radiusOf(n);
                const on = !lit || lit.has(n.id);
                const isHover = hover === n.id || curseur === n.id;
                const ink =
                  n.kind === "thread"
                    ? catInk(n.color || "burgundy")
                    : n.kind === "film"
                      ? C.burgundy
                      : n.type
                        ? LINK_INK[n.type]
                        : C.ochre;
                /* A pattern that gives the ending away is not displayed
                   in the clear on a chart one walks through: the
                   thread's name stays scratched out until revealed by a
                   hover. */
                const scratched =
                  n.kind === "thread" && !!n.motif && !!motifById(n.motif)?.spoiler && !isHover;
                return (
                  <g
                    key={n.id}
                    id={`astre-${n.id}`}
                    role="option"
                    aria-selected={curseur === n.id}
                    aria-label={describeStar(n)}
                    transform={`translate(${p.x},${p.y})`}
                    style={{
                      cursor: n.kind === "work" ? "grab" : "pointer",
                      opacity: on ? 1 : 0.22,
                      transition: "opacity .18s ease",
                    }}
                    onPointerEnter={() => !drag && setHover(n.id)}
                    onPointerLeave={() => !drag && setHover(null)}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      pressAt.current = { x: e.clientX, y: e.clientY };
                      setDrag(n.id);
                    }}
                    /* A CLICK MOVES THE FOCUS, IT NO LONGER OPENS THE
                       CARD.

                       It is the gesture of exploration: one advances
                       step by step, and leaving the chart at every body
                       would make the journey impossible. Opening the
                       card remains a double-click away, and the legend
                       says so — a gesture one cannot guess must be
                       written down somewhere.

                       The focus itself is an exception: clicking it
                       again would have nothing to recentre, so it
                       opens. */
                    onClick={(e) => {
                      if (n.kind === "work") return;
                      const s = pressAt.current;
                      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) return; // that was a drag
                      /* A thread does not open — it has no card: taking
                         it as the focus shows everything it gathers, and
                         that is exactly the question one asks of it. */
                      if (n.kind === "thread") setFocus(n.id);
                      else if (n.id === foyer) onOpen(n.filmId as string);
                      else setFocus(n.id);
                    }}
                    onDoubleClick={() => n.kind === "film" && onOpen(n.filmId as string)}
                  >
                    {/* THE KEYBOARD CURSOR'S RING. The hover's halo is
                        not enough: it is diffuse by nature, and "where
                        am I" must show at a glance without having to
                        compare two glows. A plain stroke, then, and only
                        with the keyboard. */}
                    {curseur === n.id && (
                      <circle
                        r={r + 11}
                        fill="none"
                        stroke={C.cobalt}
                        strokeWidth={2}
                        strokeDasharray="3 3"
                      />
                    )}
                    {/* halo: the most cited bodies shine the brightest */}
                    <circle
                      r={r + 7}
                      fill={ink}
                      opacity={isHover ? 0.22 : 0.1}
                      filter="url(#halo)"
                    />
                    <circle
                      r={r}
                      fill={n.kind === "thread" ? alpha(ink, 0.28) : ink}
                      stroke={n.kind === "thread" ? ink : C.card}
                      strokeWidth={n.kind === "thread" ? 2 : 1.6}
                    />
                    {/* The pinned body stands apart: nothing holds it to
                        the sky but a gesture, and the dashed circle says
                        so. */}
                    {n.pinned && (
                      <circle
                        r={r + 8}
                        fill="none"
                        stroke={C.slate}
                        strokeWidth="0.9"
                        strokeDasharray="1 4"
                      />
                    )}
                    {n.kind === "film" && (
                      <circle
                        r={r + 4.5}
                        fill="none"
                        stroke={ink}
                        strokeWidth="0.9"
                        opacity="0.5"
                        strokeDasharray="2 3"
                      />
                    )}
                    <text
                      x={0}
                      y={-r - 11}
                      textAnchor="middle"
                      style={{
                        /* The roles, and not two typefaces named in the
                           clear: written that way, they stayed the
                           notebook's under the thirteen other skins. */
                        fontFamily: n.kind === "work" ? F.mono : F.title,
                        fontSize: n.kind === "work" ? 10.5 : n.kind === "thread" ? 16 : 15,
                        fontWeight: n.kind === "work" ? 400 : 700,
                        fontStyle: n.kind === "thread" ? "italic" : "normal",
                        fill: C.ink,
                        pointerEvents: "none",
                      }}
                    >
                      {scratched
                        ? "•".repeat(Math.min(n.label.length, 14))
                        : n.label.length > 30
                          ? n.label.slice(0, 29) + "…"
                          : n.label}
                    </text>
                    {isHover && n.sub && (
                      <text
                        x={0}
                        y={r + 18}
                        textAnchor="middle"
                        style={{
                          fontFamily: F.hand,
                          fontSize: 16,
                          fill: C.inkFaded,
                          pointerEvents: "none",
                        }}
                      >
                        {n.sub}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {/* WHAT THE VOICE SAYS WHILE ONE MOVES ABOUT.

                `aria-activedescendant` is enough in theory, but screen
                readers follow it unevenly inside an SVG. A live region
                says the same thing by a path that does work everywhere.
                It is off screen and not `display: none`: what is hidden
                is not read. */}
            <div
              aria-live="polite"
              aria-atomic="true"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clipPath: "inset(50%)",
                whiteSpace: "nowrap",
              }}
            >
              {currentStar ? describeStar(currentStar) : ""}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 14,
              position: "relative",
              zIndex: 2,
            }}
          >
            <span style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded }}>
              {placed.filter((n) => n.kind === "film").length} film(s),{" "}
              {placed.filter((n) => n.kind === "work").length} œuvre(s) —{" "}
              {placed.filter((n) => (n.refs ?? 0) > 1).length} pont(s) entre two films
            </span>
            {(Object.keys(moved).length > 0 || pins.length > 0) && (
              <button
                /* Putting the sky back in place also means removing the
                   pins: they are two gestures of the same hand, and
                   letting them survive the sweep would give a sky "put
                   back in place" that is not. */
                onClick={() => {
                  setMoved({});
                  setPins([]);
                }}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  color: C.burgundy,
                  borderBottom: `1px solid ${C.burgundy}`,
                }}
              >
                REMETTRE LE CIEL EN PLACE
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* THE LIST OF DEPARTURES, AND WHAT IT SHOWS WHEN ONE SEARCHES.

   With no search: the most linked films, the ones from which one will
   travel furthest. With one: the WHOLE collection, each result marked
   according to whether it is already in the sky or not. A film outside
   the chart is not greyed out — it is offered, because pinning it is
   precisely what one came to do. */
function Results({
  query,
  results,
  departs,
  inTheSky,
  onFoyer,
  onÉpingler,
}: {
  query: string;
  results: Film[];
  departs: PlacedNode[] | SkyNode[];
  inTheSky: Set<string>;
  onFoyer: (nodeId: string) => void;
  onÉpingler: (filmId: string) => void;
}) {
  if (!query.trim())
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {departs.slice(0, 12).map((n) => (
          <button key={n.id} onClick={() => onFoyer(n.id)} style={departStyle}>
            {n.label}
            <span style={{ opacity: 0.6, marginLeft: 6 }}>{n.degree}</span>
          </button>
        ))}
      </div>
    );

  if (results.length === 0)
    return (
      <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded }}>
        rien de ce nom dans la collection.
      </div>
    );

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {results.map((f) => {
        const placedItem = inTheSky.has(f.id);
        return (
          <button
            key={f.id}
            onClick={() => (placedItem ? onFoyer(`f:${f.id}`) : onÉpingler(f.id))}
            title={placedItem ? "Prendre pour foyer" : "L'épingler au ciel et partir de lui"}
            style={{
              ...departStyle,
              borderStyle: placedItem ? "solid" : "dashed",
              color: placedItem ? C.ink : C.inkFaded,
            }}
          >
            {f.title}
            <span style={{ opacity: 0.6, marginLeft: 6, fontFamily: F.mono, fontSize: 9.5 }}>
              {placedItem ? "au ciel" : "épingler"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const departStyle: CSSProperties = {
  all: "unset",
  ...tap,
  cursor: "pointer",
  fontFamily: F.body,
  fontSize: 12.5,
  padding: "4px 10px",
  color: C.ink,
  border: `1px solid ${C.line}`,
  borderRadius: "var(--tag-radius)",
  background: C.card,
};

const smallButton = (active: boolean): CSSProperties => ({
  all: "unset",
  ...tap,
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: "var(--tag-tracking)",
  padding: "3px 9px",
  color: active ? C.card : C.inkFaded,
  background: active ? C.slate : "transparent",
  border: `1px solid ${active ? C.slate : C.line}`,
  borderRadius: "var(--tag-radius)",
});
