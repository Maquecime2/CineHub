/* ============================================================
   COUNTRY AND LANGUAGE NAMES
   ============================================================

   The domain returns ISO codes because it does not know what language it
   will be read in; the views do know. Two of them knew — the almanac and
   the card — hence this module: one table, and not two translations of
   the same code drifting apart.

   `Intl.DisplayNames` does the work with no table at all to keep up to
   date: two hundred and fifty countries and seven thousand languages
   already live in the browser. The fallback is the code itself — better
   to read "ZZ" than a blank.

   THE DISPLAY LOCALE FOLLOWS THE READER, and that is the whole point of
   this module now: it used to be pinned to `fr`, so an English screen
   said "Japon" and "japonais" beside "RUNNING TIME". `Intl` is asked in
   whichever language is in force, and the makers are cached per locale —
   building a `DisplayNames` on every poster would be wasteful. */
const caches: Record<string, (code: string) => string> = {};

const nameOf = (type: "region" | "language", lang: string) => {
  const key = `${type}:${lang}`;
  const already = caches[key];
  if (already) return already;

  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames([lang], { type });
  } catch {
    dn = null;
  }
  const make = (code: string): string => {
    try {
      return dn?.of(code) || code;
    } catch {
      return code;
    }
  };
  caches[key] = make;
  return make;
};

export const countryName = (code: string, lang: string): string => nameOf("region", lang)(code);
export const languageName = (code: string, lang: string): string => nameOf("language", lang)(code);
