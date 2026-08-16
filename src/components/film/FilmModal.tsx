/* ============================================================
   FORMULAIRE — NOUVEAU FILM
   ============================================================ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, ruledTextarea, tap, tapSquare } from "../../theme/styles";
import { CommaInput, InkStars, Label } from "../ui";
import { makeFilm } from "../../domain/film";
import type { Film, FilmStatus } from "../../types";
import { useViewport } from "../../hooks/useViewport";
import { useEscape } from "../../hooks/useEscape";

const STATUSES: { k: FilmStatus; l: string }[] = [
  { k: "watched", l: "Film vu" },
  { k: "watchlist", l: "views.watchlist" },
];

export function FilmModal({ onClose, onSave }: { onClose: () => void; onSave: (f: Film) => void }) {
  const { t } = useTranslation();
  useEscape(onClose);
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
          {t("film.newCard")}
        </div>
        <div style={{ height: 1, background: C.line, margin: "14px 0 20px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 2 }}>
            <Label>{t("film.titleField")}</Label>
            <input
              style={underlineInput}
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t("film.titlePlaceholder")}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Label>{t("film.year")}</Label>
            <input
              style={underlineInput}
              value={f.year}
              onChange={(e) => set("year", e.target.value as Film["year"])}
              placeholder="1975"
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>{t("film.director")}</Label>
          <input
            style={underlineInput}
            value={f.director}
            onChange={(e) => set("director", e.target.value)}
            placeholder={t("film.nameField")}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>{t("film.genresField")}</Label>
          <CommaInput
            style={underlineInput}
            value={f.genres}
            onChange={(v) => set("genres", v)}
            placeholder={t("film.genresPlaceholder")}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <Label>{t("film.themes")}</Label>
          <CommaInput
            style={underlineInput}
            value={f.themes}
            onChange={(v) => set("themes", v)}
            placeholder={t("film.themesPlaceholder")}
          />
        </div>
        <div style={{ marginTop: 18 }}>
          <Label>{t("film.thisCard")}</Label>
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
            <Label>{t("film.yourRating")}</Label>
            <InkStars value={f.rating} onChange={(v) => set("rating", v)} size={22} />
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Label>{t("film.firstImpression")}</Label>
          <textarea
            style={{ ...ruledTextarea, minHeight: 70 }}
            value={f.review}
            onChange={(e) => set("review", e.target.value)}
            placeholder={t("film.feelingPlaceholder")}
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
          {t("film.pinToWall")}
        </button>
      </div>
    </div>
  );
}
