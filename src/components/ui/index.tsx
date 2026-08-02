/* ============================================================
   PRIMITIVES — les petites pièces réemployées d'une vue à l'autre.
   ============================================================ */
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { C } from "../../theme/tokens";

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
        fontFamily: "'Special Elite', monospace",
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
