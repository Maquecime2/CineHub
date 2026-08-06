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
          /* UNE DATE N'EST PAS UNE SÉANCE. « Watched Date » (diary) en est
             une : elle dit le jour où le film a été vu. « Date » n'en est
             jamais une — c'est le jour où la fiche a été ajoutée dans
             watched.csv, celui où la note a été posée dans ratings.csv.
             En faire une séance donnait à un film vu UNE fois deux
             entrées au journal dès qu'on déposait watched.csv puis
             diary.csv, et un « ×2 » sur une fiche que personne n'avait
             revue. Elle reste bonne à dater la fiche, et à rien d'autre. */
          const seance = pick(r, ["Watched Date"]);
          const watchedAt = seance || pick(r, ["Date", "date"]);
          const rating = parseRating(pick(r, ["Rating", "rating"]) || null);
          const rewatch = /^(yes|true|1)$/i.test(pick(r, ["Rewatch", "rewatch"]));
          const row: ImportRow = {
            title,
            year: yearRaw ? Number(yearRaw) || "" : "",
            rating,
            watchedAt: watchedAt || null,
            uri: pick(r, ["Letterboxd URI"]) || null,
            /* La séance que porte CETTE ligne — s'il y en a une. Seul
               diary.csv en consigne ; watched.csv et ratings.csv disent
               qu'un film a été vu et noté, jamais quand. */
            watches: seance ? [{ date: seance, rating, ...(rewatch && { rewatch }) }] : [],
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

export interface DiffOptions {
  /* LE FICHIER FAIT AUTORITÉ SUR LES SÉANCES : son journal REMPLACE
     celui de la fiche au lieu de le compléter.

     Par défaut on complète, et c'est la bonne règle : un `diary.csv`
     apporte des séances anciennes qu'on n'avait pas, et rien ne doit se
     perdre. Mais compléter ne sait pas défaire, et une fiche qui a
     récolté une séance qui n'en était pas une la garde pour toujours.
     Redéposer le diary en le déclarant SEUL MAÎTRE remet le journal
     d'aplomb — c'est le seul chemin qui retire une séance sans qu'on
     l'ait retirée à la main. */
  authoritativeWatches?: boolean;
  /* NE PAS TOUCHER AU STATUT DES FICHES EXISTANTES.

     `status` sert deux choses très différentes : il décide du rayon des
     fiches CRÉÉES, et il fait passer « à voir » → « vu » les fiches
     existantes qu'un export de films vus mentionne. La seconde est juste
     quand on dépose un diary — c'est même tout l'intérêt.

     Elle est catastrophique quand l'appelant ne parle pas de visionnage.
     « Compléter les fiches » enrichit depuis TMDB et passait `"watched"`
     faute de mieux, en croyant ce statut inerte puisqu'il ne crée rien :
     il a vidé des watchlists entières dans la vidéothèque, d'un seul
     bouton, sur les fiches les plus incomplètes — c'est-à-dire justement
     celles qu'on n'a pas vues.

     D'où cet interrupteur, et son nom : ce que l'appelant refuse de
     décider doit s'écrire, pas se déduire. */
  garderStatut?: boolean;
}

/* Compare le CSV à la vidéothèque sans rien écrire : c'est ce diff qui est
   montré à l'écran avant validation. */
export function diffImport(
  existing: Film[],
  rows: ImportRow[],
  status: FilmStatus,
  { authoritativeWatches = false, garderStatut = false }: DiffOptions = {}
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
        tmdbId: r.tmdbId || null,
        rating: r.rating ?? 0,
        status,
        source: "letterboxd",
        /* Quand la source sait dans quel ordre les fiches ont été mises
           de côté, on la croit : sinon les cinq cents films d'un même
           relevé porteraient tous la même milliseconde, et le tri « par
           ajout » rendrait un ordre au hasard. */
        ...(r.addedAt ? { addedAt: r.addedAt } : null),
      });
      /* `withWatches` pose le journal ET la date : les écrire séparément
         serait le premier endroit où les deux pourraient diverger. Un film
         « à voir » n'a évidemment aucune séance. */
      const made = status === "watched" ? withWatches(fresh, r.watches || []) : fresh;
      /* Une fiche sans séance peut quand même être datée : watched.csv
         sait qu'on a vu le film, pas quand. La date approchée vaut mieux
         qu'un vide — c'est elle qui range la vidéothèque — mais elle
         n'entre pas au journal pour autant. */
      if (status === "watched" && !made.watchedAt && r.watchedAt) made.watchedAt = r.watchedAt;
      toCreate.push(made);
      continue;
    }

    // Fusion prudente : la note du CSV fait autorité, mais tout ce qui a été
    // écrit à la main (critique, notes, thèmes, fil rouge) est intouchable.
    const changes: Partial<Film> = {};
    if (r.rating != null && r.rating !== match.rating) changes.rating = r.rating;
    if (r.director && !match.director) changes.director = r.director;
    if (r.genres?.length && !(match.genres || []).length) changes.genres = r.genres;
    /* LE CASTING SE COMBLE, IL NE SE CORRIGE PAS. Comme les genres :
       on ne remplit que le vide. Une fiche d'avant la récolte le reçoit
       au premier réimport ; une fiche qui en a déjà un le garde, parce
       qu'on ne sait pas si c'est TMDB ou la main qui l'a écrit. */
    if (r.cast?.length && !(match.cast || []).length) changes.cast = r.cast;
    if (r.crew && Object.keys(r.crew).length && !Object.keys(match.crew || {}).length)
      changes.crew = r.crew;
    /* Durée, langue, pays, note du public : mêmes règles que ci-dessus —
       on ne remplit que le vide. `== null` et non `!match.runtime` : une
       fiche dont la durée est connue ne doit pas être réinterrogée, et
       zéro n'est pas une durée absente mais une donnée fausse qu'on
       n'écrit jamais (voir `getDetails`). */
    if (r.runtime != null && match.runtime == null) changes.runtime = r.runtime;
    if (r.language && !match.language) changes.language = r.language;
    if (r.countries?.length && !(match.countries || []).length) changes.countries = r.countries;
    if (r.tmdbRating != null && match.tmdbRating == null) changes.tmdbRating = r.tmdbRating;
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
      const watches = authoritativeWatches
        ? mergeWatches(r.watches)
        : mergeWatches(match.watches, r.watches);
      /* On compare les DATES et non le nombre : en mode autorité, un
         journal peut se retrouver aussi long qu'avant tout en ayant
         changé de séances. */
      const dates = (w: { date: string }[]) => w.map((x) => x.date).join("|");
      if (dates(watches) !== dates(match.watches || [])) {
        changes.watches = watches;
        /* La date suit le journal, elle ne se règle jamais toute seule.
           Elle avance seule d'ordinaire ; quand le fichier fait autorité,
           elle recule aussi — sinon la fiche garderait la date d'une
           séance qu'on vient justement d'effacer. */
        if (authoritativeWatches) changes.watchedAt = watches[0]?.date ?? null;
        else if ((watches[0]?.date || "") > (match.watchedAt || ""))
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
    if (!garderStatut && status === "watched" && match.status !== "watched")
      changes.status = "watched";

    if (Object.keys(changes).length) toUpdate.push({ film: match, changes });
    else unchanged.push(match);
  }
  return { toCreate, toUpdate, unchanged };
}
