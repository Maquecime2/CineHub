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
import { C } from "../../theme/tokens";
import {
  PAINTS,
  PATTERNS,
  TEXTURES,
  MATERIALS,
  FINISHES,
  FAMILY_LABELS,
  paintStyle,
  patternLayer,
  textureLayer,
  materialStyle,
} from "../../theme/surfaces";
import { CAT_FAMILIES, catInk } from "./constants";

const STUDIO_BOX = {
  position: "fixed",
  right: 40,
  top: 120,
  zIndex: 45,
  width: 300,
  maxHeight: "calc(100vh - 170px)",
  overflowY: "auto",
  padding: "12px 14px",
  background: C.card,
  border: `1px solid ${C.line}`,
  boxShadow: "2px 8px 20px rgba(30,20,10,0.34)",
};

const Title = ({ children, top = 12 }) => (
  <div
    style={{
      fontFamily: "'Special Elite', monospace",
      fontSize: 8.5,
      letterSpacing: 1,
      color: C.inkFaded,
      margin: `${top}px 0 5px`,
    }}
  >
    {children}
  </div>
);

const Grid = ({ children }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{children}</div>
);

/* Une vignette. Elle porte le style qu'elle propose, et le cadre d'encre
   dit lequel est retenu — le même signe que les pastilles de couleur. */
const Swatch = ({ on, onClick, title, style, w = 42, h = 28, children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    aria-pressed={on}
    style={{
      all: "unset",
      cursor: "pointer",
      boxSizing: "border-box",
      position: "relative",
      overflow: "hidden",
      width: w,
      height: h,
      border: on ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
      ...style,
    }}
  >
    {children}
  </button>
);

/* « Rien » est un choix, pas une absence de bouton : sans lui, on pose
   un papier peint et on ne peut plus l'enlever. */
const NoneSwatch = ({ on, onClick, label = "aucun" }) => (
  <Swatch
    on={on}
    onClick={onClick}
    title={label}
    style={{
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Special Elite', monospace",
      fontSize: 8,
      color: C.inkFaded,
    }}
  >
    {label}
  </Swatch>
);

function WallTab({ decor, set }) {
  const ink = decor?.patternInk ? catInk(decor.patternInk) : undefined;
  const pattern = patternLayer(decor?.pattern, ink);

  return (
    <>
      <Title top={4}>PEINTURE</Title>
      <Grid>
        <NoneSwatch on={!decor?.paint} onClick={() => set({ paint: null })} />
        {Object.entries(PAINTS).map(([k, p]) => (
          <Swatch
            key={k}
            on={decor?.paint === k}
            onClick={() => set({ paint: k })}
            title={p.label}
            style={paintStyle(k)}
          />
        ))}
      </Grid>

      <Title>PAPIER PEINT</Title>
      <Grid>
        <NoneSwatch on={!decor?.pattern} onClick={() => set({ pattern: null })} />
        {Object.entries(PATTERNS).map(([k, p]) => (
          <Swatch
            key={k}
            on={decor?.pattern === k}
            onClick={() => set({ pattern: k })}
            title={p.label}
            /* La vignette montre la trame SUR la peinture retenue : un
               motif sur fond blanc ne dit pas ce qu'il donnera. */
            style={{ ...paintStyle(decor?.paint), ...patternLayer(k, ink) }}
          />
        ))}
      </Grid>

      {/* L'encre n'a de sens qu'avec une trame à teinter. */}
      {decor?.pattern && (
        <>
          <Title>ENCRE DU MOTIF</Title>
          <Grid>
            {CAT_FAMILIES.flatMap((f) => f.keys).map((k) => (
              <Swatch
                key={k}
                on={decor?.patternInk === k}
                onClick={() => set({ patternInk: k })}
                title={k}
                w={18}
                h={18}
                style={{ background: catInk(k), borderRadius: "50%" }}
              />
            ))}
          </Grid>
        </>
      )}

      <Title>TEXTURE</Title>
      <Grid>
        <NoneSwatch on={!decor?.texture} onClick={() => set({ texture: null })} />
        {Object.entries(TEXTURES).map(([k, t]) => (
          <Swatch
            key={k}
            on={decor?.texture === k}
            onClick={() => set({ texture: k })}
            title={t.label}
            style={paintStyle(decor?.paint)}
          >
            {/* la texture se fond, elle ne se substitue pas : la vignette
                l'empile comme le rayon le fait */}
            <span style={{ position: "absolute", inset: 0, ...textureLayer(k) }} aria-hidden />
            {pattern && <span style={{ position: "absolute", inset: 0, ...pattern }} aria-hidden />}
          </Swatch>
        ))}
      </Grid>
    </>
  );
}

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
            {Object.entries(FINISHES).map(([k, f]) => {
              const on = (decor?.finish || "satine") === k;
              return (
                <button
                  key={k}
                  onClick={() => set({ finish: k })}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    padding: "2px 9px",
                    fontFamily: "'Special Elite', monospace",
                    fontSize: 9.5,
                    background: on ? C.ink : "transparent",
                    color: on ? C.card : C.inkFaded,
                    border: `1px solid ${on ? C.ink : C.line}`,
                  }}
                >
                  {f.label}
                </button>
              );
            })}
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
              fontFamily: "'Special Elite', monospace",
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
                fontFamily: "'Special Elite', monospace",
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
                fontFamily: "'Special Elite', monospace",
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
          <WallTab decor={decor} set={set} />
        ) : (
          <PlankTab decor={decor} set={set} />
        )}

        <div
          style={{
            fontFamily: "'Caveat', cursive",
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
