import { C } from "../../theme/tokens";

/* une ligne de bordereau : intitulé à gauche, chiffre tamponné à droite */
export function Tally({
  label,
  value,
  ink = C.ink,
}: {
  label: string;
  value: number | string;
  ink?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        fontFamily: "'Lora', serif",
        fontSize: 13.5,
        color: C.inkFaded,
      }}
    >
      <span>{label}</span>
      <span
        style={{ flex: 1, borderBottom: `1px dotted ${C.line}`, transform: "translateY(-3px)" }}
      />
      <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 14, color: ink }}>
        {value}
      </span>
    </div>
  );
}
