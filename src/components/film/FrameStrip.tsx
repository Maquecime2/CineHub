/* ============================================================
   A FEW FRAMES OF THE FILM
   ============================================================

   A poster is a promise made by a marketing department; a frame is the
   film. Six of them say the light, the faces and the period in one
   glance, which is exactly what one is trying to decide when a film is
   proposed and one has not seen it.

   THEY COST ONE REQUEST, AND IT IS ALREADY PAID. `getDetails` appends
   `images` to the call it was making anyway — see `tmdb.js`. What is
   stored is a PATH, so the strip asks for w300 and the enlargement for
   w1280 without the card having to be rewritten the day one of the two
   changes.

   THEY ARE NOT `stills`. Those are what YOU captured: they live in this
   device's vault, they are mirrored server-side, they count against
   `MEDIA_CEILING`, and they carry a caption one writes. Here there is
   nothing to annotate and nothing to delete — which is why the two are
   drawn apart and named apart wherever they meet.

   THE ENLARGEMENT IS A LAYER, so it goes through `Layer` and
   `useDialog`: `[data-enters]` carries a transform during the view's
   entrance and would anchor a `fixed` panel to the column. The arrows
   walk the plate and Escape leaves it — a gallery one can only click
   through is a gallery half the people cannot open. */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { Layer } from "../ui/Layer";
import { Label } from "../ui";
import { useDialog } from "../../hooks/useDialog";
import { FRAME_FULL, FRAME_THUMB } from "../../tmdb";

export function FrameStrip({ frames, title }: { frames: string[]; title: string }) {
  const { t } = useTranslation();
  /** Le rang ouvert en grand, ou `null` tant que la planche est fermée. */
  const [open, setOpen] = useState<number | null>(null);
  /* Une image que le navigateur n'a pas pu charger n'est pas une case
     vide : elle sort de la planche. TMDB connaît des chemins dont il ne
     sert plus l'image. */
  const [broken, setBroken] = useState<Set<string>>(new Set());

  const shown = frames.filter((f) => !broken.has(f));
  if (!shown.length) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <Label>{t("frames.title")}</Label>
      <ul
        aria-label={t("frames.title")}
        style={{
          listStyle: "none",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
          gap: 6,
          margin: "6px 0 0",
          padding: 0,
        }}
      >
        {shown.map((path, i) => (
          <li key={path}>
            <button
              onClick={() => setOpen(i)}
              aria-label={t("frames.enlarge", { title, place: i + 1, total: shown.length })}
              style={{ ...bare, display: "block", width: "100%", padding: 0 }}
            >
              <img
                src={`${FRAME_THUMB}${path}`}
                alt=""
                /* Six images valent une LISTE et non un moment : décodage
                   différé, aucun filtre, aucun mélange de calques. */
                loading="lazy"
                decoding="async"
                onError={() => setBroken((was) => new Set(was).add(path))}
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "16 / 9",
                  objectFit: "cover",
                  border: `1px solid ${alpha(C.line, 0.8)}`,
                  background: alpha(C.ink, 0.06),
                }}
              />
            </button>
          </li>
        ))}
      </ul>

      {open !== null && shown[open] && (
        <Enlarged
          frames={shown}
          at={open}
          title={title}
          onMove={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Enlarged({
  frames,
  at,
  title,
  onMove,
  onClose,
}: {
  frames: string[];
  at: number;
  title: string;
  onMove: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useDialog(onClose);

  /* LES FLÈCHES MARCHENT DEPUIS N'IMPORTE OÙ DANS LA COUCHE, et pas
     seulement depuis les deux boutons : le focus est piégé dedans, donc
     il n'y a personne d'autre pour les entendre. Elles ne bouclent pas —
     on doit sentir qu'on est au bout d'une planche de six. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && at > 0) onMove(at - 1);
      if (e.key === "ArrowRight" && at < frames.length - 1) onMove(at + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, frames.length, onMove]);

  const step = (delta: number) => {
    const next = at + delta;
    if (next >= 0 && next < frames.length) onMove(next);
  };

  return (
    <Layer>
      <div
        style={{
          position: "fixed",
          inset: 0,
          /* Au-dessus de la vue rapide, qui est elle-même à 50 : c'est
             elle qui l'ouvre, et une planche derrière son appelant ne se
             verrait pas. Sous les peaux et la visite. */
          zIndex: 55,
          background: alpha(C.ink, 0.85),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
        onClick={onClose}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={t("frames.plate", { title })}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "min(1100px, 100%)", width: "100%" }}
        >
          <img
            src={`${FRAME_FULL}${frames[at]}`}
            alt=""
            style={{
              display: "block",
              width: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
              margin: "0 auto",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 10,
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => step(-1)}
              disabled={at === 0}
              aria-label={t("frames.previous")}
              title={t("frames.previous")}
              style={{ ...bare, color: C.card, opacity: at === 0 ? 0.3 : 1, padding: 4 }}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.card }}>
              {t("frames.count", { place: at + 1, total: frames.length })}
            </span>
            <button
              onClick={() => step(1)}
              disabled={at === frames.length - 1}
              aria-label={t("frames.next")}
              title={t("frames.next")}
              style={{
                ...bare,
                color: C.card,
                opacity: at === frames.length - 1 ? 0.3 : 1,
                padding: 4,
              }}
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={onClose}
              aria-label={t("frames.close")}
              title={t("frames.close")}
              style={{ ...bare, color: C.card, padding: 4, marginLeft: 10 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </Layer>
  );
}
