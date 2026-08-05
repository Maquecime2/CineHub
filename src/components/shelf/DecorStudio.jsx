/* L'ATELIER DÉCO — de quoi la pièce est faite.

   Le cabinet de curiosités donne les objets qu'on POSE ; celui-ci donne
   la matière de ce sur quoi on les pose. Deux volets, parce qu'il y a
   deux surfaces : le mur derrière, la planche dessous.

   IL N'Y A PAS DE VOLET « PALETTE ». Les teintes se choisissent SUR
   l'objet qui les porte, dans sa propre palette — un nuancier ici
   n'aurait rien à peindre, et offrirait un réglage global là où la
   couleur est une propriété de chaque carton. La seule teinte qui soit
   un réglage de pièce est celle du papier peint, et elle vit donc avec
   lui, dans le volet du mur.

   Chaque vignette est rendue par le MÊME moteur que l'étagère
   (`theme/surfaces`) : un aperçu qui se dessinerait autrement finirait
   par mentir, et c'est toujours l'aperçu qui aurait tort.

   Rien n'est écrit tant qu'on ne choisit rien, et « revenir au thème »
   efface le décor entier : la vue redevient ce que son bois dit d'elle.
   C'est cette porte de sortie qui rend toute l'exploration sans risque. */
import { useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { MATERIALS, FINISHES, FAMILY_LABELS, materialStyle } from "../../theme/surfaces";
import {
  STUDIO_BOX,
  Title,
  Grid,
  Swatch,
  NoneSwatch,
  OptionButton,
  SurfaceTab,
} from "../ui/Swatches";

/* Les matériaux, groupés par famille. Vingt et une vignettes en vrac
   seraient un catalogue ; par famille, on cherche « quelque chose en
   métal » et on l'a. Même raisonnement que pour les teintes. */
const byFamily = () => {
  const out = new Map();
  for (const [k, m] of Object.entries(MATERIALS)) {
    if (!out.has(m.family)) out.set(m.family, []);
    out.get(m.family).push(k);
  }
  return [...out.entries()];
};

function PlankTab({ decor, set }) {
  return (
    <>
      <Title top={4}>MATÉRIAU</Title>
      <NoneSwatch on={!decor?.material} onClick={() => set({ material: null })} label="au thème" />

      {byFamily().map(([family, keys]) => (
        <div key={family}>
          <Title top={9}>{FAMILY_LABELS[family].toUpperCase()}</Title>
          <Grid>
            {keys.map((k) => (
              <Swatch
                key={k}
                on={decor?.material === k}
                onClick={() => set({ material: k })}
                title={MATERIALS[k].label}
                h={22}
                /* La vignette est une TRANCHE de planche, à la finition
                   retenue : c'est ce qu'on verra sous les boîtiers. */
                style={materialStyle(k, decor?.finish)}
              />
            ))}
          </Grid>
        </div>
      ))}

      {/* La finition ne vernit que ce qui a une matière : sans matériau,
          elle ne toucherait à rien. */}
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
                {f.label}
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
    <>
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
    </>
  );
}
