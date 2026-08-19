import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layer } from "../ui/Layer";
import { useDialog } from "../../hooks/useDialog";
import { X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { ShotImage, type Shot } from "./shots";

const ARROW_COL = {
  all: "unset",
  ...tap,
  cursor: "pointer",
  width: "16%",
  minWidth: 90,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: `${alpha(C.paper, 0.6)}`,
  fontSize: 44,
  fontFamily: F.title,
} as const;

/* The full-screen viewer, with keyboard navigation.

   LA SEULE DU PRODUIT, DÉSORMAIS. Elle regardait vos captures ; les
   plans de TMDB en avaient une seconde, qui redessinait le même voile,
   les mêmes flèches et le même compteur — deux visionneuses à corriger
   au lieu d'une. Ce qui les séparait n'était pas l'affichage mais la
   PROVENANCE de l'image, et `Shot` la porte. */
export function StillLightbox({
  shots,
  index,
  title,
  onClose,
  onIndex,
}: {
  shots: Shot[];
  index: number;
  /** De quoi ces images sont les images. Sert à NOMMER la couche. */
  title?: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const { t } = useTranslation();
  const shot = shots[index];
  /* `useDialog` PIÈGE LE FOCUS ET LE REND, ce que cette visionneuse ne
     faisait pas : on l'ouvrait au clavier et le curseur restait derrière
     le voile. Il prend aussi Escape en charge — d'où l'effet ci-dessous
     réduit aux seules flèches. La planche des plans l'avait ; c'est le
     genre de qualité qu'une fusion perd si personne ne compare. */
  const box = useDialog(onClose);

  /* ON NE BOUCLE PAS, ET C'EST UNE DÉCISION : on doit sentir qu'on est
     au bout. Les captures bouclaient, les plans butaient ; la règle qui
     porte une raison écrite l'emporte sur celle qui n'en portait pas. */
  const step = (to: number) => onIndex(Math.max(0, Math.min(shots.length - 1, to)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(index + 1);
      if (e.key === "ArrowLeft") step(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* THE PAGE BEHIND DOES NOT SCROLL.

     The viewer takes the whole screen, but the film's card stays
     underneath with all its height: the vertical bar went on showing at
     the edge, and the wheel slid a page nobody can see. An image looked
     at large is a full screen, not a window laid over something else.

     On `html` and not on `body`: it is the root element's overflow that
     propagates to the window. The previous value is put back as it was —
     empty most of the time, and the style sheet takes over again. */
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflowY;
    root.style.overflowY = "hidden";
    return () => {
      root.style.overflowY = before;
    };
  }, []);
  if (!shot) return null;

  return (
    <Layer>
      {/* CE COMMENTAIRE S'AFFICHAIT. Écrit sans accolades, il n'était pas
          un commentaire mais du TEXTE JSX : la visionneuse posait ses
          trente mots de code anglais au-dessus de l'image, à côté de la
          légende, sur chaque agrandissement. Rien ne pouvait le dire —
          ni le typage, ni le lint, ni un test qui ne lit pas ce que la
          couche écrit.

          Ce qu'il dit reste vrai : la fermeture ne part que du VOILE
          lui-même (`e.target` === `e.currentTarget`) et jamais de ce
          qu'il contient, pour qu'un clic à côté de l'image ne referme
          pas la visionneuse par accident. */}
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title ? t("frames.plate", { title }) : t("stills.theFilmStrip")}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20,15,10,0.88)",
          zIndex: 80,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
        }}
      >
        {/* `all: unset` puts the button back to inline: without `flex`, the vertical
          padding does not count and the target stays a thin strip */}
        <button
          onClick={onClose}
          title={t("stills.close")}
          style={{
            all: "unset",
            ...tap,
            position: "absolute",
            top: 10,
            right: 14,
            cursor: "pointer",
            color: C.paper,
            padding: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <X size={22} />
        </button>

        {/* full-height navigation columns: a wide target, not a chevron */}
        {shots.length > 1 && (
          <button
            onClick={() => step(index - 1)}
            title={t("stills.previous")}
            style={ARROW_COL}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = C.paper;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = `${alpha(C.paper, 0.6)}`;
            }}
          >
            ‹
          </button>
        )}

        {/* the central area is entirely safe, margins included */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px 10px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              background: C.card,
              padding: 10,
              boxShadow: "0 14px 40px rgba(0,0,0,0.6)",
              maxWidth: "100%",
            }}
          >
            <ShotImage
              shot={shot}
              big
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: "72vh",
                objectFit: "contain",
              }}
            />
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 21,
              color: C.paper,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {shot.caption || t("stills.shotNumber", { n: index + 1 })}
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                opacity: 0.7,
                marginLeft: 10,
              }}
            >
              {t("frames.count", { place: index + 1, total: shots.length })}
            </span>
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              color: `${alpha(C.paper, 0.4)}`,
              marginTop: 10,
              letterSpacing: 1,
            }}
          >
            {t("stills.escToClose")}
          </div>
        </div>

        {shots.length > 1 && (
          <button
            onClick={() => step(index + 1)}
            title={t("stills.next")}
            style={ARROW_COL}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = C.paper;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = `${alpha(C.paper, 0.6)}`;
            }}
          >
            ›
          </button>
        )}
      </div>
    </Layer>
  );
}
