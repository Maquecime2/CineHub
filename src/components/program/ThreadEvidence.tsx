/* ============================================================
   WHAT THE THREAD OFFERS
   ============================================================

   THE MAP HAD A JOB NO OTHER THREAD HAD ANYBODY TO DO IT. Under a
   filiation, the graph both justifies the order and hands over films to
   lay down (`NodePanel`). Under a motif, a decade or a genre there was
   nothing at all — one had to go to the binder, search, come back, and
   the run one was composing was gone. This is that missing half: the
   cards one HOLDS that carry the thread and are not in the run yet.

   IT SUGGESTS AND IT NEVER FILTERS. A run on the sixties takes a film
   from 1971 gladly — the exception is very often the reason for the run
   — so nothing here refuses anything; it only offers what is easy to
   miss. `matchesThread` is the one door, and it answers `false` for a
   filiation and for a free thread on purpose.

   IT IS FOLDED UNTIL ASKED FOR. It is evidence, and evidence sits under
   the thing it supports — never above the order, which is the subject. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { PosterArt } from "../film/PosterArt";
import { initialsOf } from "../../domain/film";
import { matchesThread } from "../../domain/course";
import type { CourseThread } from "../../domain/course";
import { threadValueLabel } from "./ThreadBar";
import type { Film } from "../../types";

interface ThreadEvidenceProps {
  thread: CourseThread;
  films: Film[];
  /** Les fiches déjà au programme : on n'offre pas un doublon. */
  inCourse: ReadonlySet<string>;
  onAdd: (filmId: string) => void;
  onLook: (film: Film) => void;
}

export function ThreadEvidence({ thread, films, inCourse, onAdd, onLook }: ThreadEvidenceProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!thread.value) return null;
  const holds = films.filter((f) => matchesThread(thread, f));
  const offered = holds.filter((f) => !inCourse.has(f.id));
  if (holds.length === 0) return null;

  return (
    <section
      style={{ marginBottom: 20, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}
      aria-label={t("program.threadEvidence")}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ ...bare, fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {t("program.threadHolds", {
          count: offered.length,
          thread: threadValueLabel(thread, t),
        })}
      </button>

      {open &&
        (offered.length === 0 ? (
          <div
            style={{
              fontFamily: "var(--f-hand)",
              fontSize: 16,
              color: C.inkFaded,
              marginTop: 8,
            }}
          >
            {t("program.threadAllIn")}
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
              display: "flex",
              gap: 10,
              overflowX: "auto",
            }}
          >
            {offered.map((film) => (
              <li key={film.id} style={{ width: 78, flexShrink: 0 }}>
                <button
                  onClick={() => onLook(film)}
                  aria-label={t("program.quickOf", { title: film.title })}
                  /* Voir `ProgressBand` : `plain` exige une boîte
                     positionnée ET haute. */
                  style={{
                    ...bare,
                    display: "block",
                    position: "relative",
                    width: "100%",
                    height: 117,
                    padding: 0,
                  }}
                >
                  <PosterArt film={film} initials={initialsOf(film.title)} width={78} plain lazy />
                </button>
                <div
                  style={{
                    fontFamily: F.body,
                    fontSize: 11,
                    color: C.ink,
                    lineHeight: 1.2,
                    marginTop: 3,
                  }}
                >
                  {film.title}
                </div>
                <button
                  onClick={() => onAdd(film.id)}
                  style={{
                    ...bare,
                    fontFamily: F.mono,
                    fontSize: 9,
                    color: C.plum,
                    marginTop: 2,
                  }}
                >
                  <Plus size={10} />
                  {t("program.addToRun")}
                </button>
              </li>
            ))}
          </ul>
        ))}

      {/* CE QUE LE FIL ROUGE TIENT DÉJÀ, dit en un chiffre : sans lui, un
          parcours de deux films sur un motif qu'on en a trente ne se
          distingue pas d'un parcours qui les tient tous. */}
      <div style={{ fontFamily: F.mono, fontSize: 9, color: alpha(C.ink, 0.45), marginTop: 8 }}>
        {t("program.threadCount", { held: holds.length - offered.length, total: holds.length })}
      </div>
    </section>
  );
}
