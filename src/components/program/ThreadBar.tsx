/* ============================================================
   THE RED THREAD OF A RUN
   ============================================================

   A RUN WAS ALWAYS ABOUT SOMETHING, AND ONLY ONE ANSWER WAS SPEAKABLE.
   Film-maker filiations were the first way of saying what held a plan
   together, and having been the only way they became the whole screen:
   a map at the top of a view whose subject is an ORDER. The thread is
   now a choice — a filiation, a motif, a decade, a genre, or a sentence
   one writes oneself — and the map is what ONE of those five draws.

   THE KIND IS A `radiogroup` OF RIBBONS, not a `<select>`, for the same
   reason `BondPicker` is: the five are the vocabulary of this screen and
   hiding them behind a closed control makes four of them undiscoverable.

   THE VALUES COME FROM THE COLLECTION, NEVER FROM A CATALOGUE. Offering
   every motif in the vocabulary, or the four hundred years a `<select>`
   would hold, is offering a run that cannot be filled: what one can be
   shown is what one HOLDS. It also keeps the list short enough to be
   chips rather than a field — and a run kept from another device may
   name a value no card carries any more, so the value in force is
   always drawn, in place, even when nothing offers it. */
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare, chip } from "../../theme/styles";
import { decadeOf, DEFAULT_THREAD } from "../../domain/course";
import type { CourseThread, ThreadKind } from "../../domain/course";
import { motifById, motifLabel } from "../../domain/motifs";
import type { Film } from "../../types";

const KINDS: ThreadKind[] = ["filiation", "motif", "decade", "genre", "free"];

/** Ce qu'un choix de nature propose, tiré de ce qu'on possède. */
export const valuesFor = (kind: ThreadKind, films: Film[]): string[] => {
  const seen = new Map<string, number>();
  const bump = (v: string) => v && seen.set(v, (seen.get(v) ?? 0) + 1);
  for (const film of films) {
    if (kind === "motif") film.motifs.forEach(bump);
    else if (kind === "genre") film.genres.forEach(bump);
    else if (kind === "decade") bump(decadeOf(film));
  }
  /* Les plus portées d'abord : c'est ce dont on peut faire un parcours.
     À égalité, l'ordre alphabétique, pour que la bande ne danse pas
     d'un rendu à l'autre. */
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([v]) => v)
    .slice(0, 24);
};

/** Le nom lisible d'une valeur de fil rouge. */
export const threadValueLabel = (
  thread: CourseThread,
  name: (k: string, v?: Record<string, string | number>) => string
): string => {
  if (thread.kind !== "motif") return thread.value;
  const motif = motifById(thread.value);
  return motif ? motifLabel(motif, name) : thread.value;
};

interface ThreadBarProps {
  thread: CourseThread;
  films: Film[];
  onThread: (next: CourseThread) => void;
}

export function ThreadBar({ thread, films, onThread }: ThreadBarProps) {
  const { t } = useTranslation();
  const offered = valuesFor(thread.kind, films);
  /* La valeur en cours est TOUJOURS dessinée, même si plus une fiche ne
     la porte : sinon changer d'appareil ferait disparaître le sujet du
     parcours sans qu'un mot le dise. */
  const values =
    thread.value && !offered.includes(thread.value) ? [thread.value, ...offered] : offered;

  return (
    <div data-tour="program-thread" style={{ marginTop: 14 }}>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          letterSpacing: 1.3,
          color: C.inkFaded,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {t("program.threadLabel")}
      </div>

      <div
        role="radiogroup"
        aria-label={t("program.threadLabel")}
        style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
      >
        {KINDS.map((kind) => {
          const on = thread.kind === kind;
          return (
            <button
              key={kind}
              role="radio"
              aria-checked={on}
              onClick={() =>
                onThread(kind === DEFAULT_THREAD.kind ? DEFAULT_THREAD : { kind, value: "" })
              }
              style={{
                ...bare,
                ...chip,
                flexShrink: 0,
                color: on ? C.card : C.inkFaded,
                background: on ? C.plum : "transparent",
                borderColor: on ? C.plum : C.line,
              }}
            >
              {t(`program.thread_${kind}`)}
            </button>
          );
        })}
      </div>

      {/* NI `filiation` NI `free` NE PRENNENT DE VALEUR : l'une se lit
          dans les liens entre personnes, l'autre est la thèse écrite
          au-dessus. Leur offrir un champ vide ferait chercher quoi y
          mettre. */}
      {(thread.kind === "motif" || thread.kind === "decade" || thread.kind === "genre") && (
        <div style={{ marginTop: 8 }}>
          {values.length === 0 ? (
            <div style={{ fontFamily: "var(--f-hand)", fontSize: 16, color: C.inkFaded }}>
              {t("program.threadNothingHeld")}
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label={t("program.threadValue")}
              style={{ display: "flex", gap: 5, flexWrap: "wrap" }}
            >
              {values.map((value) => {
                const on = thread.value === value;
                return (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={on}
                    onClick={() => onThread({ kind: thread.kind, value: on ? "" : value })}
                    style={{
                      ...bare,
                      ...chip,
                      flexShrink: 0,
                      fontSize: 10,
                      color: on ? C.plum : C.inkFaded,
                      background: on ? alpha(C.plum, 0.12) : "transparent",
                      borderColor: on ? C.plum : C.line,
                    }}
                  >
                    {threadValueLabel({ kind: thread.kind, value }, t)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
