/* ============================================================
   NAVIGATION — onglets de classeur
   ============================================================ */
import { type ComponentType } from "react";
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
  Compass,
  Sparkles,
  CalendarDays,
  NotebookPen,
  FolderInput,
  Settings,
  Search,
  KeyRound,
} from "lucide-react";
import { C, alpha } from "../../theme/tokens";
import { useViewport } from "../../hooks/useViewport";
import { serverConfigured } from "../../services/server";

/** The views reachable from the tabs. `detail` opens from a card. */
export type View =
  | "library"
  | "watchlist"
  | "credits"
  | "reco"
  | "constellation"
  | "notebook"
  | "import"
  | "thread"
  | "lists"
  | "detail"
  | "almanac"
  | "skinlab";

interface FolderTabsProps {
  view: View;
  setView: (v: View) => void;
  onAdd: () => void;
  /** Opens the search that crosses the whole binder. */
  onSearch: () => void;
  /** Opens the site skin picker. */
  onSkin: () => void;
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
}

/* THE ICON IS NOT AN ORNAMENT: it is what is left of the tab when the
   window is too short for its words. So it must read on its own, and
   designate the view rather than its pretty metaphor. */
const TABS: {
  key: View;
  label: string;
  color: string;
  icon: ComponentType<{ size?: number }>;
  /** Worth nothing with no server: the tab does not appear at all. */
  needsServer?: boolean;
}[] = [
  { key: "library", label: "Vidéothèque", color: C.burgundy, icon: Clapperboard },
  { key: "watchlist", label: "À voir", color: C.ochre, icon: Bookmark },
  /* The Credits look at the same collection from another angle: it
     belongs to the holdings group, beside the two walls, not the tools. */
  { key: "credits", label: "Générique", color: C.plum, icon: Users },
  { key: "reco", label: "Découvertes", color: C.vermillion, icon: Compass },
  { key: "constellation", label: "Constellation", color: C.cobalt, icon: Sparkles },
  { key: "almanac", label: "Almanach", color: C.moss, icon: CalendarDays },
  { key: "notebook", label: "Carnet", color: C.pine, icon: NotebookPen },
  { key: "import", label: "Import Letterboxd", color: C.slate, icon: FolderInput },
  /* THE FEED IS THE LAST TAB, and not the first: the binder stays a
       personal video library, and what we look at in other people's
       homes comes after what we have in ours. */
  { key: "thread", label: "Le fil", color: C.cobalt, icon: Users2, needsServer: true },
  /* The lists and the challenges come after the feed: we look at what
       others are doing before starting something with them. */
  {
    key: "lists",
    label: "Listes et défis",
    color: C.moss,
    icon: ListChecks,
    needsServer: true,
  },
];

/* The skin control tab is not a view of the product: it only appears in
   development, and the production build does not even carry it — the
   condition is static, so the import of the board falls to tree
   shaking. */
const DEV_TABS: typeof TABS = import.meta.env.DEV
  ? /* En encre et non dans l'une des huit teintes : les onglets du
       produit sont pris, et un outil ne doit pas se déguiser en vue. */
    [{ key: "skinlab", label: "Peaux ⚙", color: C.ink, icon: Settings }]
  : [];

const DIMMED = "saturate(0.65) brightness(0.92)";

type TabDef = (typeof TABS)[number];

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
}: {
  t: TabDef;
  active: boolean;
  onClick: () => void;
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

export function FolderTabs({
  view,
  setView,
  onAdd,
  onSearch,
  onSkin,
  onHelp,
  onKey,
  onAccount,
  sync,
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
  const tabs = [...TABS, ...DEV_TABS].filter((t) => !t.needsServer || serverConfigured());
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
            flex: "1 1 auto",
            minHeight: 0,
            minWidth: 0,
            display: "flex",
            gap: 6,
            ...(phone
              ? {
                  /* HERE, WE SCROLL — AND IT IS THE OPPOSITE OF THE RAIL.

                     On the spine, nothing was to overflow: a scrollbar on
                     a binder's back looks like nothing at all, and eight
                     stacked pills fit in any window. Laid down, eight
                     forty-pixel pills make three hundred and sixty-eight,
                     and the four actions take two hundred more: in a
                     window of three hundred and ninety, that does not
                     fit, and never will.

                     Horizontal filing, for its part, has an obvious
                     finger gesture — we swipe. Its bar stays hidden
                     (`[data-tab-rail]`, higher up in the tokens), the
                     swipe does not. */
                  overflowX: "auto",
                  overflowY: "hidden",
                  flexDirection: "row",
                  alignItems: "center",
                }
              : {
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
          {tabs.map((t) => (
            <Tab
              key={t.key}
              t={t}
              active={view === t.key}
              phone={phone}
              onClick={() => setView(t.key)}
            />
          ))}
        </div>

        {/* THE ACTIONS — always at the foot of the rail, always visible.
            On a phone, "at the foot" means at the end: they file to the
            right of the bar, outside the tabs' swipe, so that the thumb
            does not lose them while scrolling the list. */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            ...(phone
              ? { flexDirection: "row", alignItems: "center", gap: 2 }
              : {
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
            title="Épingler un nouveau film"
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
            title="Chercher partout (Ctrl+K)"
            aria-label="Chercher partout"
            style={{
              all: "unset",
              cursor: "pointer",
              marginLeft: phone ? 0 : 6,
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

          {/* THE SITE SKIN, at the foot of the binder's spine. */}
          <RoundAction
            onClick={onSkin}
            tour="skin"
            label="Changer la peau du site"
            icon={Palette}
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
            label="La clé TMDB"
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
              label="Votre compte et la synchronisation"
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
            label="La visite guidée"
            icon={HelpCircle}
            finger={phone}
          />
        </div>
      </div>
    </div>
  );
}
