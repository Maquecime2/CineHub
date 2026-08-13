/* ============================================================
   THE SKIN PICKER — what the site looks like
   ============================================================

   One thumbnail per skin, and the thumbnail IS the skin: its background
   is the page background of the one it offers, its title is written in
   its title font, its pills are its tokens. A preview that drew itself
   otherwise would end up lying — it is the same rule as the Decor
   Workshop's thumbnails.

   The fonts of a skin one has not chosen are NOT loaded: its title
   therefore shows in its stack's fallback font until one has tried it.
   That is an accepted compromise — preloading fourteen sets of fonts for
   a panel one opens twice costs far more than what the preview gains by
   it. The colours, for their part, are right the first time, and they
   are what one looks at. */
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
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

/* What the skin gives to be seen, in small. We read its values
   DIRECTLY — not the document's variables, which are those of the skin
   in place and would make the fourteen thumbnails identical. */
function SkinCard({ skin, on, onPick }: { skin: Skin; on: boolean; onPick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onPick}
      aria-pressed={on}
      aria-label={t(`skins.${skin.key}.label`)}
      style={{
        all: "unset",
        ...tap,
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
        {t(`skins.${skin.key}.label`)}
      </div>
      <div
        style={{
          fontFamily: skin.fonts.hand,
          fontSize: 13,
          color: skin.c.inkFaded,
          marginTop: 1,
        }}
      >
        {t(`skins.${skin.key}.note`)}
      </div>
      {/* the six tokens that carry the identity, in the order they are seen */}
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
          <button
            onClick={onClose}
            aria-label="Fermer le choix des peaux"
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
          >
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

        {/* What the skin does not touch, said once rather than never:
            the user who painted their cards must know why they do not
            follow. */}
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
