/* ============================================================
   A COURSE — films in the order one means to watch them
   ============================================================

   A watchlist says WHAT. It has never said in what ORDER, and an order
   is the whole of a viewing plan: seeing Hou before Ozu is not the same
   plan as seeing Ozu before Hou, it is a different reading of both.

   THE ARRAY IS THE ORDER. Nothing carries a rank, nothing is sorted on
   the way out — the same doctrine as `shelf-views`, where an item's
   place on a board is its place in the list. A rank column would be a
   second truth to keep in step with the first, and the two would drift
   apart the first time something was removed from the middle.

   `Step.id` AND NOT `filmId` IS THE IDENTITY. Watching the same film
   twice inside one cycle — Ozu 1949, then Hou, then Ozu 1953 — is a
   perfectly ordinary plan, and keying a step by its film would have
   forbidden it without anybody having decided to. It is also what makes
   a correct React key for a list one reorders: two entries on the same
   film would otherwise swap their notes as they moved.

   WHAT THE STEPS SAY, AND WHY THERE ARE THREE PLACES TO SAY IT.
   `Course.note` is the thesis — what the whole run is trying to show.
   `Step.why` is the marginal note — why THIS film, at THIS place.
   `Step.because` is neither: it POINTS AT A BOND, so a plan can state
   that this entry follows from a filiation rather than merely asserting
   it in prose. That is what makes the reasoning navigable in both
   directions instead of merely readable.

   `because` IS NOT VALIDATED AT THE DOOR, AND THAT IS DELIBERATE. It
   names a row in the OTHER document, and the two documents travel apart
   under last-writer-wins: a device can hold a course citing a bond
   another device has just erased. Checking one against the other on
   load would rebuild the coupling we broke by storing them separately,
   and would silently erase somebody's justification because their
   synchronisation ran two seconds late. A dangling `because` is simply
   mute when drawn — the ribbon is not traced, and `why` stays. */
import type { Film } from "../types";
import type { Bond } from "./bonds";

export interface Step {
  /** The identity of the STEP, never of the film. */
  id: string;
  filmId: string;
  /** Why this film, at this place. Empty is the norm. */
  why: string;
  /** The `Bond.id` this step follows from, if any. */
  because: string | null;
  /**
   * WHEN THE STEP WAS LAID, and the whole of the progress model.
   *
   * A step is settled by a screening LATER than this — see `stepDone`.
   * There is no `done` flag any more: a hand-ticked box is a second
   * truth about the same fact, and the two drift apart the first time
   * one logs a screening from the film card, which is where one
   * actually logs it.
   */
  at: number;
}

/**
 * THE RED THREAD, AND NOT A FILTER.
 *
 * A run has always been ABOUT something — the film-maker filiations were
 * only the first way of saying it, and they had quietly become the
 * whole screen. The kind decides what EVIDENCE is drawn under the
 * heading; it never decides what one is allowed to lay down. A run on
 * the sixties takes a film from 1971 gladly, because the exception is
 * very often the reason for the run.
 */
export type ThreadKind = "filiation" | "motif" | "decade" | "genre" | "free";

export interface CourseThread {
  kind: ThreadKind;
  /** A motif id, a decade ("1960"), a genre. Empty under `free`. */
  value: string;
}

/**
 * WHAT A RUN IS ABOUT UNTIL SOMEBODY SAYS OTHERWISE, and it is the
 * filiation rather than `free`.
 *
 * Every run ever written was one — the map was the only instrument this
 * screen had — so reading `free` off a document that predates the field
 * would silently take the map away from people who had been using it,
 * and taking a feature away by omission is worse than any default. It
 * is also the only kind that offers cards to lay down without a value
 * being picked first, so a brand-new run is not a dead end.
 */
export const DEFAULT_THREAD: CourseThread = { kind: "filiation", value: "" };

/** A thread nobody has touched: it says nothing the absence of one does not. */
export const isPlainThread = (t: CourseThread): boolean =>
  t.kind === DEFAULT_THREAD.kind && !t.value;

export interface Course {
  id: string;
  /** Empty means "call it whatever the catalogue calls an untitled run". */
  label: string;
  /** The thesis: what the whole run means to show. */
  note: string;
  thread: CourseThread;
  /**
   * The one run the rest of the app speaks about — see `pinnedCourse`.
   * At most one, and that is settled AT THE DOOR by `normalizeCourses`
   * rather than by the form: two devices can each pin their own.
   */
  pinned?: boolean;
  steps: Step[];
  createdAt: number;
  updatedAt: number;
}

/* Ids are only ever compared to one another, never parsed and never
   shown: a counter plus the clock is enough, and it keeps the domain
   free of `crypto` — which the tests would have had to stub. */
let tick = 0;
const freshId = (prefix: string): string =>
  `${prefix}${Date.now().toString(36)}${(tick++).toString(36)}`;

export const makeStep = (filmId: string, rest: Partial<Step> = {}): Step => ({
  why: "",
  because: null,
  ...rest,
  /* AFTER the spread, like `id`: a caller handing `at: undefined` — which
     is exactly what reading an old document does — would otherwise blank
     the default it had just been given. */
  at: rest.at ?? Date.now(),
  id: rest.id || freshId("s"),
  filmId,
});

export const makeCourse = (rest: Partial<Course> = {}): Course => {
  const now = Date.now();
  return {
    label: "",
    note: "",
    thread: DEFAULT_THREAD,
    steps: [],
    createdAt: now,
    ...rest,
    id: rest.id || freshId("c"),
    updatedAt: rest.updatedAt ?? now,
  };
};

/**
 * Is this run worth keeping on disk?
 *
 * A course with no step, no title and no thesis says nothing the
 * absence of a course does not already say — the same reasoning that
 * keeps `"fils"` a list of deviations. It is also why NOTHING in the
 * interface offers to "create a course" on an empty screen: the first
 * film dropped in makes one, exactly as laying a motif makes a
 * gathering.
 */
export const isEmptyCourse = (c: Course): boolean =>
  c.steps.length === 0 && !c.label.trim() && !c.note.trim() && isPlainThread(c.thread);

/**
 * The steps that still point at something, in order.
 *
 * FILTERED ON READ, NEVER WRITTEN BACK — the same rule as
 * `threadMembers`. Erasing here would mean writing to disk on every
 * render, and a card that is merely missing for the moment (a
 * synchronisation running behind) would be destroyed for good rather
 * than coming back on its own.
 */
export const courseSteps = (course: Course, films: Film[]): { step: Step; film: Film }[] => {
  const byId = new Map(films.map((f) => [f.id, f]));
  const out: { step: Step; film: Film }[] = [];
  for (const step of course.steps) {
    const film = byId.get(step.filmId);
    if (film) out.push({ step, film });
  }
  return out;
};

/* ------------------------------------------------------------
   WHERE ONE IS UP TO
   ------------------------------------------------------------
   A watchlist says what is left; a run says what is left IN ORDER, and
   until now it said neither — the screen drew a plan and never once
   drew the plan's state. */

/**
 * The day a step was laid, spelled as `Watch.date` spells it.
 *
 * Exported because the step panel says which screening settled the step,
 * and it has to apply the very same cut-off to find it — a second
 * spelling of "the same day" is how the panel and the count come to
 * disagree about one entry.
 */
export const laidOn = (at: number): string => new Date(at).toISOString().slice(0, 10);

/**
 * Has this step been walked?
 *
 * A SCREENING LATER THAN THE STEP WAS LAID, and nothing else. Having
 * seen the film ten years ago does not settle it: a run would then be
 * born half finished, and the one number this screen exists to show
 * would be wrong on the day it is made. Watching it again does settle
 * it, which is the whole reason a run may hold a film one has seen.
 *
 * Compared as `YYYY-MM-DD` strings on both sides: `Watch.date` is a DAY
 * and carries no clock, so a step laid this afternoon is settled by a
 * screening logged this morning — which is what one means when one lays
 * down the film one has just watched.
 */
export const stepDone = (step: Step, film: Film): boolean => {
  const laid = laidOn(step.at);
  return film.watches.some((w) => w.date >= laid);
};

export interface Progress {
  done: number;
  total: number;
  /** The first step not yet walked, in the order of the array. */
  next: { step: Step; film: Film } | null;
}

/**
 * How far along a run is, and what comes next.
 *
 * `next` IS THE FIRST UNWALKED ENTRY IN THE ORDER THAT IS WRITTEN, not
 * the nearest or the shortest. The array is the order — the doctrine of
 * this whole file — so picking anything else would answer a question
 * nobody asked with a plan nobody wrote.
 *
 * Steps whose card has left the collection count in neither number:
 * `courseSteps` has already dropped them at the reading, and NOTHING
 * says how many — le rail rétrécit sans un mot, et c'est un choix
 * assumé. L'étape reste écrite : elle revient si la fiche revient.
 */
export const courseProgress = (course: Course, films: Film[]): Progress => {
  const entries = courseSteps(course, films);
  let done = 0;
  let next: Progress["next"] = null;
  for (const entry of entries) {
    if (stepDone(entry.step, entry.film)) done += 1;
    else if (!next) next = entry;
  }
  return { done, total: entries.length, next };
};

/* ------------------------------------------------------------
   THE RED THREAD
   ------------------------------------------------------------ */

/* `year` IS TYPED BY HAND, so "196?" and "" both reach here. A guard
   rather than a cast: the same reasoning as the decade challenge, where
   an `::int` on a typo brought down the query that PAYS. */
const YEAR = /^\d{4}$/;

/** The decade a card falls in ("1963" → "1960"), or nothing. */
export const decadeOf = (film: Pick<Film, "year">): string => {
  const y = String(film.year ?? "");
  return YEAR.test(y) ? `${y.slice(0, 3)}0` : "";
};

/**
 * Does this card carry the run's thread?
 *
 * FALSE UNDER `filiation` AND `free`, and that is not a gap. A
 * filiation lives between PEOPLE — the map is what reads it, and it
 * reads it from the bonds, not from a card. A free thread is a
 * sentence somebody wrote; no card can be measured against prose.
 * Both are asked elsewhere, and neither has suggestions to offer.
 */
export const matchesThread = (thread: CourseThread, film: Film): boolean => {
  if (!thread.value) return false;
  if (thread.kind === "motif") return film.motifs.includes(thread.value);
  if (thread.kind === "decade") return decadeOf(film) === thread.value;
  if (thread.kind === "genre") return film.genres.includes(thread.value);
  return false;
};

/* ------------------------------------------------------------
   WHAT THE REST OF THE APP READS
   ------------------------------------------------------------
   Three screens ask the same thing — the film card, the watchlist, the
   library door — and none of them writes. */

/** The pinned run, or the most recently touched one, or nothing. */
export const pinnedCourse = (courses: Course[]): Course | null =>
  courses.find((c) => c.pinned) ||
  [...courses].sort((a, b) => b.updatedAt - a.updatedAt)[0] ||
  null;

export interface Placing {
  course: Course;
  step: Step;
  /** Its place, counted from one — what a person would say out loud. */
  place: number;
}

/**
 * Where this film stands in a run, if it stands in one.
 *
 * THE PINNED RUN FIRST, then the others in the order they are held: a
 * film can honestly belong to three plans, and naming all three on a
 * card would say nothing. The FIRST occurrence within a run wins — the
 * same film twice in one run is a plan, and its first place is the one
 * that is still to come.
 */
export const stepOf = (courses: Course[], filmId: string): Placing | null => {
  const pinned = pinnedCourse(courses);
  const order = pinned ? [pinned, ...courses.filter((c) => c !== pinned)] : courses;
  for (const course of order) {
    const at = course.steps.findIndex((s) => s.filmId === filmId);
    if (at >= 0) return { course, step: course.steps[at]!, place: at + 1 };
  }
  return null;
};

/**
 * Consecutive runs by the same director.
 *
 * GROUPED, NEVER SORTED. Gathering every Ozu together would reorder
 * somebody's plan under cover of presenting it — and the plan is the
 * one thing here that is theirs. Three Ozu in a row make one group;
 * two Ozu split by a Hou make two, because that is what was written.
 */
export const groupedSteps = <T extends { step: Step; film: Film }>(
  entries: T[],
  keyOf: (film: Film) => string
): { key: string; entries: T[] }[] => {
  const out: { key: string; entries: T[] }[] = [];
  for (const entry of entries) {
    const key = keyOf(entry.film);
    const last = out[out.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else out.push({ key, entries: [entry] });
  }
  return out;
};

/* ------------------------------------------------------------
   MOVING THINGS ABOUT
   ------------------------------------------------------------
   Pure, and out of the view on purpose: reordering is the gesture this
   screen is FOR, and it is tested on its own rather than through a
   drag nobody can reproduce in a test runner. */

/** The list with the item at `from` moved to `to`. Out of bounds: unchanged. */
export const move = <T>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
};

/**
 * The list with the item at `i` moved by `delta`.
 *
 * A move that would fall off either end is NOT clamped, it is refused:
 * clamping makes the last item's "move down" look like it worked, and
 * the announcement would then say it changed place when it had not.
 */
export const moveBy = <T>(list: T[], i: number, delta: number): T[] => {
  const to = i + delta;
  if (to < 0 || to >= list.length) return list;
  return move(list, i, to);
};

/**
 * The list with everything named by `ids` gathered in front of `beforeId`.
 *
 * WHAT IS TAKEN KEEPS ITS OWN ORDER. Picking entries 2, 5 and 6 and
 * dropping them further along must not shuffle them among themselves:
 * the three were already in an order somebody chose, and the gesture
 * asked to move them, not to rearrange them.
 *
 * DROPPING A SELECTION ONTO ITSELF IS REFUSED, and refused the same way
 * `move` refuses — by handing the very same array back, so the caller
 * cannot announce a move that did not happen. There is no sensible
 * answer to "put these three in front of the second of the three", and
 * inventing one would move somebody's plan without being asked.
 */
export const moveGroup = <T extends { id: string }>(
  list: T[],
  ids: ReadonlySet<string>,
  beforeId: string
): T[] => {
  if (ids.size === 0 || ids.has(beforeId)) return list;
  const taken = list.filter((item) => ids.has(item.id));
  if (taken.length === 0) return list;
  const rest = list.filter((item) => !ids.has(item.id));
  const at = rest.findIndex((item) => item.id === beforeId);
  if (at < 0) return list;
  return [...rest.slice(0, at), ...taken, ...rest.slice(at)];
};

const touched = (course: Course, steps: Step[]): Course => ({
  ...course,
  steps,
  updatedAt: Date.now(),
});

export const withSteps = touched;

/** Append a film to the end of the run. The same film twice is a plan, not a mistake. */
export const withStep = (course: Course, filmId: string, rest: Partial<Step> = {}): Course =>
  touched(course, [...course.steps, makeStep(filmId, rest)]);

export const withoutStep = (course: Course, stepId: string): Course =>
  touched(
    course,
    course.steps.filter((s) => s.id !== stepId)
  );

/** The same, for a whole selection taken out in one gesture. */
export const withoutSteps = (course: Course, ids: ReadonlySet<string>): Course =>
  touched(
    course,
    course.steps.filter((s) => !ids.has(s.id))
  );

export const patchStep = (course: Course, stepId: string, patch: Partial<Step>): Course =>
  touched(
    course,
    course.steps.map((s) => (s.id === stepId ? { ...s, ...patch, id: s.id } : s))
  );

/** The bond a step follows from, or `undefined` when it names none we hold. */
export const stepBond = (step: Step, bonds: Bond[]): Bond | undefined =>
  step.because ? bonds.find((b) => b.id === step.because) : undefined;

/** What to call a run that has never been named. */
export const courseLabel = (course: Course, untitled: string): string =>
  course.label.trim() || untitled;

/**
 * What comes off the disk: we trust nothing about its shape.
 *
 * THE ONE DOOR. It knows nothing of bonds (see the header), and it
 * drops only what cannot be drawn at all: a step with no film, a course
 * that is a duplicate of another by id, a run that says nothing.
 */
const KINDS: ThreadKind[] = ["filiation", "motif", "decade", "genre", "free"];

/* AN UNKNOWN KIND FALLS BACK TO THE DEFAULT, IT IS NOT DROPPED. A run made
   on a newer version of the app carries a thread this one cannot draw;
   losing the run over it would be the worst possible answer, and the
   thesis and the order — the things nothing else holds — survive
   untouched. `value` is never checked against a catalogue: motifs live
   in another document, and validating one against the other is the
   coupling `because` was written to avoid. */
const readThread = (raw: unknown): CourseThread => {
  const t = (raw ?? {}) as Partial<CourseThread>;
  const kind = KINDS.includes(t.kind as ThreadKind) ? (t.kind as ThreadKind) : DEFAULT_THREAD.kind;
  if (kind === "free" || kind === "filiation") return { kind, value: "" };
  return { kind, value: typeof t.value === "string" ? t.value : "" };
};

export const normalizeCourses = (raw: unknown): Course[] => {
  const byId = new Map<string, Course>();
  /* AT MOST ONE PIN, SETTLED HERE AND NOT BY THE FORM. Two devices each
     pin their own run, last-writer-wins hands back a document with two,
     and the app would then have to pick — silently — which one the rest
     of it talks about. First one held wins, like `normalizeBonds`. */
  let pinned = false;

  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!entry || typeof entry !== "object") continue;
    const c = entry as Partial<Course>;

    const steps: Step[] = [];
    const seen = new Set<string>();
    for (const s of Array.isArray(c.steps) ? c.steps : []) {
      if (!s || typeof s !== "object") continue;
      const step = s as Partial<Step>;
      if (typeof step.filmId !== "string" || !step.filmId) continue;
      /* Two steps sharing an id would move as one and edit as one — the
         very confusion `Step.id` exists to prevent. The second gets a
         fresh one rather than being dropped: it is a real entry in
         somebody's plan, only badly named. */
      const id = typeof step.id === "string" && step.id && !seen.has(step.id) ? step.id : undefined;
      const made = makeStep(step.filmId, {
        id,
        why: typeof step.why === "string" ? step.why : "",
        because: typeof step.because === "string" && step.because ? step.because : null,
        /* A step laid before `at` existed falls back on the run's own
           birth — the earliest moment we can honestly claim. Reading
           `Date.now()` here instead would settle nothing that is
           already watched, and the run would look untouched forever. */
        at:
          typeof step.at === "number"
            ? step.at
            : typeof c.createdAt === "number"
              ? c.createdAt
              : undefined,
      });
      seen.add(made.id);
      steps.push(made);
    }

    const keepPin = !pinned && c.pinned === true;
    const course = makeCourse({
      id: typeof c.id === "string" && c.id ? c.id : undefined,
      label: typeof c.label === "string" ? c.label : "",
      note: typeof c.note === "string" ? c.note : "",
      thread: readThread(c.thread),
      ...(keepPin ? { pinned: true } : {}),
      steps,
      createdAt: typeof c.createdAt === "number" ? c.createdAt : undefined,
      updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : undefined,
    });
    if (isEmptyCourse(course)) continue;
    if (byId.has(course.id)) continue;
    if (keepPin) pinned = true;
    byId.set(course.id, course);
  }

  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
};
