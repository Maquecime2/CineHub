/* ============================================================
   WHAT A FILM-MAKER SAYS WHEN YOU CLICK THEM
   ============================================================

   THIS PANEL EXISTS FOR THE HOLLOW NODE. A director tied to somebody
   but with no film in the run has nothing to light up in the column, and
   a click that lights nothing reads as a click that failed. So the
   screen says it in words — "six films in the binder, none in the run" —
   and offers the films themselves. That sentence is the bridge between
   the two scales this view holds.

   AN ORPHAN GETS NO LIST, because there is nothing to list: no card
   carries the name any more. It gets what is still true — the bond, and
   the way out to the Credits.

   `pageOf` DOES THE COUNTING, and it is already written and tested
   (`domain/people`). Sweeping the collection again here would be a
   second census drifting from the first. */
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, inked, hollow } from "../../theme/styles";
import { Label } from "../ui";
import { bondLabel } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import { pageOf } from "../../domain/people";
import type { LineageNode } from "../../domain/lineageMap";
import type { Film } from "../../types";

interface NodePanelProps {
  node: LineageNode;
  films: Film[];
  bonds: Bond[];
  /** Les films de cette personne DÉJÀ au programme, par identifiant. */
  inCourse: Set<string>;
  onAdd: (filmId: string) => void;
  onAddAll: (filmIds: string[]) => void;
  onOpenPerson: (key: string) => void;
  onPickBond: (bondId: string) => void;
  onAddBond: (name: string) => void;
  onClose: () => void;
}

export function NodePanel({
  node,
  films,
  bonds,
  inCourse,
  onAdd,
  onAddAll,
  onOpenPerson,
  onPickBond,
  onAddBond,
  onClose,
}: NodePanelProps) {
  const { t } = useTranslation();
  const person = node.orphan ? null : pageOf(films, node.key);
  const theirs = (person?.films || []).filter((id) => !inCourse.has(id));
  const mine = bonds.filter((b) => b.from === node.key || b.to === node.key);

  return (
    <div
      style={{
        marginTop: 14,
        border: `1px solid ${C.line}`,
        background: C.card,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: F.title, fontSize: 19, color: C.ink, flex: 1 }}>{node.name}</div>
        <button onClick={onClose} style={{ ...bare, fontFamily: F.mono, fontSize: 9.5 }}>
          {t("program.close")}
        </button>
      </div>

      {node.orphan ? (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {t("program.orphan")}
        </div>
      ) : (
        node.inCourse === 0 && (
          <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginTop: 6 }}>
            {t("program.notInQueue", { count: node.owned })}
          </div>
        )
      )}

      {mine.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Label>{t("program.map")}</Label>
          <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
            {mine.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => onPickBond(b.id)}
                  style={{
                    ...bare,
                    fontFamily: F.body,
                    fontSize: 13.5,
                    color: C.ink,
                    textAlign: "left",
                  }}
                >
                  {bondLabel(b, node.key, t)}
                  {b.note && (
                    <span style={{ color: alpha(C.ink, 0.55), fontFamily: F.hand, fontSize: 15 }}>
                      {" "}
                      {b.note}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {theirs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {theirs.slice(0, 8).map((id) => {
              const film = films.find((f) => f.id === id);
              if (!film) return null;
              return (
                <li key={id}>
                  <button
                    onClick={() => onAdd(id)}
                    style={{
                      ...bare,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: C.ink,
                      fontFamily: F.body,
                      fontSize: 13.5,
                      padding: "3px 0",
                    }}
                  >
                    <Plus size={11} color={C.inkFaded} />
                    {film.title}
                  </button>
                </li>
              );
            })}
          </ul>
          <button onClick={() => onAddAll(theirs)} style={{ ...inked(C.plum), marginTop: 8 }}>
            {t("program.addTheirFilms")}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={() => onAddBond(node.name)} style={{ ...inked(C.ink), ...hollow }}>
          {t("program.linkThisDirector")}
        </button>
        {!node.orphan && (
          <button onClick={() => onOpenPerson(node.key)} style={{ ...inked(C.ink), ...hollow }}>
            {t("program.openPerson")}
          </button>
        )}
      </div>
    </div>
  );
}
