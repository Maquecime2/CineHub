/* ============================================================
   BONDS AND COURSES, ON DISK
   ============================================================

   TWO KEYS AND NOT ONE, ON PURPOSE.

   They are written at opposite rates. Reordering a run writes every
   400 ms while a film is being dragged; stating a filiation happens
   twice a month. Held in a single document, the whole map would enter
   last-writer-wins arbitration at every pixel of a drag — and a map
   would be lost because somebody moved a film about on a second
   device.

   They also LAST differently. One settles a course and starts another;
   one does not settle "Hou had Ozu for a master". A single key would
   have made it impossible to sweep away one's plans while keeping what
   one knows.

   NEITHER GOES INTO THE VAULT. A few kilobytes read at mount, exactly
   like `"fils"` — IndexedDB is for what grows without bound, and a
   handful of names does not.
   ============================================================ */
import { store } from "./storage";
import { normalizeBonds } from "../domain/bonds";
import type { Bond } from "../domain/bonds";
import { isEmptyCourse, normalizeCourses } from "../domain/course";
import type { Course } from "../domain/course";

export const BONDS_KEY = "filiations";
export const COURSES_KEY = "parcours";

export const loadBonds = (): Bond[] => normalizeBonds(store.get(BONDS_KEY, []));

export const saveBonds = (bonds: Bond[]): boolean => store.set(BONDS_KEY, bonds);

export const loadCourses = (): Course[] => normalizeCourses(store.get(COURSES_KEY, []));

/* A run that says nothing is not stored — see `isEmptyCourse`. The
   filter is here rather than in the callers so that the rule holds
   whichever gesture happens to be the last one before the write. */
const worthKeeping = (courses: Course[]): Course[] => courses.filter((c) => !isEmptyCourse(c));

export const saveCourses = (courses: Course[]): boolean =>
  store.set(COURSES_KEY, worthKeeping(courses));

/** While a drag is running: coalesced, so the disk sees one write, not forty. */
export const saveCoursesSoon = (courses: Course[]): void =>
  store.setSoon(COURSES_KEY, worthKeeping(courses));
