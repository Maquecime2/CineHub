/* THE DECOR WORKSHOP — what the room is made of.

   The cabinet of curiosities gives the objects one LAYS DOWN; this one
   gives the substance of what one lays them on. Two panels, because there
   are two surfaces: the wall behind, the board underneath.

   THERE IS NO "PALETTE" PANEL. Tints are chosen ON the object that
   carries them, in its own palette — a colour chart here would have
   nothing to paint, and would offer a global setting where colour is a
   property of each card. The only tint that is a room setting is the
   wallpaper's, and it therefore lives with it, in the wall panel.

   Every thumbnail is rendered by the SAME engine as the shelf
   (`theme/surfaces`): a preview that drew itself otherwise would end up
   lying, and it is always the preview that would be wrong.

   Nothing is written as long as one chooses nothing, and "back to the
   theme" erases the whole decor: the view becomes again what its wood
   says of it. It is that way out that makes all the exploring
   riskless. */
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Layer } from "../ui/Layer";
import { X, RotateCcw } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { MATERIALS, FINISHES, materialStyle } from "../../theme/surfaces";
import {
  STUDIO_BOX,
  Title,
  Grid,
  Swatch,
  NoneSwatch,
  OptionButton,
  SurfaceTab,
} from "../ui/Swatches";

/* The materials, grouped by family. Twenty-one thumbnails in bulk would
   be a catalogue; by family, one looks for "something in metal" and has
   it. The same reasoning as for the tints. */
const byFamily = () => {
  const out = new Map();
  for (const [k, m] of Object.entries(MATERIALS)) {
    if (!out.has(m.family)) out.set(m.family, []);
    out.get(m.family).push(k);
  }
  return [...out.entries()];
};

function PlankTab({ decor, set }) {
  const { t } = useTranslation();
  return (
    <>
      <Title top={4}>MATÉRIAU</Title>
      <NoneSwatch on={!decor?.material} onClick={() => set({ material: null })} label="au thème" />

      {byFamily().map(([family, keys]) => (
        <div key={family}>
          <Title top={9}>{t(`surfaces.families.${family}`).toUpperCase()}</Title>
          <Grid>
            {keys.map((k) => (
              <Swatch
                key={k}
                on={decor?.material === k}
                onClick={() => set({ material: k })}
                title={t(`surfaces.materials.${k}`)}
                h={22}
                /* The thumbnail is a SLICE of board, in the chosen
                   finish: it is what one will see under the cases. */
                style={materialStyle(k, decor?.finish)}
              />
            ))}
          </Grid>
        </div>
      ))}

      {/* The finish only varnishes what has a material: with no
          material, it would touch nothing. */}
      {decor?.material && (
        <>
          <Title>FINITION</Title>
          <div style={{ display: "flex", gap: 5 }}>
            {Object.entries(FINISHES).map(([k, f]) => (
              <OptionButton
                key={k}
                on={(decor?.finish || "satine") === k}
                onClick={() => set({ finish: k })}
              >
                {t(`surfaces.finishes.${k}`)}
              </OptionButton>
            ))}
          </div>
        </>
      )}
    </>
  );
}

const TABS = [
  { key: "wall", label: "MUR" },
  { key: "plank", label: "PLANCHE" },
];

export function DecorStudio({ view, onChange, onReset, onClose }) {
  const [tab, setTab] = useState("wall");
  const decor = view?.decor?.[tab === "wall" ? "wall" : "plank"] || null;
  const set = (patch) => onChange(tab === "wall" ? "wall" : "plank", patch);

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
            ATELIER DÉCO
          </div>
          <div style={{ flex: 1 }} />
          {view?.decor && (
            <button
              onClick={onReset}
              title="Effacer le décor et revenir au bois du thème"
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontFamily: F.mono,
                fontSize: 9,
                color: C.burgundy,
              }}
            >
              <RotateCcw size={11} /> AU THÈME
            </button>
          )}
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "2px 10px",
                fontFamily: F.mono,
                fontSize: 9.5,
                background: tab === t.key ? C.ink : "transparent",
                color: tab === t.key ? C.card : C.inkFaded,
                border: `1px solid ${tab === t.key ? C.ink : C.line}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "wall" ? (
          <SurfaceTab decor={decor} set={set} />
        ) : (
          <PlankTab decor={decor} set={set} />
        )}

        <div
          style={{
            fontFamily: F.hand,
            fontSize: 14,
            color: C.inkFaded,
            marginTop: 10,
          }}
        >
          le décor appartient à cette vue — une autre garde le sien
        </div>
      </div>
    </Layer>
  );
}
