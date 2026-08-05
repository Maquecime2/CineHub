import { useEffect } from "react";
import { X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { IdbImage } from "./IdbImage";
import type { Still } from "../../types";

const ARROW_COL = {
  all: "unset",
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

/* La visionneuse plein écran, avec navigation au clavier. */
export function StillLightbox({
  stills,
  index,
  onClose,
  onIndex,
}: {
  stills: Still[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const still = stills[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % stills.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + stills.length) % stills.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, stills.length, onClose, onIndex]);

  /* LA PAGE DERRIÈRE NE DÉFILE PAS.

     La visionneuse prend tout l'écran, mais la fiche du film reste
     dessous avec toute sa hauteur : la barre verticale continuait de
     s'afficher sur le bord, et la molette faisait glisser une page
     qu'on ne voit pas. Une image regardée en grand est un plein écran,
     pas une fenêtre posée sur autre chose.

     Sur `html` et non sur `body` : c'est le débordement de l'élément
     racine qui se propage à la fenêtre. La valeur d'avant est remise
     telle quelle — vide le plus souvent, et la feuille de styles
     reprend la main. */
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflowY;
    root.style.overflowY = "hidden";
    return () => {
      root.style.overflowY = before;
    };
  }, []);
  if (!still) return null;

  return (
    /* Fermer ne se déclenche que sur le fond lui-même (`e.target` = le voile),
       jamais sur ce qu'il contient : viser à côté de l'image ne referme plus
       la visionneuse par accident. */
    <div
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
      {/* `all: unset` remet le bouton en inline : sans `flex`, le rembourrage
          vertical ne compte pas et la cible reste une mince bande */}
      <button
        onClick={onClose}
        title="fermer (Échap)"
        style={{
          all: "unset",
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

      {/* colonnes de navigation pleine hauteur : une cible large, pas un chevron */}
      {stills.length > 1 && (
        <button
          onClick={() => onIndex((index - 1 + stills.length) % stills.length)}
          title="précédente (←)"
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

      {/* la zone centrale est entièrement sûre, marges comprises */}
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
          <IdbImage
            imageKey={still.key}
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
          {still.caption || `capture ${index + 1}`}
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              opacity: 0.7,
              marginLeft: 10,
            }}
          >
            {index + 1} / {stills.length}
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
          ÉCHAP POUR FERMER
        </div>
      </div>

      {stills.length > 1 && (
        <button
          onClick={() => onIndex((index + 1) % stills.length)}
          title="suivante (→)"
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
  );
}
