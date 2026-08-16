/* ============================================================
   VUE — IMPORT LETTERBOXD
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, tap } from "../../theme/styles";
import { Label, Tally, InkStars } from "../../components/ui";
import { StampCorner } from "../../components/atmosphere";
import { store } from "../../services/storage";
import { keepTheVault } from "../../services/persistence";
import { doorEvent } from "../../services/measure";
import { importAllowance, spendImport, type ImportAllowance } from "../../services/server";
import { writtenKey, setTmdbKey, useTmdbKey } from "../../services/tmdbKey";
import { parseLetterboxdCsv, diffImport, filmKey } from "../../domain/importing";
import {
  fetchLetterboxdFeed,
  fetchLetterboxdWatchlist,
  DEFAULT_RELAY,
  USER_KEY,
  RELAY_KEY,
  LetterboxdError,
} from "../../services/letterboxd";
import { enrichRows, checkApiKey } from "../../tmdb";
import { BackupPanel } from "./BackupPanel";
import { CompletePanel } from "./CompletePanel";
import { RepairPanel } from "./RepairPanel";
import { OrphanViews } from "./OrphanViews";
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
import type { Thread } from "../../domain/threads";
import type { StoredVocabulary as Vocabulary } from "../../domain/motifs";

/* LES DEUX LIBELLÉS ÉTAIENT FAUX, CHACUN À SA FAÇON — et sur l'écran
   d'import, c'est-à-dire sur la porte. « des films vus » était du
   français en dur, invisible à qui lit le classeur en anglais ; et
   « views.watchlist » était une CLÉ de catalogue rendue telle quelle,
   parce que personne ne la passait à `t()`. Le bouton d'à côté affichait
   donc littéralement « views.watchlist ».

   Les deux sont désormais des clés, et les deux passent par `t()`. */
const IMPORT_STATUSES: { k: FilmStatus; l: string }[] = [
  { k: "watched", l: "import.asWatched" },
  { k: "watchlist", l: "views.watchlist" },
];

interface ImportViewProps {
  films: Film[];
  onImport: (diff: ImportDiff) => void;
  notes: Note[];
  dividers: Divider[];
  views: ShelfViews | null;
  fils: Thread[];
  motifs: Vocabulary;
  onRestore: (data: {
    films: Film[];
    notes: Note[];
    dividers: Divider[];
    views: ShelfViews | null;
    fils: Thread[];
    motifs: Vocabulary;
  }) => void;
  /* Retourner au mur depuis le bilan. Facultatif : sans lui le bilan
     reste ce qu'il était, trois nombres et rien d'autre. */
  onSeeWall?: () => void;
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
  onSeeWall,
}: ImportViewProps) {
  const { t } = useTranslation();

  /* A `LetterboxdError` carries a CODE, not a sentence: the service does
     not know which language is being read, and this is where we do. */
  const saidError = (e: unknown): string =>
    e instanceof LetterboxdError
      ? t(`letterboxd.${e.code}`, e.values)
      : String((e as Error)?.message || e);

  const [rows, setRows] = useState<ImportRow[]>([]); // lignes lues, éventuellement enrichies
  const [stats, setStats] = useState<ImportStats | null>(null); // ce que le fichier contenait
  const [importStatus, setImportStatus] = useState<FilmStatus>("watched"); // vus / à voir
  /* Unticked by default, and it must stay that way: completing never
     loses anything, replacing may erase screenings entered by hand. */
  const [autorite, setAutorite] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ created: number; updated: number; unchanged: number } | null>(
    null
  ); // report après écriture

  /* The field here keeps its local draft — one types a key before
     validating it — but it is no longer the ONLY place where it is laid:
     the drawer at the foot of the rail writes to the same service, and
     laying the key over there must show here. */
  /* TWO THINGS THAT LOOK ALIKE AND MUST NOT BE CONFUSED.

     `apiKey` is the content of the FIELD: what one is typing, and what
     "test the key" tries out. So it must remain the written key, and
     nothing else — one does not test a token one has not entered.

     `deQuoi` is what one will call TMDB WITH: the key one has just
     typed, otherwise the one already laid, otherwise the server's relay
     when an account is open. IT is what commands the buttons.

     Confusing them left "you must first enter a key" under the nose of
     somebody logged in, who precisely no longer needs one. */
  const [apiKey, setApiKey] = useState(writtenKey);
  const placedKey = useTmdbKey();
  const wherewithal = apiKey.trim() || placedKey;
  const [useTmdb, setUseTmdb] = useState(() => !!wherewithal);
  const [keyState, setKeyState] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null); // { done, total }
  const [tmdbReport, setTmdbReport] = useState<{ resolved: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* The Letterboxd feed. The username is remembered from one time to
     the next — one does not read somebody else's feed by accident. The
     relay stays folded away: nobody should have to look at it as long as
     it works. */
  const [lbUser, setLbUser] = useState(() => store.get(USER_KEY, ""));
  const [relay, setRelay] = useState(() => store.get(RELAY_KEY, DEFAULT_RELAY));
  const [showRelay, setShowRelay] = useState(false);
  const [feeding, setFeeding] = useState(false);
  /* A watchlist is read over several pages: the button says which one,
     otherwise a profile of six hundred films looks frozen for a whole
     minute. */
  const [pages, setPages] = useState<{ done: number; total: number } | null>(null);
  /* The "à voir" cards that came from Letterboxd and that the online
     watchlist no longer carries. We SHOW them without touching them: the
     watchlist read says what it contains today, not what should be
     thrown away. */
  const [dropped, setDropped] = useState<Film[]>([]);

  /* CE QU'IL RESTE D'IMPORTS, demandé À L'ENTRÉE et non à la validation.
     Le coût est dans l'enrichissement — six cents films, six cents
     interrogations du relais — et il part avant qu'on valide : refuser
     à la fin ferait travailler quelqu'un pour lui dire non après coup. */
  const [allowance, setAllowance] = useState<ImportAllowance | null>(null);
  useEffect(() => {
    importAllowance().then(setAllowance);
  }, []);

  const reset = () => {
    setRows([]);
    setStats(null);
    setFileName("");
    setError("");
    setTmdbReport(null);
    setProgress(null);
    // a new file is not authoritative because the previous one was
    setAutorite(false);
  };

  const handleFile = async (file: File) => {
    reset();
    setDropped([]);
    setDone(null);
    setFileName(file.name);
    /* LANCÉ, ET PAS ENCORE ABOUTI. C'est l'écart entre les deux qui dit
       quelque chose : un import déposé mais jamais confirmé est un
       bordereau qu'on n'a pas su lire, et c'est ce qu'on veut voir.
       Le NOM DU FICHIER ne part pas — il n'est pas dans l'événement, et
       la liste des événements est fermée pour que ça reste vrai. */
    doorEvent("porte:import-lance");
    try {
      const { rows: parsed, stats: s, kind } = await parseLetterboxdCsv(file);
      setRows(parsed);
      setStats(s);
      setImportStatus(kind);
      if (parsed.length === 0) setError(t("import.noUsableRow"));
    } catch {
      setError(t("import.unreadableCsv"));
    }
  };

  /* Reading the feed comes to exactly the same as dropping a file: we
     fill `rows` and `stats`, and everything downstream — the preview,
     the TMDB pass, the diff, the validation — does not know where it
     came from. */
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
      if (parsed.length === 0) setError(t("import.feedEmpty"));
    } catch (e) {
      setError(saidError(e));
    }
    setFeeding(false);
  };

  /* The wishes one has here and that Letterboxd no longer has. We look
     only at the cards that CAME from Letterboxd: a film filed from the
     discoveries desk has never been on that account, and announcing it
     as removed would be a misreading. */
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

  /* The watchlist has no feed: it is read from the profile's public
     pages. The reading looks in every respect like the previous one —
     that is intended: downstream must still not know where the rows come
     from. */
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
      if (parsed.length === 0) setError(t("import.emptyWatchlist"));
    } catch (e) {
      setError(saidError(e));
    }
    setPages(null);
    setFeeding(false);
  };

  const testKey = async () => {
    setKeyState("…");
    const r = await checkApiKey(apiKey.trim());
    setKeyState(r.ok ? t("import.keyValid") : t("import.keyRefused"));
  };

  // The director is not in the CSV: we go and fetch it before comparing,
  // so that the preview already shows the cards as they will be written.
  const runTmdb = async () => {
    const key = wherewithal;
    if (!key) return;
    /* We only keep what has been TYPED: the relay's token is not a key
       and has no business on the disk. */
    if (apiKey.trim()) setTmdbKey(apiKey.trim());
    setProgress({ done: 0, total: rows.length });
    const res = await enrichRows(rows, key, {
      onProgress: (d: number, t: number) => setProgress({ done: d, total: t }),
    } as never);
    setRows(res.rows);
    setTmdbReport({ resolved: res.resolved, failed: res.failed });
    setProgress(null);
  };

  // Nothing is written until this diff has been validated.
  const diff = useMemo(
    () =>
      rows.length
        ? diffImport(films, rows, importStatus, { authoritativeWatches: autorite })
        : null,
    [films, rows, importStatus, autorite]
  );

  /* The "this file is authoritative" choice only makes sense if the
     file carries screenings: only diary.csv and the feed have any. */
  const hasScreenings = rows.some((r) => r.watches?.length);

  const confirm = async () => {
    if (!diff) return;
    /* ON CONSOMME AVANT D'ÉCRIRE. Le serveur est seul juge : il compte
       dans la même requête qu'il écrit, donc deux onglets ne peuvent pas
       passer ensemble. Un refus arrête tout — écrire quand même
       laisserait la collection en avance sur ce qu'on a le droit de
       faire. */
    try {
      setAllowance(await spendImport());
    } catch (e) {
      setError((e as Error).message || t("import.refused"));
      return;
    }
    onImport(diff);
    /* LE MOMENT DE DEMANDER LE REMPART. Quelqu'un qui vient de verser
       sa collection entière a donné au navigateur exactement le signal
       d'engagement que `persist()` attend, et a de quoi comprendre la
       question si Firefox la pose. Au chargement, ni l'un ni l'autre.

       Sans `await`, et sans que le résultat compte : l'import est fait,
       il est écrit, et rien de ce qui suit ne doit retenir la main. */
    if (diff.toCreate.length) void keepTheVault();
    doorEvent("porte:import-abouti");
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
        {t("import.heading")}
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
        {t("import.oneFileAtATime")}
      </div>

      {/* CE QU'IL RESTE, DIT AVANT DE COMMENCER. Un plafond invisible se
          découvre en le heurtant, c'est-à-dire après avoir déposé son
          fichier et attendu six cents interrogations du relais. On ne
          montre RIEN quand le palier ne compte pas : « imports
          illimités » est une phrase qui n'apprend rien et qui occupe la
          place où une vraie nouvelle devrait tenir. */}
      {allowance?.ceiling != null && (
        <div
          style={{
            marginBottom: 22,
            padding: "9px 12px",
            border: `1px solid ${allowance.allowed ? C.line : C.burgundy}`,
            fontFamily: F.hand,
            fontSize: 16,
            color: allowance.allowed ? C.inkFaded : C.burgundy,
            lineHeight: 1.35,
          }}
        >
          {allowance.allowed
            ? t("import.left", { count: allowance.ceiling - allowance.used })
            : t("import.none")}
        </div>
      )}

      {/* The Letterboxd export is a zip of several CSVs: each holds only
          part of the story, hence the recommended order. */}
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
          {t("import.whichFiles")}
        </div>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.inkFaded, marginBottom: 12 }}>
          {t("import.zipNote")}
        </div>
        {[
          {
            n: "watched.csv",
            d: t("import.file.watched"),
            ink: C.pine,
            ordre: "1",
          },
          {
            n: "ratings.csv",
            d: t("import.file.ratings"),
            ink: C.burgundy,
            ordre: "2",
          },
          {
            n: "diary.csv",
            d: t("import.file.diary"),
            ink: C.ochre,
            ordre: "3",
          },
          {
            n: "watchlist.csv",
            d: t("import.file.watchlist"),
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
          {t("import.orderNote")}
        </div>
      </div>

      {/* THE FEED — for updating, where the zip is for priming. It is
          placed AFTER the files and not before: it is the CSV that
          builds a film library, the feed merely keeps it up to date. */}
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
          {t("import.orReadProfile")}
        </div>
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.inkFaded, marginBottom: 12 }}>
          {/* Three botched substitutions used to read here — "c'est de
              what tenir la collection à day, step de what la bâtir". */}
          {t("import.profileNote")}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Label>{t("import.letterboxdHandle")}</Label>
            <input
              style={underlineInput}
              value={lbUser}
              placeholder={t("import.handlePlaceholder")}
              onChange={(e) => setLbUser(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && lbUser.trim() && !feeding) runFeed();
              }}
            />
          </div>
          {/* Two readings, a single username: the screenings come from
              the feed, the watchlist from the profile's pages — but it
              is the same account, and asking again would be for
              nothing. */}
          {(
            [
              ["SÉANCES", runFeed, feeding ? "…" : t("import.viewings")],
              [
                "WATCHLIST",
                runWatchlist,
                feeding && pages
                  ? t("import.page", { done: pages.done, total: pages.total })
                  : t("import.watchlist"),
              ],
            ] as [string, () => void, string][]
          ).map(([k, run, label]) => (
            <button
              key={k}
              onClick={run}
              disabled={!lbUser.trim() || feeding}
              style={{
                all: "unset",
                ...tap,
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

        {/* The relay, folded away. Letterboxd does not allow its feed
            to be read from another site: an intermediary is needed, and
            the default one is a public service. Whoever prefers their
            own pastes it here — it is explained in
            docs/relais-letterboxd.md. */}
        <button
          onClick={() => setShowRelay((v) => !v)}
          style={{
            all: "unset",
            ...tap,
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
              {t("import.relayNote")}
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
            ...tap,
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
            {t("import.finished")}
          </div>
          <Tally label={t("import.created")} value={done.created} ink={C.pine} />
          <Tally label={t("import.updated")} value={done.updated} ink={C.ochre} />
          <Tally label={t("import.unchanged")} value={done.unchanged} />
          {/* LE BILAN MENAIT NULLE PART. Trois nombres, et l'écran
              d'import restait ouvert : quelqu'un qui vient de verser six
              cents films doit aller LES VOIR, et c'est le seul moment du
              produit où l'on sait avec certitude ce qu'il veut faire
              ensuite. Rien ne s'ouvre tout seul pour autant — on propose
              la porte, on ne pousse personne dedans. */}
          {onSeeWall && (done.created > 0 || done.updated > 0) && (
            <button
              onClick={onSeeWall}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 12,
                padding: "8px 14px",
                background: C.pine,
                color: C.card,
                fontFamily: F.mono,
                fontSize: 10.5,
                letterSpacing: 1,
              }}
            >
              {t("import.seeThem")}
            </button>
          )}
        </div>
      )}

      {/* ---- checking that the file was read ---- */}
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
          <Tally label={t("import.linesRead")} value={stats.lines} />
          <Tally label={t("import.distinctFilms")} value={stats.total} />
          <Tally
            label={t("import.withRating")}
            value={stats.withRating}
            ink={stats.withRating ? C.pine : C.inkFaded}
          />
          <Tally label={t("import.withoutRating")} value={stats.withoutRating} />
          {stats.duplicatesInFile > 0 && (
            <Tally
              label={t("import.rewatchesGrouped")}
              value={stats.duplicatesInFile}
              ink={C.ochre}
            />
          )}
          {stats.skippedNoTitle > 0 && (
            <Tally
              label={t("import.linesWithoutTitle")}
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
                    ...tap,
                    cursor: "pointer",
                    padding: "6px 14px",
                    fontFamily: F.mono,
                    fontSize: 11,
                    background: importStatus === o.k ? C.cobalt : "transparent",
                    color: importStatus === o.k ? C.card : C.inkFaded,
                    border: `1px solid ${importStatus === o.k ? C.cobalt : C.line}`,
                  }}
                >
                  {t(o.l)}
                </button>
              ))}
            </div>
          </div>

          {/* REPAIRING THE LOGS. For a long time, a card dropped by
              watched.csv harvested a screening at the date it had been
              ADDED, and diary.csv added a second one at the date the
              film had been seen: a "×2" under a film seen once. The
              first flaw is fixed at reading time, but the cards already
              written keep their extra screening — and completing does
              not know how to undo. This box can, once. */}
          {hasScreenings && importStatus === "watched" && (
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
                    {t("import.replaceLogNote")}
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* ---- directors via TMDB ---- */}
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
            {t("import.tmdbNote")}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Label>{t("import.tmdbApiKey")}</Label>
              <input
                style={underlineInput}
                value={apiKey}
                type="password"
                placeholder={t("import.pasteKeyHere")}
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
                ...tap,
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
                color: keyState === t("import.keyValid") ? C.pine : C.burgundy,
                marginTop: 6,
              }}
            >
              {keyState}
            </div>
          )}

          {progress ? (
            <div style={{ marginTop: 14 }}>
              {/* UNE BARRE QUI SE VOIT DOIT AUSSI S'ENTENDRE. Elle n'était
                  qu'un rectangle qui rétrécit : une synthèse vocale n'en
                  tirait rien, sur la seule attente longue du produit.
                  `aria-valuetext` porte la phrase déjà écrite en dessous,
                  plutôt qu'un pourcentage nu. */}
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
                aria-valuetext={t("import.queried", {
                  done: progress.done,
                  total: progress.total,
                })}
                style={{ height: 6, background: C.line, position: "relative" }}
              >
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
                {t("import.queried", { done: progress.done, total: progress.total })}
              </div>
            </div>
          ) : (
            <button
              onClick={runTmdb}
              disabled={!wherewithal || !useTmdb}
              style={{
                all: "unset",
                ...tap,
                cursor: wherewithal ? "pointer" : "not-allowed",
                marginTop: 14,
                background: wherewithal ? C.ochre : C.line,
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
              <Tally label={t("import.directorsFound")} value={tmdbReport.resolved} ink={C.pine} />
              {tmdbReport.failed > 0 && (
                <Tally
                  label={t("import.filmsNotIdentified")}
                  value={tmdbReport.failed}
                  ink={C.burgundy}
                />
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

      {/* ---- the diff, before writing ---- */}
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
                  …et {diff.toCreate.length - 60} others
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
              ...tap,
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

      {/* ---- what the online watchlist no longer carries ----
          An observation, and nothing else: no button, no writing. A film
          removed from the watchlist was sometimes removed because it was
          seen, sometimes out of weariness — the application has no
          business deciding, and a wall emptying itself would be the
          worst way of finding out. */}
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
            {dropped.length} card(s) « à voir » venues de Letterboxd n'y figurent plus. Nothing
            n'est removed : à vous de les garder ou de les file.
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
        {films.length} film(s) existing au catalogue — un réimport met à day les cards existantes au
        lieu de les duplicate.
      </div>

      <div data-tour="import-complete">
        <CompletePanel films={films} apiKey={wherewithal} onImport={onImport} />
      </div>

      {/* Placed AFTER "complete" and before the backup: it is
          "complete" that caused the damage, and the backup is the
          gesture to make before repairing. The order tells the procedure
          to follow. The panel disappears by itself when it has nothing
          left to offer. */}
      {/* No wrapper here: it is the panel itself that carries its
          `data-tour`. An empty wrapper keeps a width, hence stays a
          measurable target, and the tour stopped on an invisible strip
          instead of skipping the step. */}
      <RepairPanel films={films} onImport={onImport} />
      {/* Les vues d'étagère que l'index ne nomme plus. Le rechargement
          est le plus court chemin pour que le mur les reprenne : l'index
          est lu au montage, et rien n'écoute son changement. */}
      <OrphanViews onRecovered={() => location.reload()} />

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
