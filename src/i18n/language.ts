/* ============================================================
   WHICH LANGUAGE, AND WHERE IT IS REMEMBERED
   ============================================================

   THE LANGUAGE IS DEVICE-LOCAL AND DOES NOT SYNCHRONISE, exactly like
   the chosen skin, and for the reason already written in
   `services/documents`: what describes THIS device stays on it. Somebody
   who reads in French on their telephone and in English at work is not
   in contradiction with themselves — imposing one on the other would be.

   So `site-lang` must never join `SYNCABLE_KEYS`.
   ============================================================ */

export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "fr";

export const LANG_KEY = "site-lang";

const known = (value: string | null | undefined): Language | null =>
  LANGUAGES.includes(value as Language) ? (value as Language) : null;

/**
 * The language to open in: the chosen one, failing that the browser's,
 * failing that French.
 *
 * The browser is only consulted the FIRST time. Once somebody has chosen,
 * the choice outlives a browser that changes its mind — a machine set to
 * English does not get to take back a French reader's binder.
 */
export function loadLanguage(): Language {
  try {
    const chosen = known(localStorage.getItem(LANG_KEY));
    if (chosen) return chosen;
  } catch {
    /* Private browsing, storage refused: the browser decides, then. */
  }
  const first = typeof navigator === "undefined" ? "" : navigator.language;
  /* `fr-CA`, `en-GB`: the region is not our business, only the tongue. */
  return known(first.slice(0, 2).toLowerCase()) ?? DEFAULT_LANGUAGE;
}

export function saveLanguage(lang: Language): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* Same as above: not being able to remember is not a reason to fail. */
  }
}

/**
 * The `lang` attribute of the document.
 *
 * It is not decoration: a screen reader pronounces the page with it, and
 * `hyphens: auto` cuts words by it. `index.html` carries `fr` in the
 * static file, for the first paint; this puts the truth back on it.
 */
export function applyLanguageToDocument(lang: Language): void {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}
