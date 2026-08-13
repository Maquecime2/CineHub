import "@testing-library/jest-dom/vitest";
import i18n from "./i18n";

/* THE TESTS RUN IN FRENCH, AND THEY ARE MADE TO. Left to itself, jsdom
   announces `en-US` and the whole suite would read in English — which
   would be a fine thing to check on purpose, and a terrible thing to
   discover by accident on four hundred assertions written in French.

   Loading the real catalogue rather than a stub is deliberate too: a key
   missing from `fr` then fails a test somewhere, instead of hiding behind
   a mock that answers everything. */
void i18n.changeLanguage("fr");
