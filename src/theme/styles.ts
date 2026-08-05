/* ============================================================
   Styles partagés par plusieurs vues. Tout ce qui est propre à un
   seul composant reste chez lui.
   ============================================================ */
import type { CSSProperties } from "react";
import { C, F, alpha } from "./tokens";

export const underlineInput: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.line}`,
  padding: "4px 2px",
  color: C.ink,
  fontFamily: F.body,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

export const ruledTextarea: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.line}`,
  padding: "6px 2px",
  color: C.ink,
  fontFamily: F.hand,
  fontSize: 20,
  lineHeight: "30px",
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
  backgroundImage: `repeating-linear-gradient(transparent, transparent 29px, ${alpha(C.line, 0.333)} 30px)`,
};
