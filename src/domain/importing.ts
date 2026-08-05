/* ============================================================
   IMPORT — lecture CSV, appariement, fusion
   ============================================================ */
import Papa from "papaparse";
import { makeFilm, mergeWatches, withWatches } from "./film";
import type { Film, FilmStatus, ImportDiff, ImportRow, ParsedCsv, Year } from "../types";

/* Clé d'appariement : casse, accents, ponctuation et article initial
   neutralisés, pour que « Le Samouraï » et « Le Samourai » soient un seul film. */
export const slugOf = (title = ""): string =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(le|la|les|the|a|an|l')\s*/, "")
    .replace(/[^a-z0-9]+/g, "");

export const filmKey = (f: { title: string; year?: Year }): string =>
  `${slugOf(f.title)}|${f.year || ""}`;

/* Une note absente vaut null (« non noté »), pas 0 : la nuance décide
   si un réimport doit écraser une note existante ou la laisser tranquille. */
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

/* Lit un export Letterboxd (ratings / diary / watched / watchlist).
   Retourne les lignes dédoublonnées, le type de fichier deviné et de quoi
   vérifier ce qui a réellement été lu. */
export function parseLetterboxdCsv(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta?.fields || [];
        // watched.csv et watchlist.csv ont les mêmes colonnes (Date, Name,
        // Year, URI) : seul le nom du fichier les distingue. On s'y fie donc
        // d'abord, et on retombe sur les colonnes s'il a été renommé.
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
        let extraWatches = 0; // les séances en plus, qui ne sont PAS des doublons
        const byKey = new Map<string, ImportRow>();

        for (const r of res.data) {
          const title = pick(r, ["Name", "name", "Title", "title"]);
          if (!title) {
            skippedNoTitle++;
            continue;
          }
          const yearRaw = pick(r, ["Year", "year"]);
          // « Watched Date » (diary) est la vraie date de séance. « Date » ne
          // l'est pas toujours — dans ratings.csv c'est la date de notation —
          // mais elle reste la meilleure approximation disponible ailleurs.
          const watchedAt = pick(r, ["Watched Date", "Date", "date"]);
          const rating = parseRating(pick(r, ["Rating", "rating"]) || null);
          const rewatch = /^(yes|true|1)$/i.test(pick(r, ["Rewatch", "rewatch"]));
          const row: ImportRow = {
            title,
            year: yearRaw ? Number(yearRaw) || "" : "",
            rating,
            watchedAt: watchedAt || null,
            uri: pick(r, ["Letterboxd URI"]) || null,
            /* La séance que porte CETTE ligne. Sans date, il n'y a pas de
               séance à consigner — ratings.csv note un film sans dire
               quand il a été vu. */
            watches: watchedAt ? [{ date: watchedAt, rating, ...(rewatch && { rewatch }) }] : [],
          };
          /* diary.csv a une ligne par visionnage. On les EMPILE désormais :
             elles ne se contredisent pas, elles se suivent. La fiche, elle,
             reste unique — c'est le journal qui s'allonge, pas la
             vidéothèque. Les champs de tête (note, date) continuent de
             refléter la séance la plus récente, pour que toute la fusion
             d'aval garde le même regard qu'avant. */
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
            /* Une revoyure n'est pas un doublon : c'est une séance de plus,
               et l'annoncer comme un rebut donnerait à croire qu'on a perdu
               quelque chose alors qu'on vient justement de le garder. */
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

/* Compare le CSV à la vidéothèque sans rien écrire : c'est ce diff qui est
   montré à l'écran avant validation. */
export function diffImport(existing: Film[], rows: ImportRow[], status: FilmStatus): ImportDiff {
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
        tmdbId: r.tmdbId || null,
        rating: r.rating ?? 0,
        status,
        source: "letterboxd",
      });
      /* `withWatches` pose le journal ET la date : les écrire séparément
         serait le premier endroit où les deux pourraient diverger. Un film
         « à voir » n'a évidemment aucune séance. */
      toCreate.push(status === "watched" ? withWatches(fresh, r.watches || []) : fresh);
      continue;
    }

    // Fusion prudente : la note du CSV fait autorité, mais tout ce qui a été
    // écrit à la main (critique, notes, thèmes, fil rouge) est intouchable.
    const changes: Partial<Film> = {};
    if (r.rating != null && r.rating !== match.rating) changes.rating = r.rating;
    if (r.director && !match.director) changes.director = r.director;
    if (r.genres?.length && !(match.genres || []).length) changes.genres = r.genres;
    // une affiche choisie à la main n'est jamais remplacée par celle de TMDB
    if (r.poster && !match.poster) changes.poster = r.poster;
    if (r.year && !match.year) changes.year = r.year;
    if (r.tmdbId && !match.tmdbId) changes.tmdbId = r.tmdbId;
    /* LE JOURNAL SE COMPLÈTE, IL NE SE REMPLACE PAS. Un `diary.csv`
       apporte des séances anciennes qu'on n'avait pas ; la fusion se fait
       par date, donc repasser le même fichier ne compte rien deux fois.
       On n'écrit que si le compte a bougé — sinon la fiche partirait dans
       « modifiés » pour rien à chaque réimport. */
    if (status === "watched" && r.watches?.length) {
      const watches = mergeWatches(match.watches, r.watches);
      if (watches.length !== (match.watches || []).length) {
        changes.watches = watches;
        // la date suit le journal, elle ne se règle jamais toute seule
        if ((watches[0]?.date || "") > (match.watchedAt || ""))
          changes.watchedAt = watches[0]!.date;
      }
    }
    // Une date sans séance consignée (ratings.csv) doit quand même AVANCER.
    if (
      status === "watched" &&
      r.watchedAt &&
      r.watchedAt > (changes.watchedAt || match.watchedAt || "")
    )
      changes.watchedAt = r.watchedAt;
    // un film « à voir » qui apparaît dans un export de films vus a été vu
    if (status === "watched" && match.status !== "watched") changes.status = "watched";

    if (Object.keys(changes).length) toUpdate.push({ film: match, changes });
    else unchanged.push(match);
  }
  return { toCreate, toUpdate, unchanged };
}
