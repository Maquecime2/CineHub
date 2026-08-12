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

   THE DISPLAY LOCALE STAYS `fr`: these names are shown in the
   interface, which is in French. */
const nameOf = (type: "region" | "language") => {
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames(["fr"], { type });
  } catch {
    dn = null;
  }
  return (code: string): string => {
    try {
      return dn?.of(code) || code;
    } catch {
      return code;
    }
  };
};

export const countryName = nameOf("region");
export const languageName = nameOf("language");
