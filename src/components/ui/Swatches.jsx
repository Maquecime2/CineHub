/* LES VIGNETTES D'ATELIER — et le volet qui choisit une surface.

   Tout ceci vivait dans `shelf/DecorStudio`, où c'était juste. Ça n'y
   suffit plus : le mur des fiches se peint désormais avec les mêmes
   peintures, les mêmes papiers peints et les mêmes textures, et deux
   nuanciers qui se ressemblent finiraient par diverger.

   Chaque vignette est rendue par le MÊME moteur que la surface qu'elle
   propose (`theme/surfaces`) : un aperçu qui se dessinerait autrement
   finirait par mentir, et c'est toujours l'aperçu qui aurait tort. */
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

/** Le format de panneau d'atelier : posé à droite, il laisse voir derrière. */
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

/* Une vignette. Elle porte le style qu'elle propose, et le cadre d'encre
   dit lequel est retenu — le même signe que les pastilles de couleur. */
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

/* « Rien » est un choix, pas une absence de bouton : sans lui, on pose
   un papier peint et on ne peut plus l'enlever. */
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

/* Un bouton d'option en toutes lettres, pour ce qui ne se montre pas en
   vignette — une finition, un calibre, un écartement. */
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

/** Le volet d'une surface : peinture, papier peint, son encre, texture. */
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
                l'empile comme la surface le fait */}
            <span style={{ position: "absolute", inset: 0, ...textureLayer(k) }} aria-hidden />
            {pattern && <span style={{ position: "absolute", inset: 0, ...pattern }} aria-hidden />}
          </Swatch>
        ))}
      </Grid>
    </>
  );
}
