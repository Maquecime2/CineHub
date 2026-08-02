import { X } from "lucide-react";
import { C } from "../../theme/tokens";
import { ShelfItems } from "./ShelfItems";
import type { ShelfDnd, ShelfItem } from "./constants";
import type { ShelfKind } from "../../types";

/* LE TIROIR — les mis de côté.

   En bas de page, ce rayon obligeait à traverser toute la collection pour
   y déposer un film ; et comme il grandissait avec le temps, il repoussait
   la collection vers le haut. Sur le côté, il est atteignable de partout et
   ne prend de la place que lorsqu'on l'ouvre. Fermé, il reste une cible :
   glisser un boîtier sur sa languette l'ouvre tout seul. */
const DRAWER_W = 250;

interface ReserveDrawerProps {
  items: ShelfItem[];
  count: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  dnd: ShelfDnd;
  onOpen: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemoveDivider: (id: string) => void;
  onAddDivider: (shelf: ShelfKind) => void;
  onSetPerRow: (id: string, perRow: number | null) => void;
  onInsertDivider?: ((shelf: ShelfKind, beforeId: string) => void) | undefined;
  manual: boolean;
}

export function ReserveDrawer({
  items,
  count,
  open,
  setOpen,
  dnd,
  onOpen,
  onRename,
  onRemoveDivider,
  onAddDivider,
  onSetPerRow,
  onInsertDivider,
  manual,
}: ReserveDrawerProps) {
  return (
    <>
      {/* la languette, toujours accrochée au bord */}
      <button
        data-drawer-tab
        onClick={() => setOpen(!open)}
        onDragOver={(e) => {
          e.preventDefault();
          dnd.onShelfOver("reserve");
          if (!open) setOpen(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dnd.onDrop("reserve");
        }}
        title={open ? "Fermer le tiroir" : "Ouvrir les films mis de côté"}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: "pointer",
          position: "fixed",
          right: open ? DRAWER_W : 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 41,
          writingMode: "vertical-rl",
          padding: "20px 9px",
          borderRadius: "4px 0 0 4px",
          background: `linear-gradient(180deg, ${C.slate}, ${C.slate}cc)`,
          color: C.card,
          fontFamily: "'Special Elite', monospace",
          fontSize: 11,
          letterSpacing: 1.4,
          boxShadow: "-3px 3px 10px rgba(30,20,10,0.32)",
          transition: "right .26s cubic-bezier(.2,.8,.3,1), background .15s ease",
        }}
      >
        {open ? "FERMER" : `MIS DE CÔTÉ${count ? ` · ${count}` : ""}`}
      </button>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          dnd.onShelfOver("reserve");
        }}
        onDrop={(e) => {
          e.preventDefault();
          dnd.onDrop("reserve");
        }}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: DRAWER_W,
          zIndex: 40,
          transform: open ? "none" : `translateX(${DRAWER_W}px)`,
          transition: "transform .26s cubic-bezier(.2,.8,.3,1), background .15s ease",
          background: C.paperDark,
          borderLeft: `1px solid ${C.line}`,
          boxShadow: open ? "-8px 0 24px rgba(30,20,10,0.22)" : "none",
          display: "flex",
          flexDirection: "column",
          // fermé, il ne doit intercepter ni clic ni survol
          visibility: open ? "visible" : "hidden",
        }}
      >
        <div style={{ padding: "18px 16px 10px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 600,
                fontSize: 19,
                color: C.ink,
              }}
            >
              Mis de côté
            </div>
            <div
              style={{
                fontFamily: "'Special Elite', monospace",
                fontSize: 10,
                color: C.inkFaded,
              }}
            >
              {count}
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setOpen(false)}
              title="Fermer"
              style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}
            >
              <X size={16} />
            </button>
          </div>
          <div
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 16,
              color: C.inkFaded,
              marginTop: 2,
            }}
          >
            gardés, pas jetés
          </div>
          <button
            onClick={() => onAddDivider("reserve")}
            title={manual ? "Poser un intercalaire" : "Ranger « à la main » d'abord"}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-block",
              marginTop: 8,
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
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 12px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            alignContent: "flex-start",
          }}
        >
          {items.length === 0 ? (
            <div style={{ color: C.inkFaded, fontStyle: "italic", fontSize: 13, lineHeight: 1.6 }}>
              Rien de côté. Glissez ici un film que vous ne voulez plus voir sur le mur — il reste
              entier, avec sa note et ses captures.
            </div>
          ) : (
            <ShelfItems
              items={items}
              kind="reserve"
              dnd={dnd}
              onOpen={onOpen}
              onRename={onRename}
              onRemoveDivider={onRemoveDivider}
              onSetPerRow={onSetPerRow}
              onInsertDivider={onInsertDivider}
              perRow="auto"
            />
          )}
        </div>
      </div>
    </>
  );
}
