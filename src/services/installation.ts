/* ============================================================
   PUTTING THE BINDER ON THE HOME SCREEN

   What gets decided here: who we offer the installation to, and when we
   keep quiet. The rest — the gesture itself — belongs to the browser.

   This is BROWSER state and not collection data, like the welcome: it
   does not go into the backup, and clearing site data offers the
   installation again. That is exactly what we want for trying it out.

   ITS TWO FIELDS ARE STORED. `refus` and `posée` are written under the
   `installation` key; `readInstallState` is the only door they come in
   through, and it reads both spellings so that someone who has already
   said no twice is not asked a third time.
   ============================================================ */
import { store } from "./storage";

const KEY = "installation";

/** Two refusals are enough to mean no. We do not ask again after that. */
export const MAX_DISMISSALS = 2;

export interface InstallState {
  /** How many times the invitation has been waved away. */
  dismissals: number;
  /** The invitation has already been shown in this browser session. */
  installed: boolean;
}

/** The shape stored before this module was translated. */
type StoredState = Partial<InstallState> & { refus?: unknown; placedOne?: unknown };

const EMPTY: InstallState = { dismissals: 0, installed: false };

export const readInstallState = (): InstallState => {
  const stored = store.get<StoredState>(KEY, EMPTY);
  const dismissals = stored?.dismissals ?? stored?.refus;
  return {
    dismissals: typeof dismissals === "number" && dismissals >= 0 ? dismissals : 0,
    installed: stored?.installed === true || stored?.placedOne === true,
  };
};

export const noteDismissal = (): InstallState => {
  const state = readInstallState();
  const next = { ...state, dismissals: state.dismissals + 1 };
  store.set(KEY, next);
  return next;
};

/** The installation happened: we never offer it again. */
export const noteInstalled = (): InstallState => {
  const next = { ...readInstallState(), installed: true };
  store.set(KEY, next);
  return next;
};

/* ALREADY INSTALLED? Two ways of knowing, and we need both: Android and
   the desktop answer through the display mode, iOS through a property of
   its own that nobody else implements. */
export const alreadyInstalled = (): boolean => {
  if (typeof window === "undefined") return false;
  const standalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const apple = (window.navigator as { standalone?: boolean }).standalone === true;
  return standalone || apple;
};

/* IOS NEVER ASKS FOR ANYTHING. Safari does not emit
   `beforeinstallprompt` and will open no dialog: the only way is Share →
   "Add to Home Screen". So we cannot offer a button, we can only EXPLAIN
   — and we have to know we are there to do it.

   We also recognise recent iPads, which declare themselves Macintosh and
   only give themselves away by their touch screen. */
export const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
};

/** Is there still any point talking about installation? */
export const mayOffer = (state: InstallState = readInstallState()): boolean =>
  !state.installed && state.dismissals < MAX_DISMISSALS && !alreadyInstalled();
