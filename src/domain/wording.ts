/* ============================================================
   WHAT THE DOMAIN SAYS, WITHOUT SAYING IT IN A LANGUAGE
   ============================================================

   `src/domain/` is pure and tested, and it stopped speaking French the
   day the binder learnt a second language. It could not simply start
   speaking English instead: a rule that computes WHY a film is proposed
   tonight has no business knowing which tongue the reader chose.

   So it returns one of two things, and the difference matters:

     { key: "tonight.fits", values: { minutes: 108 } }
        — words WE own. There is one sentence per language for them, in
          the catalogue, and the view fetches whichever is in force.

     { text: "Chantal Akerman" }
        — words the USER owns: a name, a title, a motif they wrote
          themselves. They are never translated, in either language,
          because they are not ours to translate.

   The view resolves both through `say`. The domain never imports
   i18next, and its tests assert keys — which is what they were always
   really about.
   ============================================================ */

export type Wording =
  | { text: string; key?: never; values?: never }
  | { key: string; values?: Values; text?: never };

/**
 * A wording may hold another: "not seen again for {{since}}" where the
 * since is itself "two years" / "deux ans". Nesting rather than pasting
 * keeps the plural where the language is — in the catalogue.
 */
export type Values = Record<string, string | number | Wording>;

/** Words the user owns. */
export const words = (text: string): Wording => ({ text });

/** Words we own, in the catalogue. */
export const saying = (key: string, values?: Values): Wording => ({ key, values });

/**
 * Turns a wording into a sentence.
 *
 * `t` is passed in rather than imported so this stays usable from a
 * canvas, a title attribute or a test — anywhere there is no component
 * to hang a hook on.
 */
export const say = (
  w: Wording,
  t: (key: string, values?: Record<string, string | number>) => string
): string => {
  if (w.text !== undefined) return w.text;
  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(w.values ?? {}))
    values[name] =
      typeof value === "object" ? say(value, t) : (value as string | number);
  return t(w.key!, values);
};
