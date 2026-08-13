/* ============================================================
   THE TWO LANGUAGES
   ============================================================

   BOTH CATALOGUES ARE IMPORTED, NOT FETCHED. i18next knows how to go and
   get a language over the network, and that is exactly what this binder
   must not do: it works offline from the first day, and a screen that
   loses its words in the underground would be a screen that lies about
   what it promises. Two catalogues weigh a few tens of kilobytes; the
   Workbox precache takes them with the rest of the bundle.

   FRENCH IS THE FALLBACK, and not by chance: it is the language the
   product was written in. An English key with nothing behind it shows the
   French sentence rather than its own name — a reader sees a word they
   did not expect, which is a small fault, instead of `detail.setAside`,
   which is a broken screen.
   ============================================================ */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import fr from "./fr";
import en from "./en";
import { DEFAULT_LANGUAGE, applyLanguageToDocument, loadLanguage, saveLanguage } from "./language";
import type { Language } from "./language";

export const resources = { fr: { translation: fr }, en: { translation: en } } as const;

const language = loadLanguage();

void i18next.use(initReactI18next).init({
  resources,
  lng: language,
  fallbackLng: DEFAULT_LANGUAGE,
  /* React escapes what it renders on its own; escaping a second time here
     would show `&amp;` on the screen. */
  interpolation: { escapeValue: false },
  /* A missing key must be loud in development and quiet in production:
     the parity test is what actually guards this. */
  returnEmptyString: false,
});

applyLanguageToDocument(language);

/** Change of language: the catalogue, the memory and the document at once. */
export function setLanguage(lang: Language): void {
  void i18next.changeLanguage(lang);
  saveLanguage(lang);
  applyLanguageToDocument(lang);
}

export { loadLanguage, LANGUAGES, DEFAULT_LANGUAGE } from "./language";
export type { Language } from "./language";
export default i18next;
