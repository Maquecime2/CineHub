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
  done?: boolean;
}

export interface Course {
  id: string;
  /** Empty means "call it whatever the catalogue calls an untitled run". */
  label: string;
  /** The thesis: what the whole run means to show. */
  note: string;
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
  id: rest.id || freshId("s"),
  filmId,
});

export const makeCourse = (rest: Partial<Course> = {}): Course => {
  const now = Date.now();
  return {
    label: "",
    note: "",
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
  c.steps.length === 0 && !c.label.trim() && !c.note.trim();

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

/**
 * How many steps point at nothing.
 *
 * THIS EXISTS SO THE VIEW CAN SAY IT. A column that quietly shrinks by
 * two entries is the same bug as a silent failure: something happened,
 * and the only person who could make sense of it was not told.
 */
export const strandedCount = (course: Course, films: Film[]): number =>
  course.steps.length - courseSteps(course, films).length;

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
export const normalizeCourses = (raw: unknown): Course[] => {
  const byId = new Map<string, Course>();

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
        ...(step.done ? { done: true } : {}),
      });
      seen.add(made.id);
      steps.push(made);
    }

    const course = makeCourse({
      id: typeof c.id === "string" && c.id ? c.id : undefined,
      label: typeof c.label === "string" ? c.label : "",
      note: typeof c.note === "string" ? c.note : "",
      steps,
      createdAt: typeof c.createdAt === "number" ? c.createdAt : undefined,
      updatedAt: typeof c.updatedAt === "number" ? c.updatedAt : undefined,
    });
    if (isEmptyCourse(course)) continue;
    if (byId.has(course.id)) continue;
    byId.set(course.id, course);
  }

  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
};
