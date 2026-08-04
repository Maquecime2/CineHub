/* ============================================================
   PANNEAU D'ENQUÊTE — fils tendus mesurés en SVG
   ============================================================ */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
/* Types seuls : la transformation JSX moderne ne met pas `React` dans la
   portée, et `React.CSSProperties` y serait un identifiant inconnu. */
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, Pencil, X } from "lucide-react";
import { C } from "../../theme/tokens";
import { tapeColor } from "../../theme/ink";
import { hash, seededRand, tiltOf, usesPin } from "../../domain/seeded";
import { PushPin, Tape } from "../atmosphere";
import { LINK_TYPES, linkTypeOf } from "./linkTypes";
import type { Film, LinkedWork, LinkPatch, LinkType } from "../../types";

interface ThreadBoardProps {
  film: Film;
  onRemove: (workId: string) => void;
  onEdit: (workId: string, patch: LinkPatch) => void;
  films?: Film[];
  onOpen: (filmId: string) => void;
}

/* Le champ d'une fiche qu'on retouche. Souligné et sans cadre : on écrit
   SUR le carton, on ne remplit pas un formulaire posé par-dessus. */
const scribble: CSSProperties = {
  all: "unset",
  boxSizing: "border-box",
  width: "100%",
  borderBottom: `1px solid ${C.line}`,
  paddingBottom: 1,
  color: C.ink,
};

/** La fiche retournée : ce qu'on peut y réécrire, et rien de plus. */
function ThreadCardEditor({
  work,
  locked,
  onCommit,
  onCancel,
}: {
  work: LinkedWork;
  /** Un renvoi vers une fiche du mur : seule la note lui appartient. */
  locked: boolean;
  onCommit: (patch: LinkPatch) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<LinkType>(work.type);
  const [title, setTitle] = useState(work.title);
  const [creator, setCreator] = useState(work.creator || "");
  const [note, setNote] = useState(work.note || "");

  const commit = () => {
    if (!locked && !title.trim()) return onCancel();
    onCommit(locked ? { note } : { type, title, creator, note });
  };

  /* Entrée valide, Échap renonce — dans un carton de deux cents pixels,
     viser une petite coche à la souris pour chaque retouche serait une
     corvée. La note reste un `input` d'une ligne : c'est une phrase, pas
     une critique, et un `textarea` inviterait au paragraphe. */
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
        /* Le titre d'un renvoi n'est pas à prendre ici : il est la fiche
           d'en face. On le montre, éteint, pour qu'on sache ce qu'on
           annote plutôt que de laisser un champ vide et muet. */
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: 15,
            color: C.inkFaded,
            lineHeight: 1.2,
          }}
        >
          {work.title}
        </div>
      ) : (
        <>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LinkType)}
            aria-label="Nature de l'œuvre"
            style={{
              ...scribble,
              fontFamily: "'Special Elite', monospace",
              fontSize: 9.5,
              color: C.inkFaded,
            }}
          >
            {LINK_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Titre de l'œuvre"
            placeholder="Titre"
            style={{
              ...scribble,
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              fontSize: 15,
            }}
          />
          <input
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            aria-label="Auteur·rice / artiste"
            placeholder="Auteur·rice"
            style={{ ...scribble, fontFamily: "'Special Elite', monospace", fontSize: 9.5 }}
          />
        </>
      )}
      <input
        autoFocus={locked}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Pourquoi ce lien ?"
        placeholder="la résonance entre les deux"
        style={{ ...scribble, fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
        <button
          onClick={commit}
          title="Enregistrer (Entrée)"
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "'Special Elite', monospace",
            fontSize: 9.5,
            color: C.burgundy,
          }}
        >
          <Check size={12} /> NOTER
        </button>
        <button
          onClick={onCancel}
          title="Renoncer (Échap)"
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "'Special Elite', monospace",
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

/** Un fil tracé : sa courbe, et le nœud qui le fixe à la fiche. */
interface Thread {
  id: string;
  d: string;
  knot: { x: number; y: number };
}

export function ThreadBoard({ film, onRemove, onEdit, films = [], onOpen }: ThreadBoardProps) {
  // les fiches encore présentes derrière les renvois : une fiche supprimée
  // laisse le lien lisible mais inerte plutôt qu'un bouton qui casse
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
        // caténaire : le fil pend d'autant plus qu'il est long, et jamais symétriquement
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

  /* `editing` est dans les dépendances alors que le calcul ne s'en sert
     pas : retourner une fiche la fait grandir, et les fils resteraient
     accrochés à la hauteur qu'elle avait avant. Ce n'est pas le contenu
     du calcul qui a changé, c'est la page sous lui. */
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
            {/* l'ombre du fil, décalée : il flotte au-dessus du papier */}
            <path
              d={p.d}
              fill="none"
              stroke="#2B262033"
              strokeWidth="3"
              strokeLinecap="round"
              transform="translate(1.5,3)"
            />
            {/* l'âme sombre de la corde, puis la torsade éclairée par-dessus */}
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
            {/* le nœud là où le fil mord la fiche */}
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
        <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: 1 }}>
          {film.title.toUpperCase()}
        </span>
      </div>

      {works.length === 0 ? (
        <div
          style={{
            color: C.inkFaded,
            fontFamily: "'Caveat', cursive",
            fontSize: 19,
            marginTop: 26,
          }}
        >
          rien d'épinglé pour l'instant…
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
                  /* Une fiche qu'on annote se pose à plat et se relève du
                     mur : on la redresse et on appuie son ombre. Tout le
                     reste de la page emploie déjà ce geste — le boîtier
                     survolé, le carton qu'on écarte. */
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
                      {/* un renvoi vers une fiche du mur s'ouvre ; une simple
                        mention reste du texte, y compris si la fiche a disparu */}
                      {linked ? (
                        <button
                          onClick={() => onOpen(w.filmId as string)}
                          style={{
                            all: "unset",
                            cursor: "pointer",
                            fontFamily: "'Playfair Display', serif",
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
                            fontFamily: "'Playfair Display', serif",
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
                          fontFamily: "'Special Elite', monospace",
                          fontSize: 9.5,
                          color: C.inkFaded,
                          marginTop: 3,
                        }}
                      >
                        {type.label}
                        {w.creator ? ` — ${w.creator}` : ""}
                        {linked && <span style={{ color: C.burgundy }}> · fiche liée</span>}
                        {w.filmId && !linked && (
                          <span style={{ color: C.inkFaded }}> · fiche supprimée</span>
                        )}
                      </div>
                      {w.note && (
                        <div
                          style={{
                            fontFamily: "'Caveat', cursive",
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
                        title={
                          w.filmId
                            ? "Réécrire la note — le titre appartient à la fiche liée"
                            : "Retoucher ce fil"
                        }
                        aria-label={`Retoucher « ${w.title} »`}
                        style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => onRemove(w.id)}
                        aria-label={`Détacher « ${w.title} »`}
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
