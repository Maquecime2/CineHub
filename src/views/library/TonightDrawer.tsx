/* ============================================================
   THE EVENING DRAWER

   One says how much time one has and what mood one is in, the binder
   decides. It offers only ONE film at a time: a list of ten would bring
   back the very problem one came to solve, which is precisely not
   knowing how to choose from a list. "Une autre" goes down one notch.

   We do not mark the film as seen from here. We are BEFORE the film, not
   after: "JE L'AI VU" already exists on the card, and that is where it
   makes sense.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { Layer } from "../../components/ui/Layer";
import { X, Dice5, ArrowRight, Loader2 } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { PosterArt } from "../../components/film/PosterArt";
import { Label, NoKey } from "../../components/ui";
import { initialsOf } from "../../domain/film";
import { MOTIFS, suggestMotifs } from "../../domain/motifs";
import { rankTheEvening, listLanguages, SLOTS, type Craving } from "../../domain/tonight";
import { languageName } from "../../names";
import { useTmdbKey } from "../../services/tmdbKey";
import { fetchKeywords, pooled } from "../../tmdb";
import type { Film } from "../../types";

/* The mood is said in the "le ton" family and nowhere else: "il pleut à
   la fin" tells a film, "mélancolie" says what state one is in tonight.
   These are two vocabularies, and the second is exactly the one we were
   after. */
const MOODS = MOTIFS.filter((m) => m.family === "tone" && !m.spoiler);

/* Beyond that, guessing the mood would cost more waiting than the
   question is worth. We ask for the keywords of the best placed only —
   the ranking without a mood is already a ranking. */
const GUESS_CAP = 40;

export function TonightDrawer({
  films,
  onClose,
  onOpen,
}: {
  /** The WHOLE collection: the taste profile is built on the films seen. */
  films: Film[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [humeur, setHumeur] = useState<string[]>([]);
  const [langues, setLangues] = useState<string[]>([]);
  const [rank, setRang] = useState(0);
  const [guessed, setGuessed] = useState<Map<string, string[]>>(new Map());
  const [query, setQuery] = useState(false);

  const apiKey = useTmdbKey();
  const craving: Craving = { minutes, mood: humeur, languages: langues };

  const available = useMemo(() => listLanguages(films), [films]);
  const suggestions = useMemo(
    () => rankTheEvening(films, craving, guessed),
    // `envie` is rebuilt on every render: we depend on its parts
    [films, minutes, humeur, langues, guessed]
  );

  /* Changing one's mind resets the pile: "une autre" means "the next of
     THIS ranking", and keeping the rank after changing the slot would
     skip proposals never shown. */
  useEffect(() => {
    setRang(0);
  }, [minutes, humeur, langues]);

  /* GUESSING THE MOOD OF THE FILMS ONE HAS NOT SEEN.

     An unseen film carries no pattern — nobody can say "il pleut à la
     fin" of a film they have not seen. TMDB's keywords answer that, and
     `suggestMotifs` already knows how to translate them into patterns:
     that is how the card offers them.

     We do it ONLY if a mood is asked for, and only on the best placed of
     the current ranking: without that, asking the question would fire
     one call per film of the whole list. `pooled` bounds the concurrency
     and swallows the failures — one lost keyword must not cancel the
     evening. */
  useEffect(() => {
    if (!apiKey || humeur.length === 0) return;
    const toGuess = suggestions
      .slice(0, GUESS_CAP)
      .map((p) => p.film)
      .filter((f) => f.tmdbId && !guessed.has(f.id));
    if (toGuess.length === 0) return;

    let alive = true;
    setQuery(true);
    pooled(
      toGuess.map((f) => async () => {
        const words = await fetchKeywords(f.tmdbId, apiKey);
        return [f.id, suggestMotifs(words).map((m) => m.id)] as [string, string[]];
      }),
      { concurrency: 5 }
    )
      .then((pairs: ([string, string[]] | null)[]) => {
        if (!alive) return;
        setGuessed((before) => {
          const next = new Map(before);
          /* The films whose guess failed are marked EMPTY and not left
             absent: without that trace, the effect would ask for them
             again on every render, indefinitely. */
          for (const f of toGuess) next.set(f.id, []);
          for (const p of pairs) if (p) next.set(p[0], p[1]);
          return next;
        });
      })
      .finally(() => {
        if (alive) setQuery(false);
      });

    return () => {
      alive = false;
    };
  }, [apiKey, humeur, suggestions, guessed]);

  // Escape closes, as everywhere else
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const choice = suggestions[rank] || null;
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  /* MOUNTED ON THE BODY OF THE PAGE, NOT WHERE IT IS CALLED FROM.

     The views live in the `[data-enters]` column, which carries a
     transform for the duration of its entry animation — and a transform
     becomes the frame of reference for the `position: fixed` it
     contains. The drawer would then anchor itself on the column, hence
     on the top of the document, and would open off screen when asked for
     from the bottom of a long wall. The trap has already bitten once, on
     the confirmation request. */
  return (
    <Layer>
      <>
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(20,14,8,0.5)" }}
        />
        <div
          role="dialog"
          aria-label="Lequel ce soir ?"
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "min(430px, 92vw)",
            zIndex: 60,
            background: C.paper,
            borderLeft: `1px solid ${C.line}`,
            boxShadow: "-6px 0 24px rgba(0,0,0,0.28)",
            overflowY: "auto",
            padding: "26px 26px 40px",
            animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div
              style={{
                fontFamily: F.title,
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 27,
                color: C.ink,
              }}
            >
              Lequel ce soir ?
            </div>
            <button onClick={onClose} aria-label="Fermer" style={{ ...nu, marginLeft: "auto" }}>
              <X size={16} color={C.inkFaded} />
            </button>
          </div>
          <div
            style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, margin: "2px 0 20px" }}
          >
            Dites le temps que vous avez, et dans quel état vous êtes.
          </div>

          {/* ---- le temps ---- */}
          <div data-tour="soir-temps" style={{ marginBottom: 18 }}>
            <Label>J'ai</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button onClick={() => setMinutes(null)} style={chip(minutes === null)}>
                peu importe
              </button>
              {SLOTS.map((c) => (
                <button
                  key={c.minutes}
                  onClick={() => setMinutes(c.minutes)}
                  style={chip(minutes === c.minutes)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* ---- l'humeur ---- */}
          <div data-tour="soir-humeur" style={{ marginBottom: 18 }}>
            <Label>Je suis d'humeur</Label>
            {!apiKey && (
              /* Without a key, the patterns of an unseen card do not
               exist and nothing can guess them. We say so rather than
               leave a wheel that answers to nothing. */
              <NoKey what="deviner l'humeur d'un film que vous n'avez pas encore annoté" />
            )}
            {!apiKey && (
              <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, margin: "6px 0" }}>
                en attendant, l&apos;humeur se lit sur vos propres motifs.
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setHumeur((h) => toggle(h, m.id))}
                  style={chip(humeur.includes(m.id), C.cobalt)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ---- la langue, s'il y a de quoi choisir ---- */}
          {available.length > 1 && (
            <div style={{ marginBottom: 22 }}>
              <Label>En</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {available.slice(0, 8).map(({ code, n }) => (
                  <button
                    key={code}
                    onClick={() => setLangues((l) => toggle(l, code))}
                    style={chip(langues.includes(code), C.moss)}
                  >
                    {languageName(code)} · {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 18 }}>
            {query && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                  marginBottom: 10,
                }}
              >
                <Loader2 size={12} /> on lit ce que TMDB dit de ces films…
              </div>
            )}

            {!choice ? (
              <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded }}>
                {suggestions.length === 0
                  ? "Rien dans « à voir » ne répond — ou la liste est vide."
                  : "Vous les avez tous passés en revue."}
              </div>
            ) : (
              <CravingCard
                choice={choice}
                rank={rank}
                total={suggestions.length}
                onAutre={() => setRang((r) => r + 1)}
                onOuvrir={() => {
                  onOpen(choice.film.id);
                  onClose();
                }}
              />
            )}
          </div>
        </div>
      </>
    </Layer>
  );
}

function CravingCard({
  choice,
  rank,
  total,
  onAutre,
  onOuvrir,
}: {
  choice: ReturnType<typeof rankTheEvening>[number];
  rank: number;
  total: number;
  onAutre: () => void;
  onOuvrir: () => void;
}) {
  const f = choice.film;
  return (
    <div data-tour="soir-carte">
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ width: 96, flexShrink: 0 }}>
          <PosterArt film={f} height={144} initials={initialsOf(f.title)} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: F.title, fontWeight: 700, fontSize: 19, color: C.ink }}>
            {f.title}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 3 }}>
            {[f.year || "s.d.", f.director].filter(Boolean).join(" · ")}
          </div>
          {/* THE REASONS, IN THE CLEAR. A score cannot be argued with;
              a sentence can — and it is what makes one want to watch, or
              not. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
            {choice.reasons.map((r, i) => (
              <span
                key={i}
                style={{
                  fontFamily: F.mono,
                  fontSize: 9,
                  letterSpacing: 0.4,
                  padding: "2px 7px",
                  borderRadius: 10,
                  border: `1px solid ${alpha(C.ink, 0.18)}`,
                  color: C.inkFaded,
                }}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <button onClick={onOuvrir} style={{ ...chip(true), padding: "5px 12px" }}>
          <ArrowRight size={11} /> sa fiche
        </button>
        <button
          onClick={onAutre}
          disabled={rank + 1 >= total}
          style={{
            ...chip(false, C.slate),
            padding: "5px 12px",
            opacity: rank + 1 >= total ? 0.4 : 1,
            cursor: rank + 1 >= total ? "default" : "pointer",
          }}
        >
          <Dice5 size={11} /> une autre
        </button>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded, marginLeft: "auto" }}>
          {rank + 1} / {total}
        </span>
      </div>
    </div>
  );
}

const nu = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

const chip = (on: boolean, tint: string = C.burgundy) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: F.mono,
  fontSize: 9.5,
  letterSpacing: 0.5,
  padding: "3px 9px",
  borderRadius: 12,
  border: `1px solid ${tint}`,
  background: on ? tint : "transparent",
  color: on ? C.card : tint,
  transition: "background var(--motion-fast) ease, color var(--motion-fast) ease",
});
