import { C, F } from "../../theme/tokens";
import { IdbImage } from "./IdbImage";
import { stillTokenScanner } from "./tokens";
import type { Still } from "../../types";

type Part = { kind: "text"; value: string } | { kind: "still"; n: number };

/* Le texte d'une critique, en lecture seule (sert encore au carnet). */
export function RichText({
  text,
  stills,
  onOpenStill,
  placeholder,
}: {
  text: string;
  stills: Still[];
  onOpenStill: (i: number) => void;
  placeholder?: string;
}) {
  if (!text?.trim())
    return <div style={{ fontFamily: F.hand, fontSize: 19, color: C.inkFaded }}>{placeholder}</div>;

  const parts: Part[] = [];
  let last = 0,
    m: RegExpExecArray | null;
  const scanner = stillTokenScanner();
  while ((m = scanner.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: text.slice(last, m.index) });
    parts.push({ kind: "still", n: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });

  return (
    <div
      style={{
        fontFamily: F.hand,
        fontSize: 20,
        lineHeight: "30px",
        color: C.ink,
        whiteSpace: "pre-wrap",
      }}
    >
      {parts.map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.value}</span>;
        const still = stills[p.n - 1];
        if (!still)
          return (
            <span
              key={i}
              style={{
                color: C.burgundy,
                fontFamily: F.mono,
                fontSize: 11,
              }}
            >
              [capture {p.n} manquante]
            </span>
          );
        return (
          <button
            key={i}
            onClick={() => onOpenStill(p.n - 1)}
            title={still.caption || `capture ${p.n}`}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              verticalAlign: "middle",
              margin: "0 3px",
              padding: 2,
              background: C.card,
              border: `1px solid ${C.burgundy}`,
              boxShadow: "1px 2px 4px rgba(30,20,10,0.28)",
              transform: "rotate(-1.5deg)",
            }}
          >
            <IdbImage
              imageKey={still.thumbKey || still.key}
              style={{ display: "block", height: 22, width: "auto", objectFit: "contain" }}
            />
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 9,
                color: C.burgundy,
                paddingRight: 3,
              }}
            >
              {p.n}
            </span>
          </button>
        );
      })}
    </div>
  );
}
