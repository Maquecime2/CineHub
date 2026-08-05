/* ============================================================
   LE CHOIX DE LA PEAU — à quoi ressemble le site
   ============================================================

   Une vignette par peau, et la vignette EST la peau : son fond est le
   fond de page de celle qu'elle propose, son titre est écrite dans sa
   police de titre, ses pastilles sont ses jetons. Un aperçu qui se
   dessinerait autrement finirait par mentir — c'est la même règle que
   les vignettes de l'Atelier déco.

   Les polices d'une peau qu'on n'a pas choisie ne sont PAS chargées :
   son titre s'affiche donc dans la police de secours de sa pile tant
   qu'on ne l'a pas essayée. C'est un compromis assumé — précharger
   quatorze jeux de polices pour un panneau qu'on ouvre deux fois coûte
   bien plus cher que ce que l'aperçu y gagne. Les couleurs, elles, sont
   justes du premier coup, et ce sont elles qu'on regarde. */
import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { SKINS, type Skin } from "../../theme/skins";

const PANEL: CSSProperties = {
  position: "fixed",
  right: 40,
  top: 90,
  zIndex: 60,
  width: 330,
  maxHeight: "calc(100vh - 140px)",
  overflowY: "auto",
  padding: "14px 16px",
  background: C.card,
  border: `1px solid ${C.line}`,
  boxShadow: "2px 8px 24px rgba(20,14,8,0.4)",
};

/* Ce que la peau donne à voir, en petit. On lit ses valeurs
   DIRECTEMENT — pas les variables du document, qui sont celles de la
   peau posée et rendraient les quatorze vignettes identiques. */
function SkinCard({ skin, on, onPick }: { skin: Skin; on: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      aria-pressed={on}
      aria-label={skin.label}
      style={{
        all: "unset",
        cursor: "pointer",
        boxSizing: "border-box",
        display: "block",
        width: "100%",
        marginBottom: 8,
        padding: "10px 12px",
        background: skin.page,
        border: on ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
        borderRadius: skin.tag.radius,
      }}
    >
      <div
        style={{
          fontFamily: skin.fonts.title,
          fontSize: 16,
          color: skin.c.ink,
          letterSpacing: skin.tag.tracking,
          textTransform: skin.tag.transform as never,
        }}
      >
        {skin.label}
      </div>
      <div
        style={{
          fontFamily: skin.fonts.hand,
          fontSize: 13,
          color: skin.c.inkFaded,
          marginTop: 1,
        }}
      >
        {skin.note}
      </div>
      {/* les six jetons qui portent l'identite, dans l'ordre ou on les voit */}
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {["burgundy", "ochre", "pine", "slate", "cobalt", "vermillion"].map((k) => (
          <span
            key={k}
            style={{
              width: 15,
              height: 15,
              borderRadius: skin.tag.radius,
              background: skin.c[k],
              border: `1px solid ${alpha(skin.c.ink!, 0.2)}`,
            }}
          />
        ))}
      </div>
    </button>
  );
}

export function SkinPicker({
  skin,
  onPick,
  onClose,
}: {
  skin: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div style={PANEL}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.inkFaded,
            }}
          >
            PEAU DU SITE
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}>
            <X size={13} />
          </button>
        </div>
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 14,
            color: C.inkFaded,
            marginBottom: 10,
          }}
        >
          elle change tout — le fond, les couleurs, les polices, les onglets
        </div>

        {SKINS.map((s) => (
          <SkinCard key={s.key} skin={s} on={s.key === skin} onPick={() => onPick(s.key)} />
        ))}

        {/* Ce que la peau ne touche pas, dit une fois plutot que jamais :
            l'utilisateur qui a peint ses cartons doit savoir pourquoi ils
            ne suivent pas. */}
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 13.5,
            color: C.inkFaded,
            marginTop: 12,
            borderTop: `1px solid ${C.line}`,
            paddingTop: 8,
          }}
        >
          vos cartons et le décor de vos étagères gardent leurs couleurs : ce sont vos choix, pas
          l&apos;habillage du site
        </div>
      </div>
    </>
  );
}
