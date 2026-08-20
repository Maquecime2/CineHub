/* ============================================================
   PANNEAU D'ENQUÊTE — fils tendus mesurés en SVG
   ============================================================ */
import { useTranslation } from "react-i18next";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
/* Types only: the modern JSX transform does not put `React` in scope, and
   `React.CSSProperties` would be an unknown identifier there. */
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, Pencil, X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { tapeColor } from "../../theme/ink";
import { hash, seededRand, tiltOf, usesPin } from "../../domain/seeded";
import { PushPin, Tape } from "../atmosphere";
import { LINK_TYPES, linkTypeOf } from "./linkTypes";
import { STRENGTHS, RELATIONS, strengthOf, relationDef } from "../../domain/relations";
import type { Film, Strength, LinkedWork, LinkPatch, LinkType, Relation } from "../../types";

interface ThreadBoardProps {
  film: Film;
  onRemove: (workId: string) => void;
  onEdit: (workId: string, patch: LinkPatch) => void;
  films?: Film[];
  onOpen: (filmId: string) => void;
}

/* The field of a card being edited. Underlined and without a frame: one
   writes ON the cardstock, one does not fill in a form laid over it. */
const scribble: CSSProperties = {
  all: "unset",
  ...tap,
  boxSizing: "border-box",
  width: "100%",
  borderBottom: `1px solid ${C.line}`,
  paddingBottom: 1,
  color: C.ink,
};

/** The card turned over: what can be rewritten on it, and nothing more. */
function ThreadCardEditor({
  work,
  locked,
  onCommit,
  onCancel,
}: {
  work: LinkedWork;
  /** A reference to a card on the wall: only the note belongs to it. */
  locked: boolean;
  onCommit: (patch: LinkPatch) => void;
  onCancel: () => void;
}) {
  const { t: tr } = useTranslation();
  const [type, setType] = useState<LinkType>(work.type);
  const [title, setTitle] = useState(work.title);
  const [creator, setCreator] = useState(work.creator || "");
  const [note, setNote] = useState(work.note || "");
  const [relation, setRelation] = useState<Relation | "">(work.relation || "");
  const [force, setForce] = useState<Strength>(strengthOf(work.force));

  const commit = () => {
    if (!locked && !title.trim()) return onCancel();
    onCommit(
      locked ? { note, relation: relation || undefined, force } : { type, title, creator, note }
    );
  };

  /* Enter confirms, Escape gives up — in a card of two hundred pixels,
     aiming at a small tick with the mouse for every edit would be a
     chore. The note stays a one-line `input`: it is a sentence, not a
     review, and a `textarea` would invite a paragraph. */
  const keys = (e: ReactKeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }} onKeyDown={keys}>
      {locked ? (
        /* A reference's title is not to be taken here: it is the card
           opposite. We show it, dimmed, so that one knows what one is
           annotating rather than leaving an empty, mute field. */
        <div
          style={{
            fontFamily: F.title,
            fontWeight: 700,
            fontSize: 15,
            color: C.inkFaded,
            lineHeight: 1.2,
          }}
        >
          {work.title}
        </div>
      ) : null}
      {locked && (
        /* The thread's kind is only offered ON a reference: a free
           mention is linked only to itself, and "follows on from" would
           mean nothing there. The derived relations — "precedes", "was
           remade by" — are not in the list: they write themselves, at the
           other end. We nonetheless keep the thread's own if it is one,
           otherwise the field would show something other than what is
           written. */
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value as Relation | "")}
            aria-label={tr("detail.linkNature")}
            style={{
              ...scribble,
              /* Two selects side by side in a card of two hundred
                 pixels: without a flexible basis or `minWidth: 0`, they
                 refuse to shrink and overflow. They stack when they must. */
              flex: "1 1 120px",
              minWidth: 0,
              fontFamily: F.mono,
              fontSize: 9.5,
              color: C.inkFaded,
            }}
          >
            <option value="">{tr("detail.noFurtherDetail")}</option>
            {RELATIONS.filter((r) => !r.derived || r.id === work.relation).map((r) => (
              <option key={r.id} value={r.id}>
                {tr(r.label)}
              </option>
            ))}
          </select>
          <select
            value={force}
            onChange={(e) => setForce(strengthOf(Number(e.target.value)))}
            aria-label={tr("detail.linkStrength")}
            style={{
              ...scribble,
              flex: "1 1 120px",
              minWidth: 0,
              fontFamily: F.mono,
              fontSize: 9.5,
              color: C.inkFaded,
            }}
          >
            {STRENGTHS.map((f) => (
              <option key={f.value} value={f.value}>
                {tr(f.label)}
              </option>
            ))}
          </select>
        </div>
      )}
      {!locked && (
        <>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LinkType)}
            aria-label={tr("threads.workKind")}
            style={{
              ...scribble,
              fontFamily: F.mono,
              fontSize: 9.5,
              color: C.inkFaded,
            }}
          >
            {LINK_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {tr(`linkTypes.${t.key}`)}
              </option>
            ))}
          </select>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={tr("detail.workTitle")}
            placeholder={tr("detail.workTitle")}
            style={{
              ...scribble,
              fontFamily: F.title,
              fontWeight: 700,
              fontSize: 15,
            }}
          />
          <input
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            aria-label={tr("detail.author")}
            placeholder={tr("detail.authorShort")}
            style={{ ...scribble, fontFamily: F.mono, fontSize: 9.5 }}
          />
        </>
      )}

      <input
        autoFocus={locked}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label={tr("detail.whyThisLink")}
        placeholder={tr("threads.resonance")}
        style={{ ...scribble, fontFamily: F.hand, fontSize: 17, color: C.inkFaded }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
        <button
          onClick={commit}
          title={tr("threads.saveHint")}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontFamily: F.mono,
            fontSize: 9.5,
            color: C.burgundy,
          }}
        >
          <Check size={12} /> NOTER
        </button>
        <button
          onClick={onCancel}
          title={tr("threads.cancelHint")}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            fontFamily: F.mono,
            fontSize: 9.5,
            color: C.inkFaded,
          }}
        >
          ANNULER
        </button>
      </div>
    </div>
  );
}

/** A drawn thread: its curve, and the knot that fixes it to the card. */
interface Thread {
  id: string;
  d: string;
  knot: { x: number; y: number };
}

export function ThreadBoard({ film, onRemove, onEdit, films = [], onOpen }: ThreadBoardProps) {
  const { t: tr } = useTranslation();
  // the cards still present behind the references: a deleted card leaves
  // the link readable but inert rather than a button that breaks
  const linkedFilms = useMemo(() => {
    const byId = new Map(films.map((f) => [f.id, f]));
    return Object.fromEntries(
      (film.linkedWorks || [])
        .filter((w) => w.filmId && byId.has(w.filmId))
        .map((w) => [w.filmId as string, byId.get(w.filmId as string) as Film])
    );
  }, [films, film.linkedWorks]);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement>>({});
  const [paths, setPaths] = useState<Thread[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const [editing, setEditing] = useState<string | null>(null);
  const works = film.linkedWorks || [];

  const recompute = useCallback(() => {
    const board = boardRef.current;
    const pin = pinRef.current;
    if (!board || !pin) return;
    const bRect = board.getBoundingClientRect();
    const pRect = pin.getBoundingClientRect();
    const x0 = pRect.left + pRect.width / 2 - bRect.left;
    const y0 = pRect.bottom - bRect.top - 2;
    const next = works
      .map((w): Thread | null => {
        const el = cardRefs.current[w.id];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const x1 = r.left + r.width / 2 - bRect.left;
        const y1 = r.top - bRect.top + 4;
        // catenary: the thread sags the longer it is, and never symmetrically
        const span = Math.abs(x1 - x0);
        const sag = 26 + span * 0.16 + seededRand(Math.abs(hash(w.id))) * 22;
        const c1x = x0 + (x1 - x0) * 0.28,
          c2x = x0 + (x1 - x0) * 0.72;
        const lowest = Math.max(y0, y1) + sag;
        return {
          id: w.id,
          d: `M ${x0} ${y0} C ${c1x} ${lowest}, ${c2x} ${lowest * 0.96}, ${x1} ${y1}`,
          knot: { x: x1, y: y1 },
        };
      })
      .filter((t): t is Thread => t !== null);
    setPaths(next);
    setSvgSize({ w: bRect.width, h: bRect.height });
  }, [works]);

  /* `editing` is in the dependencies although the computation does not
     use it: turning a card over makes it grow, and the threads would stay
     hooked to the height it had before. It is not the computation's
     content that changed, it is the page under it. */
  useLayoutEffect(() => {
    const t = setTimeout(recompute, 30);
    window.addEventListener("resize", recompute);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", recompute);
    };
  }, [recompute, editing]);

  return (
    <div ref={boardRef} style={{ position: "relative", paddingTop: 30 }}>
      <svg
        width={svgSize.w}
        height={svgSize.h}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {paths.map((p) => (
          <g key={p.id}>
            {/* the thread's shadow, offset: it floats above the paper */}
            <path
              d={p.d}
              fill="none"
              stroke="#2B262033"
              strokeWidth="3"
              strokeLinecap="round"
              transform="translate(1.5,3)"
            />
            {/* the rope's dark core, then the lit twist over it */}
            <path
              d={p.d}
              fill="none"
              stroke="#6B241F"
              strokeWidth="2.6"
              strokeLinecap="round"
              opacity="0.95"
            />
            <path
              d={p.d}
              fill="none"
              stroke="#C4562E"
              strokeWidth="2.6"
              strokeDasharray="2.5 4"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* the knot where the thread bites the card */}
            <circle cx={p.knot.x} cy={p.knot.y} r="3.2" fill="#6B241F" opacity="0.9" />
          </g>
        ))}
      </svg>

      <div
        ref={pinRef}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: C.ink,
          color: C.card,
          padding: "7px 16px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <PushPin color={C.burgundy} style={{ position: "static", marginRight: 2 }} />
        <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1 }}>
          {film.title.toUpperCase()}
        </span>
      </div>

      {works.length === 0 ? (
        <div
          style={{
            color: C.inkFaded,
            fontFamily: F.hand,
            fontSize: 19,
            marginTop: 26,
          }}
        >
          {tr("detail.nothingPinnedYet")}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "40px 28px",
            marginTop: 40,
            position: "relative",
            zIndex: 2,
          }}
        >
          {works.map((w) => {
            const type = linkTypeOf(w.type);
            const Icon = type.icon;
            const tilt = tiltOf(w.id);
            const pinned = usesPin(w.id);
            const linked = w.filmId ? linkedFilms[w.filmId] : undefined;
            const open = editing === w.id;
            return (
              <div
                key={w.id}
                ref={(el) => {
                  if (el) cardRefs.current[w.id] = el;
                }}
                style={{
                  position: "relative",
                  background: C.card,
                  padding: "12px 16px 14px",
                  /* A card being annotated lies flat and lifts off the
                     wall: we straighten it and deepen its shadow. All the
                     rest of the page already uses this gesture — the
                     hovered case, the card one sets aside. */
                  boxShadow: open
                    ? "3px 8px 20px rgba(30,20,10,0.34)"
                    : "2px 5px 12px rgba(30,20,10,0.25)",
                  transform: open ? "none" : `rotate(${Number(tilt) / 2}deg)`,
                  transition: "transform .2s ease, box-shadow .2s ease",
                  width: 200,
                }}
              >
                {pinned ? (
                  <PushPin style={{ top: -7, left: "50%", marginLeft: -7 }} />
                ) : (
                  <Tape
                    color={tapeColor(w.id)}
                    rotate={Number(tilt) > 0 ? -8 : 8}
                    width={54}
                    style={{ top: -9, left: "50%", marginLeft: -27 }}
                  />
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Icon size={15} color={C.burgundy} style={{ marginTop: 2, flexShrink: 0 }} />
                  {open ? (
                    <div style={{ flex: 1 }}>
                      <ThreadCardEditor
                        work={w}
                        locked={!!w.filmId}
                        onCommit={(patch) => {
                          onEdit(w.id, patch);
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  ) : (
                    <div style={{ flex: 1 }}>
                      {/* a reference to a card on the wall opens; a plain
                        mention stays text, including if the card is gone */}
                      {linked ? (
                        <button
                          onClick={() => onOpen(w.filmId as string)}
                          style={{
                            all: "unset",
                            ...tap,
                            cursor: "pointer",
                            fontFamily: F.title,
                            fontWeight: 700,
                            fontSize: 15,
                            color: C.burgundy,
                            lineHeight: 1.2,
                            textDecoration: "underline",
                            textDecorationStyle: "dotted",
                            textUnderlineOffset: 3,
                          }}
                        >
                          {w.title}
                        </button>
                      ) : (
                        <div
                          style={{
                            fontFamily: F.title,
                            fontWeight: 700,
                            fontSize: 15,
                            color: C.ink,
                            lineHeight: 1.2,
                          }}
                        >
                          {w.title}
                        </div>
                      )}
                      <div
                        style={{
                          fontFamily: F.mono,
                          fontSize: 9.5,
                          color: C.inkFaded,
                          marginTop: 3,
                        }}
                      >
                        {tr(`linkTypes.${type.key}`)}
                        {w.creator ? ` — ${w.creator}` : ""}
                        {/* The thread's kind is read from the side one is
                            on: "follows on from" here, "precedes" there. */}
                        {linked && (
                          <span style={{ color: C.burgundy }}>
                            {" · "}
                            {relationDef(w.relation)
                              ? tr(relationDef(w.relation)!.label)
                              : tr("threads.linkedCard")}
                            {" " + "·".repeat(strengthOf(w.force))}
                          </span>
                        )}
                        {w.filmId && !linked && (
                          <span style={{ color: C.inkFaded }}> · {tr("threads.cardDeleted")}</span>
                        )}
                      </div>
                      {w.note && (
                        <div
                          style={{
                            fontFamily: F.hand,
                            fontSize: 17,
                            color: C.inkFaded,
                            marginTop: 5,
                          }}
                        >
                          « {w.note} »
                        </div>
                      )}
                    </div>
                  )}
                  {!open && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        onClick={() => setEditing(w.id)}
                        title={w.filmId ? tr("threads.rewriteNote") : tr("threads.rewriteThis")}
                        aria-label={tr("threads.rewriteNamed", { title: w.title })}
                        style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => onRemove(w.id)}
                        aria-label={tr("threads.detachNamed", { title: w.title })}
                        style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
