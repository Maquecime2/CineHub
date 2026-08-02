/* ============================================================
   IMPORT — lecture CSV, appariement, fusion
   ============================================================ */
import Papa from "papaparse";
import { makeFilm } from "./film";
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
          const row: ImportRow = {
            title,
            year: yearRaw ? Number(yearRaw) || "" : "",
            rating: parseRating(pick(r, ["Rating", "rating"]) || null),
            watchedAt: watchedAt || null,
            uri: pick(r, ["Letterboxd URI"]) || null,
          };
          // diary.csv contient une ligne par visionnage : on ne garde que le
          // plus récent, sinon chaque revoyure créerait une fiche de plus.
          const k = filmKey(row);
          const prev = byKey.get(k);
          if (!prev || (row.watchedAt || "") >= (prev.watchedAt || "")) {
            byKey.set(k, prev ? { ...prev, ...row, rating: row.rating ?? prev.rating } : row);
          }
        }

        const rows = [...byKey.values()];
        resolve({
          rows,
          kind,
          stats: {
            lines: res.data.length,
            total: rows.length,
            duplicatesInFile: res.data.length - skippedNoTitle - rows.length,
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
      toCreate.push(
        makeFilm({
          title: r.title,
          year: r.year,
          director: r.director || "",
          poster: r.poster || "",
          genres: r.genres || [],
          tmdbId: r.tmdbId || null,
          rating: r.rating ?? 0,
          status,
          watchedAt: status === "watched" ? r.watchedAt || null : null,
          source: "letterboxd",
        })
      );
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
    // La date de dernière séance doit AVANCER : un diary importé après un
    // ratings.csv apporte des dates plus récentes, il faut qu'elles gagnent.
    if (status === "watched" && r.watchedAt && r.watchedAt > (match.watchedAt || ""))
      changes.watchedAt = r.watchedAt;
    // un film « à voir » qui apparaît dans un export de films vus a été vu
    if (status === "watched" && match.status !== "watched") changes.status = "watched";

    if (Object.keys(changes).length) toUpdate.push({ film: match, changes });
    else unchanged.push(match);
  }
  return { toCreate, toUpdate, unchanged };
}
