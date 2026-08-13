import "@testing-library/jest-dom/vitest";

/* THE TESTS RUN IN FRENCH, and that is not a detail of configuration.
   They assert on what the screen says; French is what it says by default,
   and it is the language the product was written in. Loading the real
   catalogue rather than a stub also means a key missing from `fr` fails a
   test somewhere instead of hiding behind a mock. */
import "./i18n";
