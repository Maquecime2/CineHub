/* ============================================================
   NAVIGATION — onglets de classeur
   ============================================================ */
import { Pin, Palette } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";

/** Les vues joignables depuis les onglets. `detail` s'ouvre depuis une fiche. */
export type View =
  "library" | "watchlist" | "reco" | "constellation" | "notebook" | "import" | "detail";

interface FolderTabsProps {
  view: View;
  setView: (v: View) => void;
  onAdd: () => void;
  /** Ouvre le choix de la peau du site. */
  onSkin: () => void;
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

export function FolderTabs({ view, setView, onAdd, onSkin }: FolderTabsProps) {
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
          background: `linear-gradient(90deg, ${alpha(C.ink, 0.28)}, ${C.paperDark})`,
          boxShadow: "inset -2px 0 4px rgba(30,20,10,0.2)",
          zIndex: 0,
        }}
      />
      {/* LE RAIL — pleine hauteur, et non plus « colle en haut ».

          Il etait `sticky` et poussait vers le bas : six onglets ecrits
          a la verticale font neuf cent cinquante pixels, et dans une
          fenetre de sept cent vingt le bouton d'ajout tombait sous le
          bord de l'ecran, injoignable. Une peau en capitales a chasse
          allongee rallonge encore chaque onglet — le defaut empirait
          avec l'habillage, ce qui est le signe qu'il n'etait pas dans
          l'habillage.

          Le rail occupe donc toute la hauteur, et ce qui deborde est la
          LISTE des onglets, pas le rail. Les actions sont ancrees en
          bas : elles restent atteignables quels que soient le nombre
          d'onglets, la longueur de leurs noms et la peau posee. */}
      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          width: 46,
          boxSizing: "border-box",
          paddingTop: 30,
          paddingBottom: 14,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div
          data-tab-rail
          style={{
            /* `minHeight: 0` est ce qui autorise vraiment le retrait :
               sans lui, un enfant flexible refuse de descendre sous la
               taille de son contenu et la liste deborderait quand meme. */
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            /* `clip` et non `hidden` : on ne veut pas d'un second axe de
               defilement, seulement que rien ne bave a droite. Les
               onglets glissent de six pixels au survol et portent une
               ombre — d'ou la marge, pour ne rogner ni l'un ni l'autre. */
            overflowX: "clip",
            paddingRight: 12,
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
                  /* `${t.color}cc` collait un canal alpha derriere une
                   couleur. Depuis que les jetons sont des renvois a des
                   variables CSS, ce collage ne veut plus rien dire et le
                   degrade entier etait rejete — les onglets perdaient
                   leur relief sans un mot. */
                  background: `linear-gradient(180deg, ${t.color}, ${t.color} 60%, ${alpha(t.color, 0.8)})`,
                  filter: active ? "none" : DIMMED,
                  color: C.card,
                  fontFamily: F.mono,
                  fontSize: 11.5,
                  textTransform: "var(--tag-transform)" as never,
                  letterSpacing: "var(--tag-tracking)",
                  padding: "18px 9px",
                  borderRadius: "0 var(--tag-radius) var(--tag-radius) 0",
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
        </div>

        {/* LES ACTIONS — toujours au pied du rail, toujours visibles. */}
        <div
          style={{
            flexShrink: 0,
            paddingTop: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <button
            onClick={onAdd}
            title="Épingler un nouveau film"
            style={{
              all: "unset",
              cursor: "pointer",
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

          {/* LA PEAU DU SITE, au pied de la tranche du classeur.

            Elle est ici et non dans une vue : ce n'est le reglage
            d'aucune d'elles, c'est celui de tout. Discrete, parce qu'on
            la choisit deux fois et qu'on la regarde ensuite tous les
            jours. */}
          <button
            onClick={onSkin}
            title="Changer la peau du site"
            aria-label="Changer la peau du site"
            style={{
              all: "unset",
              cursor: "pointer",
              marginLeft: 8,
              width: 26,
              height: 26,
              borderRadius: "50%",
              color: C.inkFaded,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${C.line}`,
              transition: "color .18s ease, border-color .18s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = C.burgundy;
              e.currentTarget.style.borderColor = C.burgundy;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = C.inkFaded;
              e.currentTarget.style.borderColor = C.line;
            }}
          >
            <Palette size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
