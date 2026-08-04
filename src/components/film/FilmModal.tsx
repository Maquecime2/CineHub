/* ============================================================
   FORMULAIRE — NOUVEAU FILM
   ============================================================ */
import { useState } from "react";
import { X } from "lucide-react";
import { C } from "../../theme/tokens";
import { underlineInput, ruledTextarea } from "../../theme/styles";
import { InkStars, Label } from "../ui";
import { makeFilm } from "../../domain/film";
import type { Film, FilmStatus } from "../../types";

const STATUSES: { k: FilmStatus; l: string }[] = [
  { k: "watched", l: "Film vu" },
  { k: "watchlist", l: "À voir" },
];

const commaList = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function FilmModal({ onClose, onSave }: { onClose: () => void; onSave: (f: Film) => void }) {
  const [f, setF] = useState<Film>(() => makeFilm());
  const set = <K extends keyof Film>(k: K, v: Film[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,10,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.card,
          width: "min(520px,100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "30px 34px",
          position: "relative",
          boxShadow: "6px 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            all: "unset",
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
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 28,
            color: C.ink,
          }}
        >
          Nouvelle fiche
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
          <input
            style={underlineInput}
            value={f.genres.join(", ")}
            onChange={(e) => set("genres", commaList(e.target.value))}
            placeholder="Drame, Science-fiction"
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>Thèmes (virgules)</Label>
          <input
            style={underlineInput}
            value={f.themes.join(", ")}
            onChange={(e) => set("themes", commaList(e.target.value))}
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
                  cursor: "pointer",
                  padding: "6px 14px",
                  fontFamily: "'Special Elite', monospace",
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
            marginTop: 24,
            width: "100%",
            textAlign: "center",
            padding: "12px 0",
            background: f.title.trim() ? C.burgundy : C.line,
            color: C.card,
            fontFamily: "'Special Elite', monospace",
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
