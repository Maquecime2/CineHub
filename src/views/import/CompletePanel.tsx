/* ============================================================
   COMPLETING THE CARDS — filling the holes from TMDB
   ============================================================

   An old card carries neither cast, nor runtime, nor country: those
   fields arrived after it, and `migrate` can only lay them empty — it
   runs at load time, offline and with no key.

   Until now the only path to filling them was to drop one's Letterboxd
   export again, which is absurd: the file contains none of that, it only
   serves to trigger the TMDB calls. So we trigger the calls directly,
   from the collection itself.

   NOTHING NEW UNDER THE HOOD. We build import rows out of the cards, and
   we pass them to the existing chain — `enrichRows`, which already has
   the cache, the concurrency limit and the progress report, then
   `diffImport`, which shows before writing. A second writing path would
   be a second place where the merge can go wrong.

   TWO GUARD RAILS, AND THE SECOND IS THE MORE IMPORTANT.

   1. We only query the INCOMPLETE cards. Without that sorting,
      completing three films would ask TMDB for five hundred.

   2. We set `toCreate` aside. `diffImport` creates a card when nothing
      matches; but here every row COMES OUT of a card. A non-match can
      therefore mean only one thing: the matching key does not find
      itself — which happens, the project's `slugOf` having a known flaw
      on titles beginning with "Les". Letting the creation through would
      then make a DUPLICATE of the very card one wanted to complete. */
import { useState } from "react";
import { Sparkles, Tags } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Tally } from "../../components/ui";
import { enrichRows } from "../../tmdb";
import { diffImport } from "../../domain/importing";
import { isIncomplete, withoutKeywords } from "../../domain/film";
import type { Film, ImportDiff, ImportRow } from "../../types";

interface CompletePanelProps {
  films: Film[];
  apiKey: string;
  onImport: (diff: ImportDiff) => void;
}

export function CompletePanel({ films, apiKey, onImport }: CompletePanelProps) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [msg, setMsg] = useState("");

  const toDo = films.filter(isIncomplete);
  /* The cards without a single keyword — the absence AND the emptiness.
     A whole collection was frozen at `[]` by a harvest flaw, and
     `isIncomplete` cannot see them: see `domain/film`. */
  const noSubjects = films.filter(withoutKeywords);

  const run = async (targets: Film[]) => {
    const key = apiKey.trim();
    if (!key || targets.length === 0) return;
    setMsg("");
    setDiff(null);
    setProgress({ done: 0, total: targets.length });

    /* One row per card. `tmdbId` when we have it: it avoids a search by
       title, and above all the false positives of `searchMovie`, which
       takes the first result without comparing. */
    const rows: ImportRow[] = targets.map((f) => ({
      title: f.title,
      year: f.year,
      rating: null,
      watchedAt: null,
      uri: null,
      tmdbId: f.tmdbId ?? null,
    }));

    try {
      const res = await enrichRows(rows, key, {
        onProgress: (d: number, t: number) => setProgress({ done: d, total: t }),
      } as never);

      /* `keepStatus` IS NOT A PRECAUTION, IT IS THE POINT.

         This panel goes and fetches a runtime and a cast: it has learned
         nothing about what you have watched. The status passed here only
         served the created cards — and since we create none, it was
         believed inert. It was not: `diffImport` also uses it to move
         existing cards from "à voir" to "vu", and completing one's
         collection emptied the watchlist into the film library. */
      const raw = diffImport(films, res.rows as ImportRow[], "watched", {
        keepStatus: true,
      });
      setDiff(raw);
      if (raw.toCreate.length)
        console.warn(
          "compléter : lignes sans fiche correspondante, écartées",
          raw.toCreate.map((f) => f.title)
        );
      if (res.failed) setMsg(`${res.failed} fiche(s) introuvable(s) chez TMDB.`);
    } catch (e) {
      setMsg((e as Error).message || "TMDB n'a pas répondu.");
    } finally {
      setProgress(null);
    }
  };

  const write = () => {
    if (!diff) return;
    // toCreate is deliberately emptied: see the file's header
    onImport({ toCreate: [], toUpdate: diff.toUpdate, unchanged: diff.unchanged });
    setMsg(`${diff.toUpdate.length} fiche(s) complétée(s).`);
    setDiff(null);
  };

  return (
    <div
      style={{
        marginTop: 34,
        border: `1px solid ${C.line}`,
        background: C.card,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          color: C.inkFaded,
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        COMPLÉTER LES FICHES DEPUIS TMDB
      </div>

      <Tally label="fiches dans la collection" value={films.length} />
      <Tally
        label="fiches à compléter"
        value={toDo.length}
        ink={toDo.length ? C.burgundy : C.pine}
      />
      {/* The keywords counted separately: they arrived after the rest,
          and an already completed collection has them all at zero.
          Saying so avoids believing that "cards to complete" has counted
          wrong. */}
      {/* Emptiness counts as a lack: a card frozen at "asked for, there
          are none" has no more subjects than a card never queried, and
          it is that number one wants to see go down. */}
      <Tally label="fiches sans mots-clés TMDB" value={noSubjects.length} ink={C.inkFaded} />

      <div
        style={{
          fontFamily: F.hand,
          fontSize: 17,
          color: C.inkFaded,
          margin: "10px 0 12px",
          lineHeight: 1.35,
        }}
      >
        {toDo.length === 0
          ? "Tout est déjà rempli — rien à demander à TMDB."
          : "Va chercher le casting, l’équipe, la durée, le pays, la langue et les mots-clés des fiches qui n’en ont pas. Les mots-clés sont ce qui permet au sillage d’un film de rapprocher deux fiches autrement que par les noms de leur équipe. Rien n’est écrit avant que vous ayez vu le détail."}
      </div>

      {progress && (
        <div style={{ margin: "10px 0" }}>
          <div style={{ height: 4, background: C.paperDark, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                right: `${100 - (progress.done / progress.total) * 100}%`,
                background: C.burgundy,
              }}
            />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 5 }}>
            {progress.done} / {progress.total} interrogés…
          </div>
        </div>
      )}

      {diff && (
        <div style={{ margin: "12px 0" }}>
          <Tally label="fiches à compléter" value={diff.toUpdate.length} ink={C.burgundy} />
          <Tally label="fiches déjà à jour" value={diff.unchanged.length} />
          {diff.toUpdate.length > 0 && (
            <div
              style={{
                marginTop: 8,
                maxHeight: 150,
                overflowY: "auto",
                fontFamily: F.body,
                fontSize: 12.5,
                color: C.ink,
              }}
            >
              {diff.toUpdate.slice(0, 40).map(({ film, changes }) => (
                <div key={film.id} style={{ display: "flex", gap: 8, padding: "2px 0" }}>
                  <span style={{ flex: 1 }}>{film.title}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                    {Object.keys(changes).join(" · ")}
                  </span>
                </div>
              ))}
              {diff.toUpdate.length > 40 && (
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 4 }}>
                  … et {diff.toUpdate.length - 40} others
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => run(toDo)}
          disabled={!apiKey.trim() || toDo.length === 0 || !!progress}
          style={{
            all: "unset",
            ...tap,
            cursor: !apiKey.trim() || toDo.length === 0 || progress ? "default" : "pointer",
            opacity: !apiKey.trim() || toDo.length === 0 || progress ? 0.45 : 1,
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 14px",
            background: C.slate,
            color: C.card,
            fontFamily: F.mono,
            fontSize: 10.5,
          }}
        >
          <Sparkles size={13} />
          {progress ? "EN COURS…" : `COMPLÉTER ${toDo.length} FICHE(S)`}
        </button>

        {/* THE KEYWORD CATCH-UP, separate and deliberate.

            A harvest flaw froze whole collections at "asked for, there
            are none": nothing could repair them any more, since
            everything that fills targets absence only. This button
            targets emptiness TOO. It is distinct from the first because
            it costs one call per targeted card — the number is written
            on it, and it is up to the user to decide. */}
        {noSubjects.length > 0 && (
          <button
            onClick={() => run(noSubjects)}
            disabled={!apiKey.trim() || !!progress}
            title="Redemande les mots-clés, y compris pour les fiches qui avaient répondu vide"
            style={{
              all: "unset",
              cursor: !apiKey.trim() || progress ? "default" : "pointer",
              opacity: !apiKey.trim() || progress ? 0.45 : 1,
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 14px",
              border: `1px solid ${C.slate}`,
              color: C.slate,
              fontFamily: F.mono,
              fontSize: 10.5,
            }}
          >
            <Tags size={13} />
            REDEMANDER LES WORDS-CLÉS ({noSubjects.length})
          </button>
        )}

        {diff && diff.toUpdate.length > 0 && (
          <button
            onClick={write}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              padding: "8px 14px",
              background: C.burgundy,
              color: C.card,
              fontFamily: F.mono,
              fontSize: 10.5,
            }}
          >
            ÉCRIRE LES {diff.toUpdate.length} MODIFICATIONS
          </button>
        )}
      </div>

      {!apiKey.trim() && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy, marginTop: 8 }}>
          Il faut de quoi interroger TMDB : une clé, plus haut — ou un compte, qui vous en dispense.
        </div>
      )}
      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginTop: 8 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
