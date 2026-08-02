import { useEffect } from "react";
import { X } from "lucide-react";
import { C } from "../../theme/tokens";
import { fileNoOf } from "../../domain/seeded";
import { PosterArt } from "../film/PosterArt";
import { InkStars } from "../ui";
import type { Film } from "../../types";

/* Le boîtier qu'on ouvre. Aperçu seulement : le dossier complet reste
   la fiche, on y va d'un clic depuis ici. */
export function CasePreview({
  film,
  onClose,
  onOpenFile,
}: {
  film: Film;
  onClose: () => void;
  onOpenFile: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initials = film.title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,10,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 20,
      }}
    >
      <div
        data-case
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          perspective: 1400,
          animation: "caseIn .3s ease both",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            background: C.card,
            border: `1px solid ${C.line}`,
            minHeight: 330,
            boxShadow: "6px 14px 40px rgba(0,0,0,0.42)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={onClose}
            style={{
              all: "unset",
              position: "absolute",
              top: 10,
              right: 12,
              zIndex: 9,
              cursor: "pointer",
              color: C.inkFaded,
            }}
          >
            <X size={18} />
          </button>
          {/* le rabat, qui s'ouvre vers la gauche */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "50%",
              background: C.paperDark,
              borderRight: `1px solid ${C.line}`,
              transformOrigin: "left center",
              backfaceVisibility: "hidden",
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "openLid .78s cubic-bezier(.22,.9,.25,1) both",
            }}
          >
            <span
              style={{
                transform: "rotate(-90deg)",
                fontFamily: "'Special Elite', monospace",
                fontSize: 11,
                letterSpacing: "0.2em",
                color: C.inkFaded,
                whiteSpace: "nowrap",
              }}
            >
              N° {fileNoOf(film.id)}
            </span>
          </div>
          <div
            style={{
              width: 210,
              flexShrink: 0,
              background: C.paperDark,
              display: "flex",
              alignItems: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "2 / 3",
                border: "1px solid rgba(43,38,32,0.3)",
                boxShadow: "2px 3px 0 rgba(43,38,32,0.18)",
                animation: "slideOut .7s .25s cubic-bezier(.2,.85,.3,1) both",
              }}
            >
              <PosterArt film={film} height={300} initials={initials} plain />
            </div>
          </div>
          <div style={{ flex: 1, padding: "24px 28px", animation: "sheetIn .5s .45s both" }}>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                fontSize: 26,
                color: C.ink,
              }}
            >
              {film.title}
            </div>
            <div
              style={{
                fontFamily: "'Lora', serif",
                fontStyle: "italic",
                fontSize: 13.5,
                color: C.inkFaded,
                marginTop: 2,
              }}
            >
              {film.director || "anonyme"} · {film.year || "s.d."}
            </div>
            {film.status !== "watchlist" && (
              <div style={{ marginTop: 8 }}>
                <InkStars value={film.rating || 0} size={16} />
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
              {(film.genres || []).map((g) => (
                <span
                  key={g}
                  style={{
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 9.5,
                    border: `1px solid ${C.line}`,
                    color: C.inkFaded,
                    padding: "3px 7px",
                  }}
                >
                  {g}
                </span>
              ))}
              {film.chevet && (
                <span
                  style={{
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 9.5,
                    border: `1px solid ${C.burgundy}`,
                    color: C.burgundy,
                    padding: "3px 7px",
                  }}
                >
                  FILM DE CHEVET
                </span>
              )}
              {film.archived && (
                <span
                  style={{
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 9.5,
                    border: `1px solid ${C.slate}`,
                    color: C.slate,
                    padding: "3px 7px",
                  }}
                >
                  MIS DE CÔTÉ
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: "'Lora', serif",
                fontSize: 14,
                lineHeight: 1.65,
                color: C.ink,
                marginTop: 14,
                maxHeight: 120,
                overflow: "hidden",
              }}
            >
              {film.review?.trim() ? (
                film.review.replace(/\[img:\d+\]/g, "").slice(0, 260)
              ) : (
                <span style={{ fontStyle: "italic", color: C.inkFaded }}>
                  Pas encore de note. Le boîtier attend son feuillet.
                </span>
              )}
            </div>
            <button
              onClick={() => onOpenFile(film.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                marginTop: 18,
                padding: "9px 16px",
                background: C.burgundy,
                color: C.card,
                fontFamily: "'Special Elite', monospace",
                fontSize: 11,
                letterSpacing: 1,
              }}
            >
              OUVRIR LE DOSSIER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
