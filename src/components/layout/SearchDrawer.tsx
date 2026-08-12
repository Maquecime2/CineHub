/* ============================================================
   SEARCHING EVERYWHERE — the drawer

   A single question asked of the whole binder, and the answers filed by
   kind. One gets there by the magnifier at the foot of the rail or by
   Ctrl+K — both, because the shortcut cannot be guessed and the button
   cannot be remembered.

   The arrows walk through, Enter opens, Escape closes: that is what one
   expects of a search field, and none of it costs anything to whoever
   ignores it and clicks.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search, Film as FilmIcon, User, Tag, Spline, NotebookPen } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { searchEverywhere, groupByKind, type Kind, type Hit } from "../../domain/everywhere";
import type { Thread } from "../../domain/threads";
import type { Film, Note } from "../../types";
import { useViewport } from "../../hooks/useViewport";

/* What each kind is called once found, and what it looks like. The icon
   is not decorative: it is what allows one to read at a glance that one
   is looking at five kinds and not a flat list. */
const NATURES: Record<Kind, { title: string; icon: typeof Search; tint: string }> = {
  film: { title: "Films", icon: FilmIcon, tint: C.burgundy },
  person: { title: "Au générique", icon: User, tint: C.plum },
  motif: { title: "Motifs", icon: Tag, tint: C.cobalt },
  thread: { title: "Fils", icon: Spline, tint: C.vermillion },
  page: { title: "Carnet", icon: NotebookPen, tint: C.pine },
};

export interface OpenFinding {
  film: (id: string) => void;
  person: (key: string) => void;
  page: () => void;
  /** The wall, its search set on the motif's label. */
  motif: (label: string) => void;
  thread: () => void;
}

export function SearchDrawer({
  films,
  notes,
  threads,
  onClose,
  ouvrir,
}: {
  films: Film[];
  notes: Note[];
  threads: Thread[];
  onClose: () => void;
  ouvrir: OpenFinding;
}) {
  const [q, setQ] = useState("");
  const { phone } = useViewport();
  const [curseur, setCurseur] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  const findings = useMemo(
    () => searchEverywhere(q, { films, notes, threads }),
    [q, films, notes, threads]
  );
  const groups = useMemo(() => groupByKind(findings), [findings]);
  /* The FLATTENED list, in the order it is drawn: it is what the arrows
     walk through. Rebuilding the order on the fly in the key handler
     would make it diverge from the display at the first change of
     layout. */
  const plate = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setCurseur(0);
  }, [q]);

  // the field takes focus at once: one opens this drawer in order to type
  useEffect(() => {
    field.current?.focus();
  }, []);

  const openThat = (t: Hit) => {
    if (t.kind === "film" && t.filmId) ouvrir.film(t.filmId);
    else if (t.kind === "person" && t.person) ouvrir.person(t.person);
    else if (t.kind === "page") ouvrir.page();
    else if (t.kind === "motif") ouvrir.motif(t.title);
    else if (t.kind === "thread") ouvrir.thread();
    onClose();
  };

  const byKeyboard = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (plate.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCurseur((c) => Math.min(c + 1, plate.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCurseur((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = plate[curseur];
      if (t) openThat(t);
    }
  };

  /* MOUNTED ON THE DOCUMENT BODY. The views live in the `[data-enters]`
     column, whose entry transform becomes the reference for the
     `position: fixed` it contains. The evening drawer and the
     confirmation request have already paid for this lesson. */
  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(20,14,8,0.5)" }}
      />
      <div
        role="dialog"
        aria-label="Chercher partout"
        onKeyDown={byKeyboard}
        style={{
          position: "fixed",
          /* EIGHT PER CENT OF HEIGHT IS A DESKTOP MARGIN.

             On a phone, those eight per cent are emptiness above the
             field, and the remaining seventy-eight stop well before the
             bottom of the screen: the list of finds fitted on three
             lines. So the sheet starts under the notch and goes down as
             far as it can. */
          top: `max(8vh, var(--safe-top))`,
          left: "50%",
          transform: "translateX(-50%)",
          width: phone ? "calc(100vw - 16px)" : "min(620px, 92vw)",
          maxHeight: phone ? "calc(100dvh - max(8vh, var(--safe-top)) - 16px)" : "78vh",
          zIndex: 60,
          background: C.paper,
          border: `1px solid ${C.line}`,
          boxShadow: "0 10px 34px rgba(0,0,0,0.34)",
          display: "flex",
          flexDirection: "column",
          animation: "sheetIn var(--motion-slow) var(--motion-ease) backwards",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: `1px solid ${C.line}`,
            flexShrink: 0,
          }}
        >
          <Search size={17} color={C.inkFaded} />
          <input
            ref={field}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="un titre, un nom, un motif, un mot que vous avez écrit…"
            aria-label="Chercher dans tout le classeur"
            style={{
              all: "unset",
              ...tap,
              flex: 1,
              fontFamily: F.body,
              fontSize: 17,
              color: C.ink,
            }}
          />
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>ÉCHAP</span>
        </div>

        <div style={{ overflowY: "auto", padding: "8px 0 12px" }}>
          {q.trim().length < 2 ? (
            <Word>
              Deux lettres suffisent. La question est posée aux films, aux gens des génériques, aux
              motifs, aux fils et aux pages du carnet — d'un coup.
            </Word>
          ) : plate.length === 0 ? (
            <Word>Rien de ce nom dans le classeur.</Word>
          ) : (
            groups.map((g) => {
              const nature = NATURES[g.kind];
              const Icon = nature.icon;
              return (
                <div key={g.kind} style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 18px 3px",
                      fontFamily: F.mono,
                      fontSize: 9,
                      letterSpacing: 1,
                      color: nature.tint,
                    }}
                  >
                    <Icon size={11} /> {nature.title.toUpperCase()}
                  </div>
                  {g.items.map((t) => {
                    const rank = plate.indexOf(t);
                    const targeted = rank === curseur;
                    return (
                      <button
                        key={t.key}
                        onClick={() => openThat(t)}
                        onMouseEnter={() => setCurseur(rank)}
                        aria-current={targeted ? "true" : undefined}
                        style={{
                          all: "unset",
                          ...tap,
                          cursor: "pointer",
                          display: "block",
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "5px 18px",
                          background: targeted ? alpha(nature.tint, 0.12) : "transparent",
                          borderLeft: `3px solid ${targeted ? nature.tint : "transparent"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span
                            style={{
                              fontFamily: F.title,
                              fontWeight: 700,
                              fontSize: 14.5,
                              color: C.ink,
                            }}
                          >
                            {t.title}
                          </span>
                          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                            {t.subtitle}
                          </span>
                        </div>
                        {/* WHAT ONE HAD WRITTEN. Without the excerpt, a
                            search on one's own words returns only a list
                            of titles — and one must reopen every card to
                            know which one spoke of what. */}
                        {t.excerpt && (
                          <div
                            style={{
                              fontFamily: F.hand,
                              fontSize: 15,
                              color: C.inkFaded,
                              marginTop: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.excerpt}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

function Word({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: F.hand,
        fontSize: 17,
        color: C.inkFaded,
        padding: "14px 20px",
        lineHeight: 1.35,
      }}
    >
      {children}
    </div>
  );
}
