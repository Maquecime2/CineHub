/* THE WALL WORKSHOP — the counterpart of the decor workshop, on the
   cards' side.

   The shelf has been adjustable for a long time; the wall offered
   nothing. It gets the same handles here, and above all the SAME
   palette: paint, wallpaper, ink and texture come from `ui/Swatches`,
   extracted from the shelf's workshop precisely so that the two surfaces
   never diverge.

   Two panels, because there are two things to adjust: what the cards are
   hung on, and the cards themselves. */
import { useState } from "react";
import { Layer } from "../../components/ui/Layer";
import { X, RotateCcw } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { STUDIO_BOX, Title, OptionButton, SurfaceTab } from "../../components/ui/Swatches";
import { CARD_SIZES, SPREADS, MESSES, HANGS, DEFAULT_WALL_LOOK } from "./wallLook";

const Row = ({ children }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{children}</div>
);

/* One setting = one title and one row of choices drawn from its
   catalogue. The four look alike because they do the same thing: name a
   key and remember it. */
const Choice = ({ title, catalog, value, onPick, top }) => (
  <>
    <Title top={top}>{title}</Title>
    <Row>
      {Object.entries(catalog).map(([k, v]) => (
        <OptionButton key={k} on={value === k} onClick={() => onPick(k)}>
          {v.label}
        </OptionButton>
      ))}
    </Row>
  </>
);

function CardsTab({ look, set }) {
  return (
    <>
      <Choice
        title="TAILLE DES FICHES"
        top={4}
        catalog={CARD_SIZES}
        value={look.size}
        onPick={(size) => set({ size })}
      />
      <Choice
        title="ÉCARTEMENT"
        catalog={SPREADS}
        value={look.spread}
        onPick={(spread) => set({ spread })}
      />
      {/* "Rangé" does not remove the disorder, it sets it to zero: the
          draw of each card is intact, and going back up one notch gives
          the wall exactly the look it had. */}
      <Choice
        title="DÉSORDRE"
        catalog={MESSES}
        value={look.mess}
        onPick={(mess) => set({ mess })}
      />
      <Choice title="ACCROCHE" catalog={HANGS} value={look.hang} onPick={(hang) => set({ hang })} />
    </>
  );
}

const TABS = [
  { key: "wall", label: "MUR" },
  { key: "cards", label: "FICHES" },
];

export function WallStudio({ look, onChange, onReset, onClose }) {
  const [tab, setTab] = useState("cards");
  // the decor is empty at the start: nothing is written until something is chosen
  const setDecor = (patch) => onChange({ decor: { ...(look.decor || {}), ...patch } });

  return (
    <Layer>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 44 }} />
      <div style={STUDIO_BOX}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              letterSpacing: 1,
              color: C.inkFaded,
            }}
          >
            ATELIER DU MUR
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onReset}
            title="Revenir au mur d'origine"
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontFamily: F.mono,
              fontSize: 9,
              color: C.burgundy,
            }}
          >
            <RotateCcw size={11} /> D'ORIGINE
          </button>
          {/* A cross on its own has no name: without a label, a screen
              reader announces "button" and nothing else. */}
          <button
            onClick={onClose}
            aria-label="Fermer l'atelier"
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
          >
            <X size={13} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
          {TABS.map((t) => (
            <OptionButton key={t.key} on={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </OptionButton>
          ))}
        </div>

        {tab === "wall" ? (
          <SurfaceTab decor={look.decor} set={setDecor} />
        ) : (
          <CardsTab look={look} set={onChange} />
        )}

        <div
          style={{
            fontFamily: F.hand,
            fontSize: 14,
            color: C.inkFaded,
            marginTop: 10,
          }}
        >
          {DEFAULT_WALL_LOOK.size === look.size && !look.decor
            ? "le mur est encore tel qu'on l'a trouvé"
            : "ce mur est à cette collection — l'autre garde le sien"}
        </div>
      </div>
    </Layer>
  );
}
