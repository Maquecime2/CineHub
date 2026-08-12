/* THE STUDIO SWATCHES — and the panel that picks a surface.

   All of this lived in `shelf/DecorStudio`, where it was right. That is
   no longer enough: the card wall is now painted with the same paints,
   the same wallpapers and the same textures, and two swatch books that
   look alike would end up drifting apart.

   Every swatch is rendered by the SAME engine as the surface it offers
   (`theme/surfaces`): a preview that drew itself differently would end up
   lying, and it is always the preview that would be wrong. */
import { C, F } from "../../theme/tokens";
import {
  PAINTS,
  PATTERNS,
  TEXTURES,
  paintStyle,
  patternLayer,
  textureLayer,
} from "../../theme/surfaces";
import { CAT_FAMILIES, catInk } from "../shelf/constants";

/** The studio panel format: set on the right, it leaves the view behind it. */
export const STUDIO_BOX = {
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

export const Title = ({ children, top = 12 }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: 8.5,
      letterSpacing: 1,
      color: C.inkFaded,
      margin: `${top}px 0 5px`,
    }}
  >
    {children}
  </div>
);

export const Grid = ({ children }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{children}</div>
);

/* One swatch. It wears the style it offers, and the ink frame says which
   one is kept — the same sign as the colour dots. */
export const Swatch = ({ on, onClick, title, style, w = 42, h = 28, children }) => (
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

/* "Nothing" is a choice, not an absence of a button: without it, one
   lays a wallpaper and can no longer take it off. */
export const NoneSwatch = ({ on, onClick, label = "aucun" }) => (
  <Swatch
    on={on}
    onClick={onClick}
    title={label}
    style={{
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: F.mono,
      fontSize: 8,
      color: C.inkFaded,
    }}
  >
    {label}
  </Swatch>
);

/* An option button spelled out, for what a swatch cannot show — a
   finish, a gauge, a spacing. */
export const OptionButton = ({ on, onClick, children, title }) => (
  <button
    onClick={onClick}
    title={title}
    aria-pressed={on}
    style={{
      all: "unset",
      cursor: "pointer",
      padding: "2px 9px",
      fontFamily: F.mono,
      fontSize: 9.5,
      background: on ? C.ink : "transparent",
      color: on ? C.card : C.inkFaded,
      border: `1px solid ${on ? C.ink : C.line}`,
    }}
  >
    {children}
  </button>
);

/** The panel of a surface: paint, wallpaper, its ink, texture. */
export function SurfaceTab({ decor, set }) {
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
            /* The thumbnail shows the pattern ON the chosen paint: a
               pattern on a white background does not say what it will
               give. */
            style={{ ...paintStyle(decor?.paint), ...patternLayer(k, ink) }}
          />
        ))}
      </Grid>

      {/* The ink only means something with a pattern to tint. */}
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
                l'empile comme la surface le fait */}
            <span style={{ position: "absolute", inset: 0, ...textureLayer(k) }} aria-hidden />
            {pattern && <span style={{ position: "absolute", inset: 0, ...pattern }} aria-hidden />}
          </Swatch>
        ))}
      </Grid>
    </>
  );
}
