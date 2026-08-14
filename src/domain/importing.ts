/* ============================================================
   IMPORT — reading the CSV, matching, merging
   ============================================================ */
import { makeFilm, mergeWatches, withWatches } from "./film";
import type { Film, FilmStatus, ImportDiff, ImportRow, ParsedCsv, Year } from "../types";

/* The matching key: case, accents, punctuation and leading article all
   neutralised, so that "Le Samouraï" and "Le Samourai" are one film. */
export const slugOf = (title = ""): string =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(le|la|les|the|a|an|l')\s*/, "")
    .replace(/[^a-z0-9]+/g, "");

export const filmKey = (f: { title: string; year?: Year }): string =>
  `${slugOf(f.title)}|${f.year || ""}`;

/* A missing rating is null ("not rated"), not 0: the distinction decides
   whether a re-import should overwrite an existing rating or leave it
   alone. */
export const parseRating = (raw: unknown): number | null => {
  if (raw == null) return null;
  const s = String(raw).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, Math.round(n * 2) / 2));
};

type CsvRow = Record<string, unknown>;

const pick = (row: CsvRow, names: string[]): string => {
  for (const n of names)
    if (row[n] != null && String(row[n]).trim() !== "") return String(row[n]).trim();
  return "";
};

/* Reads a Letterboxd export (ratings / diary / watched / watchlist).
   Returns the deduplicated rows, the guessed file kind, and enough to
   check what was actually read. */
/* LE LECTEUR DE CSV N'ARRIVE QU'AVEC LE FICHIER.

   `papaparse` ne sert qu'ici, c'est-à-dire au moment où quelqu'un dépose
   une exportation Letterboxd — un geste rare, et le seul de
   l'application. Importé en tête, il voyageait dans le paquet principal
   et se chargeait chez tout le monde, y compris chez ceux qui n'ont
   jamais eu de compte Letterboxd. Il se charge maintenant pendant que
   l'on choisit le fichier, ce qui ne coûte aucune attente visible. */
export async function parseLetterboxdCsv(file: File): Promise<ParsedCsv> {
  const { default: Papa } = await import("papaparse");
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta?.fields || [];
        // watched.csv and watchlist.csv have the same columns (Date, Name,
        // Year, URI): only the file name tells them apart. So we trust that
        // first, and fall back on the columns if it has been renamed.
        const name = (file.name || "").toLowerCase();
        const hasRating = headers.some((h) => /^rating$/i.test(h));
        const hasWatchedDate = headers.some((h) => /^watched date$/i.test(h));
        const kind: FilmStatus = /watchlist/.test(name)
          ? "watchlist"
          : /watched|ratings|diary|reviews/.test(name)
            ? "watched"
            : hasRating || hasWatchedDate
              ? "watched"
              : "watchlist";

        let skippedNoTitle = 0;
        let extraWatches = 0; // the additional screenings, which are NOT duplicates
        const byKey = new Map<string, ImportRow>();

        for (const r of res.data) {
          const title = pick(r, ["Name", "name", "Title", "title"]);
          if (!title) {
            skippedNoTitle++;
            continue;
          }
          const yearRaw = pick(r, ["Year", "year"]);
          /* A DATE IS NOT A SCREENING. "Watched Date" (diary) is one: it
             says the day the film was seen. "Date" never is — it is the
             day the card was added in watched.csv, the day the rating was
             set in ratings.csv. Turning it into a screening gave a film
             seen ONCE two entries in the log as soon as you dropped
             watched.csv and then diary.csv, and a "×2" on a card nobody
             had watched again. It is still good for dating the card, and
             for nothing else. */
          const screening = pick(r, ["Watched Date"]);
          const watchedAt = screening || pick(r, ["Date", "date"]);
          const rating = parseRating(pick(r, ["Rating", "rating"]) || null);
          const rewatch = /^(yes|true|1)$/i.test(pick(r, ["Rewatch", "rewatch"]));
          const row: ImportRow = {
            title,
            year: yearRaw ? Number(yearRaw) || "" : "",
            rating,
            watchedAt: watchedAt || null,
            uri: pick(r, ["Letterboxd URI"]) || null,
            /* The screening THIS line carries — if it carries one. Only
               diary.csv records them; watched.csv and ratings.csv say that
               a film was seen and rated, never when. */
            watches: screening ? [{ date: screening, rating, ...(rewatch && { rewatch }) }] : [],
          };
          /* diary.csv has one line per viewing. We now STACK them: they do
             not contradict each other, they follow one another. The card
             stays unique — it is the log that gets longer, not the video
             library. The head fields (rating, date) go on reflecting the
             most recent screening, so that all the downstream merging
             keeps the same view as before. */
          const k = filmKey(row);
          const prev = byKey.get(k);
          if (!prev) {
            byKey.set(k, row);
            continue;
          }
          const watches = mergeWatches(prev.watches, row.watches);
          extraWatches += Math.max(0, watches.length - (prev.watches?.length || 0));
          const recent = (row.watchedAt || "") >= (prev.watchedAt || "");
          byKey.set(k, {
            ...prev,
            ...(recent ? row : null),
            rating: (recent ? row.rating : prev.rating) ?? prev.rating ?? row.rating,
            watches,
          });
        }

        const rows = [...byKey.values()];
        resolve({
          rows,
          kind,
          stats: {
            lines: res.data.length,
            total: rows.length,
            /* A rewatch is not a duplicate: it is one more screening, and
               announcing it as a reject would suggest we had lost
               something when we have in fact just kept it. */
            duplicatesInFile: res.data.length - skippedNoTitle - rows.length - extraWatches,
            withRating: rows.filter((r) => r.rating != null).length,
            withoutRating: rows.filter((r) => r.rating == null).length,
            skippedNoTitle,
          },
        });
      },
      error: (err) => reject(err),
    });
  });
}

export interface DiffOptions {
  /* THE FILE IS AUTHORITATIVE ON SCREENINGS: its log REPLACES the card's
     instead of completing it.

     By default we complete, and that is the right rule: a `diary.csv`
     brings old screenings we did not have, and nothing must be lost. But
     completing does not know how to undo, and a card that has picked up a
     screening that was not one keeps it forever. Dropping the diary in
     again and declaring it SOLE MASTER puts the log straight — it is the
     only path that removes a screening without one having been removed by
     hand. */
  authoritativeWatches?: boolean;
  /* DO NOT TOUCH THE STATUS OF EXISTING CARDS.

     `status` serves two very different purposes: it decides which shelf
     CREATED cards land on, and it flips existing cards from "to watch" →
     "watched" when an export of watched films mentions them. The second
     is right when you drop a diary in — it is the whole point.

     It is catastrophic when the caller is not talking about viewing at
     all. "Complete the cards" enriches from TMDB and passed `"watched"`
     for want of anything better, believing that status inert since it
     creates nothing: it emptied whole watchlists into the video library,
     at the touch of one button, on the most incomplete cards — that is to
     say, precisely the ones we had not seen.

     Hence this switch, and its name: what the caller refuses to decide
     must be written down, not inferred. */
  keepStatus?: boolean;
}

/* Compares the CSV against the video library without writing anything:
   this diff is what gets shown on screen before confirmation. */
export function diffImport(
  existing: Film[],
  rows: ImportRow[],
  status: FilmStatus,
  { authoritativeWatches = false, keepStatus = false }: DiffOptions = {}
): ImportDiff {
  const byTmdb = new Map(existing.filter((f) => f.tmdbId).map((f) => [String(f.tmdbId), f]));
  const byKey = new Map(existing.map((f) => [filmKey(f), f]));

  const toCreate: ImportDiff["toCreate"] = [];
  const toUpdate: ImportDiff["toUpdate"] = [];
  const unchanged: ImportDiff["unchanged"] = [];

  for (const r of rows) {
    const match = (r.tmdbId && byTmdb.get(String(r.tmdbId))) || byKey.get(filmKey(r));
    if (!match) {
      const fresh = makeFilm({
        title: r.title,
        year: r.year,
        director: r.director || "",
        poster: r.poster || "",
        genres: r.genres || [],
        cast: r.cast || [],
        crew: r.crew || {},
        runtime: r.runtime ?? null,
        language: r.language || "",
        countries: r.countries || [],
        tmdbRating: r.tmdbRating ?? null,
        keywords: r.keywords,
        tmdbId: r.tmdbId || null,
        rating: r.rating ?? 0,
        status,
        source: "letterboxd",
        /* When the source knows in what order the cards were set aside, we
           believe it: otherwise the five hundred films of a single export
           would all carry the same millisecond, and sorting "by date
           added" would return a random order. */
        ...(r.addedAt ? { addedAt: r.addedAt } : null),
      });
      /* `withWatches` sets the log AND the date: writing them separately
         would be the first place the two could drift apart. A film "to
         watch" obviously has no screening. */
      const made = status === "watched" ? withWatches(fresh, r.watches || []) : fresh;
      /* A card with no screening can still be dated: watched.csv knows we
         saw the film, not when. An approximate date beats a void — it is
         what files the video library — but it does not enter the log for
         all that. */
      if (status === "watched" && !made.watchedAt && r.watchedAt) made.watchedAt = r.watchedAt;
      toCreate.push(made);
      continue;
    }

    // Cautious merging: the CSV's rating is authoritative, but everything
    // written by hand (review, notes, themes, red thread) is untouchable.
    const changes: Partial<Film> = {};
    if (r.rating != null && r.rating !== match.rating) changes.rating = r.rating;
    if (r.director && !match.director) changes.director = r.director;
    if (r.genres?.length && !(match.genres || []).length) changes.genres = r.genres;
    /* THE CAST IS FILLED IN, IT IS NOT CORRECTED. Like the genres: we only
       fill the void. A card from before the harvest receives one on the
       first re-import; a card that already has one keeps it, because we do
       not know whether TMDB or a hand wrote it. */
    if (r.cast?.length && !(match.cast || []).length) changes.cast = r.cast;
    if (r.crew && Object.keys(r.crew).length && !Object.keys(match.crew || {}).length)
      changes.crew = r.crew;
    /* Runtime, language, countries, public rating: same rules as above —
       we only fill the void. `== null` and not `!match.runtime`: a card
       whose runtime is known must not be queried again, and zero is not a
       missing runtime but wrong data we never write (see `getDetails`). */
    if (r.runtime != null && match.runtime == null) changes.runtime = r.runtime;
    if (r.language && !match.language) changes.language = r.language;
    if (r.countries?.length && !(match.countries || []).length) changes.countries = r.countries;
    if (r.tmdbRating != null && match.tmdbRating == null) changes.tmdbRating = r.tmdbRating;
    /* KEYWORDS ARE WRITTEN EVEN WHEN EMPTY, and that is indispensable.

       The "only fill the void" rule is enough everywhere else. Here it
       loops: a response with NO keyword would write nothing, the card
       would stay "never asked", and "complete" would ask for it again on
       every pass until the end of time. So we write the list, empty or
       not — it is what says "we asked".

       They are NOT your motifs and do not touch them: those are only ever
       written by hand, and a harvest has nothing to say about them. */
    /* We fill the absence — and the EMPTINESS too, when we finally bring
       something back. That is what makes "ask for the keywords again" able
       to repair the cards frozen at `[]` by the old fault. A list already
       filled is never overwritten. */
    if (r.keywords && (match.keywords == null || (r.keywords.length && !match.keywords.length)))
      changes.keywords = r.keywords;
    // a poster chosen by hand is never replaced by TMDB's
    if (r.poster && !match.poster) changes.poster = r.poster;
    if (r.year && !match.year) changes.year = r.year;
    if (r.tmdbId && !match.tmdbId) changes.tmdbId = r.tmdbId;
    /* THE LOG IS COMPLETED, IT IS NOT REPLACED. A `diary.csv` brings old
       screenings we did not have; the merging is done by date, so running
       the same file through again counts nothing twice. We only write if
       the count has moved — otherwise the card would go into "modified"
       for nothing on every re-import. */
    if (status === "watched" && r.watches?.length) {
      const watches = authoritativeWatches
        ? mergeWatches(r.watches)
        : mergeWatches(match.watches, r.watches);
      /* We compare the DATES and not the count: in authoritative mode a
         log can end up as long as before while having changed
         screenings. */
      const dates = (w: { date: string }[]) => w.map((x) => x.date).join("|");
      if (dates(watches) !== dates(match.watches || [])) {
        changes.watches = watches;
        /* The date follows the log, it never sets itself. It moves forward
           on its own as a rule; when the file is authoritative, it moves
           back too — otherwise the card would keep the date of a screening
           we have just erased. */
        if (authoritativeWatches) changes.watchedAt = watches[0]?.date ?? null;
        else if ((watches[0]?.date || "") > (match.watchedAt || ""))
          changes.watchedAt = watches[0]!.date;
      }
    }
    // A date with no recorded screening (ratings.csv) must still MOVE FORWARD.
    if (
      status === "watched" &&
      r.watchedAt &&
      r.watchedAt > (changes.watchedAt || match.watchedAt || "")
    )
      changes.watchedAt = r.watchedAt;
    // a film "to watch" that appears in an export of watched films has been seen
    if (!keepStatus && status === "watched" && match.status !== "watched")
      changes.status = "watched";

    if (Object.keys(changes).length) toUpdate.push({ film: match, changes });
    else unchanged.push(match);
  }
  return { toCreate, toUpdate, unchanged };
}
