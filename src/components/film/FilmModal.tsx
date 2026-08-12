/* ============================================================
   FORMULAIRE — NOUVEAU FILM
   ============================================================ */
import { useState } from "react";
import { X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, ruledTextarea, tap, tapSquare } from "../../theme/styles";
import { CommaInput, InkStars, Label } from "../ui";
import { makeFilm } from "../../domain/film";
import type { Film, FilmStatus } from "../../types";
import { useViewport } from "../../hooks/useViewport";

const STATUSES: { k: FilmStatus; l: string }[] = [
  { k: "watched", l: "Film vu" },
  { k: "watchlist", l: "À voir" },
];

export function FilmModal({ onClose, onSave }: { onClose: () => void; onSave: (f: Film) => void }) {
  const [f, setF] = useState<Film>(() => makeFilm());
  const set = <K extends keyof Film>(k: K, v: Film[K]) => setF((p) => ({ ...p, [k]: v }));
  const { phone } = useViewport();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,10,0.55)",
        display: "flex",
        /* ON A PHONE, THE CARD RISES FROM THE BOTTOM RATHER THAN
           FLOATING IN THE MIDDLE.

           A centred card assumes a margin all around, and on three
           hundred and ninety pixels that margin is emptiness paid for
           twice: in field width, and in height — the soft keyboard takes
           the lower half of the screen, and a centred card ends up pushed
           under it. Anchored at the bottom, it stops where the keyboard
           begins. */
        alignItems: phone ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: 50,
        padding: phone ? 0 : 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          width: "min(520px, 100%)",
          /* The veil no longer carries an inset on a phone: it is the
             sheet that takes its margins, and its bottom margin must pass
             above the system's home bar. */
          margin: phone ? "0 8px" : undefined,
          marginBottom: phone ? "max(8px, var(--safe-bottom))" : undefined,
          maxHeight: phone ? "calc(100dvh - 24px)" : "88vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          padding: "clamp(20px, 5vw, 30px) clamp(18px, 6vw, 34px)",
          position: "relative",
          boxShadow: "6px 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            all: "unset",
            ...tapSquare,
            position: "absolute",
            top: 18,
            right: 20,
            cursor: "pointer",
            color: C.inkFaded,
          }}
        >
          <X size={18} />
        </button>
        <div
          style={{
            fontFamily: F.title,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 28,
            color: C.ink,
          }}
        >
          NewsItem fiche
        </div>
        <div style={{ height: 1, background: C.line, margin: "14px 0 20px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 2 }}>
            <Label>Titre</Label>
            <input
              style={underlineInput}
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Le titre du film"
            />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Année</Label>
            <input
              style={underlineInput}
              value={f.year}
              onChange={(e) => set("year", e.target.value as Film["year"])}
              placeholder="1975"
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>Réalisateur·rice</Label>
          <input
            style={underlineInput}
            value={f.director}
            onChange={(e) => set("director", e.target.value)}
            placeholder="Nom"
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>Genres (virgules)</Label>
          <CommaInput
            style={underlineInput}
            value={f.genres}
            onChange={(v) => set("genres", v)}
            placeholder="Drame, Science-fiction"
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>Thèmes (virgules)</Label>
          <CommaInput
            style={underlineInput}
            value={f.themes}
            onChange={(v) => set("themes", v)}
            placeholder="Mémoire, Solitude"
          />
        </div>
        <div style={{ marginTop: 18 }}>
          <Label>Cette fiche</Label>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            {STATUSES.map((o) => (
              <button
                key={o.k}
                onClick={() => set("status", o.k)}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  padding: "6px 14px",
                  fontFamily: F.mono,
                  fontSize: 11,
                  background: f.status === o.k ? C.pine : "transparent",
                  color: f.status === o.k ? C.card : C.inkFaded,
                  border: `1px solid ${f.status === o.k ? C.pine : C.line}`,
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        {f.status === "watched" && (
          <div style={{ marginTop: 16 }}>
            <Label>Votre note</Label>
            <InkStars value={f.rating} onChange={(v) => set("rating", v)} size={22} />
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Label>Première impression</Label>
          <textarea
            style={{ ...ruledTextarea, minHeight: 70 }}
            value={f.review}
            onChange={(e) => set("review", e.target.value)}
            placeholder="Ce que ce film vous a fait ressentir…"
          />
        </div>
        <button
          onClick={() => f.title.trim() && onSave(f)}
          disabled={!f.title.trim()}
          style={{
            all: "unset",
            ...tap,
            marginTop: 24,
            width: "100%",
            textAlign: "center",
            padding: "12px 0",
            background: f.title.trim() ? C.burgundy : C.line,
            color: C.card,
            fontFamily: F.mono,
            fontSize: 13,
            letterSpacing: 1,
            cursor: f.title.trim() ? "pointer" : "not-allowed",
            boxSizing: "border-box",
          }}
        >
          ÉPINGLER CETTE FICHE AU MUR
        </button>
      </div>
    </div>
  );
}
