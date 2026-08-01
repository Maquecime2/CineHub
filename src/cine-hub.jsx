import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import {
  Pin, Paperclip, Plus, X, Trash2, ArrowLeft, Upload,
  Star, BookOpen, Palette, Clapperboard, Sparkles, Link2,
} from "lucide-react";
import Papa from "papaparse";
import { enrichRows, checkApiKey } from "./tmdb";
import {
  IDB_PREFIX, isIdbPoster, idbKeyOf, putPoster, deletePoster,
  posterStats, pruneOrphans, exportBackup, importBackup, idbAvailable,
} from "./db";

/* ============================================================
   TOKENS — carnet d'archiviste : papier kraft, encre, fil rouge
   ============================================================ */
const C = {
  paper: "#EEE3CC",
  paperDark: "#E2D3AE",
  card: "#F6EFDE",
  ink: "#2B2620",
  inkFaded: "#6E6153",
  burgundy: "#8C3A34",
  ochre: "#B9862E",
  pine: "#3E5B4B",
  slate: "#5C6B78",
  line: "#C9B98F",
  // accents — des touches plus vives qui percent le kraft
  cobalt: "#3A5C8C",
  vermillion: "#C4562E",
  moss: "#6E7A3A",
};

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500;1,600&family=Lora:ital,wght@0,400;0,500;1,400&family=Caveat:wght@500;600;700&family=Special+Elite&display=swap');

::selection { background: ${C.ochre}66; color: ${C.ink}; }

body { background: ${C.paper}; }

/* la molette fait défiler un dossier, pas une page web */
::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-track { background: ${C.paperDark}; }
::-webkit-scrollbar-thumb { background: ${C.line}; border: 2px solid ${C.paperDark}; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: ${C.inkFaded}; }

@keyframes swayIn { from { opacity: 0; transform: translateY(10px) rotate(var(--tilt, 0deg)); } to { opacity: 1; transform: translateY(0) rotate(var(--tilt, 0deg)); } }

input::placeholder, textarea::placeholder { color: ${C.inkFaded}88; font-style: italic; }
`;

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.055 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// persistance locale (remplace window.storage du runtime artefact)
const store = {
  get: (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  /* Le quota localStorage (~5 Mo) est la vraie limite quand on colle des
     affiches en data URI : on prévient au lieu de perdre l'écriture. */
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) {
      console.error(e);
      if (String(e.name || "").includes("Quota")) {
        alert("Espace de stockage plein.\n\nLes affiches importées depuis votre disque sont les plus lourdes : préférez une adresse d'image (clic droit → copier l'adresse de l'image) ou l'enrichissement TMDB, qui ne stockent qu'un lien.");
      }
      return false;
    }
  },
};

/* ============================================================
   MODÈLE — une fiche film, une seule définition
   ============================================================ */
export const makeFilm = (partial = {}) => ({
  id: uid(),
  title: "", year: "", director: "",
  poster: "",          // URL TMDB, adresse collée, ou image réduite en data URI
  genres: [], themes: [],
  rating: 0, review: "", notes: "", linkedWorks: [],
  addedAt: Date.now(),
  status: "watched",   // "watched" | "watchlist"
  watchedAt: null,
  tmdbId: null,
  source: "manual",    // "manual" | "letterboxd"
  ...partial,
});

/* Les fiches enregistrées avant ces champs sont complétées au chargement.
   On en profite pour ramener `year` à un nombre : le tri par année faisait
   jusqu'ici de l'arithmétique sur des chaînes venues du CSV. */
export const migrate = (films) =>
  (films || []).map((f) => ({
    ...makeFilm(),
    ...f,
    year: f.year === "" || f.year == null ? "" : Number(f.year) || "",
    status: f.status === "watchlist" ? "watchlist" : "watched",
    genres: f.genres || [], themes: f.themes || [], linkedWorks: f.linkedWorks || [],
  }));

/* ============================================================
   IMPORT — lecture CSV, appariement, fusion
   ============================================================ */

/* Clé d'appariement : casse, accents, ponctuation et article initial
   neutralisés, pour que « Le Samouraï » et « Le Samourai » soient un seul film. */
export const slugOf = (title = "") =>
  title.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^(le|la|les|the|a|an|l')\s*/, "")
    .replace(/[^a-z0-9]+/g, "");

export const filmKey = (f) => `${slugOf(f.title)}|${f.year || ""}`;

/* Une note absente vaut null (« non noté »), pas 0 : la nuance décide
   si un réimport doit écraser une note existante ou la laisser tranquille. */
export const parseRating = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, Math.round(n * 2) / 2));
};

const pick = (row, names) => {
  for (const n of names) if (row[n] != null && String(row[n]).trim() !== "") return String(row[n]).trim();
  return "";
};

/* Lit un export Letterboxd (ratings / diary / watched / watchlist).
   Retourne les lignes dédoublonnées, le type de fichier deviné et de quoi
   vérifier ce qui a réellement été lu. */
export function parseLetterboxdCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta?.fields || [];
        // Attention : watchlist.csv possède aussi une colonne « Date » (date
        // watched.csv et watchlist.csv ont les mêmes colonnes (Date, Name,
        // Year, URI) : seul le nom du fichier les distingue. On s'y fie donc
        // d'abord, et on retombe sur les colonnes s'il a été renommé.
        const name = (file.name || "").toLowerCase();
        const hasRating = headers.some((h) => /^rating$/i.test(h));
        const hasWatchedDate = headers.some((h) => /^watched date$/i.test(h));
        const kind = /watchlist/.test(name) ? "watchlist"
          : /watched|ratings|diary|reviews/.test(name) ? "watched"
          : hasRating || hasWatchedDate ? "watched" : "watchlist";

        let skippedNoTitle = 0;
        const byKey = new Map();

        for (const r of res.data) {
          const title = pick(r, ["Name", "name", "Title", "title"]);
          if (!title) { skippedNoTitle++; continue; }
          const yearRaw = pick(r, ["Year", "year"]);
          // « Watched Date » (diary) est la vraie date de séance. « Date » ne
          // l'est pas toujours — dans ratings.csv c'est la date de notation —
          // mais elle reste la meilleure approximation disponible ailleurs.
          const watchedAt = pick(r, ["Watched Date", "Date", "date"]);
          const row = {
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
          rows, kind,
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
export function diffImport(existing, rows, status) {
  const byTmdb = new Map(existing.filter((f) => f.tmdbId).map((f) => [String(f.tmdbId), f]));
  const byKey = new Map(existing.map((f) => [filmKey(f), f]));

  const toCreate = [], toUpdate = [], unchanged = [];

  for (const r of rows) {
    const match = (r.tmdbId && byTmdb.get(String(r.tmdbId))) || byKey.get(filmKey(r));
    if (!match) {
      toCreate.push(makeFilm({
        title: r.title, year: r.year, director: r.director || "",
        poster: r.poster || "",
        genres: r.genres || [], tmdbId: r.tmdbId || null,
        rating: r.rating ?? 0,
        status, watchedAt: status === "watched" ? r.watchedAt || null : null,
        source: "letterboxd",
      }));
      continue;
    }

    // Fusion prudente : la note du CSV fait autorité, mais tout ce qui a été
    // écrit à la main (critique, notes, thèmes, fil rouge) est intouchable.
    const changes = {};
    if (r.rating != null && r.rating !== match.rating) changes.rating = r.rating;
    if (r.director && !match.director) changes.director = r.director;
    if (r.genres?.length && !(match.genres || []).length) changes.genres = r.genres;
    // une affiche choisie à la main n'est jamais remplacée par celle de TMDB
    if (r.poster && !match.poster) changes.poster = r.poster;
    if (r.year && !match.year) changes.year = r.year;
    if (r.tmdbId && !match.tmdbId) changes.tmdbId = r.tmdbId;
    // La date de dernière séance doit AVANCER : un diary importé après un
    // ratings.csv apporte des dates plus récentes, il faut qu'elles gagnent.
    if (status === "watched" && r.watchedAt && r.watchedAt > (match.watchedAt || "")) changes.watchedAt = r.watchedAt;
    // un film « à voir » qui apparaît dans un export de films vus a été vu
    if (status === "watched" && match.status !== "watched") changes.status = "watched";

    if (Object.keys(changes).length) toUpdate.push({ film: match, changes });
    else unchanged.push(match);
  }
  return { toCreate, toUpdate, unchanged };
}

const hash = (str = "") => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return h;
};
const seededRand = (seed) => {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
};
const tiltOf = (id) => ((Math.abs(hash(id)) % 90) / 10 - 4.5).toFixed(1);
const TAPE_COLORS = [C.ochre, C.slate, C.burgundy];
const tapeColor = (id) => TAPE_COLORS[Math.abs(hash(id)) % TAPE_COLORS.length];
const hueOf = (id) => {
  // émulsions virées : sépia, cyanotype, sélénium, cibachrome fané…
  const hues = ["#7a5230", "#6b4a4a", "#3f5a52", "#54506b", "#7a5b3a", "#2f4a68", "#6d4a2f", "#4a5c38", "#7b4a52"];
  return hues[Math.abs(hash(id)) % hues.length];
};
const usesPin = (id) => Math.abs(hash(id)) % 2 === 0;
// décalage vertical pour casser l'alignement des colonnes du mur
const nudgeOf = (id) => Math.round(seededRand(Math.abs(hash(id)) + 3) * 34);
// numéro de fiche façon tampon d'archive
const fileNoOf = (id) => String(Math.abs(hash(id)) % 9000 + 1000);

// bord déchiré déterministe (clip-path) pour le bas d'une photo
const tornClip = (id, points = 9) => {
  const base = Math.abs(hash(id));
  const pts = ["0% 0%", "100% 0%", "100% 85%"];
  for (let i = points; i >= 0; i--) {
    const x = (i / points) * 100;
    const y = 85 + seededRand(base + i * 7) * 13;
    pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }
  pts.push("0% 85%");
  return `polygon(${pts.join(",")})`;
};

const LINK_TYPES = [
  { key: "book", label: "Livre", icon: BookOpen },
  { key: "painting", label: "Peinture", icon: Palette },
  { key: "film", label: "Film", icon: Clapperboard },
  { key: "other", label: "Autre œuvre", icon: Sparkles },
];

/* ============================================================
   ATMOSPHÈRE — grain, taches, texture
   ============================================================ */
function PaperGrain() {
  return (
    <>
      {/* fibres du papier — de longues stries irrégulières */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, opacity: 0.5, mixBlendMode: "multiply",
        backgroundImage: `repeating-linear-gradient(94deg, ${C.line}22 0 1px, transparent 1px 5px), repeating-linear-gradient(3deg, ${C.line}18 0 1px, transparent 1px 9px)`,
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: GRAIN, mixBlendMode: "multiply", opacity: 0.7, zIndex: 1 }} />
      {/* vignettage — les bords d'une page qu'on a trop manipulée */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, mixBlendMode: "multiply",
        background: `radial-gradient(ellipse at 50% 42%, transparent 42%, ${C.paperDark}bb 88%, #b9a67e88 100%)`,
      }} />
    </>
  );
}

function CoffeeRing({ style, rotate = 0 }) {
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" style={{ position: "absolute", opacity: 0.4, pointerEvents: "none", transform: `rotate(${rotate}deg)`, mixBlendMode: "multiply", ...style }}>
      {/* anneau irrégulier : le café ne sèche jamais en cercle parfait */}
      <path d="M75 14 C 108 14 137 40 138 74 C 139 110 110 138 75 137 C 40 136 12 108 13 73 C 14 39 42 14 75 14 Z"
        fill="none" stroke={C.ochre} strokeWidth="3.2" opacity="0.55" strokeLinecap="round" strokeDasharray="140 9 60 4" />
      <circle cx="75" cy="75" r="52" fill="none" stroke={C.ochre} strokeWidth="1.1" opacity="0.3" />
      <circle cx="75" cy="75" r="58" fill={C.ochre} opacity="0.07" />
    </svg>
  );
}

/* résidu de scotch arraché — un rectangle plus clair et brillant sur le fond */
function TapeResidue({ style, rotate = -18, w = 90 }) {
  return (
    <div style={{
      position: "absolute", width: w, height: 26, pointerEvents: "none", opacity: 0.5,
      transform: `rotate(${rotate}deg)`, background: `linear-gradient(${C.card}88, ${C.paperDark}55)`,
      clipPath: "polygon(4% 0,96% 6%,100% 96%,2% 100%)", ...style,
    }} />
  );
}

/* soulignement tracé à main levée sous un titre */
function InkUnderline({ width = 260, color = C.burgundy, style }) {
  return (
    <svg width={width} height="14" viewBox={`0 0 ${width} 14`} style={{ display: "block", marginTop: -2, overflow: "visible", ...style }}>
      <path d={`M2 9 C ${width * 0.22} 3, ${width * 0.4} 12, ${width * 0.62} 6 S ${width * 0.88} 4, ${width - 3} 8`}
        fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
      <path d={`M${width * 0.1} 12.5 C ${width * 0.4} 9, ${width * 0.6} 14, ${width * 0.86} 11`}
        fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

/* numéro d'inventaire tamponné dans un coin */
function FileNumber({ id, style }) {
  return (
    <div style={{
      position: "absolute", fontFamily: "'Special Elite', monospace", fontSize: 8.5, letterSpacing: 1.2,
      color: C.inkFaded, opacity: 0.55, transform: "rotate(-1.5deg)", pointerEvents: "none", ...style,
    }}>
      N° {fileNoOf(id)}
    </div>
  );
}

function Tape({ color, rotate = -4, width = 70, style }) {
  return (
    <div
      style={{
        position: "absolute", width, height: 22, background: color, opacity: 0.75,
        transform: `rotate(${rotate}deg)`, boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.15) 0 3px, transparent 3px 7px)",
        clipPath: "polygon(2% 0,98% 0,100% 40%,97% 100%,3% 100%,0 60%)",
        ...style,
      }}
    />
  );
}

function PushPin({ color = C.burgundy, style }) {
  return (
    <div
      style={{
        position: "absolute", width: 15, height: 15, borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, #fff9, ${color} 65%)`,
        boxShadow: "0 3px 4px rgba(0,0,0,0.45)", zIndex: 3, ...style,
      }}
    />
  );
}

function StampCorner({ text }) {
  return (
    <div
      style={{
        position: "absolute", top: 22, right: 34, color: C.burgundy,
        border: `2.5px solid ${C.burgundy}`, boxShadow: `inset 0 0 0 1px ${C.paper}, inset 0 0 0 3px ${C.burgundy}88`,
        padding: "7px 13px", fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: 1.8,
        transform: "rotate(-7deg)", opacity: 0.62, pointerEvents: "none", borderRadius: 2,
        mixBlendMode: "multiply", zIndex: 3,
      }}
    >
      {text}
    </div>
  );
}

function InkStars({ value = 0, onChange, size = 15 }) {
  const editable = !!onChange;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        return (
          <span key={n} onClick={editable ? () => onChange(n === value ? n - 0.5 : n) : undefined} style={{ cursor: editable ? "pointer" : "default", position: "relative", lineHeight: 0 }}>
            <Star size={size} color={C.burgundy} fill={filled ? C.burgundy : "none"} strokeWidth={1.4} />
            {half && <span style={{ position: "absolute", inset: 0, width: "50%", overflow: "hidden" }}><Star size={size} color={C.burgundy} fill={C.burgundy} strokeWidth={1.4} /></span>}
          </span>
        );
      })}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", color: C.inkFaded, marginBottom: 5 }}>{children}</div>;
}

const underlineInput = {
  width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`,
  padding: "4px 2px", color: C.ink, fontFamily: "'Lora', serif", fontSize: 15, outline: "none", boxSizing: "border-box",
};

const ruledTextarea = {
  width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.line}`,
  padding: "6px 2px", color: C.ink, fontFamily: "'Caveat', cursive", fontSize: 20, lineHeight: "30px",
  outline: "none", resize: "vertical", boxSizing: "border-box",
  backgroundImage: `repeating-linear-gradient(transparent, transparent 29px, ${C.line}55 30px)`,
};

/* ============================================================
   AFFICHE — la vraie si on en a une, l'émulsion virée sinon.
   Le grain et le bord déchiré restent par-dessus l'image : une
   affiche collée dans un carnet, pas une vignette de catalogue.
   ============================================================ */
function PosterArt({ film, height, initials, clipSeed = 0 }) {
  const [broken, setBroken] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const hue = hueOf(film.id);

  // une affiche « idb: » vit dans IndexedDB : on la sort en URL d'objet le
  // temps de l'afficher, et on la relâche en partant pour ne pas fuiter.
  useEffect(() => {
    if (!isIdbPoster(film.poster)) { setBlobUrl(null); return; }
    let url = null, alive = true;
    import("./db").then(({ getPoster }) => getPoster(idbKeyOf(film.poster))).then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
    }).catch(() => setBroken(true));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [film.poster]);

  useEffect(() => { setBroken(false); }, [film.poster]);

  const src = broken ? null : isIdbPoster(film.poster) ? blobUrl : film.poster || null;
  return (
    <div style={{ position: "relative", height, clipPath: tornClip(film.id, clipSeed), overflow: "hidden" }}>
      {src ? (
        <img
          src={src} alt=""
          onError={() => setBroken(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.88) contrast(1.04)" }}
        />
      ) : (
        <>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${hue}, ${hue}dd 60%, #1c1712)` }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 22%, rgba(255,240,210,0.28), transparent 62%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: height > 170 ? 50 : 40, color: "#f3ead8cc", textShadow: "0 2px 6px rgba(0,0,0,0.4)" }}>{initials}</span>
          </div>
        </>
      )}
      <div style={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: src ? 0.32 : 0.5, mixBlendMode: "overlay", pointerEvents: "none" }} />
    </div>
  );
}

/* ============================================================
   POLAROID / FICHE FILM
   ============================================================ */
function FilmPolaroid({ film, onClick }) {
  const tilt = tiltOf(film.id);
  const tape = tapeColor(film.id);
  const hue = hueOf(film.id);
  const pinned = usesPin(film.id);
  const initials = film.title.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const nudge = nudgeOf(film.id);
  // l'ombre tombe du côté opposé à l'inclinaison — la photo n'est pas plaquée à plat
  const rest = `${tilt > 0 ? -3 : 3}px 7px 15px rgba(30,20,10,0.3), 0 1px 2px rgba(30,20,10,0.4)`;
  const lift = `${tilt > 0 ? -6 : 6}px 18px 30px rgba(30,20,10,0.38), 0 2px 3px rgba(30,20,10,0.3)`;

  return (
    <div style={{ breakInside: "avoid", marginBottom: 34, paddingTop: nudge }}>
      <button
        onClick={onClick}
        style={{
          all: "unset", cursor: "pointer", width: "100%", padding: "12px 12px 18px", position: "relative",
          background: `linear-gradient(158deg, #FBF6E9, ${C.card} 55%, ${C.paperDark})`,
          boxShadow: rest, transform: `rotate(${tilt}deg)`, display: "block",
          transition: "transform .25s cubic-bezier(.2,.8,.3,1), box-shadow .25s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(0deg) translateY(-7px) scale(1.035)"; e.currentTarget.style.boxShadow = lift; e.currentTarget.style.zIndex = 5; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${tilt}deg)`; e.currentTarget.style.boxShadow = rest; e.currentTarget.style.zIndex = "auto"; }}
      >
        {pinned ? (
          <PushPin color={[C.burgundy, C.cobalt, C.moss][Math.abs(hash(film.id)) % 3]} style={{ top: -7, left: "50%", marginLeft: -7 }} />
        ) : (
          <Tape color={tape} rotate={tilt > 0 ? -8 : 8} style={{ top: -10, left: "50%", marginLeft: -35 }} />
        )}
        <PosterArt film={film} height={150} initials={initials} />
        <div style={{ paddingTop: 14, textAlign: "left" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 18, color: C.ink, lineHeight: 1.15 }}>{film.title}</div>
          {/* la légende manuscrite, écrite au dos puis recopiée devant */}
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, marginTop: 2, transform: "rotate(-0.8deg)" }}>
            {film.year || "s.d."} · {film.director || "anonyme"}
          </div>
          {/* pas d'étoiles sur un film pas encore vu : rien à noter */}
          <div style={{ marginTop: 8 }}>
            {film.status === "watchlist"
              ? <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.cobalt, letterSpacing: 1 }}>À VOIR</span>
              : <InkStars value={film.rating || 0} size={12} />}
          </div>
        </div>
        <FileNumber id={film.id} style={{ bottom: 6, right: 10 }} />
        {/* coin corné : un pli d'ombre en bas à droite */}
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, background: `linear-gradient(135deg, transparent 50%, ${C.paperDark} 50%, #cbb894 100%)`, boxShadow: "-1px -1px 2px rgba(30,20,10,0.18)" }} />
      </button>
    </div>
  );
}

/* ============================================================
   NAVIGATION — onglets de classeur
   ============================================================ */
function FolderTabs({ view, setView, onAdd }) {
  const tabs = [
    { key: "library", label: "Vidéothèque", color: C.burgundy },
    { key: "watchlist", label: "À voir", color: C.ochre },
    { key: "constellation", label: "Constellation", color: C.cobalt },
    { key: "notebook", label: "Carnet", color: C.pine },
    { key: "import", label: "Import Letterboxd", color: C.slate },
  ];
  return (
    <div style={{ width: 46, flexShrink: 0, position: "relative", zIndex: 2 }}>
      {/* la tranche du classeur, contre laquelle les onglets butent */}
      <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, width: 5, background: `linear-gradient(90deg, #b9a67e, ${C.paperDark})`, boxShadow: "inset -2px 0 4px rgba(30,20,10,0.2)", zIndex: 0 }} />
      <div style={{ position: "sticky", top: 0, paddingTop: 30, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
        {tabs.map((t) => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                all: "unset", cursor: "pointer", writingMode: "vertical-rl", transform: "rotate(180deg)",
                // carton teinté dans la masse, pas un aplat : reflet en haut, tranche sombre en bas
                background: `linear-gradient(180deg, ${t.color}, ${t.color} 60%, ${t.color}cc)`,
                filter: active ? "none" : "saturate(0.65) brightness(0.92)",
                color: C.card, fontFamily: "'Special Elite', monospace",
                fontSize: 11.5, letterSpacing: 1.5, padding: "18px 9px", borderRadius: "0 3px 3px 0",
                boxShadow: active
                  ? `4px 4px 10px rgba(0,0,0,0.35), inset -2px 0 0 ${t.color}, inset 0 1px 0 rgba(255,255,255,0.25)`
                  : "2px 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.15)",
                marginLeft: active ? 0 : -6, transition: "margin .18s cubic-bezier(.2,.8,.3,1), filter .18s ease",
                textShadow: "0 1px 1px rgba(0,0,0,0.3)",
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.marginLeft = "0px"; e.currentTarget.style.filter = "none"; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.marginLeft = "-6px"; e.currentTarget.style.filter = "saturate(0.65) brightness(0.92)"; } }}
            >
              {t.label}
            </button>
          );
        })}
        <button onClick={onAdd} title="Épingler un nouveau film" style={{ all: "unset", cursor: "pointer", marginTop: 24, marginLeft: 4, width: 34, height: 34, borderRadius: "50%", background: `radial-gradient(circle at 32% 26%, #fff8, ${C.burgundy} 62%)`, color: C.card, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "2px 4px 7px rgba(0,0,0,0.4)", transition: "transform .18s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.12) rotate(-12deg)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}
        >
          <Pin size={16} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   FORMULAIRE — NOUVEAU FILM
   ============================================================ */
function FilmModal({ onClose, onSave }) {
  const [f, setF] = useState(() => makeFilm());
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,15,10,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, width: "min(520px,100%)", maxHeight: "88vh", overflowY: "auto", padding: "30px 34px", position: "relative", boxShadow: "6px 10px 30px rgba(0,0,0,0.4)" }}>
        <button onClick={onClose} style={{ all: "unset", position: "absolute", top: 18, right: 20, cursor: "pointer", color: C.inkFaded }}><X size={18} /></button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 28, color: C.ink }}>Nouvelle fiche</div>
        <div style={{ height: 1, background: C.line, margin: "14px 0 20px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 2 }}><Label>Titre</Label><input style={underlineInput} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Le titre du film" /></div>
          <div style={{ flex: 1 }}><Label>Année</Label><input style={underlineInput} value={f.year} onChange={(e) => set("year", e.target.value)} placeholder="1975" /></div>
        </div>
        <div style={{ marginTop: 16 }}><Label>Réalisateur·rice</Label><input style={underlineInput} value={f.director} onChange={(e) => set("director", e.target.value)} placeholder="Nom" /></div>
        <div style={{ marginTop: 16 }}><Label>Genres (virgules)</Label><input style={underlineInput} value={f.genres.join(", ")} onChange={(e) => set("genres", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Drame, Science-fiction" /></div>
        <div style={{ marginTop: 16 }}><Label>Thèmes (virgules)</Label><input style={underlineInput} value={f.themes.join(", ")} onChange={(e) => set("themes", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Mémoire, Solitude" /></div>
        <div style={{ marginTop: 18 }}>
          <Label>Cette fiche</Label>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            {[{ k: "watched", l: "Film vu" }, { k: "watchlist", l: "À voir" }].map((o) => (
              <button key={o.k} onClick={() => set("status", o.k)} style={{
                all: "unset", cursor: "pointer", padding: "6px 14px",
                fontFamily: "'Special Elite', monospace", fontSize: 11,
                background: f.status === o.k ? C.pine : "transparent",
                color: f.status === o.k ? C.card : C.inkFaded,
                border: `1px solid ${f.status === o.k ? C.pine : C.line}`,
              }}>{o.l}</button>
            ))}
          </div>
        </div>
        {f.status === "watched" && <div style={{ marginTop: 16 }}><Label>Votre note</Label><InkStars value={f.rating} onChange={(v) => set("rating", v)} size={22} /></div>}
        <div style={{ marginTop: 16 }}><Label>Première impression</Label><textarea style={{ ...ruledTextarea, minHeight: 70 }} value={f.review} onChange={(e) => set("review", e.target.value)} placeholder="Ce que ce film vous a fait ressentir…" /></div>
        <button onClick={() => f.title.trim() && onSave(f)} disabled={!f.title.trim()} style={{ all: "unset", marginTop: 24, width: "100%", textAlign: "center", padding: "12px 0", background: f.title.trim() ? C.burgundy : C.line, color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 13, letterSpacing: 1, cursor: f.title.trim() ? "pointer" : "not-allowed", boxSizing: "border-box" }}>
          ÉPINGLER CETTE FICHE AU MUR
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   VUE — VIDÉOTHÈQUE (mur en désordre organique)
   ============================================================ */
/* Le mur des fiches.

   Il utilisait des colonnes CSS, qui remplissent une colonne de haut en bas
   avant de passer à la suivante : l'ordre trié devenait illisible pour un œil
   qui lit de gauche à droite, au point de faire croire que le tri ne marchait
   pas. Une grille ordonne les fiches ligne par ligne ; le décalage vertical de
   chaque fiche (nudgeOf) suffit à garder le désordre voulu. */
function FilmWall({ films, onOpen }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "0 34px", alignItems: "start" }}>
      {films.map((f) => <FilmPolaroid key={f.id} film={f} onClick={() => onOpen(f.id)} />)}
    </div>
  );
}

/* Le même mur sert la vidéothèque et la liste « à voir » : seules changent
   l'en-tête, les tris proposés et l'invite quand il n'y a rien. */
const WALLS = {
  watched: {
    stamp: "CATALOGUE", title: "Votre vidéothèque",
    subtitle: "un mur d'affiches, de notes et de souvenirs de séances",
    underline: 330,
    // la dernière séance d'abord : c'est l'ordre dans lequel on se souvient
    defaultSort: "watched",
    sorts: [["watched", "vus récemment"], ["added", "ajoutés"], ["title", "A–Z"], ["year", "année"], ["rating", "note"], ["director", "réalisateur"]],
    empty: ["Le mur est encore vide", "Épinglez votre premier film pour commencer la collection."],
  },
  watchlist: {
    stamp: "À VOIR", title: "Le coin des envies",
    subtitle: "les films mis de côté, en attente d'une séance",
    underline: 300,
    defaultSort: "added",
    sorts: [["added", "ajoutés"], ["title", "A–Z"], ["year", "année"], ["director", "réalisateur"]],
    empty: ["Aucune envie en attente", "Importez votre watchlist Letterboxd, ou épinglez un film « à voir »."],
  },
};

function LibraryView({ films, onOpen, wall = "watched" }) {
  const cfg = WALLS[wall];
  const [q, setQ] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [sortBy, setSortBy] = useState(cfg.defaultSort);
  const [grouped, setGrouped] = useState(false);

  const allGenres = useMemo(() => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(), [films]);

  const filtered = useMemo(() => {
    let list = films.filter((f) => {
      const mq = !q || f.title.toLowerCase().includes(q.toLowerCase()) || (f.director || "").toLowerCase().includes(q.toLowerCase());
      const mg = !genreFilter || (f.genres || []).includes(genreFilter);
      return mq && mg;
    });
    return [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "year") return (b.year || 0) - (a.year || 0);
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "director") return (a.director || "zzz").localeCompare(b.director || "zzz") || a.title.localeCompare(b.title);
      // les films jamais datés glissent en fin de liste plutôt qu'en tête
      if (sortBy === "watched") return (b.watchedAt || "").localeCompare(a.watchedAt || "");
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
  }, [films, q, genreFilter, sortBy]);

  /* Le regroupement par réalisateur : une pile de fiches par cinéaste, les
     plus fréquentés d'abord — c'est là que se lisent les habitudes. */
  const groups = useMemo(() => {
    if (!grouped) return null;
    const by = new Map();
    for (const f of filtered) {
      const key = f.director?.trim() || "Réalisateur inconnu";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(f);
    }
    return [...by.entries()].sort((a, b) =>
      b[1].length - a[1].length ||
      (a[0] === "Réalisateur inconnu" ? 1 : b[0] === "Réalisateur inconnu" ? -1 : a[0].localeCompare(b[0]))
    );
  }, [filtered, grouped]);

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <CoffeeRing style={{ top: 10, right: 120 }} rotate={12} />
      <CoffeeRing style={{ bottom: 40, left: -30, width: 100, height: 100 }} rotate={-40} />
      <CoffeeRing style={{ top: 340, right: -40, width: 190, height: 190 }} rotate={70} />
      <TapeResidue style={{ top: 96, right: 260 }} />
      <TapeResidue style={{ bottom: 120, left: 180, opacity: 0.3 }} rotate={7} w={64} />
      <StampCorner text={`${cfg.stamp} · ${films.length}`} />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 46, color: C.ink, position: "relative", zIndex: 2 }}>{cfg.title}</div>
      <InkUnderline width={cfg.underline} />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: C.inkFaded, marginTop: 2, position: "relative", zIndex: 2 }}>{cfg.subtitle}</div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end", marginTop: 26, marginBottom: 34, borderBottom: `1px dashed ${C.line}`, paddingBottom: 18, position: "relative", zIndex: 2 }}>
        <div style={{ minWidth: 200 }}>
          <Label>Chercher</Label>
          <input style={underlineInput} placeholder="un titre, un·e cinéaste…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <Label>Genre</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allGenres.length === 0 && <span style={{ color: C.inkFaded, fontSize: 13, fontStyle: "italic" }}>—</span>}
            {allGenres.map((g) => {
              // chaque genre porte sa propre encre — l'étiquetage n'a pas été fait le même jour
              const ink = [C.burgundy, C.cobalt, C.moss, C.vermillion, C.slate][Math.abs(hash(g)) % 5];
              const on = genreFilter === g;
              return (
                <button key={g} onClick={() => setGenreFilter(on ? "" : g)} style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 10.5, padding: "4px 11px", borderRadius: 14, border: `1px solid ${ink}`, color: on ? C.card : ink, background: on ? ink : "transparent", transform: `rotate(${(Math.abs(hash(g)) % 5) - 2}deg)`, boxShadow: on ? `1px 2px 4px ${ink}55` : "none", transition: "background .15s ease" }}>{g}</button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Trier</Label>
          <div style={{ display: "flex", gap: 14, fontFamily: "'Special Elite', monospace", fontSize: 11 }}>
            {cfg.sorts.map(([k, l]) => (
              <span key={k} onClick={() => setSortBy(k)} style={{ cursor: "pointer", color: sortBy === k ? C.burgundy : C.inkFaded, textDecoration: sortBy === k ? "underline" : "none" }}>{l}</span>
            ))}
          </div>
        </div>
        <div>
          <Label>Classer</Label>
          <button
            onClick={() => setGrouped((g) => !g)}
            style={{
              all: "unset", cursor: "pointer", padding: "5px 12px", marginTop: 2,
              fontFamily: "'Special Elite', monospace", fontSize: 10.5,
              background: grouped ? C.pine : "transparent", color: grouped ? C.card : C.inkFaded,
              border: `1px solid ${grouped ? C.pine : C.line}`,
            }}
          >PAR RÉALISATEUR</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.inkFaded, position: "relative", zIndex: 2 }}>
          <Pin size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink, marginBottom: 6 }}>{films.length === 0 ? cfg.empty[0] : "Rien à afficher"}</div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19 }}>{films.length === 0 ? cfg.empty[1] : "Essayez une autre recherche."}</div>
        </div>
      ) : grouped ? (
        <div style={{ position: "relative", zIndex: 2 }}>
          {groups.map(([director, list]) => (
            <div key={director} style={{ marginBottom: 46 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 26, color: C.ink }}>{director}</div>
                <div style={{ flex: 1, borderBottom: `1px dashed ${C.line}`, transform: "translateY(-6px)" }} />
                <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded }}>{list.length} film{list.length > 1 ? "s" : ""}</div>
              </div>
              <FilmWall films={list} onOpen={onOpen} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: "relative", zIndex: 2 }}>
          <FilmWall films={filtered} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PANNEAU D'ENQUÊTE — fils tendus mesurés en SVG
   ============================================================ */
function ThreadBoard({ film, onRemove, films = [], onOpen }) {
  // les fiches encore présentes derrière les renvois : une fiche supprimée
  // laisse le lien lisible mais inerte plutôt qu'un bouton qui casse
  const linkedFilms = useMemo(() => {
    const byId = new Map(films.map((f) => [f.id, f]));
    return Object.fromEntries((film.linkedWorks || [])
      .filter((w) => w.filmId && byId.has(w.filmId))
      .map((w) => [w.filmId, byId.get(w.filmId)]));
  }, [films, film.linkedWorks]);

  const boardRef = useRef(null);
  const pinRef = useRef(null);
  const cardRefs = useRef({});
  const [paths, setPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const works = film.linkedWorks || [];

  const recompute = useCallback(() => {
    const board = boardRef.current;
    const pin = pinRef.current;
    if (!board || !pin) return;
    const bRect = board.getBoundingClientRect();
    const pRect = pin.getBoundingClientRect();
    const x0 = pRect.left + pRect.width / 2 - bRect.left;
    const y0 = pRect.bottom - bRect.top - 2;
    const next = works.map((w) => {
      const el = cardRefs.current[w.id];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x1 = r.left + r.width / 2 - bRect.left;
      const y1 = r.top - bRect.top + 4;
      // caténaire : le fil pend d'autant plus qu'il est long, et jamais symétriquement
      const span = Math.abs(x1 - x0);
      const sag = 26 + span * 0.16 + seededRand(Math.abs(hash(w.id))) * 22;
      const c1x = x0 + (x1 - x0) * 0.28, c2x = x0 + (x1 - x0) * 0.72;
      const lowest = Math.max(y0, y1) + sag;
      return {
        id: w.id,
        d: `M ${x0} ${y0} C ${c1x} ${lowest}, ${c2x} ${lowest * 0.96}, ${x1} ${y1}`,
        knot: { x: x1, y: y1 },
      };
    }).filter(Boolean);
    setPaths(next);
    setSvgSize({ w: bRect.width, h: bRect.height });
  }, [works]);

  useLayoutEffect(() => {
    const t = setTimeout(recompute, 30);
    window.addEventListener("resize", recompute);
    return () => { clearTimeout(t); window.removeEventListener("resize", recompute); };
  }, [recompute]);

  return (
    <div ref={boardRef} style={{ position: "relative", paddingTop: 30 }}>
      <svg width={svgSize.w} height={svgSize.h} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}>
        {paths.map((p) => (
          <g key={p.id}>
            {/* l'ombre du fil, décalée : il flotte au-dessus du papier */}
            <path d={p.d} fill="none" stroke="#2B262033" strokeWidth="3" strokeLinecap="round" transform="translate(1.5,3)" />
            {/* l'âme sombre de la corde, puis la torsade éclairée par-dessus */}
            <path d={p.d} fill="none" stroke="#6B241F" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
            <path d={p.d} fill="none" stroke="#C4562E" strokeWidth="2.6" strokeDasharray="2.5 4" strokeLinecap="round" opacity="0.8" />
            {/* le nœud là où le fil mord la fiche */}
            <circle cx={p.knot.x} cy={p.knot.y} r="3.2" fill="#6B241F" opacity="0.9" />
          </g>
        ))}
      </svg>

      <div ref={pinRef} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.ink, color: C.card, padding: "7px 16px", position: "relative", zIndex: 2 }}>
        <PushPin color={C.burgundy} style={{ position: "static", marginRight: 2 }} />
        <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: 1 }}>{film.title.toUpperCase()}</span>
      </div>

      {works.length === 0 ? (
        <div style={{ color: C.inkFaded, fontFamily: "'Caveat', cursive", fontSize: 19, marginTop: 26 }}>rien d'épinglé pour l'instant…</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "40px 28px", marginTop: 40, position: "relative", zIndex: 2 }}>
          {works.map((w) => {
            const type = LINK_TYPES.find((t) => t.key === w.type) || LINK_TYPES[3];
            const Icon = type.icon;
            const tilt = tiltOf(w.id);
            const pinned = usesPin(w.id);
            return (
              <div
                key={w.id}
                ref={(el) => { if (el) cardRefs.current[w.id] = el; }}
                style={{ position: "relative", background: C.card, padding: "12px 16px 14px", boxShadow: "2px 5px 12px rgba(30,20,10,0.25)", transform: `rotate(${tilt / 2}deg)`, width: 200 }}
              >
                {pinned ? <PushPin style={{ top: -7, left: "50%", marginLeft: -7 }} /> : <Tape color={tapeColor(w.id)} rotate={tilt > 0 ? -8 : 8} width={54} style={{ top: -9, left: "50%", marginLeft: -27 }} />}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Icon size={15} color={C.burgundy} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    {/* un renvoi vers une fiche du mur s'ouvre ; une simple
                        mention reste du texte, y compris si la fiche a disparu */}
                    {linkedFilms[w.filmId] ? (
                      <button
                        onClick={() => onOpen(w.filmId)}
                        style={{ all: "unset", cursor: "pointer", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: C.burgundy, lineHeight: 1.2, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
                      >{w.title}</button>
                    ) : (
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: C.ink, lineHeight: 1.2 }}>{w.title}</div>
                    )}
                    <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded, marginTop: 3 }}>
                      {type.label}{w.creator ? ` — ${w.creator}` : ""}
                      {linkedFilms[w.filmId] && <span style={{ color: C.burgundy }}> · fiche liée</span>}
                      {w.filmId && !linkedFilms[w.filmId] && <span style={{ color: C.inkFaded }}> · fiche supprimée</span>}
                    </div>
                    {w.note && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, marginTop: 5 }}>« {w.note} »</div>}
                  </div>
                  <button onClick={() => onRemove(w.id)} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}><X size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   VUE — DOSSIER FILM
   ============================================================ */
/* L'image est ramenée à une taille d'affiche avant d'être rangée. IndexedDB
   pourrait encaisser l'original, mais 700 px suffisent largement au plus grand
   affichage : autant garder la base légère et le rendu instantané. */
const shrinkImage = (file, maxW = 700) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      // un Blob, pas une chaîne base64 : c'est tout l'intérêt d'IndexedDB
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encodage impossible"))), "image/jpeg", 0.82);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function PosterPicker({ film, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const fromFile = async (file) => {
    setBusy(true);
    try {
      const blob = await shrinkImage(file);
      const key = `${film.id}-${Date.now()}`;   // clé neuve : le cache d'image ne resservira pas l'ancienne
      await putPoster(key, blob);
      if (isIdbPoster(film.poster)) await deletePoster(idbKeyOf(film.poster));
      onUpdate({ ...film, poster: IDB_PREFIX + key });
    } catch (e) {
      console.error(e);
      alert("Cette image n'a pas pu être enregistrée.");
    }
    setBusy(false); setOpen(false);
  };

  const clear = async () => {
    if (isIdbPoster(film.poster)) await deletePoster(idbKeyOf(film.poster));
    onUpdate({ ...film, poster: "" });
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ all: "unset", cursor: "pointer", display: "block", marginTop: 8, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10, letterSpacing: 0.5 }}>
        {film.poster ? "changer l'affiche" : "coller une affiche"}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.line}`, background: C.paperDark, padding: "12px 14px" }}>
      <Label>Adresse de l'image</Label>
      <input
        style={underlineInput} value={url} placeholder="https://…jpg"
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key !== "Enter" || !url.trim()) return;
          if (isIdbPoster(film.poster)) await deletePoster(idbKeyOf(film.poster));
          onUpdate({ ...film, poster: url.trim() }); setUrl(""); setOpen(false);
        }}
      />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: C.inkFaded, marginTop: 4 }}>
        clic droit sur une affiche → « copier l'adresse de l'image », puis Entrée
      </div>

      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files[0] && fromFile(e.target.files[0])} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={() => ref.current.click()} disabled={busy} style={{ all: "unset", cursor: "pointer", padding: "6px 12px", border: `1px solid ${C.line}`, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10 }}>
          {busy ? "…" : "DEPUIS MON DISQUE"}
        </button>
        {film.poster && (
          <button onClick={clear} style={{ all: "unset", cursor: "pointer", padding: "6px 12px", border: `1px solid ${C.burgundy}`, color: C.burgundy, fontFamily: "'Special Elite', monospace", fontSize: 10 }}>RETIRER</button>
        )}
        <button onClick={() => setOpen(false)} style={{ all: "unset", cursor: "pointer", padding: "6px 12px", color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10 }}>fermer</button>
      </div>
    </div>
  );
}

function DetailView({ film, onBack, onUpdate, onDelete, films = [], onLinkFilm, onRemoveLink, onOpen }) {
  const [linkType, setLinkType] = useState("book");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkCreator, setLinkCreator] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [picked, setPicked] = useState(null);   // fiche existante retenue
  const hue = hueOf(film.id);

  /* Quand on cherche un film, on propose ceux de la collection — vidéothèque
     et watchlist confondues. Rien n'oblige à en choisir un : le champ reste
     libre pour les films qu'on ne possède pas encore. */
  const already = new Set((film.linkedWorks || []).map((w) => w.filmId).filter(Boolean));
  const suggestions = useMemo(() => {
    if (linkType !== "film") return [];
    const q = linkTitle.trim().toLowerCase();
    if (!q) return [];
    return films
      .filter((f) => f.id !== film.id && !already.has(f.id))
      .filter((f) => f.title.toLowerCase().includes(q) || (f.director || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [films, film.id, linkTitle, linkType, film.linkedWorks]);

  const addLink = () => {
    // une fiche retenue devient un vrai lien réciproque, pas une étiquette
    if (picked) {
      onLinkFilm(film.id, picked.id, linkNote);
      setPicked(null); setLinkTitle(""); setLinkCreator(""); setLinkNote("");
      return;
    }
    if (!linkTitle.trim()) return;
    const work = { id: uid(), type: linkType, title: linkTitle.trim(), creator: linkCreator.trim(), note: linkNote.trim() };
    onUpdate({ ...film, linkedWorks: [...(film.linkedWorks || []), work] });
    setLinkTitle(""); setLinkCreator(""); setLinkNote("");
  };
  const removeLink = (id) => onRemoveLink(film.id, id);

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 900, position: "relative" }}>
      <StampCorner text="DOSSIER" />
      <button onClick={onBack} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 11.5, marginBottom: 22 }}>
        <ArrowLeft size={14} /> RETOUR AU MUR
      </button>

      <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ background: C.card, padding: "12px 12px 16px", boxShadow: "3px 6px 14px rgba(30,20,10,0.28)", position: "relative" }}>
            <Tape color={C.burgundy} rotate={-5} style={{ top: -10, left: "50%", marginLeft: -35 }} />
            <PosterArt film={film} height={290} clipSeed={11} initials={film.title.slice(0, 2).toUpperCase()} />
          </div>
          <PosterPicker film={film} onUpdate={onUpdate} />
          <div style={{ marginTop: 16, border: `1px solid ${C.line}`, padding: "12px 14px", background: C.paperDark }}>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>FICHE CATALOGUE</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 20, color: C.ink, marginTop: 4 }}>{film.title}</div>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, marginTop: 3 }}>{film.year || "s.d."} — {film.director || "anonyme"}</div>
            {film.status === "watchlist" ? (
              <button
                onClick={() => onUpdate({ ...film, status: "watched", watchedAt: new Date().toISOString().slice(0, 10) })}
                style={{ all: "unset", cursor: "pointer", marginTop: 12, display: "block", textAlign: "center", padding: "8px 0", background: C.pine, color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 10.5, letterSpacing: 1, boxSizing: "border-box", width: "100%" }}
              >JE L'AI VU</button>
            ) : (
              <>
                <div style={{ marginTop: 10 }}><InkStars value={film.rating || 0} onChange={(v) => onUpdate({ ...film, rating: v })} size={18} /></div>
                <button
                  onClick={() => onUpdate({ ...film, status: "watchlist" })}
                  style={{ all: "unset", cursor: "pointer", marginTop: 8, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10 }}
                >remettre « à voir »</button>
              </>
            )}
            {film.watchedAt && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded, marginTop: 6 }}>vu le {film.watchedAt}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {(film.genres || []).map((g) => <span key={g} style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, border: `1px solid ${C.burgundy}`, color: C.burgundy, borderRadius: 12, padding: "2px 8px" }}>{g}</span>)}
              {(film.themes || []).map((t) => <span key={t} style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, border: `1px solid ${C.pine}`, color: C.pine, borderRadius: 12, padding: "2px 8px" }}>{t}</span>)}
            </div>
            <button onClick={() => onDelete(film.id)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10, marginTop: 16 }}>
              <Trash2 size={12} /> retirer du mur
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 300, position: "relative" }}>
          <Paperclip size={26} color={C.inkFaded} style={{ position: "absolute", top: -14, left: -22, transform: "rotate(-25deg)", opacity: 0.7 }} />
          <Label>Critique personnelle</Label>
          <textarea style={{ ...ruledTextarea, minHeight: 120 }} value={film.review || ""} onChange={(e) => onUpdate({ ...film, review: e.target.value })} placeholder="Écrivez ici, à main levée…" />
          <div style={{ marginTop: 22 }}>
            <Label>Notes libres</Label>
            <textarea style={{ ...ruledTextarea, minHeight: 70 }} value={film.notes || ""} onChange={(e) => onUpdate({ ...film, notes: e.target.value })} placeholder="Scènes, citations, fragments…" />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link2 size={15} color={C.burgundy} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 24, color: C.ink }}>Le fil rouge</div>
        </div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded, marginTop: -2, marginBottom: 8 }}>
          les œuvres qui répondent à ce film — livres, peintures, autres films
        </div>

        <ThreadBoard film={film} onRemove={removeLink} films={films} onOpen={onOpen} />

        <div style={{ marginTop: 30, border: `1px dashed ${C.line}`, padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <Label>Type</Label>
            <select value={linkType} onChange={(e) => { setLinkType(e.target.value); setPicked(null); }} style={{ ...underlineInput, fontFamily: "'Special Elite', monospace", fontSize: 12, width: 120 }}>
              {LINK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
            <Label>{linkType === "film" ? "Chercher dans la collection" : "Titre de l'œuvre"}</Label>
            {picked ? (
              // fiche retenue : on montre qu'il s'agit d'un vrai renvoi, pas d'un texte
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.burgundy}`, padding: "5px 10px", marginTop: 2 }}>
                <Link2 size={13} color={C.burgundy} />
                <span style={{ fontFamily: "'Lora', serif", fontSize: 14, color: C.ink }}>{picked.title}{picked.year ? ` (${picked.year})` : ""}</span>
                <button onClick={() => setPicked(null)} style={{ all: "unset", cursor: "pointer", color: C.inkFaded, marginLeft: "auto" }}><X size={12} /></button>
              </div>
            ) : (
              <input style={underlineInput} value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder={linkType === "film" ? "un titre déjà au mur, ou un titre libre" : "Titre"} />
            )}
            {suggestions.length > 0 && !picked && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: C.card, border: `1px solid ${C.line}`, boxShadow: "2px 6px 14px rgba(30,20,10,0.3)", maxHeight: 210, overflowY: "auto" }}>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setPicked(s); setLinkCreator(s.director || ""); }}
                    style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", padding: "7px 11px", borderBottom: `1px solid ${C.line}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.paperDark; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontFamily: "'Lora', serif", fontSize: 13.5, color: C.ink }}>{s.title}</span>
                    <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded, marginLeft: 6 }}>
                      {s.year || "s.d."}{s.director ? ` · ${s.director}` : ""}{s.status === "watchlist" ? " · à voir" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {linkType === "film" && !picked && linkTitle.trim() && suggestions.length === 0 && (
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: C.inkFaded, marginTop: 3 }}>pas au mur — sera relié comme simple mention</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 140 }}><Label>Auteur·rice / artiste</Label><input style={underlineInput} value={linkCreator} onChange={(e) => setLinkCreator(e.target.value)} placeholder="Nom" disabled={!!picked} /></div>
          <div style={{ flex: 1.4, minWidth: 180 }}><Label>Pourquoi ce lien ?</Label><input style={underlineInput} value={linkNote} onChange={(e) => setLinkNote(e.target.value)} placeholder="La résonance entre les deux" /></div>
          <button onClick={addLink} style={{ all: "unset", cursor: "pointer", background: C.burgundy, color: C.card, padding: "8px 16px", fontFamily: "'Special Elite', monospace", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> relier
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   VUE — CONSTELLATION : une carte du ciel tracée à l'encre.
   Chaque film est une étoile, chaque œuvre liée un astre plus
   discret. Une œuvre citée par deux films devient un pont : c'est
   là que les constellations se forment.
   ============================================================ */
const LINK_INK = { film: C.burgundy, book: C.cobalt, painting: C.moss, other: C.ochre };
// clé de fusion : deux fois « Nighthawks / Hopper » = un seul astre
const workKey = (w) => `${w.type}::${w.title.trim().toLowerCase()}::${(w.creator || "").trim().toLowerCase()}`;

function buildSky(films) {
  const nodes = [];
  const links = [];
  const byKey = new Map();

  films.forEach((f) => {
    nodes.push({ id: `f:${f.id}`, kind: "film", label: f.title, sub: [f.year, f.director].filter(Boolean).join(" · "), rating: f.rating || 0, filmId: f.id });
  });

  films.forEach((f) => {
    (f.linkedWorks || []).forEach((w) => {
      const k = workKey(w);
      if (!byKey.has(k)) {
        byKey.set(k, { id: `w:${k}`, kind: "work", type: w.type, label: w.title, sub: w.creator || "", refs: 0 });
        nodes.push(byKey.get(k));
      }
      const node = byKey.get(k);
      node.refs += 1;
      links.push({ a: `f:${f.id}`, b: node.id, kind: "cite" });
    });
  });

  // les films d'un même cinéaste sont d'une même famille d'étoiles
  const byDirector = new Map();
  films.forEach((f) => {
    const d = (f.director || "").trim().toLowerCase();
    if (!d) return;
    if (!byDirector.has(d)) byDirector.set(d, []);
    byDirector.get(d).push(f);
  });
  byDirector.forEach((group) => {
    for (let i = 1; i < group.length; i++) links.push({ a: `f:${group[i - 1].id}`, b: `f:${group[i].id}`, kind: "author" });
  });

  return { nodes, links };
}

/* relaxation force-dirigée, déterministe : même collection = même ciel */
function relax(nodes, links, W, H) {
  if (nodes.length === 0) return [];
  const P = nodes.map((n) => {
    const s = Math.abs(hash(n.id));
    return { ...n, x: W / 2 + (seededRand(s) - 0.5) * W * 0.75, y: H / 2 + (seededRand(s + 11) - 0.5) * H * 0.75 };
  });
  const index = new Map(P.map((p, i) => [p.id, i]));
  const edges = links.map((l) => ({ i: index.get(l.a), j: index.get(l.b), kind: l.kind })).filter((e) => e.i != null && e.j != null);

  for (let step = 0; step < 320; step++) {
    const cool = 1 - step / 320;
    // répulsion : deux astres ne se superposent jamais
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y;
        let d2 = dx * dx + dy * dy || 0.01;
        const d = Math.sqrt(d2);
        const f = Math.min(9000 / d2, 12) * cool;
        const ux = dx / d, uy = dy / d;
        P[i].x -= ux * f; P[i].y -= uy * f;
        P[j].x += ux * f; P[j].y += uy * f;
      }
    }
    // ressorts : le fil tire les œuvres vers leur film
    edges.forEach((e) => {
      const a = P[e.i], b = P[e.j];
      const rest = e.kind === "author" ? 210 : 128;
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - rest) * 0.045 * cool;
      const ux = dx / d, uy = dy / d;
      a.x += ux * f; a.y += uy * f;
      b.x -= ux * f; b.y -= uy * f;
    });
    // gravité douce vers le centre de la feuille
    P.forEach((p) => { p.x += (W / 2 - p.x) * 0.006 * cool; p.y += (H / 2 - p.y) * 0.006 * cool; });
  }

  // recadrage : le ciel occupe toute la feuille, quelle que soit la taille de la collection
  const pad = 90;
  const xs = P.map((p) => p.x), ys = P.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = Math.min((W - pad * 2) / Math.max(maxX - minX, 1), (H - pad * 2) / Math.max(maxY - minY, 1));
  // on n'agrandit jamais au-delà du raisonnable : à deux étoiles, le ciel reste aéré
  const s = Math.min(k, 1.6);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  P.forEach((p) => { p.x = W / 2 + (p.x - cx) * s; p.y = H / 2 + (p.y - cy) * s; });

  return P;
}

function ConstellationView({ films, onOpen }) {
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const [moved, setMoved] = useState({});
  const svgRef = useRef(null);
  // d'où le pointeur est parti : au-delà de quelques pixels, c'est un glissé, pas un clic
  const pressAt = useRef(null);

  const W = 1100, H = 760;
  const { nodes, links } = useMemo(() => buildSky(films), [films]);
  const placed = useMemo(() => relax(nodes, links, W, H), [nodes, links]);

  const pos = useCallback((p) => moved[p.id] || p, [moved]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);

  // l'ensemble des astres qu'un survol met en lumière
  const lit = useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    links.forEach((l) => { if (l.a === hover) set.add(l.b); if (l.b === hover) set.add(l.a); });
    return set;
  }, [hover, links]);

  const toSvg = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const radiusOf = (n) => (n.kind === "film" ? 7 + (n.rating || 0) * 1.6 : 4 + Math.min(n.refs, 4));

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <StampCorner text="CARTE DU CIEL" />
      <CoffeeRing style={{ top: 150, right: 90 }} rotate={-25} />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 46, color: C.ink, position: "relative", zIndex: 2 }}>La constellation</div>
      <InkUnderline width={300} />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: C.inkFaded, marginTop: 2, position: "relative", zIndex: 2 }}>
        tout ce qui se répond dans votre collection — attrapez une étoile pour la déplacer
      </div>

      {placed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: C.inkFaded, position: "relative", zIndex: 2 }}>
          <Sparkles size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink, marginBottom: 6 }}>Le ciel est encore noir</div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19 }}>Épinglez des films, reliez-leur des œuvres — les constellations apparaîtront d'elles-mêmes.</div>
        </div>
      ) : (
        <>
          {/* la légende, façon cartouche de carte ancienne */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 22, marginBottom: 10, position: "relative", zIndex: 2 }}>
            {[["film", "Film"], ["book", "Livre"], ["painting", "Peinture"], ["other", "Autre œuvre"]].map(([k, l]) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: LINK_INK[k], boxShadow: `0 0 6px ${LINK_INK[k]}88` }} />
                {l.toUpperCase()}
              </span>
            ))}
          </div>

          <div style={{
            position: "relative", zIndex: 2, background: `radial-gradient(ellipse at 50% 45%, ${C.card}cc, transparent 72%)`,
            border: `1px dashed ${C.line}`, boxShadow: "inset 0 0 40px rgba(30,20,10,0.06)",
          }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", display: "block", cursor: drag ? "grabbing" : "default", touchAction: "none" }}
              onPointerMove={(e) => { if (!drag) return; const p = toSvg(e); setMoved((m) => ({ ...m, [drag]: { ...byId.get(drag), x: p.x, y: p.y } })); }}
              onPointerUp={() => setDrag(null)}
              onPointerLeave={() => { setDrag(null); setHover(null); }}
            >
              {/* le quadrillage effacé d'une carte astronomique */}
              <defs>
                <pattern id="sky-grid" width="55" height="55" patternUnits="userSpaceOnUse">
                  <path d="M55 0 L0 0 0 55" fill="none" stroke={C.line} strokeWidth="0.6" opacity="0.4" />
                </pattern>
                <filter id="halo" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect width={W} height={H} fill="url(#sky-grid)" />

              {/* les fils : caténaire légère, comme sur le panneau d'enquête */}
              {links.map((l, i) => {
                const a = pos(byId.get(l.a)), b = pos(byId.get(l.b));
                if (!a || !b) return null;
                const on = !lit || (lit.has(l.a) && lit.has(l.b));
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + Math.abs(b.x - a.x) * 0.09 + 10;
                const author = l.kind === "author";
                return (
                  <path
                    key={i}
                    d={`M ${a.x} ${a.y} Q ${mx} ${my}, ${b.x} ${b.y}`}
                    fill="none"
                    stroke={author ? C.inkFaded : C.vermillion}
                    strokeWidth={author ? 1 : 1.6}
                    strokeDasharray={author ? "6 7" : "2.5 4"}
                    strokeLinecap="round"
                    opacity={on ? (author ? 0.5 : 0.75) : 0.1}
                    style={{ transition: "opacity .18s ease" }}
                  />
                );
              })}

              {placed.map((n) => {
                const p = pos(n);
                const r = radiusOf(n);
                const ink = n.kind === "film" ? C.burgundy : LINK_INK[n.type] || C.ochre;
                const on = !lit || lit.has(n.id);
                const isHover = hover === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    style={{ cursor: n.kind === "film" ? "pointer" : "grab", opacity: on ? 1 : 0.22, transition: "opacity .18s ease" }}
                    onPointerEnter={() => !drag && setHover(n.id)}
                    onPointerLeave={() => !drag && setHover(null)}
                    onPointerDown={(e) => { e.preventDefault(); pressAt.current = { x: e.clientX, y: e.clientY }; setDrag(n.id); }}
                    onClick={(e) => {
                      if (n.kind !== "film") return;
                      const s = pressAt.current;
                      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) return; // c'était un glissé
                      onOpen(n.filmId);
                    }}
                  >
                    {/* halo : les astres les plus cités brillent le plus fort */}
                    <circle r={r + 7} fill={ink} opacity={isHover ? 0.22 : 0.1} filter="url(#halo)" />
                    <circle r={r} fill={ink} stroke={C.card} strokeWidth="1.6" />
                    {n.kind === "film" && <circle r={r + 4.5} fill="none" stroke={ink} strokeWidth="0.9" opacity="0.5" strokeDasharray="2 3" />}
                    <text
                      x={0} y={-r - 11} textAnchor="middle"
                      style={{
                        fontFamily: n.kind === "film" ? "'Playfair Display', serif" : "'Special Elite', monospace",
                        fontSize: n.kind === "film" ? 15 : 10.5,
                        fontWeight: n.kind === "film" ? 700 : 400,
                        fill: C.ink, pointerEvents: "none",
                      }}
                    >
                      {n.label.length > 30 ? n.label.slice(0, 29) + "…" : n.label}
                    </text>
                    {isHover && n.sub && (
                      <text x={0} y={r + 18} textAnchor="middle" style={{ fontFamily: "'Caveat', cursive", fontSize: 16, fill: C.inkFaded, pointerEvents: "none" }}>
                        {n.sub}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", marginTop: 14, position: "relative", zIndex: 2 }}>
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded }}>
              {placed.filter((n) => n.kind === "film").length} film(s), {placed.filter((n) => n.kind === "work").length} œuvre(s) — {placed.filter((n) => n.refs > 1).length} pont(s) entre deux films
            </span>
            {Object.keys(moved).length > 0 && (
              <button onClick={() => setMoved({})} style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 10.5, color: C.burgundy, borderBottom: `1px solid ${C.burgundy}` }}>
                REMETTRE LE CIEL EN PLACE
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   VUE — CARNET
   ============================================================ */
function NotebookView({ notes, onAdd, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = () => {
    if (!body.trim() && !title.trim()) return;
    onAdd({ id: uid(), title: title.trim() || "Sans titre", body, createdAt: Date.now() });
    setTitle(""); setBody("");
  };
  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 720, position: "relative" }}>
      <StampCorner text="CARNET" />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 42, color: C.ink }}>Le carnet</div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, color: C.inkFaded, marginTop: -4, marginBottom: 26 }}>des pensées libres, qui n'appartiennent à aucun film en particulier</div>

      <div style={{ background: C.card, padding: 20, boxShadow: "3px 5px 12px rgba(30,20,10,0.22)", transform: "rotate(-0.6deg)" }}>
        <input style={{ ...underlineInput, fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 19, fontWeight: 700 }} placeholder="Titre de la note" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...ruledTextarea, minHeight: 90, marginTop: 8 }} placeholder="Écrivez librement…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={create} style={{ all: "unset", cursor: "pointer", marginTop: 14, background: C.pine, color: C.card, padding: "8px 16px", fontFamily: "'Special Elite', monospace", fontSize: 11 }}>+ AJOUTER LA PAGE</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 30 }}>
        {notes.length === 0 && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19, color: C.inkFaded }}>le carnet attend sa première page…</div>}
        {[...notes].sort((a, b) => b.createdAt - a.createdAt).map((n) => (
          <div key={n.id} style={{ background: C.card, padding: 18, boxShadow: "2px 4px 10px rgba(30,20,10,0.2)", transform: `rotate(${tiltOf(n.id) / 3}deg)`, position: "relative" }}>
            <button onClick={() => onDelete(n.id)} style={{ all: "unset", position: "absolute", top: 12, right: 14, cursor: "pointer", color: C.inkFaded }}><Trash2 size={13} /></button>
            <input style={{ ...underlineInput, fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 18, border: "none" }} value={n.title} onChange={(e) => onUpdate({ ...n, title: e.target.value })} />
            <textarea style={{ ...ruledTextarea, minHeight: 50, border: "none" }} value={n.body} onChange={(e) => onUpdate({ ...n, body: e.target.value })} />
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded, marginTop: 6 }}>{new Date(n.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   VUE — IMPORT LETTERBOXD
   ============================================================ */
/* une ligne de bordereau : intitulé à gauche, chiffre tamponné à droite */
function Tally({ label, value, ink = C.ink }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: "'Lora', serif", fontSize: 13.5, color: C.inkFaded }}>
      <span>{label}</span>
      <span style={{ flex: 1, borderBottom: `1px dotted ${C.line}`, transform: "translateY(-3px)" }} />
      <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 14, color: ink }}>{value}</span>
    </div>
  );
}

const humanSize = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} Mo` : `${Math.round(b / 1024)} Ko`);

/* Le local est rapide et gratuit, mais un navigateur qu'on nettoie efface
   tout : la sauvegarde est le filet, pas une option décorative. */
function BackupPanel({ films, notes, onRestore }) {
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState("");
  const ref = useRef(null);

  useEffect(() => { posterStats().then(setStats).catch(() => setStats(null)); }, [films]);

  const download = async () => {
    setMsg("préparation…");
    const data = await exportBackup({ films, notes });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cine-hub-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(`sauvegarde de ${films.length} fiche(s) téléchargée.`);
  };

  const restore = async (file) => {
    setMsg("lecture…");
    try {
      const { films: f, notes: n } = await importBackup(JSON.parse(await file.text()));
      setMsg(`${onRestore({ films: f, notes: n })} fiche(s) restaurée(s).`);
    } catch (e) {
      setMsg(e.message || "Sauvegarde illisible.");
    }
  };

  return (
    <div style={{ marginTop: 34, border: `1px solid ${C.line}`, background: C.card, padding: "16px 20px" }}>
      <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1, marginBottom: 10 }}>COFFRE À AFFICHES ET SAUVEGARDE</div>
      {stats && (
        <>
          <Tally label="affiches rangées dans la base" value={stats.count} />
          <Tally label="place occupée" value={humanSize(stats.bytes)} />
          {stats.quota?.quota && <Tally label="place disponible" value={humanSize(stats.quota.quota - (stats.quota.usage || 0))} ink={C.pine} />}
        </>
      )}
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, margin: "10px 0 12px", lineHeight: 1.35 }}>
        Tout est stocké sur cette machine. Exportez de temps en temps : vider les données du navigateur effacerait la collection.
      </div>
      <input ref={ref} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => e.target.files[0] && restore(e.target.files[0])} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={download} style={{ all: "unset", cursor: "pointer", padding: "8px 14px", background: C.pine, color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 10.5 }}>EXPORTER MA COLLECTION</button>
        <button onClick={() => ref.current.click()} style={{ all: "unset", cursor: "pointer", padding: "8px 14px", border: `1px solid ${C.line}`, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10.5 }}>RESTAURER UNE SAUVEGARDE</button>
      </div>
      {msg && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.pine, marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

function ImportView({ films, onImport, notes, onRestore }) {
  const [rows, setRows] = useState([]);          // lignes lues, éventuellement enrichies
  const [stats, setStats] = useState(null);      // ce que le fichier contenait
  const [importStatus, setImportStatus] = useState("watched"); // vus / à voir
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);        // bilan après écriture

  const [apiKey, setApiKey] = useState(() => store.get("tmdb-key", ""));
  const [useTmdb, setUseTmdb] = useState(() => !!store.get("tmdb-key", ""));
  const [keyState, setKeyState] = useState("");
  const [progress, setProgress] = useState(null); // { done, total }
  const [tmdbReport, setTmdbReport] = useState(null);
  const fileRef = useRef(null);

  const reset = () => { setRows([]); setStats(null); setFileName(""); setError(""); setTmdbReport(null); setProgress(null); };

  const handleFile = async (file) => {
    reset(); setDone(null); setFileName(file.name);
    try {
      const { rows: parsed, stats: s, kind } = await parseLetterboxdCsv(file);
      setRows(parsed); setStats(s); setImportStatus(kind);
      if (parsed.length === 0) setError("Aucune ligne exploitable trouvée dans ce fichier.");
    } catch {
      setError("Impossible de lire ce fichier CSV.");
    }
  };

  const testKey = async () => {
    setKeyState("…");
    const r = await checkApiKey(apiKey.trim());
    setKeyState(r.ok ? "clé valide" : "clé refusée");
  };

  // Le réalisateur n'est pas dans le CSV : on va le chercher avant de comparer,
  // pour que l'aperçu montre déjà les fiches telles qu'elles seront écrites.
  const runTmdb = async () => {
    const key = apiKey.trim();
    if (!key) return;
    store.set("tmdb-key", key);
    setProgress({ done: 0, total: rows.length });
    const res = await enrichRows(rows, key, { onProgress: (d, t) => setProgress({ done: d, total: t }) });
    setRows(res.rows);
    setTmdbReport({ resolved: res.resolved, failed: res.failed });
    setProgress(null);
  };

  // Rien n'est écrit tant que ce diff n'a pas été validé.
  const diff = useMemo(
    () => (rows.length ? diffImport(films, rows, importStatus) : null),
    [films, rows, importStatus]
  );

  const confirm = () => {
    onImport(diff);
    setDone({ created: diff.toCreate.length, updated: diff.toUpdate.length, unchanged: diff.unchanged.length });
    reset();
  };

  const enriched = rows.filter((r) => r.director).length;

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 680, position: "relative" }}>
      <StampCorner text="ARCHIVES" />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 42, color: C.ink }}>Bordereau d'import</div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, color: C.inkFaded, marginTop: -4, marginBottom: 22 }}>un fichier à la fois, dans l'ordre indiqué ci-dessous</div>

      {/* L'export Letterboxd est un zip de plusieurs CSV : chacun ne contient
          qu'une partie de l'histoire, d'où l'ordre conseillé. */}
      <div style={{ border: `1px solid ${C.line}`, background: C.card, padding: "16px 20px", marginBottom: 22 }}>
        <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1, marginBottom: 4 }}>QUELS FICHIERS DÉPOSER</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 13, color: C.inkFaded, marginBottom: 12 }}>
          Letterboxd vous livre un zip : dézippez-le, puis déposez ces fichiers un par un.
        </div>
        {[
          { n: "watched.csv", d: "tous les films vus — la base de la collection", ink: C.pine, ordre: "1" },
          { n: "ratings.csv", d: "vos notes ; complète les fiches déjà créées", ink: C.burgundy, ordre: "2" },
          { n: "watchlist.csv", d: "vos envies ; atterrit dans l'onglet « À voir »", ink: C.cobalt, ordre: "3" },
        ].map((f) => (
          <div key={f.n} style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 7 }}>
            <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 12, color: C.card, background: f.ink, width: 18, height: 18, lineHeight: "18px", textAlign: "center", borderRadius: "50%", flexShrink: 0 }}>{f.ordre}</span>
            <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 12, color: f.ink }}>{f.n}</span>
            <span style={{ fontFamily: "'Lora', serif", fontSize: 12.5, color: C.inkFaded }}>{f.d}</span>
          </div>
        ))}
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, marginTop: 12, lineHeight: 1.35 }}>
          L'ordre compte peu, mais watched.csv d'abord évite d'oublier les films vus sans note.
          diary.csv est optionnel : il n'ajoute que les dates de séance.
          Rien n'est jamais dupliqué — repassez les fichiers autant de fois que vous voulez.
        </div>
      </div>

      <div style={{ border: `2px dashed ${C.line}`, padding: 34, textAlign: "center", background: C.paperDark }}>
        <Upload size={24} color={C.burgundy} style={{ marginBottom: 10 }} />
        <div style={{ color: C.ink, fontFamily: "'Lora', serif", fontSize: 14, marginBottom: 14 }}>letterboxd.com → Settings → Import &amp; Export → Export your data</div>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        <button onClick={() => fileRef.current.click()} style={{ all: "unset", cursor: "pointer", background: C.burgundy, color: C.card, padding: "9px 18px", fontFamily: "'Special Elite', monospace", fontSize: 11.5 }}>CHOISIR UN FICHIER</button>
        {fileName && <div style={{ color: C.inkFaded, fontSize: 12, marginTop: 10, fontFamily: "'Special Elite', monospace" }}>{fileName}</div>}
      </div>

      {error && <div style={{ marginTop: 16, color: C.burgundy, fontFamily: "'Caveat', cursive", fontSize: 19 }}>{error}</div>}

      {done && (
        <div style={{ marginTop: 20, border: `1px solid ${C.pine}`, background: C.card, padding: "14px 18px" }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.pine, letterSpacing: 1, marginBottom: 8 }}>IMPORT TERMINÉ</div>
          <Tally label="fiches créées" value={done.created} ink={C.pine} />
          <Tally label="fiches mises à jour" value={done.updated} ink={C.ochre} />
          <Tally label="déjà à jour, inchangées" value={done.unchanged} />
        </div>
      )}

      {/* ---- vérification de la lecture du fichier ---- */}
      {stats && (
        <div style={{ marginTop: 24, border: `1px solid ${C.line}`, background: C.card, padding: "16px 20px" }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1, marginBottom: 10 }}>CE QUE CONTIENT LE FICHIER</div>
          <Tally label="lignes lues" value={stats.lines} />
          <Tally label="films distincts" value={stats.total} />
          <Tally label="avec une note" value={stats.withRating} ink={stats.withRating ? C.pine : C.inkFaded} />
          <Tally label="sans note" value={stats.withoutRating} />
          {stats.duplicatesInFile > 0 && <Tally label="revoyures regroupées" value={stats.duplicatesInFile} ink={C.ochre} />}
          {stats.skippedNoTitle > 0 && <Tally label="lignes sans titre, ignorées" value={stats.skippedNoTitle} ink={C.burgundy} />}

          <div style={{ marginTop: 16 }}>
            <Label>Ces films sont</Label>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              {[{ k: "watched", l: "des films vus" }, { k: "watchlist", l: "à voir" }].map((o) => (
                <button key={o.k} onClick={() => setImportStatus(o.k)} style={{
                  all: "unset", cursor: "pointer", padding: "6px 14px",
                  fontFamily: "'Special Elite', monospace", fontSize: 11,
                  background: importStatus === o.k ? C.cobalt : "transparent",
                  color: importStatus === o.k ? C.card : C.inkFaded,
                  border: `1px solid ${importStatus === o.k ? C.cobalt : C.line}`,
                }}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- réalisateurs via TMDB ---- */}
      {rows.length > 0 && (
        <div style={{ marginTop: 20, border: `1px solid ${C.line}`, background: C.paperDark, padding: "16px 20px" }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1 }}>RÉALISATEUR·RICE, GENRES ET AFFICHES</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 13, color: C.inkFaded, margin: "6px 0 12px" }}>
            Letterboxd n'exporte ni le réalisateur ni les affiches. TMDB retrouve les deux (clé gratuite sur themoviedb.org).
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Label>Clé API TMDB</Label>
              <input style={underlineInput} value={apiKey} type="password" placeholder="collez votre clé ici"
                onChange={(e) => { setApiKey(e.target.value); setKeyState(""); setUseTmdb(!!e.target.value.trim()); }} />
            </div>
            <button onClick={testKey} disabled={!apiKey.trim()} style={{ all: "unset", cursor: apiKey.trim() ? "pointer" : "not-allowed", padding: "7px 14px", border: `1px solid ${C.line}`, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10.5 }}>TESTER</button>
          </div>
          {keyState && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: keyState === "clé valide" ? C.pine : C.burgundy, marginTop: 6 }}>{keyState}</div>}

          {progress ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 6, background: C.line, position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, right: `${100 - (progress.done / progress.total) * 100}%`, background: C.ochre, transition: "right .2s linear" }} />
              </div>
              <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10.5, color: C.inkFaded, marginTop: 6 }}>{progress.done} / {progress.total} interrogés…</div>
            </div>
          ) : (
            <button onClick={runTmdb} disabled={!apiKey.trim() || !useTmdb} style={{ all: "unset", cursor: apiKey.trim() ? "pointer" : "not-allowed", marginTop: 14, background: apiKey.trim() ? C.ochre : C.line, color: C.card, padding: "9px 16px", fontFamily: "'Special Elite', monospace", fontSize: 11 }}>
              COMPLÉTER LES {rows.length} FICHE(S)
            </button>
          )}

          {tmdbReport && (
            <div style={{ marginTop: 12 }}>
              <Tally label="réalisateurs trouvés" value={tmdbReport.resolved} ink={C.pine} />
              {tmdbReport.failed > 0 && <Tally label="films non identifiés" value={tmdbReport.failed} ink={C.burgundy} />}
            </div>
          )}
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded, marginTop: 10 }}>
            L'import fonctionne aussi sans clé : les fiches seront simplement créées sans réalisateur.
          </div>
        </div>
      )}

      {/* ---- diff avant écriture ---- */}
      {diff && (
        <div style={{ marginTop: 22 }}>
          <Label>Ce qui va être écrit</Label>
          <div style={{ display: "flex", gap: 26, margin: "10px 0 14px", fontFamily: "'Special Elite', monospace" }}>
            {[["nouveaux", diff.toCreate.length, C.pine], ["mis à jour", diff.toUpdate.length, C.ochre], ["inchangés", diff.unchanged.length, C.inkFaded]].map(([l, n, ink]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, color: ink }}>{n}</div>
                <div style={{ fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>{l.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {diff.toUpdate.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded, marginBottom: 4 }}>fiches existantes retouchées (vos critiques et notes libres sont conservées)</div>
              <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.line}`, background: C.card }}>
                {diff.toUpdate.map(({ film, changes }) => (
                  <div key={film.id} style={{ padding: "7px 14px", borderBottom: `1px solid ${C.line}`, fontFamily: "'Lora', serif", fontSize: 13, color: C.ink }}>
                    {film.title} {film.year && <span style={{ color: C.inkFaded }}>({film.year})</span>}
                    <span style={{ color: C.ochre, fontFamily: "'Special Elite', monospace", fontSize: 10.5, marginLeft: 8 }}>
                      {"rating" in changes && `note ${film.rating || 0} → ${changes.rating}`}
                      {changes.director && ` · réalisateur : ${changes.director}`}
                      {changes.watchedAt && ` · vu le ${changes.watchedAt}`}
                      {changes.status && " · passe en « vu »"}
                      {changes.genres && " · genres"}
                      {changes.poster && " · affiche"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diff.toCreate.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.line}`, background: C.card }}>
              {diff.toCreate.slice(0, 60).map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${C.line}`, fontFamily: "'Lora', serif", fontSize: 13, color: C.ink }}>
                  <span>
                    {f.title} {f.year && <span style={{ color: C.inkFaded }}>({f.year})</span>}
                    {f.director && <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded }}> — {f.director}</span>}
                  </span>
                  {importStatus === "watched" && f.rating > 0 && <InkStars value={f.rating} size={11} />}
                </div>
              ))}
              {diff.toCreate.length > 60 && <div style={{ padding: "8px 14px", fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded }}>…et {diff.toCreate.length - 60} autres</div>}
            </div>
          )}

          {enriched === 0 && (
            <div style={{ marginTop: 10, fontFamily: "'Caveat', cursive", fontSize: 17, color: C.burgundy }}>
              Aucun réalisateur pour l'instant — complétez via TMDB ci-dessus avant de valider, sinon les fiches resteront « anonyme ».
            </div>
          )}

          <button
            onClick={confirm}
            disabled={diff.toCreate.length === 0 && diff.toUpdate.length === 0}
            style={{
              all: "unset", marginTop: 16, padding: "11px 20px",
              cursor: diff.toCreate.length || diff.toUpdate.length ? "pointer" : "not-allowed",
              background: diff.toCreate.length || diff.toUpdate.length ? C.pine : C.line,
              color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 11.5, letterSpacing: 1,
            }}
          >
            {diff.toCreate.length || diff.toUpdate.length
              ? `VALIDER — ${diff.toCreate.length} CRÉÉE(S), ${diff.toUpdate.length} MISE(S) À JOUR`
              : "TOUT EST DÉJÀ À JOUR"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 26, fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded }}>
        {films.length} film(s) déjà au catalogue — un réimport met à jour les fiches existantes au lieu de les dupliquer.
      </div>

      <BackupPanel films={films} notes={notes} onRestore={onRestore} />
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [films, setFilms] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library");
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // les fiches d'avant les champs status/watchedAt/tmdbId sont complétées ici
    const migrated = migrate(store.get("films", []));
    setFilms(migrated);
    store.set("films", migrated);
    setNotes(store.get("notebook-notes", []));
    setLoaded(true);
  }, []);

  const saveFilms = (next) => { setFilms(next); store.set("films", next); };
  const saveNotes = (next) => { setNotes(next); store.set("notebook-notes", next); };

  const addFilm = (film) => { saveFilms([film, ...films]); setShowModal(false); };
  const updateFilm = (film) => saveFilms(films.map((f) => (f.id === film.id ? film : f)));
  const deleteFilm = (id) => {
    const next = films.filter((f) => f.id !== id);
    saveFilms(next);
    pruneOrphans(next).catch(console.error);  // l'affiche part avec la fiche
    setView("library"); setSelectedId(null);
  };

  /* Relier deux fiches, c'est écrire des deux côtés : ouvrir l'un ou l'autre
     doit montrer le même fil. Les deux moitiés partagent un pairId, ce qui
     permet de les défaire ensemble. */
  const linkFilms = (fromId, toId, note = "") => {
    const a = films.find((f) => f.id === fromId);
    const b = films.find((f) => f.id === toId);
    if (!a || !b || a.id === b.id) return;
    if ((a.linkedWorks || []).some((w) => w.filmId === b.id)) return;  // déjà relié

    const pairId = uid();
    const card = (target) => ({
      id: uid(), pairId, type: "film", filmId: target.id,
      title: target.title, creator: target.director || "", note: note.trim(),
    });
    saveFilms(films.map((f) =>
      f.id === a.id ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(b)] }
      : f.id === b.id ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(a)] }
      : f
    ));
  };

  /* Défaire un lien : la moitié réciproque part avec lui. */
  const removeLink = (ownerId, workId) => {
    const owner = films.find((f) => f.id === ownerId);
    const work = (owner?.linkedWorks || []).find((w) => w.id === workId);
    if (!work) return;
    saveFilms(films.map((f) => {
      if (f.id === ownerId) return { ...f, linkedWorks: f.linkedWorks.filter((w) => w.id !== workId) };
      if (work.pairId && f.id === work.filmId) return { ...f, linkedWorks: (f.linkedWorks || []).filter((w) => w.pairId !== work.pairId) };
      return f;
    }));
  };

  const restoreBackup = ({ films: f, notes: n }) => {
    const migrated = migrate(f);
    saveFilms(migrated);
    if (n?.length) saveNotes(n);
    return migrated.length;
  };

  /* Applique le diff déjà validé à l'écran : les mises à jour sont fusionnées
     champ par champ, jamais un remplacement de fiche. */
  const importFilms = ({ toCreate, toUpdate }) => {
    const patches = new Map(toUpdate.map(({ film, changes }) => [film.id, changes]));
    const merged = films.map((f) => (patches.has(f.id) ? { ...f, ...patches.get(f.id) } : f));
    saveFilms([...toCreate, ...merged]);
  };

  const selectedFilm = films.find((f) => f.id === selectedId);
  const watched = useMemo(() => films.filter((f) => f.status !== "watchlist"), [films]);
  const watchlist = useMemo(() => films.filter((f) => f.status === "watchlist"), [films]);
  // le mur d'où l'on vient : « je l'ai vu » depuis la watchlist doit ramener au bon endroit
  const backView = selectedFilm?.status === "watchlist" ? "watchlist" : "library";

  if (!loaded) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.inkFaded, fontFamily: "'Caveat', cursive", fontSize: 22 }}>
        <style>{FONT_IMPORT}</style>
        ouverture du classeur…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", position: "relative",
      // le kraft n'est pas uniforme : des nappes plus claires là où la lumière tombe
      background: `
        radial-gradient(circle at 18% 12%, #F5EDD8 0%, transparent 45%),
        radial-gradient(circle at 82% 68%, #F2E9D2 0%, transparent 40%),
        radial-gradient(circle at 55% 100%, #E5D6B4 0%, transparent 50%),
        ${C.paper}`,
    }}>
      <style>{FONT_IMPORT}</style>
      <PaperGrain />
      <FolderTabs view={view} setView={(v) => { setView(v); setSelectedId(null); }} onAdd={() => setShowModal(true)} />
      <div style={{ flex: 1, position: "relative", zIndex: 2 }}>
        {view === "library" && !selectedId && <LibraryView wall="watched" films={watched} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "watchlist" && !selectedId && <LibraryView wall="watchlist" films={watchlist} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "detail" && selectedFilm && (
          <DetailView
            film={selectedFilm}
            films={films}
            onBack={() => { setView(backView); setSelectedId(null); }}
            onUpdate={updateFilm}
            onDelete={deleteFilm}
            onLinkFilm={linkFilms}
            onRemoveLink={removeLink}
            onOpen={(id) => setSelectedId(id)}
          />
        )}
        {view === "constellation" && <ConstellationView films={watched} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "notebook" && <NotebookView notes={notes} onAdd={(n) => saveNotes([n, ...notes])} onUpdate={(n) => saveNotes(notes.map((x) => (x.id === n.id ? n : x)))} onDelete={(id) => saveNotes(notes.filter((x) => x.id !== id))} />}
        {view === "import" && <ImportView onImport={importFilms} films={films} notes={notes} onRestore={restoreBackup} />}
      </div>
      {showModal && <FilmModal onClose={() => setShowModal(false)} onSave={addFilm} />}
    </div>
  );
}
