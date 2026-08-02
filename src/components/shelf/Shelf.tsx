import { C } from "../../theme/tokens";
import { ShelfItems } from "./ShelfItems";
import { BOX_H, SHELF_KIND } from "./constants";
import type { ShelfDnd, ShelfItem } from "./constants";
import type { PerRow, ShelfKind } from "../../types";

interface ShelfProps {
  kind: ShelfKind;
  title?: string;
  tag?: string;
  items: ShelfItem[];
  count: number;
  onOpen: (id: string) => void;
  dnd: ShelfDnd;
  empty?: string;
  perRow: PerRow;
  onAddDivider: (shelf: ShelfKind) => void;
  onRename: (id: string, label: string) => void;
  onRemoveDivider: (id: string) => void;
  onSetPerRow: (id: string, perRow: number | null) => void;
  onInsertDivider?: ((shelf: ShelfKind, beforeId: string) => void) | undefined;
  /** Un intercalaire n'a de sens que sur un rayon rangé à la main. */
  manual: boolean;
}

/* Un rayon : une planche, et une zone de dépôt. */
export function Shelf({
  kind,
  title,
  tag,
  items,
  count,
  onOpen,
  dnd,
  empty,
  perRow,
  onAddDivider,
  onRename,
  onRemoveDivider,
  onSetPerRow,
  onInsertDivider,
  manual,
}: ShelfProps) {
  const cfg = SHELF_KIND[kind];

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 600,
            fontSize: 21,
            color: C.ink,
          }}
        >
          {title ?? cfg.title}
        </div>
        <div
          style={{
            fontFamily: "'Special Elite', monospace",
            fontSize: 10,
            color: C.inkFaded,
            letterSpacing: 1,
          }}
        >
          {count} film{count > 1 ? "s" : ""}
        </div>
        {(tag ?? cfg.tag) && (
          <div
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 17,
              color: C.burgundy,
              transform: "rotate(-3deg)",
            }}
          >
            {tag ?? cfg.tag}
          </div>
        )}
        <button
          onClick={() => onAddDivider(kind)}
          title={
            manual
              ? "Poser un intercalaire à la fin du rayon"
              : "Ranger « à la main » d'abord : un intercalaire a besoin d'un ordre stable"
          }
          style={{
            all: "unset",
            cursor: "pointer",
            fontFamily: "'Special Elite', monospace",
            fontSize: 9.5,
            letterSpacing: 1,
            color: C.inkFaded,
            border: `1px dashed ${C.line}`,
            padding: "3px 8px",
          }}
        >
          + INTERCALAIRE
        </button>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          dnd.onShelfOver(kind);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dnd.onDrop(kind);
        }}
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          minHeight: BOX_H + 40,
          padding: "14px 10px 0",
          background: cfg.tint || "transparent",
          border: cfg.border
            ? `1px ${kind === "reserve" ? "solid" : "dashed"} ${cfg.border}${kind === "reserve" ? "" : "59"}`
            : "none",
          borderBottom: "none",
          borderRadius: cfg.border ? "3px 3px 0 0" : 0,
          transition: "background .15s ease",
        }}
      >
        {items.length === 0 && (
          <div
            style={{
              color: C.inkFaded,
              fontStyle: "italic",
              fontSize: 13,
              padding: "44px 4px",
            }}
          >
            {empty || "Rayon vide — glissez-y un boîtier."}
          </div>
        )}
        <ShelfItems
          items={items}
          kind={kind}
          dnd={dnd}
          onOpen={onOpen}
          onRename={onRename}
          onRemoveDivider={onRemoveDivider}
          onSetPerRow={onSetPerRow}
          onInsertDivider={onInsertDivider}
          perRow={perRow}
        />
        {/* la planche */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 12,
            background: "linear-gradient(#7A5B3A, #5E442A)",
            boxShadow: "0 3px 0 rgba(0,0,0,0.18)",
          }}
        />
      </div>
    </div>
  );
}
