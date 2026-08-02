/* ============================================================
   PANNEAU D'ENQUÊTE — fils tendus mesurés en SVG
   ============================================================ */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { C } from "../../theme/tokens";
import { tapeColor } from "../../theme/ink";
import { hash, seededRand, tiltOf, usesPin } from "../../domain/seeded";
import { PushPin, Tape } from "../atmosphere";
import { linkTypeOf } from "./linkTypes";
import type { Film } from "../../types";

interface ThreadBoardProps {
  film: Film;
  onRemove: (workId: string) => void;
  films?: Film[];
  onOpen: (filmId: string) => void;
}

/** Un fil tracé : sa courbe, et le nœud qui le fixe à la fiche. */
interface Thread {
  id: string;
  d: string;
  knot: { x: number; y: number };
}

export function ThreadBoard({ film, onRemove, films = [], onOpen }: ThreadBoardProps) {
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

  useLayoutEffect(() => {
    const t = setTimeout(recompute, 30);
    window.addEventListener("resize", recompute);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", recompute);
    };
  }, [recompute]);

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
                  boxShadow: "2px 5px 12px rgba(30,20,10,0.25)",
                  transform: `rotate(${Number(tilt) / 2}deg)`,
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
                  <button
                    onClick={() => onRemove(w.id)}
                    style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
