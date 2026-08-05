/* ============================================================
   PRIMITIVES — les petites pièces réemployées d'une vue à l'autre.
   ============================================================ */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Star } from "lucide-react";
import { C, F } from "../../theme/tokens";

/** La note, en étoiles d'encre. Un clic sur une étoile déjà pleine la coupe en deux. */
export function InkStars({
  value = 0,
  onChange,
  size = 15,
}: {
  value?: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const editable = !!onChange;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        return (
          <span
            key={n}
            onClick={editable ? () => onChange(n === value ? n - 0.5 : n) : undefined}
            style={{
              cursor: editable ? "pointer" : "default",
              position: "relative",
              lineHeight: 0,
            }}
          >
            <Star
              size={size}
              color={C.burgundy}
              fill={filled ? C.burgundy : "none"}
              strokeWidth={1.4}
            />
            {half && (
              <span style={{ position: "absolute", inset: 0, width: "50%", overflow: "hidden" }}>
                <Star size={size} color={C.burgundy} fill={C.burgundy} strokeWidth={1.4} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** L'intitulé d'un champ, tapé à la machine. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 10.5,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: C.inkFaded,
        marginBottom: 5,
      }}
    >
      {children}
    </div>
  );
}
/* Un champ qui se lit comme une liste séparée par des virgules.

   Naïvement, on rendait `value={liste.join(", ")}` et on renvoyait le
   découpage à chaque frappe. Mais taper la virgule produit un dernier
   morceau vide, que le découpage jette : le `join` recomposait aussitôt
   la même chaîne SANS la virgule, et le curseur reculait d'un cran. Il
   devenait impossible d'ouvrir un second genre.

   On garde donc le TEXTE tel qu'il est tapé tant que le champ est vivant,
   et on ne renvoie la liste que découpée à côté. La chaîne ne se
   recompose depuis la liste que lorsque celle-ci change par ailleurs
   (TMDB qui remplit la fiche, une remise à zéro du formulaire). */
export function CommaInput({
  value,
  onChange,
  style,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  style?: CSSProperties;
  placeholder?: string;
}) {
  const joined = value.join(", ");
  const [text, setText] = useState(joined);
  const [seen, setSeen] = useState(joined);
  if (joined !== seen) {
    setSeen(joined);
    setText(joined);
  }
  return (
    <input
      style={style}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const list = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        setSeen(list.join(", "));
        onChange(list);
      }}
      onBlur={() => setText(value.join(", "))}
    />
  );
}

export { Tally } from "./Tally";
