import { C, F } from "../../theme/tokens";

/* a docket line: label on the left, figure stamped on the right */
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
        fontFamily: F.body,
        fontSize: 13.5,
        color: C.inkFaded,
      }}
    >
      <span>{label}</span>
      <span
        style={{ flex: 1, borderBottom: `1px dotted ${C.line}`, transform: "translateY(-3px)" }}
      />
      <span style={{ fontFamily: F.mono, fontSize: 14, color: ink }}>{value}</span>
    </div>
  );
}
