/* ============================================================
   NAVIGATION — onglets de classeur
   ============================================================ */
import { type ComponentType } from "react";
import {
  Pin,
  Palette,
  HelpCircle,
  Clapperboard,
  Bookmark,
  Users,
  Compass,
  Sparkles,
  CalendarDays,
  NotebookPen,
  FolderInput,
  Settings,
  Search,
} from "lucide-react";
import { C, alpha } from "../../theme/tokens";

/** Les vues joignables depuis les onglets. `detail` s'ouvre depuis une fiche. */
export type View =
  | "library"
  | "watchlist"
  | "generique"
  | "reco"
  | "constellation"
  | "notebook"
  | "import"
  | "detail"
  | "almanac"
  | "skinlab";

interface FolderTabsProps {
  view: View;
  setView: (v: View) => void;
  onAdd: () => void;
  /** Ouvre la recherche qui traverse tout le classeur. */
  onSearch: () => void;
  /** Ouvre le choix de la peau du site. */
  onSkin: () => void;
  /** Ouvre le menu de la visite guidée. */
  onHelp: () => void;
}

/* L'ICÔNE N'EST PAS UN ORNEMENT : c'est ce qui reste de l'onglet quand
   la fenêtre est trop basse pour ses mots. Elle doit donc se lire seule,
   et désigner la vue et non sa jolie métaphore. */
const TABS: { key: View; label: string; color: string; icon: ComponentType<{ size?: number }> }[] =
  [
    { key: "library", label: "Vidéothèque", color: C.burgundy, icon: Clapperboard },
    { key: "watchlist", label: "À voir", color: C.ochre, icon: Bookmark },
    /* Le Générique regarde la même collection sous un autre angle : il est
     du groupe du fonds, à côté des deux murs, et non des outils. */
    { key: "generique", label: "Générique", color: C.plum, icon: Users },
    { key: "reco", label: "Découvertes", color: C.vermillion, icon: Compass },
    { key: "constellation", label: "Constellation", color: C.cobalt, icon: Sparkles },
    { key: "almanac", label: "Almanach", color: C.moss, icon: CalendarDays },
    { key: "notebook", label: "Carnet", color: C.pine, icon: NotebookPen },
    { key: "import", label: "Import Letterboxd", color: C.slate, icon: FolderInput },
  ];

/* L'onglet de contrôle des peaux n'est pas une vue du produit : il ne
   paraît qu'en développement, et le build de production ne l'emporte
   même pas — la condition est statique, donc l'import de la planche
   tombe au secouage d'arbre. */
const DEV_TABS: typeof TABS = import.meta.env.DEV
  ? /* En encre et non dans l'une des huit teintes : les onglets du
       produit sont pris, et un outil ne doit pas se déguiser en vue. */
    [{ key: "skinlab", label: "Peaux ⚙", color: C.ink, icon: Settings }]
  : [];

const DIMMED = "saturate(0.65) brightness(0.92)";

type Tab = (typeof TABS)[number];

/* UN ONGLET — UNE PASTILLE À ICÔNE.

   Les onglets portaient leur nom, écrit à la verticale. Huit noms font
   plus de neuf cents pixels, une peau en capitales à chasse allongée les
   rallonge encore, et le rail se mettait à défiler : une barre de
   défilement sur une tranche de classeur, ce qui ne ressemble à rien.

   L'icône règle la question au lieu de la repousser : huit pastilles
   font moins de trois cents pixels, elles tiennent dans n'importe quelle
   fenêtre, et aucune peau ne peut les rallonger. Le nom n'est pas perdu
   — il passe dans l'infobulle et dans `aria-label`, sans quoi le rail
   entier deviendrait muet pour un lecteur d'écran. */
function Onglet({ t, active, onClick }: { t: Tab; active: boolean; onClick: () => void }) {
  const Icon = t.icon;
  return (
    <button
      data-tour={`tab-${t.key}`}
      data-tab-onglet
      onClick={onClick}
      title={t.label}
      aria-label={t.label}
      aria-current={active ? "page" : undefined}
      style={{
        all: "unset",
        cursor: "pointer",
        boxSizing: "border-box",
        width: 32,
        height: 32,
        /* ET QUI SE TASSENT PLUTÔT QUE DE DÉBORDER.

           Huit pastilles tiennent dans toute fenêtre raisonnable, mais
           « raisonnable » n'est pas une garantie : sous une certaine
           hauteur, la dernière passerait sous le bord, et `overflow:
           clip` la couperait en silence — un onglet invisible et
           injoignable, ce qui est pire qu'un onglet serré.

           En colonne flexible, un objet se rétracte de lui-même quand la
           place manque. Le plancher est l'icône elle-même : on ne
           descend pas sous ce qui se lit. */
        flexShrink: 1,
        minHeight: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // carton teinté dans la masse, pas un aplat : reflet en haut, tranche sombre en bas
        /* `${t.color}cc` collait un canal alpha derriere une
           couleur. Depuis que les jetons sont des renvois a des
           variables CSS, ce collage ne veut plus rien dire et le
           degrade entier etait rejete — les onglets perdaient
           leur relief sans un mot. */
        background: `linear-gradient(180deg, ${t.color}, ${t.color} 60%, ${alpha(t.color, 0.8)})`,
        filter: active ? "none" : DIMMED,
        color: C.card,
        borderRadius: "0 var(--tag-radius) var(--tag-radius) 0",
        boxShadow: active
          ? `4px 4px 10px rgba(0,0,0,0.35), inset -2px 0 0 ${t.color}, inset 0 1px 0 rgba(255,255,255,0.25)`
          : "2px 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.15)",
        marginLeft: active ? 0 : -6,
        /* Les durées passent par les jetons de mouvement : le bloc
           `prefers-reduced-motion` les met à zéro tout seul. */
        transition: "margin var(--motion-fast) var(--motion-ease), filter var(--motion-fast) ease",
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
      <Icon size={16} />
    </button>
  );
}

export function FolderTabs({ view, setView, onAdd, onSearch, onSkin, onHelp }: FolderTabsProps) {
  const tabs = [...TABS, ...DEV_TABS];

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

          Le rail occupe donc toute la hauteur, et les actions sont
          ancrees en bas : elles restent atteignables quels que soient le
          nombre d'onglets, la longueur de leurs noms et la peau posee.

          RIEN NE DEBORDE PLUS. Ce qui debordait, c'etait la LISTE, et
          elle defilait. Les onglets ne portent plus leurs noms ecrits
          mais une icone : huit pastilles tiennent partout, et se tassent
          plutot que de passer sous le bord — voir `Onglet`. */}
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
               taille de son contenu. */
            flex: "1 1 auto",
            minHeight: 0,
            /* `clip` et non `hidden` : on ne veut aucun axe de
               defilement, seulement que rien ne bave a droite. Les
               onglets glissent de six pixels au survol et portent une
               ombre — d'ou la marge, pour ne rogner ni l'un ni l'autre. */
            overflow: "clip",
            paddingRight: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          {tabs.map((t) => (
            <Onglet key={t.key} t={t} active={view === t.key} onClick={() => setView(t.key)} />
          ))}
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
            data-tour="add-film"
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

          {/* CHERCHER PARTOUT.

            Juste sous l'épingle, et non dans une vue : la question ne
            s'adresse à aucune d'elles en particulier. Chaque onglet a
            bien son champ, mais aucun ne cherchait au-delà de ce qu'il
            montre — il fallait donc savoir d'avance dans quel onglet se
            trouvait ce qu'on cherchait, ce qui suppose de l'avoir déjà
            trouvé. */}
          <button
            onClick={onSearch}
            data-tour="search-all"
            title="Chercher partout (Ctrl+K)"
            aria-label="Chercher partout"
            style={{
              all: "unset",
              cursor: "pointer",
              marginLeft: 6,
              width: 30,
              height: 30,
              borderRadius: "50%",
              color: C.card,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: C.ink,
              boxShadow: "2px 3px 6px rgba(0,0,0,0.32)",
              transition: "transform var(--motion-fast) ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
            }}
          >
            <Search size={14} />
          </button>

          {/* LA PEAU DU SITE, au pied de la tranche du classeur.

            Elle est ici et non dans une vue : ce n'est le reglage
            d'aucune d'elles, c'est celui de tout. Discrete, parce qu'on
            la choisit deux fois et qu'on la regarde ensuite tous les
            jours. */}
          <button
            onClick={onSkin}
            data-tour="skin"
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

          {/* LA VISITE, au dernier cran du rail.

            Une seule ancre, et toujours la même : c'est ce que la fiche
            de rappel désigne quand on écarte la visite, et ce qu'on
            cherche six mois plus tard en se demandant à quoi servait
            l'étagère. Sous la peau parce qu'on la consulte encore moins
            souvent — mais jamais ailleurs, jamais rangée dans une vue :
            l'aide d'un outil ne se cache pas dans l'outil. */}
          <button
            onClick={onHelp}
            data-tour="help"
            title="La visite guidée"
            aria-label="La visite guidée"
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
            <HelpCircle size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
