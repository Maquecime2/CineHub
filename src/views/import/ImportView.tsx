/* ============================================================
   VUE — IMPORT LETTERBOXD
   ============================================================ */
import { useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput } from "../../theme/styles";
import { Label, Tally, InkStars } from "../../components/ui";
import { StampCorner } from "../../components/atmosphere";
import { store } from "../../services/storage";
import { parseLetterboxdCsv, diffImport, filmKey } from "../../domain/importing";
import {
  fetchLetterboxdFeed,
  fetchLetterboxdWatchlist,
  DEFAULT_RELAY,
  USER_KEY,
  RELAY_KEY,
} from "../../services/letterboxd";
import { enrichRows, checkApiKey } from "../../tmdb";
import { BackupPanel } from "./BackupPanel";
import { CompletePanel } from "./CompletePanel";
import type {
  Divider,
  Film,
  FilmStatus,
  ImportDiff,
  ImportRow,
  ImportStats,
  Note,
  ShelfViews,
} from "../../types";
import type { Fil } from "../../domain/fils";
import type { VocabulaireStocké as Vocabulaire } from "../../domain/motifs";

/** Les deux natures d'import proposées sous le relevé du fichier. */
const IMPORT_STATUSES: { k: FilmStatus; l: string }[] = [
  { k: "watched", l: "des films vus" },
  { k: "watchlist", l: "à voir" },
];

interface ImportViewProps {
  films: Film[];
  onImport: (diff: ImportDiff) => void;
  notes: Note[];
  dividers: Divider[];
  views: ShelfViews | null;
  fils: Fil[];
  motifs: Vocabulaire;
  onRestore: (data: {
    films: Film[];
    notes: Note[];
    dividers: Divider[];
    views: ShelfViews | null;
    fils: Fil[];
    motifs: Vocabulaire;
  }) => void;
}

export function ImportView({
  films,
  onImport,
  notes,
  dividers,
  views,
  fils,
  motifs,
  onRestore,
}: ImportViewProps) {
  const [rows, setRows] = useState<ImportRow[]>([]); // lignes lues, éventuellement enrichies
  const [stats, setStats] = useState<ImportStats | null>(null); // ce que le fichier contenait
  const [importStatus, setImportStatus] = useState<FilmStatus>("watched"); // vus / à voir
  /* Décoché par défaut, et il faut que ça le reste : compléter ne perd
     jamais rien, remplacer peut effacer des séances saisies à la main. */
  const [autorite, setAutorite] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ created: number; updated: number; unchanged: number } | null>(
    null
  ); // bilan après écriture

  const [apiKey, setApiKey] = useState(() => store.get("tmdb-key", ""));
  const [useTmdb, setUseTmdb] = useState(() => !!store.get("tmdb-key", ""));
  const [keyState, setKeyState] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null); // { done, total }
  const [tmdbReport, setTmdbReport] = useState<{ resolved: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* Le flux Letterboxd. Le pseudo se retient d'une fois sur l'autre — on
     ne relève pas le flux d'un autre par accident. Le relais, lui, reste
     replié : personne ne devrait avoir à le regarder tant qu'il marche. */
  const [lbUser, setLbUser] = useState(() => store.get(USER_KEY, ""));
  const [relay, setRelay] = useState(() => store.get(RELAY_KEY, DEFAULT_RELAY));
  const [showRelay, setShowRelay] = useState(false);
  const [feeding, setFeeding] = useState(false);
  /* Une watchlist se lit en plusieurs pages : le bouton dit laquelle,
     sinon un profil de six cents films paraît figé une minute durant. */
  const [pages, setPages] = useState<{ done: number; total: number } | null>(null);
  /* Les fiches « à voir » venues de Letterboxd que la watchlist en ligne
     ne porte plus. On les MONTRE sans y toucher : la watchlist relevée
     dit ce qu'elle contient aujourd'hui, pas ce qu'il faut jeter. */
  const [dropped, setDropped] = useState<Film[]>([]);

  const reset = () => {
    setRows([]);
    setStats(null);
    setFileName("");
    setError("");
    setTmdbReport(null);
    setProgress(null);
    // un nouveau fichier ne fait pas autorité parce que le précédent l'a fait
    setAutorite(false);
  };

  const handleFile = async (file: File) => {
    reset();
    setDropped([]);
    setDone(null);
    setFileName(file.name);
    try {
      const { rows: parsed, stats: s, kind } = await parseLetterboxdCsv(file);
      setRows(parsed);
      setStats(s);
      setImportStatus(kind);
      if (parsed.length === 0) setError("Aucune ligne exploitable trouvée dans ce fichier.");
    } catch {
      setError("Impossible de lire ce fichier CSV.");
    }
  };

  /* Relever le flux revient exactement au même que déposer un fichier :
     on remplit `rows` et `stats`, et tout l'aval — l'aperçu, le passage
     TMDB, le diff, la validation — ne sait pas d'où ça vient. */
  const runFeed = async () => {
    reset();
    setDropped([]);
    setDone(null);
    setFeeding(true);
    try {
      const { rows: parsed, stats: s, kind } = await fetchLetterboxdFeed(lbUser, relay);
      store.set(USER_KEY, lbUser.trim().replace(/^@/, ""));
      store.set(RELAY_KEY, relay.trim() || DEFAULT_RELAY);
      setRows(parsed);
      setStats(s);
      setImportStatus(kind);
      setFileName(`flux de ${lbUser.trim().replace(/^@/, "")}`);
      if (parsed.length === 0) setError("Ce flux ne contient aucune séance.");
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
    setFeeding(false);
  };

  /* Les envies qu'on a ici et que Letterboxd n'a plus. On ne regarde que
     les fiches VENUES de Letterboxd : un film rangé depuis le bureau des
     découvertes n'a jamais été sur ce compte, et l'annoncer comme retiré
     serait un contresens. */
  const absentFrom = (parsed: ImportRow[]): Film[] => {
    const keys = new Set(parsed.map(filmKey));
    const ids = new Set(parsed.filter((r) => r.tmdbId).map((r) => String(r.tmdbId)));
    return films.filter(
      (f) =>
        f.status === "watchlist" &&
        f.source === "letterboxd" &&
        !keys.has(filmKey(f)) &&
        !(f.tmdbId && ids.has(String(f.tmdbId)))
    );
  };

  /* La watchlist n'a pas de flux : elle se lit dans les pages publiques
     du profil. Le relevé ressemble en tout au précédent — c'est voulu :
     l'aval ne doit toujours pas savoir d'où viennent les lignes. */
  const runWatchlist = async () => {
    reset();
    setDropped([]);
    setDone(null);
    setFeeding(true);
    const pseudo = lbUser.trim().replace(/^@/, "");
    try {
      const { rows: parsed, stats: s } = await fetchLetterboxdWatchlist(lbUser, relay, {
        onProgress: (done, total) => setPages({ done, total }),
      });
      store.set(USER_KEY, pseudo);
      store.set(RELAY_KEY, relay.trim() || DEFAULT_RELAY);
      setRows(parsed);
      setStats(s);
      setImportStatus("watchlist");
      setFileName(`watchlist de ${pseudo}`);
      setDropped(absentFrom(parsed));
      if (parsed.length === 0) setError("Cette watchlist est vide.");
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
    setPages(null);
    setFeeding(false);
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
    const res = await enrichRows(rows, key, {
      onProgress: (d: number, t: number) => setProgress({ done: d, total: t }),
    } as never);
    setRows(res.rows);
    setTmdbReport({ resolved: res.resolved, failed: res.failed });
    setProgress(null);
  };

  // Rien n'est écrit tant que ce diff n'a pas été validé.
  const diff = useMemo(
    () =>
      rows.length
        ? diffImport(films, rows, importStatus, { authoritativeWatches: autorite })
        : null,
    [films, rows, importStatus, autorite]
  );

  /* Le choix « ce fichier fait autorité » n'a de sens que si le fichier
     porte des séances : seul diary.csv et le flux en ont. */
  const porteDesSeances = rows.some((r) => r.watches?.length);

  const confirm = () => {
    if (!diff) return;
    onImport(diff);
    setDone({
      created: diff.toCreate.length,
      updated: diff.toUpdate.length,
      unchanged: diff.unchanged.length,
    });
    reset();
  };

  const enriched = rows.filter((r) => r.director).length;

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 680, position: "relative" }}>
      <StampCorner text="ARCHIVES" />
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 42,
          color: C.ink,
        }}
      >
        Bordereau d'import
      </div>
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 20,
          color: C.inkFaded,
          marginTop: -4,
          marginBottom: 22,
        }}
      >
        un fichier à la fois, dans l'ordre indiqué ci-dessous
      </div>

      {/* L'export Letterboxd est un zip de plusieurs CSV : chacun ne contient
          qu'une partie de l'histoire, d'où l'ordre conseillé. */}
      <div
        style={{
          border: `1px solid ${C.line}`,
          background: C.card,
          padding: "16px 20px",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            color: C.inkFaded,
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          QUELS FICHIERS DÉPOSER
        </div>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.inkFaded, marginBottom: 12 }}>
          Letterboxd vous livre un zip : dézippez-le, puis déposez ces fichiers un par un.
        </div>
        {[
          {
            n: "watched.csv",
            d: "tous les films vus — la base de la collection",
            ink: C.pine,
            ordre: "1",
          },
          {
            n: "ratings.csv",
            d: "vos notes ; complète les fiches déjà créées",
            ink: C.burgundy,
            ordre: "2",
          },
          {
            n: "diary.csv",
            d: "chaque séance, une par une : c'est lui qui compte les visionnages",
            ink: C.ochre,
            ordre: "3",
          },
          {
            n: "watchlist.csv",
            d: "vos envies ; atterrit dans l'onglet « À voir »",
            ink: C.cobalt,
            ordre: "4",
          },
        ].map((f) => (
          <div key={f.n} style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 7 }}>
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 12,
                color: C.card,
                background: f.ink,
                width: 18,
                height: 18,
                lineHeight: "18px",
                textAlign: "center",
                borderRadius: "50%",
                flexShrink: 0,
              }}
            >
              {f.ordre}
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: f.ink }}>{f.n}</span>
            <span style={{ fontFamily: F.body, fontSize: 12.5, color: C.inkFaded }}>{f.d}</span>
          </div>
        ))}
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 17,
            color: C.inkFaded,
            marginTop: 12,
            lineHeight: 1.35,
          }}
        >
          L'ordre compte peu, mais watched.csv d'abord évite d'oublier les films vus sans note.
          diary.csv est le seul à porter une ligne par séance : c'est de lui que viennent le nombre
          de visionnages et l'évolution de vos notes. Rien n'est jamais dupliqué — repassez les
          fichiers autant de fois que vous voulez.
        </div>
      </div>

      {/* LE FLUX — pour la mise à jour, quand le zip est pour l'amorçage.
          Il est placé APRÈS les fichiers et non avant : c'est le CSV qui
          bâtit une vidéothèque, le flux ne fait que la tenir à jour. */}
      <div
        data-tour="import-feed"
        style={{
          border: `1px solid ${C.line}`,
          background: C.card,
          padding: "16px 20px",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            color: C.inkFaded,
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          OU RELEVER VOTRE PROFIL
        </div>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.inkFaded, marginBottom: 12 }}>
          Sans fichier, directement depuis votre profil public. <strong>Séances</strong> ne rend que
          vos cinquante dernières : c'est de quoi tenir la collection à jour, pas de quoi la bâtir.{" "}
          <strong>Watchlist</strong> la relève entière, page après page.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Label>Pseudo Letterboxd</Label>
            <input
              style={underlineInput}
              value={lbUser}
              placeholder="votre-pseudo"
              onChange={(e) => setLbUser(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && lbUser.trim() && !feeding) runFeed();
              }}
            />
          </div>
          {/* Deux relevés, un seul pseudo : les séances viennent du flux,
              la watchlist des pages du profil — mais c'est le même compte,
              et ce serait le redemander pour rien. */}
          {(
            [
              ["SÉANCES", runFeed, feeding ? "…" : "SÉANCES"],
              [
                "WATCHLIST",
                runWatchlist,
                feeding && pages ? `PAGE ${pages.done}/${pages.total}` : "WATCHLIST",
              ],
            ] as [string, () => void, string][]
          ).map(([k, run, label]) => (
            <button
              key={k}
              onClick={run}
              disabled={!lbUser.trim() || feeding}
              style={{
                all: "unset",
                cursor: lbUser.trim() && !feeding ? "pointer" : "not-allowed",
                padding: "7px 14px",
                border: `1px solid ${C.line}`,
                color: C.inkFaded,
                fontFamily: F.mono,
                fontSize: 10.5,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Le relais, replié. Letterboxd n'autorise pas la lecture de son
            flux depuis un autre site : il faut un intermédiaire, et celui
            par défaut est un service public. Qui préfère le sien le colle
            ici — c'est expliqué dans docs/relais-letterboxd.md. */}
        <button
          onClick={() => setShowRelay((v) => !v)}
          style={{
            all: "unset",
            cursor: "pointer",
            marginTop: 10,
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            textDecoration: "underline",
          }}
        >
          relais
        </button>
        {showRelay && (
          <div style={{ marginTop: 8 }}>
            <Label>Adresse du relais</Label>
            <input
              style={underlineInput}
              value={relay}
              placeholder={DEFAULT_RELAY}
              onChange={(e) => setRelay(e.target.value)}
            />
            <div
              style={{
                fontFamily: F.hand,
                fontSize: 16,
                color: C.inkFaded,
                marginTop: 6,
                lineHeight: 1.35,
              }}
            >
              Letterboxd interdit la lecture de son flux depuis un autre site : un intermédiaire va
              le chercher à votre place. Celui par défaut est un service public — il peut ralentir
              ou disparaître. <code>{"{url}"}</code> est remplacé par l'adresse du flux. En local,
              ce réglage ne sert pas : le serveur de développement relaie lui-même.
            </div>
          </div>
        )}
      </div>

      <div
        data-tour="import-drop"
        style={{
          border: `2px dashed ${C.line}`,
          padding: 34,
          textAlign: "center",
          background: C.paperDark,
        }}
      >
        <Upload size={24} color={C.burgundy} style={{ marginBottom: 10 }} />
        <div style={{ color: C.ink, fontFamily: F.body, fontSize: 14, marginBottom: 14 }}>
          letterboxd.com → Settings → Import &amp; Export → Export your data
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            all: "unset",
            cursor: "pointer",
            background: C.burgundy,
            color: C.card,
            padding: "9px 18px",
            fontFamily: F.mono,
            fontSize: 11.5,
          }}
        >
          CHOISIR UN FICHIER
        </button>
        {fileName && (
          <div
            style={{
              color: C.inkFaded,
              fontSize: 12,
              marginTop: 10,
              fontFamily: F.mono,
            }}
          >
            {fileName}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            color: C.burgundy,
            fontFamily: F.hand,
            fontSize: 19,
          }}
        >
          {error}
        </div>
      )}

      {done && (
        <div
          style={{
            marginTop: 20,
            border: `1px solid ${C.pine}`,
            background: C.card,
            padding: "14px 18px",
          }}
        >
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              color: C.pine,
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            IMPORT TERMINÉ
          </div>
          <Tally label="fiches créées" value={done.created} ink={C.pine} />
          <Tally label="fiches mises à jour" value={done.updated} ink={C.ochre} />
          <Tally label="déjà à jour, inchangées" value={done.unchanged} />
        </div>
      )}

      {/* ---- vérification de la lecture du fichier ---- */}
      {stats && (
        <div
          style={{
            marginTop: 24,
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
            CE QUE CONTIENT LE FICHIER
          </div>
          <Tally label="lignes lues" value={stats.lines} />
          <Tally label="films distincts" value={stats.total} />
          <Tally
            label="avec une note"
            value={stats.withRating}
            ink={stats.withRating ? C.pine : C.inkFaded}
          />
          <Tally label="sans note" value={stats.withoutRating} />
          {stats.duplicatesInFile > 0 && (
            <Tally label="revoyures regroupées" value={stats.duplicatesInFile} ink={C.ochre} />
          )}
          {stats.skippedNoTitle > 0 && (
            <Tally
              label="lignes sans titre, ignorées"
              value={stats.skippedNoTitle}
              ink={C.burgundy}
            />
          )}

          <div style={{ marginTop: 16 }}>
            <Label>Ces films sont</Label>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              {IMPORT_STATUSES.map((o) => (
                <button
                  key={o.k}
                  onClick={() => setImportStatus(o.k)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    padding: "6px 14px",
                    fontFamily: F.mono,
                    fontSize: 11,
                    background: importStatus === o.k ? C.cobalt : "transparent",
                    color: importStatus === o.k ? C.card : C.inkFaded,
                    border: `1px solid ${importStatus === o.k ? C.cobalt : C.line}`,
                  }}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* LA RÉPARATION DES JOURNAILS. Longtemps, une fiche déposée par
              watched.csv récoltait une séance à la date où elle avait été
              AJOUTÉE, et diary.csv en ajoutait une seconde à la date où le
              film avait été vu : un « ×2 » sous un film vu une fois. Le
              premier travers est corrigé à la lecture, mais les fiches déjà
              écrites gardent leur séance en trop — et compléter ne sait pas
              défaire. Cette case le peut, une fois. */}
          {porteDesSeances && importStatus === "watched" && (
            <div style={{ marginTop: 16 }}>
              <label
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  cursor: "pointer",
                  fontFamily: F.body,
                  fontSize: 13,
                  color: C.ink,
                }}
              >
                <input
                  type="checkbox"
                  checked={autorite}
                  onChange={(e) => setAutorite(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  Ce relevé fait autorité sur les séances
                  <span
                    style={{
                      display: "block",
                      fontFamily: F.hand,
                      fontSize: 16,
                      color: C.inkFaded,
                      lineHeight: 1.35,
                    }}
                  >
                    D&apos;ordinaire les journaux se complètent, et rien ne se perd. Coché, le
                    journal des films cités est <strong>remplacé</strong> par celui-ci : c&apos;est
                    ce qu&apos;il faut pour effacer une séance en trop, et c&apos;est aussi ce qui
                    efface les séances ajoutées à la main.
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* ---- réalisateurs via TMDB ---- */}
      {rows.length > 0 && (
        <div
          style={{
            marginTop: 20,
            border: `1px solid ${C.line}`,
            background: C.paperDark,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              color: C.inkFaded,
              letterSpacing: 1,
            }}
          >
            RÉALISATEUR·RICE, GENRES ET AFFICHES
          </div>
          <div
            style={{
              fontFamily: F.body,
              fontSize: 13,
              color: C.inkFaded,
              margin: "6px 0 12px",
            }}
          >
            Letterboxd n'exporte ni le réalisateur ni les affiches. TMDB retrouve les deux (clé
            gratuite sur themoviedb.org).
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Label>Clé API TMDB</Label>
              <input
                style={underlineInput}
                value={apiKey}
                type="password"
                placeholder="collez votre clé ici"
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setKeyState("");
                  setUseTmdb(!!e.target.value.trim());
                }}
              />
            </div>
            <button
              onClick={testKey}
              disabled={!apiKey.trim()}
              style={{
                all: "unset",
                cursor: apiKey.trim() ? "pointer" : "not-allowed",
                padding: "7px 14px",
                border: `1px solid ${C.line}`,
                color: C.inkFaded,
                fontFamily: F.mono,
                fontSize: 10.5,
              }}
            >
              TESTER
            </button>
          </div>
          {keyState && (
            <div
              style={{
                fontFamily: F.hand,
                fontSize: 17,
                color: keyState === "clé valide" ? C.pine : C.burgundy,
                marginTop: 6,
              }}
            >
              {keyState}
            </div>
          )}

          {progress ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 6, background: C.line, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    right: `${100 - (progress.done / progress.total) * 100}%`,
                    background: C.ochre,
                    transition: "right .2s linear",
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  color: C.inkFaded,
                  marginTop: 6,
                }}
              >
                {progress.done} / {progress.total} interrogés…
              </div>
            </div>
          ) : (
            <button
              onClick={runTmdb}
              disabled={!apiKey.trim() || !useTmdb}
              style={{
                all: "unset",
                cursor: apiKey.trim() ? "pointer" : "not-allowed",
                marginTop: 14,
                background: apiKey.trim() ? C.ochre : C.line,
                color: C.card,
                padding: "9px 16px",
                fontFamily: F.mono,
                fontSize: 11,
              }}
            >
              COMPLÉTER LES {rows.length} FICHE(S)
            </button>
          )}

          {tmdbReport && (
            <div style={{ marginTop: 12 }}>
              <Tally label="réalisateurs trouvés" value={tmdbReport.resolved} ink={C.pine} />
              {tmdbReport.failed > 0 && (
                <Tally label="films non identifiés" value={tmdbReport.failed} ink={C.burgundy} />
              )}
            </div>
          )}
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 16,
              color: C.inkFaded,
              marginTop: 10,
            }}
          >
            L'import fonctionne aussi sans clé : les fiches seront simplement créées sans
            réalisateur.
          </div>
        </div>
      )}

      {/* ---- diff avant écriture ---- */}
      {diff && (
        <div style={{ marginTop: 22 }}>
          <Label>Ce qui va être écrit</Label>
          <div
            style={{
              display: "flex",
              gap: 26,
              margin: "10px 0 14px",
              fontFamily: F.mono,
            }}
          >
            {(
              [
                ["nouveaux", diff.toCreate.length, C.pine],
                ["mis à jour", diff.toUpdate.length, C.ochre],
                ["inchangés", diff.unchanged.length, C.inkFaded],
              ] as [string, number, string][]
            ).map(([l, n, ink]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, color: ink }}>{n}</div>
                <div style={{ fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>
                  {l.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {diff.toUpdate.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontFamily: F.hand,
                  fontSize: 18,
                  color: C.inkFaded,
                  marginBottom: 4,
                }}
              >
                fiches existantes retouchées (vos critiques et notes libres sont conservées)
              </div>
              <div
                style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  border: `1px solid ${C.line}`,
                  background: C.card,
                }}
              >
                {diff.toUpdate.map(({ film, changes }) => (
                  <div
                    key={film.id}
                    style={{
                      padding: "7px 14px",
                      borderBottom: `1px solid ${C.line}`,
                      fontFamily: F.body,
                      fontSize: 13,
                      color: C.ink,
                    }}
                  >
                    {film.title}{" "}
                    {film.year && <span style={{ color: C.inkFaded }}>({film.year})</span>}
                    <span
                      style={{
                        color: C.ochre,
                        fontFamily: F.mono,
                        fontSize: 10.5,
                        marginLeft: 8,
                      }}
                    >
                      {"rating" in changes && `note ${film.rating || 0} → ${changes.rating}`}
                      {changes.director && ` · réalisateur : ${changes.director}`}
                      {changes.watchedAt && ` · vu le ${changes.watchedAt}`}
                      {changes.watches &&
                        ` · journal ${(film.watches || []).length} → ${changes.watches.length}`}
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
            <div
              style={{
                maxHeight: 220,
                overflowY: "auto",
                border: `1px solid ${C.line}`,
                background: C.card,
              }}
            >
              {diff.toCreate.slice(0, 60).map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 14px",
                    borderBottom: `1px solid ${C.line}`,
                    fontFamily: F.body,
                    fontSize: 13,
                    color: C.ink,
                  }}
                >
                  <span>
                    {f.title} {f.year && <span style={{ color: C.inkFaded }}>({f.year})</span>}
                    {f.director && (
                      <span style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded }}>
                        {" "}
                        — {f.director}
                      </span>
                    )}
                  </span>
                  {importStatus === "watched" && f.rating > 0 && (
                    <InkStars value={f.rating} size={11} />
                  )}
                </div>
              ))}
              {diff.toCreate.length > 60 && (
                <div
                  style={{
                    padding: "8px 14px",
                    fontFamily: F.hand,
                    fontSize: 16,
                    color: C.inkFaded,
                  }}
                >
                  …et {diff.toCreate.length - 60} autres
                </div>
              )}
            </div>
          )}

          {enriched === 0 && (
            <div
              style={{
                marginTop: 10,
                fontFamily: F.hand,
                fontSize: 17,
                color: C.burgundy,
              }}
            >
              Aucun réalisateur pour l'instant — complétez via TMDB ci-dessus avant de valider,
              sinon les fiches resteront « anonyme ».
            </div>
          )}

          <button
            onClick={confirm}
            disabled={diff.toCreate.length === 0 && diff.toUpdate.length === 0}
            style={{
              all: "unset",
              marginTop: 16,
              padding: "11px 20px",
              cursor: diff.toCreate.length || diff.toUpdate.length ? "pointer" : "not-allowed",
              background: diff.toCreate.length || diff.toUpdate.length ? C.pine : C.line,
              color: C.card,
              fontFamily: F.mono,
              fontSize: 11.5,
              letterSpacing: 1,
            }}
          >
            {diff.toCreate.length || diff.toUpdate.length
              ? `VALIDER — ${diff.toCreate.length} CRÉÉE(S), ${diff.toUpdate.length} MISE(S) À JOUR`
              : "TOUT EST DÉJÀ À JOUR"}
          </button>
        </div>
      )}

      {/* ---- ce que la watchlist en ligne ne porte plus ----
          Un constat, et rien d'autre : aucun bouton, aucune écriture. Un
          film retiré de la watchlist l'a parfois été parce qu'on l'a vu,
          parfois par lassitude — l'appli n'a pas à trancher, et un mur
          vidé tout seul serait la pire façon de l'apprendre. */}
      {dropped.length > 0 && (
        <div
          style={{
            marginTop: 22,
            border: `1px solid ${C.line}`,
            background: C.card,
            padding: "14px 18px",
          }}
        >
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              color: C.inkFaded,
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            PLUS DANS VOTRE WATCHLIST LETTERBOXD
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 17,
              color: C.inkFaded,
              marginBottom: 8,
              lineHeight: 1.35,
            }}
          >
            {dropped.length} fiche(s) « à voir » venues de Letterboxd n'y figurent plus. Rien n'est
            retiré : à vous de les garder ou de les ranger.
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {dropped.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: "5px 0",
                  borderBottom: `1px solid ${C.line}`,
                  fontFamily: F.body,
                  fontSize: 13,
                  color: C.ink,
                }}
              >
                {f.title} {f.year && <span style={{ color: C.inkFaded }}>({f.year})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 26, fontFamily: F.hand, fontSize: 17, color: C.inkFaded }}>
        {films.length} film(s) déjà au catalogue — un réimport met à jour les fiches existantes au
        lieu de les dupliquer.
      </div>

      <div data-tour="import-complete">
        <CompletePanel films={films} apiKey={apiKey} onImport={onImport} />
      </div>

      <div data-tour="import-backup">
        <BackupPanel
          films={films}
          notes={notes}
          dividers={dividers}
          views={views}
          fils={fils}
          motifs={motifs}
          onRestore={onRestore}
        />
      </div>
    </div>
  );
}
