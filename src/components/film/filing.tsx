/* ============================================================
   FILING, MADE AVAILABLE WHEREVER A FILM IS DRAWN
   ============================================================

   The badge belongs to a FILM, not to a presentation of films — so the
   wall and the shelf must both be able to raise it. The wall could:
   `FilmWall` already threads a `filing` object down two levels. The
   shelf could not, and it is worth saying why rather than working
   around it quietly: a case is drawn at the bottom of `Row` → `Line` →
   `FilmBox`, each memoised, each rebuilt dozens of times a second while
   something is being dragged. Threading one more prop through that
   chain would add a reason for the whole row to redraw mid-gesture, for
   a button that is shown on hover.

   Hence a context. It is read by the leaf that needs it, it changes
   perhaps twice in a session, and it costs the drag nothing.

   IT IS `null` BY DEFAULT, which is the case that must stay effortless:
   no server, no account, or a card drawn somewhere that has nothing to
   file into (the Discoveries), and no badge appears at all.
   ============================================================ */
import { createContext, useContext, type ReactNode } from "react";
import type { Film } from "../../types";

export interface Filing {
  /** Opens the panel for this film, anchored to the badge's rectangle. */
  onFile: (film: Film, at: DOMRect) => void;
  label: string;
}

const FilingContext = createContext<Filing | null>(null);

export const FilingProvider = ({
  value,
  children,
}: {
  value: Filing | null;
  children: ReactNode;
}) => <FilingContext.Provider value={value}>{children}</FilingContext.Provider>;

/** What it takes to file a film from here, or `null` if nothing can. */
export const useFiling = (): Filing | null => useContext(FilingContext);
