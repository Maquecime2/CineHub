import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { C } from "../../theme/tokens";
import { BOX_H } from "./constants";
import type { DragKind } from "./constants";
import type { Divider, PerRow, ShelfKind } from "../../types";

interface ShelfDividerProps {
  divider: Divider;
  kind: ShelfKind;
  onDragStart: (kind: DragKind, id: string, el: HTMLElement) => void;
  onDragEnd: () => void;
  onDragOverBox: (e: React.DragEvent, shelf: ShelfKind, overId: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  onSetPerRow: (id: string, perRow: number | null) => void;
  shelfPerRow: PerRow;
}

const PER_ROW_CHOICES: (number | null)[] = [null, 3, 4, 5, 6, 8, 10, 12];

/* L'intercalaire : le carton debout qu'on glisse entre deux boîtiers pour
   dire « à partir d'ici, autre chose ». Il se déplace comme un boîtier et
   se renomme d'un clic — un séparateur qu'on ne peut pas nommer ne sépare
   rien de nommable. */
export const ShelfDivider = React.memo(function ShelfDivider({
  divider,
  kind,
  onDragStart,
  onDragEnd,
  onDragOverBox,
  onRename,
  onRemove,
  onSetPerRow,
  shelfPerRow,
}: ShelfDividerProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(divider.label);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    setDraft(divider.label);
  }, [divider.label]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== divider.label) onRename(divider.id, v);
    else setDraft(divider.label);
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", flexShrink: 0 }}>
      <div
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart("divider", divider.id, e.currentTarget);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOverBox(e, kind, divider.id)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: "relative",
          width: editing ? 168 : 30,
          height: BOX_H + 16,
          marginBottom: 12,
          marginRight: 9,
          background: `linear-gradient(90deg, ${C.paperDark}, #D8C69C)`,
          border: `1px solid ${C.line}`,
          borderBottom: "none",
          borderRadius: "3px 3px 0 0",
          boxShadow: "2px 2px 0 rgba(43,38,32,0.14)",
          cursor: editing ? "text" : "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "width .18s ease, opacity .15s ease",
        }}
      >
        {editing ? (
          /* Ouvert, le carton montre les deux choses qui le définissent :
             son nom, et le nombre de films de la ligne qu'il ouvre. */
          <div
            style={{
              width: "100%",
              padding: "10px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) commit();
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(divider.label);
                  setEditing(false);
                }
              }}
              style={{
                all: "unset",
                boxSizing: "border-box",
                width: "100%",
                borderBottom: `1px solid ${C.line}`,
                paddingBottom: 3,
                fontFamily: "'Special Elite', monospace",
                fontSize: 11,
                color: C.ink,
                textAlign: "center",
              }}
            />
            <div
              style={{
                fontFamily: "'Special Elite', monospace",
                fontSize: 8.5,
                letterSpacing: 1,
                color: C.inkFaded,
                textAlign: "center",
              }}
            >
              FILMS SUR CETTE LIGNE
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
              {PER_ROW_CHOICES.map((n) => {
                const on = (divider.perRow || null) === n;
                return (
                  <button
                    key={String(n)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSetPerRow(divider.id, n)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "2px 6px",
                      fontFamily: "'Special Elite', monospace",
                      fontSize: 9.5,
                      background: on ? C.ink : "transparent",
                      color: on ? C.card : C.inkFaded,
                      border: `1px solid ${on ? C.ink : C.line}`,
                    }}
                  >
                    {n === null ? (shelfPerRow === "auto" ? "auto" : `déf. ${shelfPerRow}`) : n}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Renommer l'intercalaire"
            style={{
              all: "unset",
              cursor: "text",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontFamily: "'Special Elite', monospace",
              fontSize: 10.5,
              letterSpacing: "0.12em",
              color: C.inkFaded,
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxHeight: BOX_H,
            }}
          >
            {divider.label}
          </button>
        )}
        {hover && !editing && (
          <button
            onClick={() => onRemove(divider.id)}
            title="Retirer l'intercalaire"
            style={{
              all: "unset",
              position: "absolute",
              top: -9,
              right: -8,
              cursor: "pointer",
              background: C.paper,
              border: `1px solid ${C.line}`,
              borderRadius: "50%",
              width: 17,
              height: 17,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.inkFaded,
            }}
          >
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  );
});
