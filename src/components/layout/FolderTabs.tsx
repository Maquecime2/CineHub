/* ============================================================
   NAVIGATION — onglets de classeur
   ============================================================ */
import { Pin } from "lucide-react";
import { C } from "../../theme/tokens";

/** Les vues joignables depuis les onglets. `detail` s'ouvre depuis une fiche. */
export type View =
  "library" | "watchlist" | "reco" | "constellation" | "notebook" | "import" | "detail";

interface FolderTabsProps {
  view: View;
  setView: (v: View) => void;
  onAdd: () => void;
}

const TABS: { key: View; label: string; color: string }[] = [
  { key: "library", label: "Vidéothèque", color: C.burgundy },
  { key: "watchlist", label: "À voir", color: C.ochre },
  { key: "reco", label: "Découvertes", color: C.vermillion },
  { key: "constellation", label: "Constellation", color: C.cobalt },
  { key: "notebook", label: "Carnet", color: C.pine },
  { key: "import", label: "Import Letterboxd", color: C.slate },
];

const DIMMED = "saturate(0.65) brightness(0.92)";

export function FolderTabs({ view, setView, onAdd }: FolderTabsProps) {
  return (
    <div style={{ width: 46, flexShrink: 0, position: "relative", zIndex: 2 }}>
      {/* la tranche du classeur, contre laquelle les onglets butent */}
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          width: 5,
          background: `linear-gradient(90deg, #b9a67e, ${C.paperDark})`,
          boxShadow: "inset -2px 0 4px rgba(30,20,10,0.2)",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "sticky",
          top: 0,
          paddingTop: 30,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        {TABS.map((t) => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                all: "unset",
                cursor: "pointer",
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                // carton teinté dans la masse, pas un aplat : reflet en haut, tranche sombre en bas
                background: `linear-gradient(180deg, ${t.color}, ${t.color} 60%, ${t.color}cc)`,
                filter: active ? "none" : DIMMED,
                color: C.card,
                fontFamily: "'Special Elite', monospace",
                fontSize: 11.5,
                letterSpacing: 1.5,
                padding: "18px 9px",
                borderRadius: "0 3px 3px 0",
                boxShadow: active
                  ? `4px 4px 10px rgba(0,0,0,0.35), inset -2px 0 0 ${t.color}, inset 0 1px 0 rgba(255,255,255,0.25)`
                  : "2px 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.15)",
                marginLeft: active ? 0 : -6,
                transition: "margin .18s cubic-bezier(.2,.8,.3,1), filter .18s ease",
                textShadow: "0 1px 1px rgba(0,0,0,0.3)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.marginLeft = "0px";
                  e.currentTarget.style.filter = "none";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.marginLeft = "-6px";
                  e.currentTarget.style.filter = DIMMED;
                }
              }}
            >
              {t.label}
            </button>
          );
        })}
        <button
          onClick={onAdd}
          title="Épingler un nouveau film"
          style={{
            all: "unset",
            cursor: "pointer",
            marginTop: 24,
            marginLeft: 4,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: `radial-gradient(circle at 32% 26%, #fff8, ${C.burgundy} 62%)`,
            color: C.card,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "2px 4px 7px rgba(0,0,0,0.4)",
            transition: "transform .18s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.12) rotate(-12deg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
          }}
        >
          <Pin size={16} />
        </button>
      </div>
    </div>
  );
}
