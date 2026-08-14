/* ============================================================
   THE TOUR — what the binder tells about itself

   ┌──────────────────────────────────────────────────────────┐
   │ THIS FILE FOLLOWS THE PRODUCT.                           │
   │ Every feature added, changed, renamed or removed is      │
   │ echoed HERE in the same change, and on the target's      │
   │ `data-tour` attribute. A tour that describes the old     │
   │ product is one more lie.                                 │
   └──────────────────────────────────────────────────────────┘

   One tour per view, plus a "global" tour that crosses them keeping only
   the essentials. The global tour does not rewrite the texts: it PICKS
   from the page tours, failing which the two would diverge at the first
   change.
   ============================================================ */
import type { View } from "../layout/FolderTabs";
import { serverConfigured } from "../../services/server";

export interface TourStep {
  /** CSS selector of what we are showing. `null`: bubble in the centre. */
  target: string | null;
  /** Catalogue key, not a sentence. See `says` below. */
  title: string;
  /** Catalogue key, not a sentence. See `says` below. */
  body: string;
  /** View to open before the step — that is what makes the tour travel. */
  view?: View;
  /**
   * Tab of the film folder to open before the step.
   *
   * THE SAME MECHANISM AS `view`, EXTENDED BY ONE NOTCH — and above all
   * not a second mechanism beside it: `TourOverlay` calls `onTab` in the
   * same effect where it calls `onView`, and for the same reason. Since
   * the card is read in three tabs, four of the seven steps of the
   * "detail" tour aim at cards that the open tab does not show; without
   * this field they would be skipped like absent targets.
   *
   * The values are those of `FolderTab` (`views/DetailView`), copied here
   * rather than imported: `steps.ts` describes the product and depends on
   * no view — `View` itself is only a type in it.
   */
  tab?: "film" | "mots" | "liens";
  placement?: "right" | "bottom" | "left" | "top" | "center";
  /**
   * Target absent ⇒ step skipped without a sound. True of everything that
   * depends on content: an empty collection has neither poster, nor row,
   * nor card.
   */
  optional?: boolean;
  /**
   * The step does not exist at all without a server.
   *
   * `optional` is not enough for those that OPEN a view: the change of
   * view happens BEFORE we look for the target (see `TourOverlay`), so a
   * skipped step would still have made a page with no tab left blink. So
   * we remove it upstream, rather than skipping it downstream.
   */
  needsServer?: boolean;
}

export interface Tour {
  /** Catalogue key, not a sentence. */
  label: string;
  steps: TourStep[];
}

/** Raccourci de lecture : `[data-tour="…"]`. */
const at = (name: string) => `[data-tour="${name}"]`;

/* ---------- THE WORDS ARE NOT HERE ----------

   `title` and `body` hold a CATALOGUE KEY, not a sentence. This file
   describes the product — which step exists, what it aims at, in which
   view — and the two catalogues say it in their language. `TourOverlay`
   and `TourMenu` resolve them through `t`.

   The key is built from the tour and a slug rather than written by hand:
   a tour renamed in one place and not the other would show `tour.x.y` on
   screen, and only the parity test would have a chance of noticing. */
const says = (tour: string, slug: string) => ({
  title: `tour.${tour}.${slug}.title`,
  body: `tour.${tour}.${slug}.body`,
});

const label = (tour: string) => `tour.${tour}.label`;

/* ---------- the page tours ---------- */

const library: Tour = {
  label: label("library"),
  steps: [
    {
      target: at("wall-search"),
      ...says("library", "search"),
      placement: "bottom",
    },
    {
      target: at("wall-mode"),
      ...says("library", "mode"),
      placement: "bottom",
    },
    {
      target: at("wall-sort"),
      ...says("library", "sort"),
      placement: "bottom",
    },
    {
      target: at("wall-filters"),
      ...says("library", "filters"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("wall-views"),
      ...says("library", "views"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("wall-decor"),
      ...says("library", "decor"),
      placement: "left",
      optional: true,
    },
    {
      target: at("wall-films"),
      ...says("library", "open"),
      placement: "top",
      optional: true,
    },
    /* THE GESTURE THAT CANNOT BE GUESSED, and which did not exist before
       the application fitted in one hand. With a finger, a swipe
       scrolls: so grabbing has to announce itself otherwise, and the
       long press takes care of it. Nobody finds it on their own.

       `optional` like the other steps that aim at content: an empty
       binder has no poster to show, and must be able to play the tour in
       full. */
    {
      target: at("wall-films"),
      ...says("library", "drag"),
      placement: "top",
      optional: true,
    },
    /* FILING WITHOUT OPENING THE CARD. The badge hides until the hand is
       near, which is what makes the wall a wall and not a wall of
       buttons — and also what makes it impossible to find by chance.
       Hence the step.

       `needsServer` AND `optional`: a list lives on the server, so with
       none the badge is not even mounted; and with a server but an empty
       binder there is no poster to point at either. */
    {
      target: at("wall-films"),
      needsServer: true,
      ...says("library", "file"),
      placement: "top",
      optional: true,
    },
    {
      target: at("wall-choose"),
      needsServer: true,
      ...says("library", "choose"),
      placement: "bottom",
      optional: true,
    },
  ],
};

const watchlist: Tour = {
  label: label("watchlist"),
  steps: [
    {
      target: at("wall-films"),
      ...says("watchlist", "waiting"),
      placement: "top",
      optional: true,
    },
    {
      target: at("soir-ouvrir"),
      ...says("watchlist", "tonight"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("wall-mode"),
      ...says("watchlist", "tools"),
      placement: "bottom",
    },
  ],
};

const credits: Tour = {
  label: label("credits"),
  steps: [
    /* The head of the directory before the search: it is what one reads
       on arriving, and the search only answers a name one already has in
       mind. Optional, because a binder of three films carries no
       shortlist — `standouts` hands its rows back empty rather than
       short, and the whole head goes with them. */
    {
      target: at("credits-standouts"),
      ...says("credits", "standouts"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("credits-search"),
      ...says("credits", "names"),
      placement: "bottom",
    },
    {
      target: at("credits-roles"),
      ...says("credits", "roles"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("credits-page"),
      ...says("credits", "page"),
      placement: "right",
      optional: true,
    },
    {
      target: at("credits-companions"),
      ...says("credits", "companions"),
      placement: "top",
      optional: true,
    },
    {
      target: at("credits-tmdb"),
      ...says("credits", "missing"),
      placement: "top",
      optional: true,
    },
  ],
};

const detail: Tour = {
  label: label("detail"),
  steps: [
    {
      target: at("detail-catalog"),
      tab: "film",
      ...says("detail", "catalog"),
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-watchlog"),
      tab: "mots",
      ...says("detail", "watchlog"),
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-ailleurs"),
      tab: "film",
      ...says("detail", "elsewhere"),
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-sharing"),
      tab: "film",
      ...says("detail", "sharing"),
      placement: "right",
      optional: true,
    },
    {
      target: at("detail-review"),
      tab: "mots",
      ...says("detail", "review"),
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-tags"),
      tab: "mots",
      ...says("detail", "tags"),
      placement: "left",
      optional: true,
    },
    /* FILING FROM THE CARD. The anchor has existed for a long time and
       no step described it; and what it does has changed — one can now
       make the list from here, where before the whole section vanished
       until a list existed elsewhere. */
    {
      target: at("detail-lists"),
      tab: "film",
      needsServer: true,
      ...says("detail", "lists"),
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-identite"),
      tab: "film",
      ...says("detail", "identity"),
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-thread"),
      tab: "liens",
      ...says("detail", "thread"),
      placement: "left",
      optional: true,
    },
    {
      target: at("detail-sillage"),
      tab: "liens",
      ...says("detail", "wake"),
      placement: "top",
      /* Optional: a collection of a single film has no wake, and the
         tour must be able to play in full on an empty binder. */
      optional: true,
    },
  ],
};

const reco: Tour = {
  label: label("reco"),
  steps: [
    {
      target: at("reco-maison"),
      ...says("reco", "home"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("reco-dials"),
      ...says("reco", "dials"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("reco-bulletin"),
      ...says("reco", "order"),
      placement: "top",
      optional: true,
    },
  ],
};

const constellation: Tour = {
  label: label("constellation"),
  steps: [
    {
      target: at("constellation-start"),
      ...says("constellation", "start"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("constellation-teams"),
      ...says("constellation", "teams"),
      placement: "bottom",
    },
    {
      target: at("constellation-fils"),
      ...says("constellation", "threads"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("constellation-ciel"),
      ...says("constellation", "keyboard"),
      placement: "top",
      optional: true,
    },
  ],
};

const almanac: Tour = {
  label: label("almanac"),
  steps: [
    {
      target: at("almanac-year"),
      ...says("almanac", "year"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("almanac-plates"),
      ...says("almanac", "plates"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("almanac-export"),
      ...says("almanac", "export"),
      placement: "left",
      optional: true,
    },
  ],
};

const notebook: Tour = {
  label: label("notebook"),
  steps: [
    {
      target: at("notebook-new"),
      ...says("notebook", "new"),
      placement: "right",
    },
  ],
};

const importTour: Tour = {
  label: label("import"),
  steps: [
    {
      target: at("import-drop"),
      ...says("import", "drop"),
      placement: "top",
    },
    {
      target: at("import-feed"),
      ...says("import", "feed"),
      placement: "top",
    },
    {
      target: at("import-complete"),
      ...says("import", "complete"),
      placement: "top",
      optional: true,
    },
    {
      target: at("import-repair"),
      ...says("import", "repair"),
      placement: "top",
      optional: true,
    },
    {
      target: at("import-backup"),
      ...says("import", "backup"),
      placement: "top",
      optional: true,
    },
  ],
};

/* ---------- the global tour ---------- */

/* Takes a few steps of a page tour and attaches them to its view. We
   designate the steps BY THEIR TARGET and not by their rank: inserting a
   step in the middle of a page tour must not silently change what the
   global tour tells. An unknown target throws — it is the coverage test
   that catches it, not the user. */
const from = (view: View, tour: Tour, ...names: string[]): TourStep[] =>
  names.map((name) => {
    const target = at(name);
    const s = tour.steps.find((x) => x.target === target);
    if (!s) throw new Error(`Global tour: "${name}" does not exist in "${tour.label}"`);
    return { ...s, view };
  });

const global: Tour = {
  label: label("global"),
  steps: [
    {
      target: null,
      ...says("global", "welcome"),
      placement: "center",
      view: "library",
    },
    {
      target: "[data-tab-rail]",
      ...says("global", "rail"),
      placement: "right",
      view: "library",
    },
    ...from("library", library, "wall-search", "wall-mode", "wall-films"),
    ...from("watchlist", watchlist, "wall-films", "soir-ouvrir"),
    /* NOT `credits-page` NOR `credits-companions` HERE, AND THAT IS A
       FIX. Their anchors only exist once a person is SELECTED, and the
       global tour arrives on a closed directory: the steps would be
       permanently dead, even on a full collection. They stay in the
       Credits tour, where a folder has been opened. The head of the
       directory, on the other hand, is right there on arriving. */
    ...from("credits", credits, "credits-standouts", "credits-search", "credits-roles"),
    /* NOT `reco-dials` EITHER, and for the same reason as
       `credits-page` above: the two dials live INSIDE the order
       form, which the view does not mount at all without a TMDB key. On
       a new binder — which never has one — the step opened Discoveries,
       looked for an absent anchor for seven hundred milliseconds of
       opaque veil, then moved on without a word.

       `reco-maison`, for its part, stays: the suggestions drawn from
       your own collection ask for no key, and that is precisely what
       this step tells. The dials keep their place in the Discoveries
       tour, where one arrives with what one has. */
    ...from("reco", reco, "reco-maison"),
    ...from("constellation", constellation, "constellation-start", "constellation-teams"),
    ...from("almanac", almanac, "almanac-year"),
    ...from("notebook", notebook, "notebook-new"),
    ...from("import", importTour, "import-drop", "import-backup"),
    {
      target: at("add-film"),
      ...says("global", "addFilm"),
      placement: "right",
      view: "library",
    },
    {
      target: at("search-all"),
      ...says("global", "searchAll"),
      placement: "right",
      view: "library",
    },
    {
      target: at("skin"),
      ...says("global", "skin"),
      placement: "right",
      view: "library",
    },
    {
      target: at("language"),
      ...says("global", "language"),
      placement: "right",
      view: "library",
    },
    /* THE BINDER INSTALLS ITSELF — and the card that offers it does not
       always appear: the browser decides on its own that a site is
       installable, and the card vanishes as soon as it has been waved
       away twice or is already laid down. `optional`, then, like
       everything that depends on what is before our eyes. */
    {
      target: at("install"),
      ...says("global", "install"),
      placement: "top",
      view: "library",
      optional: true,
    },
    /* THE ACCOUNT — `optional` because the action is only mounted if a
       server is set. With no server there is nothing to show and the
       tour passes over it without saying so. */
    {
      target: at("compte"),
      ...says("global", "account"),
      placement: "right",
      view: "library",
      optional: true,
    },
    /* SHARING LIVES IN THE SAME DRAWER AS THE ACCOUNT, and the step says
       so there too: it only exists with an account, and a second anchor
       for a panel the tour cannot open on its own would show the
       void. */
    {
      target: at("compte"),
      ...says("global", "sharing"),
      placement: "right",
      view: "library",
      optional: true,
    },
    /* THE OTHER DEVICES, in that same drawer. This one is not a comfort:
       a passkey does not leave the machine that made it, so an account
       opened on one computer stays shut inside it until a second key —
       a telephone's — is hung on it. Nobody thinks of doing that before
       the evening they need it, which is exactly why the tour says it
       on the first. */
    {
      target: at("compte"),
      needsServer: true,
      ...says("global", "devices"),
      placement: "right",
      view: "library",
      optional: true,
    },
    /* THE REMINDERS live in the same drawer as the account and sharing,
       and the step says so there too. `optional`: with no server, with
       no keys laid on it, or in a browser that cannot receive a
       notification, the action is not even mounted. */
    {
      target: at("compte"),
      ...says("global", "reminders"),
      placement: "right",
      view: "library",
      optional: true,
    },
    /* THE CHALLENGES, last before the goodbye: it is the only thing in
       this binder done with other people, and it presupposes all the
       rest. `optional` like the account — with no server the view shows
       only a sentence, and there is no landmark to point at. */
    {
      target: at("lists-challenges"),
      needsServer: true,
      ...says("global", "challenges"),
      placement: "top",
      view: "lists",
      optional: true,
    },
    /* AND THE QUIZZES RIGHT AFTER, because they are the same idea taken
       one step further: the challenges measure what one watches, a quiz
       what one knows. `quiz-new` and not `quiz-bank` — the bank belongs
       to whoever fills it, and the global tour is run by everybody. */
    {
      target: at("quiz-new"),
      needsServer: true,
      ...says("global", "quiz"),
      placement: "bottom",
      view: "quiz",
      optional: true,
    },
    {
      target: at("tmdb-key"),
      ...says("global", "tmdbKey"),
      placement: "right",
      view: "library",
    },
    {
      target: at("help"),
      ...says("global", "replay"),
      placement: "right",
      view: "library",
    },
  ],
};

/* THE FEED — the only view that does not speak of your collection. Its
   steps are `optional`: with no server, no account, or nobody followed,
   half these landmarks do not exist, and a tour that points at the void
   is worse than a shorter tour. */
const thread: Tour = {
  label: label("thread"),
  steps: [
    {
      target: at("thread-search"),
      ...says("thread", "find"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("thread-follows"),
      ...says("thread", "follows"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("thread-news"),
      ...says("thread", "news"),
      placement: "top",
      optional: true,
    },
  ],
};

/* THE LISTS AND THE CHALLENGES. The same precautions as the feed: with
   no server or account, none of this exists, and a tour that points at
   the void is worse than a shorter tour. */
const lists: Tour = {
  label: label("lists"),
  steps: [
    {
      target: at("lists-new"),
      ...says("lists", "new"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("lists-mine"),
      ...says("lists", "mine"),
      placement: "bottom",
      optional: true,
    },
    /* FILLING A LIST FROM TMDB. The search only exists inside an
       OPEN list one may write in: on arriving here with nothing opened
       there is no anchor, hence `optional`. */
    {
      target: at("lists-search"),
      ...says("lists", "search"),
      placement: "top",
      optional: true,
    },
    {
      target: at("lists-challenges"),
      ...says("lists", "challenges"),
      placement: "top",
      optional: true,
    },
  ],
};

/* THE QUIZZES. Every step is `optional`, and here that is not a
   precaution but the shape of the view itself: `quiz-bank` is drawn only
   for whoever may fill the bank, and the anchors inside a quiz only
   exist once one has been unfolded. Somebody invited to play sees three
   of these, and their tour must still run from end to end. */
const quiz: Tour = {
  label: label("quiz"),
  steps: [
    {
      target: at("quiz-new"),
      ...says("quiz", "compose"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("quiz-bank"),
      ...says("quiz", "bank"),
      placement: "bottom",
      optional: true,
    },
    {
      target: at("quiz-mine"),
      ...says("quiz", "mine"),
      placement: "top",
      optional: true,
    },
    {
      target: at("quiz-given"),
      ...says("quiz", "given"),
      placement: "top",
      optional: true,
    },
    {
      target: at("quiz-playing"),
      ...says("quiz", "playing"),
      placement: "top",
      optional: true,
    },
    {
      target: at("quiz-players"),
      ...says("quiz", "players"),
      placement: "top",
      optional: true,
    },
    {
      target: at("quiz-scores"),
      ...says("quiz", "scores"),
      placement: "top",
      optional: true,
    },
  ],
};

/* ---------- the registry ---------- */

/* WHAT DOES NOT EXIST IS NOT VISITED. With no server — the published
   site's case — the feed and the challenges have no tab; their steps
   therefore have nothing to show, and the tour must describe the product
   as it is for whoever is playing it. */
const prune = (t: Tour): Tour =>
  serverConfigured() ? t : { ...t, steps: t.steps.filter((s) => !s.needsServer) };

export const TOURS: Record<string, Tour> = Object.fromEntries(
  Object.entries({
    global,
    library,
    watchlist,
    credits,
    detail,
    reco,
    constellation,
    almanac,
    notebook,
    import: importTour,
    thread,
    lists,
    quiz,
  }).map(([key, t]) => [key, prune(t)])
);

/** A view's tour, if there is one. `detail` has one, `skinlab` does not. */
export const tourForView = (view: string): Tour | undefined =>
  view === "global" ? undefined : TOURS[view];
