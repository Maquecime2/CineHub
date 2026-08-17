/* ============================================================
   NAVIGATION — onglets de classeur
   ============================================================ */
import { type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Pin,
  Palette,
  UserRound,
  HelpCircle,
  Clapperboard,
  Bookmark,
  Users,
  Users2,
  ListChecks,
  Puzzle,
  Compass,
  Sparkles,
  CalendarDays,
  FolderInput,
  Settings,
  Search,
  KeyRound,
  Languages,
  Coins,
  Route,
} from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { PurseTally } from "../play/Tally";
import { useViewport } from "../../hooks/useViewport";
import { serverConfigured } from "../../services/server";

/**
 * The views reachable from the tabs. `detail` opens from a card, and
 * `import` from the foot of the rail — neither belongs to a group.
 *
 * LE CARNET N'EST PLUS UNE VUE. Ses pages libres s'écrivent dans un
 * tiroir ouvert depuis le classeur : voir `NotebookDrawer`. Ce qu'elles
 * sont — la recherche transverse les lit, la synchro les emporte sous la
 * clé `notebook-notes` — n'a pas bougé d'un pouce.
 */
export type View =
  | "library"
  | "watchlist"
  | "credits"
  | "reco"
  | "constellation"
  | "lineage"
  | "import"
  | "thread"
  | "lists"
  | "quiz"
  | "counter"
  | "detail"
  | "almanac"
  | "skinlab";

interface FolderTabsProps {
  view: View;
  setView: (v: View) => void;
  onAdd: () => void;
  /** Ouvre l'import Letterboxd et la sauvegarde. */
  onImport: () => void;
  /** Opens the search that crosses the whole binder. */
  onSearch: () => void;
  /** Opens the site skin picker. */
  onSkin: () => void;
  /** Opens the language picker. */
  onLanguage: () => void;
  /** Opens the guided tour menu. */
  onHelp: () => void;
  /** Opens the TMDB key setting. */
  onKey: () => void;
  /** The account and synchronisation drawer. */
  onAccount: () => void;
  /**
   * The synchronisation state, to badge it. `null` when there is no
   * server: the action is then not even mounted.
   */
  sync: "up-to-date" | "running" | "waiting" | "error" | "no-account" | "absent";
  /** Du neuf au hall, qu'on n'a pas encore regardé. */
  hallNews?: boolean;
}

/* THE ICON IS NOT AN ORNAMENT: it is what is left of the tab when the
   window is too short for its words. So it must read on its own, and
   designate the view rather than its pretty metaphor. */
/* `label` holds a CATALOGUE KEY, not a word: the rail is the one place
   in the product that is always on screen, and a tab still reading
   "Vidéothèque" under an English skin would be the most visible lie of
   the lot. */
interface TabDef {
  key: View;
  label: string;
  color: string;
  icon: ComponentType<{ size?: number }>;
}

const TABS: Record<string, TabDef> = {
  library: { key: "library", label: "views.library", color: C.burgundy, icon: Clapperboard },
  watchlist: { key: "watchlist", label: "views.watchlist", color: C.ochre, icon: Bookmark },
  /* The Credits look at the same collection from another angle: it
     belongs to the holdings group, beside the two walls, not the tools. */
  credits: { key: "credits", label: "views.credits", color: C.plum, icon: Users },
  reco: { key: "reco", label: "views.reco", color: C.vermillion, icon: Compass },
  constellation: {
    key: "constellation",
    label: "views.constellation",
    color: C.cobalt,
    icon: Sparkles,
  },
  /* `Route` AND NOT `Network` OR `Share2`. Those two draw a graph, and a
     graph is what the constellation already is on this very bar — the
     lineages are read for their ORDER first, and the map is what makes
     that order make sense. Plum comes back here from the Credits, which
     never sits in the same bar as Explore. */
  lineage: { key: "lineage", label: "views.lineage", color: C.plum, icon: Route },
  almanac: { key: "almanac", label: "views.almanac", color: C.moss, icon: CalendarDays },
  thread: { key: "thread", label: "views.thread", color: C.cobalt, icon: Users2 },
  lists: { key: "lists", label: "views.lists", color: C.moss, icon: ListChecks },
  /* The quizzes carry the plum of the Credits — the eight tints are
     taken, and the two never sit in the same bar.
     NOT `HelpCircle`, WHICH IS THE HELP: that icon already means "the
     guided tour" at the foot of this very rail, and one drawing standing
     for two things is the sort of confusion a rail cannot afford. */
  quiz: { key: "quiz", label: "views.quiz", color: C.plum, icon: Puzzle },
  /* `Coins` AND NOT `Store`. A shop front would say "buy"; the counter
     is first of all where one reads what one has, and the buying is the
     third of its three bands. */
  counter: { key: "counter", label: "views.counter", color: C.ochre, icon: Coins },
  /* In ink and not in one of the eight tints: the product's tabs are
     taken, and a tool must not disguise itself as a view. */
  skinlab: { key: "skinlab", label: "views.skinlab", color: C.ink, icon: Settings },
};

/* ============================================================
   TROIS PASTILLES, ET NON PLUS DOUZE
   ============================================================

   Le rail était une liste PLATE de douze onglets, sans une séparation,
   alors que trois familles s'y lisaient à l'œil nu — et que deux d'entre
   eux, la vidéothèque et « à voir », sont littéralement le même
   composant. Douze cibles à parcourir chaque fois qu'on cherche où l'on
   va, c'est douze décisions pour en prendre une.

   Elles se regroupent donc, et le regroupement DIT quelque chose :

   — LE CLASSEUR, ce qu'on possède : le mur, ce qu'on veut voir, et les
     gens qui l'ont fait. Trois angles sur une seule collection.
   — EXPLORER, ce qu'on n'a pas encore : les découvertes, les liens entre
     les films, et l'année écoulée. Trois façons de regarder au-delà.
   — LE HALL, les autres. Il a déjà son atmosphère à lui
     (`atmosphere/hall`) — ticket, vitrine, fronton : quatre onglets se
     la partageaient sans le dire, ils sont maintenant les quatre
     guichets d'un même hall.

   `needsServer` MONTE AU NIVEAU DU GROUPE. Sans serveur, le hall ne
   paraît pas du tout — pas grisé, ABSENT, comme la règle du projet le
   veut. Le rail tombe alors à deux pastilles, ce qui est encore la
   bonne réponse : il n'y a personne en face.

   L'UNION `View` NE BOUGE PAS POUR AUTANT, et c'est délibéré. Les vues
   restent ce qu'elles sont, `App` les monte comme avant, chacune garde
   sa visite guidée et son entrée dans `steps.ts`. Ce qui change est la
   NAVIGATION : une pastille par famille, et les membres de la famille en
   sous-onglets sous elle. Effacer les clés de vue aurait été réécrire
   tout le produit pour ranger un rail. */
export interface TabGroup {
  key: string;
  label: string;
  color: string;
  icon: ComponentType<{ size?: number }>;
  /** Les vues du groupe, dans l'ordre où elles se lisent. */
  members: View[];
  /** Sans serveur, le groupe entier disparaît. */
  needsServer?: boolean;
}

export const GROUPS: TabGroup[] = [
  {
    key: "binder",
    label: "groups.binder",
    color: C.burgundy,
    icon: Clapperboard,
    members: ["library", "watchlist", "credits"],
  },
  {
    key: "explore",
    label: "groups.explore",
    color: C.cobalt,
    icon: Compass,
    /* Les filiations entrent ici et non au classeur, bien qu'elles se
       nourrissent de la collection : le classeur est ce qu'on POSSÈDE,
       explorer est ce qu'on n'a pas encore vu, et un programme de
       visionnage est exactement cela. Elles se rangent d'ailleurs à côté
       de la constellation, l'autre carte. */
    members: ["reco", "constellation", "lineage", "almanac"],
  },
  {
    key: "hall",
    label: "groups.hall",
    color: C.ochre,
    icon: Users2,
    members: ["thread", "lists", "quiz", "counter"],
    needsServer: true,
  },
  ...(import.meta.env.DEV
    ? [
        {
          key: "skins",
          label: "views.skinlab",
          color: C.ink,
          icon: Settings,
          members: ["skinlab" as View],
        },
      ]
    : []),
];

/**
 * Le groupe d'une vue, s'il y en a un.
 *
 * `detail` et `import` n'appartiennent à aucun : la fiche s'ouvre depuis
 * une carte, l'import depuis le pied du rail. Le rail n'allume alors
 * aucune pastille et la barre de sous-onglets se retire — ce sont des
 * pages, pas des onglets, et le rail ne doit pas prétendre le contraire.
 */
export const groupOf = (view: View): TabGroup | undefined =>
  GROUPS.find((g) => g.members.includes(view));

const DIMMED = "saturate(0.65) brightness(0.92)";

/* Ce qu'il faut pour dessiner une pastille, et rien de plus : un groupe
   du rail et un sous-onglet en portent autant l'un que l'autre. */
interface Pill {
  key: string;
  label: string;
  color: string;
  icon: ComponentType<{ size?: number }>;
}

/* A TAB — AN ICON PILL.

   The tabs carried their name, written vertically. Eight names make more
   than nine hundred pixels, a skin in extended-width capitals makes them
   longer still, and the rail began to scroll: a scrollbar on a binder's
   spine, which looks like nothing at all.

   The icon settles the question instead of postponing it: eight pills
   make less than three hundred pixels, they fit in any window, and no
   skin can lengthen them. The name is not lost — it moves into the
   tooltip and into `aria-label`, failing which the whole rail would go
   mute for a screen reader. */
function Tab({
  t,
  active,
  onClick,
  phone,
  mark,
}: {
  t: Pill;
  active: boolean;
  onClick: () => void;
  /* UNE PASTILLE SUR LA PASTILLE : il y a du neuf derrière. Un POINT et
     jamais un nombre — le rail fait trente-deux pixels de large, un
     chiffre y serait illisible, et « combien » ne change de toute façon
     rien à ce qu'on fait. Le compte exact se lit au guichet. */
  mark?: boolean;
  /* ON A PHONE, THIS IS NO LONGER A BINDER TAB.

     The pill draws its shape from the spine it butts against: rounded on
     the right only, offset six pixels to the left when it sleeps, and
     coming forward when chosen. Laid at the bottom of the screen, that
     grammar no longer means anything — there is no spine on the left any
     more, and the offset then reads as a misalignment.

     So it becomes again what it really is in that place: a token,
     rounded all over, wide enough for a thumb. Forty pixels and not
     thirty-two: that is the floor below which a target is missed one
     time in three. */
  phone: boolean;
}) {
  const { t: say } = useTranslation();
  const Icon = t.icon;
  const name = say(t.label);
  return (
    <button
      data-tour={`tab-${t.key}`}
      data-tab-tab
      onClick={onClick}
      title={mark ? `${name} — ${say("groups.news")}` : name}
      aria-label={mark ? `${name} — ${say("groups.news")}` : name}
      aria-current={active ? "page" : undefined}
      style={{
        all: "unset",
        cursor: "pointer",
        boxSizing: "border-box",
        /* Le point se pose en coordonnées de la pastille, donc elle doit
           être son référent. */
        position: "relative",
        width: phone ? 40 : 32,
        height: phone ? 40 : 32,
        /* AND THAT PACK DOWN RATHER THAN OVERFLOW.

           Eight pills fit in any reasonable window, but "reasonable" is
           not a guarantee: below a certain height the last one would
           slide under the edge, and `overflow: clip` would cut it in
           silence — an invisible, unreachable tab, which is worse than a
           cramped one.

           In a flexible column, an item shrinks on its own when room is
           short. The floor is the icon itself: we do not go below what
           can be read. */
        flexShrink: phone ? 0 : 1,
        minHeight: phone ? 40 : 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // cardstock dyed through, not a flat fill: highlight on top, dark edge below
        /* `${t.color}cc` glued an alpha channel behind a colour. Since
           the tokens became references to CSS variables, that gluing no
           longer means anything and the whole gradient was rejected —
           the tabs lost their relief without a word. */
        background: `linear-gradient(180deg, ${t.color}, ${t.color} 60%, ${alpha(t.color, 0.8)})`,
        filter: active ? "none" : DIMMED,
        color: C.card,
        borderRadius: phone ? "var(--tag-radius)" : "0 var(--tag-radius) var(--tag-radius) 0",
        /* The chosen tab moves right, on the rail. Laid at the bottom it
           can no longer move forward: it then rings itself with a line of
           pale cardstock, which detaches it from the bar without changing
           its colour — it is the same thing the forward move says, said
           otherwise. */
        boxShadow: active
          ? phone
            ? `0 0 0 2px ${C.card}, 0 2px 8px rgba(0,0,0,0.35)`
            : `4px 4px 10px rgba(0,0,0,0.35), inset -2px 0 0 ${t.color}, inset 0 1px 0 rgba(255,255,255,0.25)`
          : "2px 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.15)",
        marginLeft: phone || active ? 0 : -6,
        /* The durations go through the motion tokens: the
           `prefers-reduced-motion` block sets them to zero on its own. */
        transition: "margin var(--motion-fast) var(--motion-ease), filter var(--motion-fast) ease",
      }}
      /* HOVER DOES NOT EXIST UNDER A FINGER, BUT THE BROWSER PRETENDS: it
         emits a hover at the moment of contact, and the tab then stayed
         forward and lit until the next contact elsewhere — eight tabs all
         lit, none chosen any more. */
      onMouseEnter={(e) => {
        if (!active && !phone) {
          e.currentTarget.style.marginLeft = "0px";
          e.currentTarget.style.filter = "none";
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !phone) {
          e.currentTarget.style.marginLeft = "-6px";
          e.currentTarget.style.filter = DIMMED;
        }
      }}
    >
      <Icon size={16} />
      {mark && (
        <span
          /* `aria-hidden` : la nouvelle est ANNONCÉE dans le nom du
             bouton, pas dessinée deux fois. Une synthèse vocale qui lit
             « le hall, point » n'apprend rien. */
          aria-hidden
          style={{
            position: "absolute",
            top: phone ? 6 : 4,
            right: phone ? 6 : 5,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: C.card,
            boxShadow: `0 0 0 1.5px ${alpha(C.ink, 0.45)}`,
          }}
        />
      )}
    </button>
  );
}

/* THE HEIGHT OF THE BOTTOM BAR, notch excluded. The same figure is
   repeated in `FONT_IMPORT` to hollow out the foot of the view column: a
   media query does not accept a `var()`, and the duplicate is the price
   of that limit. If one changes, the other changes. */
const BAR_H = 58;

/* THE LITTLE SETTINGS OF EVERYTHING — the skin, the key, the account,
   the tour.

   They are the setting of NO view, they are the setting of them all:
   hence the foot of the rail, and not a tab. Discreet, because we touch
   them twice and live beside them every day.

   A single pill written a single time: the four carried the same block
   of style copied out, and the next would have copied it once more — so
   many chances to diverge unintentionally. The demonstration took place:
   the finger rail and the TMDB key each arrived on their own, and
   rewrote the same buttons.

   Hence `finger`: on a phone these pills go down into the bottom bar,
   where 26 px cannot be aimed at. The parameter lives HERE rather than at
   each call, otherwise the next pill added will forget it.

   `badge` carries the synchronisation badge — the only thing one of
   these buttons has to say without being opened. */
function RoundAction({
  onClick,
  label,
  tour,
  icon: Icon,
  finger = false,
  badge,
}: {
  onClick: () => void;
  label: string;
  tour: string;
  icon: ComponentType<{ size?: number }>;
  finger?: boolean;
  badge?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      data-tour={tour}
      title={label}
      aria-label={label}
      style={{
        all: "unset",
        cursor: "pointer",
        position: "relative",
        marginLeft: finger ? 0 : 8,
        /* NE CÈDE RIEN. Dans une barre du bas qui défile, un bouton
           souple ne défile pas : il rétrécit. Mesuré à trois cent
           soixante-quinze pixels, les huit actions tombaient à dix-huit
           pixels chacune — moins de la moitié du plancher sous lequel
           une cible se rate une fois sur trois. */
        flexShrink: 0,
        width: finger ? 40 : 26,
        height: finger ? 40 : 26,
        borderRadius: "50%",
        color: C.inkFaded,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${C.line}`,
        transition: "color var(--motion-fast) ease, border-color var(--motion-fast) ease",
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
      <Icon size={13} />
      {badge && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: finger ? 6 : 1,
            right: finger ? 6 : 1,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: badge,
          }}
        />
      )}
    </button>
  );
}

/* ============================================================
   LA BARRE DE SOUS-ONGLETS — ce que la pastille contient
   ============================================================

   Elle se rend AU-DESSUS de la colonne de vue et non dedans : la colonne
   porte `[data-enters]`, dont l'animation d'entrée rejoue à chaque
   changement de page. Une barre placée dedans se serait redessinée sous
   la main à chaque clic — or elle est précisément ce qui ne bouge pas
   pendant qu'on tourne les pages du groupe.

   ELLE SE RETIRE quand la vue n'appartient à aucun groupe (la fiche
   d'un film, l'import) et quand le groupe n'a qu'un membre : une barre
   d'un seul onglet ne propose rien, elle occupe une ligne.

   Le patron est celui des onglets de la fiche (`views/DetailView`) :
   des mots soulignés à l'encre, pas des pastilles — le rail dit déjà
   « où l'on est » en couleur, et deux grammaires pour une navigation
   font deux navigations. */
export function SubTabs({
  view,
  setView,
  extra,
}: {
  view: View;
  setView: (v: View) => void;
  /** Ce qui s'ouvre depuis le groupe sans être une vue — le carnet. */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const group = groupOf(view);
  if (!group || (group.members.length < 2 && !extra)) return null;

  return (
    <div
      data-sub-rail
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
        padding: "12px 44px 0",
        /* Le trait est celui d'un intercalaire, pas d'une bordure de
           panneau : il ne ferme rien, il sépare. */
        borderBottom: `1px solid ${alpha(C.line, 0.9)}`,
      }}
    >
      {group.members.map((key) => {
        const tab = TABS[key];
        if (!tab) return null;
        const on = view === key;
        const Icon = tab.icon;
        return (
          <button
            key={key}
            data-tour={`tab-${key}`}
            onClick={() => setView(key)}
            aria-current={on ? "page" : undefined}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 2px 8px",
              fontFamily: F.mono,
              fontSize: 10.5,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: on ? tab.color : C.inkFaded,
              /* Le trait sous l'onglet ouvert déborde d'un pixel sur
                 celui de la barre : il le RECOUVRE, ce qui est ce que
                 fait un intercalaire qu'on a tiré. */
              boxShadow: on ? `inset 0 -2px 0 ${tab.color}` : "none",
              marginBottom: -1,
              transition: "color var(--motion-fast) ease",
            }}
          >
            <Icon size={12} /> {t(tab.label)}
          </button>
        );
      })}
      {extra}
    </div>
  );
}

export function FolderTabs({
  view,
  setView,
  onAdd,
  onImport,
  onSearch,
  onSkin,
  onLanguage,
  onHelp,
  onKey,
  onAccount,
  sync,
  hallNews,
}: FolderTabsProps) {
  /* TWO TABS THAT ONLY APPEAR IF THERE IS SOMEBODY OPPOSITE.

     With no server — that is the published site's case, which has none —
     the feed and the challenges have nothing to show but a sentence
     explaining that they have nothing to show. Two notches of the rail
     taken up by a promise.

     So they fade out entirely, rather than showing greyed: a greyed tab
     asks "why?" at every passage, whereas an absent tab is not noticed.
     The account button has followed this rule since it existed, and for
     the same reason.

     The condition is static — the server's address is decided at build
     time — so the rail will never change shape along the way. Nor will
     the tour: its steps aiming at these views are `optional`, and an
     absent target is skipped without a sound. */
  const groups = GROUPS.filter((g) => !g.needsServer || serverConfigured());
  const here = groupOf(view);
  /* THE RAIL LIES DOWN RATHER THAN DISAPPEARING.

     On a binder's left spine, eight stacked pills and four actions at the
     foot fit in forty-six pixels of width. On a phone held in one hand,
     that column eats an eighth of the width and ends where the thumb
     does not reach — the top of the screen. The same list, laid at the
     bottom of the window, falls exactly under the thumb.

     NOTHING DISAPPEARS IN THE PROCESS, and that is not a scruple: each of
     these buttons carries a `data-tour`, and a guided tour whose target
     does not exist in the document is a tour that skips the step in
     silence. So the twelve targets stay mounted; it is the axis and the
     measurements that change. */
  const { t } = useTranslation();
  const { phone } = useViewport();

  return (
    <div
      style={{
        width: phone ? 0 : 46,
        flexShrink: 0,
        position: "relative",
        /* THE BOTTOM BAR LOST ITS TIE, AND A TIE IS ALWAYS LOST THE SAME
           WAY.

           The rail and the view column were both at 2. At equal value, it
           is the LAST in the document that paints on top — and the rail
           is written first. On the left spine this did not show: the rail
           and the column overlap nowhere. Laid at the bottom, the bar
           passes UNDER the column it is meant to border, and everything
           overflowing the column paints over it.

           Twenty: above the page (2), below the panels (30–45) and
           everything that follows — an open drawer covers the bar, the
           page never. */
        zIndex: phone ? 20 : 2,
      }}
    >
      {/* the binder's spine, which the tabs butt against. It does not
          follow the bar down: what it draws is the back of a binder
          standing upright, and a back lying down is no longer a back. */}
      {!phone && (
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
      )}
      {/* THE RAIL — full height, and no longer "stuck to the top".

          It was `sticky` and pushed downwards: six tabs written
          vertically make nine hundred and fifty pixels, and in a window
          of seven hundred and twenty the add button fell below the edge
          of the screen, unreachable. A skin in extended-width capitals
          lengthens each tab further — the fault got worse with the skin,
          which is the sign that it was not in the skin.

          So the rail takes up the whole height, and the actions are
          anchored at the bottom: they stay reachable whatever the number
          of tabs, the length of their names and the skin laid on.

          NOTHING OVERFLOWS ANY MORE. What overflowed was the LIST, and it
          scrolled. The tabs no longer carry their names written out but
          an icon: eight pills fit everywhere, and pack down rather than
          slipping under the edge — see `Tab`. */}
      <div
        style={{
          position: "fixed",
          left: 0,
          boxSizing: "border-box",
          display: "flex",
          ...(phone
            ? {
                /* THE BOTTOM BAR. It is OPAQUE, and that is necessary:
                   the wall scrolls underneath, and a transparent bar
                   would let posters show through under the tabs. */
                right: 0,
                bottom: 0,
                paddingBottom: "var(--safe-bottom)",
                paddingLeft: "max(8px, var(--safe-left))",
                paddingRight: "max(8px, var(--safe-right))",
                height: `calc(${BAR_H}px + var(--safe-bottom))`,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                background: C.paperDark,
                borderTop: `1px solid ${C.line}`,
                boxShadow: `0 -3px 10px ${alpha(C.ink, 0.16)}`,
              }
            : {
                top: 0,
                bottom: 0,
                width: 46,
                paddingTop: 30,
                paddingBottom: 14,
                flexDirection: "column",
                alignItems: "flex-start",
              }),
        }}
      >
        <div
          data-tab-rail
          style={{
            /* `minHeight: 0` is what really allows the shrinking:
               without it, a flexible child refuses to go below the size
               of its content. */
            minHeight: 0,
            display: "flex",
            gap: 6,
            ...(phone
              ? {
                  /* SUR TÉLÉPHONE, CE SONT LES ONGLETS QUI NE CÈDENT PAS.

                     La barre du bas partageait sa largeur entre la liste
                     des onglets, souple, et les actions, incompressibles.
                     Avec douze pastilles c'était déjà tendu ; mesuré à
                     trois cent soixante-quinze pixels, les actions en
                     prenaient trois cent quarante-six et il RESTAIT CINQ
                     PIXELS aux onglets — la navigation entière du produit,
                     réduite à une fente. Elle défilait, donc rien ne
                     paraissait cassé : elle était simplement introuvable.

                     Depuis qu'ils sont trois, les onglets tiennent en
                     cent quarante pixels sur n'importe quel téléphone.
                     Ils ne cèdent donc plus rien, et ce sont les actions
                     qui défilent au doigt — l'épingle et la loupe, les
                     deux qu'on touche, arrivent en tête. */
                  flex: "0 0 auto",
                  flexDirection: "row",
                  alignItems: "center",
                }
              : {
                  flex: "1 1 auto",
                  minWidth: 0,
                  /* `clip` and not `hidden`: we want no scrolling axis
                     at all, only that nothing bleeds to the right. The
                     tabs slide six pixels on hover and carry a shadow —
                     hence the margin, so as to clip neither one nor the
                     other. */
                  overflow: "clip",
                  paddingRight: 12,
                  flexDirection: "column",
                  alignItems: "flex-start",
                }),
          }}
        >
          {groups.map((g) => (
            <Tab
              key={g.key}
              t={g}
              active={here?.key === g.key}
              phone={phone}
              /* On entre TOUJOURS par le premier membre, et non par
                 celui qu'on avait quitté : une pastille qui rouvre
                 ailleurs selon l'humeur du souvenir est une pastille
                 dont on ne sait plus ce qu'elle fait. La barre de
                 sous-onglets, juste dessous, montre le reste. */
              /* LE POINT NE VIT QUE SUR LE HALL, et il vient d'`App` :
                 c'est lui qui tient le fil. Le rail ne lit rien du
                 serveur — il dessine ce qu'on lui dit. */
              mark={g.key === "hall" && hallNews}
              onClick={() => setView(g.members[0]!)}
            />
          ))}
        </div>

        {/* THE ACTIONS — always at the foot of the rail, always visible.
            On a phone, "at the foot" means at the end: they file to the
            right of the bar, outside the tabs' swipe, so that the thumb
            does not lose them while scrolling the list. */}
        <div
          data-tab-actions
          style={{
            display: "flex",
            ...(phone
              ? {
                  /* Elles cèdent, et défilent : voir la note sur les
                     onglets juste au-dessus. Leur barre de défilement est
                     masquée comme celle du rail (`theme/tokens`) ; le
                     balayage, lui, ne l'est pas. */
                  flex: "1 1 auto",
                  minWidth: 0,
                  overflowX: "auto",
                  overflowY: "hidden",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 2,
                }
              : {
                  flexShrink: 0,
                  paddingTop: 16,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 10,
                }),
          }}
        >
          <button
            onClick={onAdd}
            data-tour="add-film"
            title={t("rail.addFilm")}
            style={{
              all: "unset",
              cursor: "pointer",
              /* THE FOUR ACTIONS DESCEND IN SIZE ON THE RAIL —
                 thirty-four, thirty, twenty-six, twenty-six — and that
                 taper states their order of importance. Under a finger it
                 no longer states anything at all: it simply makes the
                 last two hard to aim at. Forty everywhere, then, below
                 which a target is missed. */
              marginLeft: phone ? 0 : 4,
              flexShrink: 0,
              width: phone ? 40 : 34,
              height: phone ? 40 : 34,
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

          {/* SEARCHING EVERYWHERE.

            Just under the pin, and not in a view: the question is
            addressed to none of them in particular. Each tab does have
            its field, but none searched beyond what it shows — one
            therefore had to know in advance which tab held what one was
            looking for, which presupposes having already found it. */}
          <button
            onClick={onSearch}
            data-tour="search-all"
            title={t("rail.searchAllHint")}
            aria-label={t("rail.searchAll")}
            style={{
              all: "unset",
              cursor: "pointer",
              marginLeft: phone ? 0 : 6,
              flexShrink: 0,
              width: phone ? 40 : 30,
              height: phone ? 40 : 30,
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

          {/* LE COMPTE, JUSTE AVANT LA PEAU. Le sélecteur affiche des
              prix : ce qu'on a et ce qu'il permet sont côte à côte. */}
          <PurseTally onOpen={() => setView("counter")} phone={phone} />

          {/* L'IMPORT ET LA SAUVEGARDE, au pied du rail.

              Il occupait une pastille du haut, à côté des vues, alors
              qu'il n'en est pas une : on y va deux fois — le jour où
              l'on arrive de Letterboxd, et le jour où l'on sauvegarde.
              Sa place est ici, avec les réglages de tout.

              PAS DANS LE TIROIR DU COMPTE, contrairement à ce qui avait
              été prévu : ce tiroir n'est monté que si un serveur est
              réglé, et l'import est justement ce dont on a besoin quand
              il n'y en a pas. Un classeur sans serveur doit pouvoir
              recevoir une collection et la sauvegarder. */}
          <RoundAction
            onClick={onImport}
            tour="tab-import"
            label={t("views.import")}
            icon={FolderInput}
            finger={phone}
          />

          {/* THE SITE SKIN, at the foot of the binder's spine. */}
          <RoundAction
            onClick={onSkin}
            tour="skin"
            label={t("rail.skin")}
            icon={Palette}
            finger={phone}
          />

          {/* THE LANGUAGE, beside the skin.

            The same kind of decision, taken in the same corner: how the
            binder presents itself. Its label is the ONE that must not
            follow the language — somebody looking for their own tongue
            reads it written in itself. */}
          <RoundAction
            onClick={onLanguage}
            tour="language"
            label="Français / English"
            icon={Languages}
            finger={phone}
          />

          {/* THE TMDB KEY, between the skin and the account.

            It commands eight screens — Discoveries, the wake, the
            posters, the crew cards — and could only be set in the Import
            tab, in the middle of a screen that speaks of something else.
            A setting that commands everything belongs to no view: it is
            here, with the other settings of everything. */}
          <RoundAction
            onClick={onKey}
            tour="tmdb-key"
            label={t("rail.tmdbKey")}
            icon={KeyRound}
            finger={phone}
          />

          {/* THE ACCOUNT AND ITS BADGE.

            It only appears if a server is set: a button that opens an
            empty drawer is worse than an absent button. The badge says at
            a glance what is waiting — that is the only thing one wants to
            know without opening. */}
          {sync !== "absent" && (
            <RoundAction
              onClick={onAccount}
              tour="compte"
              label={t("rail.account")}
              icon={UserRound}
              finger={phone}
              badge={sync === "error" ? C.burgundy : sync === "waiting" ? C.inkFaded : null}
            />
          )}

          {/* THE TOUR, at the rail's last notch.

            A single anchor, and always the same: it is what the reminder
            card points at when the tour is waved away, and what one looks
            for six months later wondering what the shelf was for. At the
            last notch because one consults it even less often — but never
            elsewhere, never filed inside a view: a tool's help is not
            hidden inside the tool. */}
          <RoundAction
            onClick={onHelp}
            tour="help"
            label={t("rail.help")}
            icon={HelpCircle}
            finger={phone}
          />
        </div>
      </div>
    </div>
  );
}
