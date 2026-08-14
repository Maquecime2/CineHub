import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Tally } from "../../components/ui";
import { posterStats, exportBackup, importBackup } from "../../db";
import { mediaPending } from "../../services/media";
import { vaultState, keepTheVault, type Vault } from "../../services/persistence";
import { doorEvent } from "../../services/measure";
import type { Divider, Film, Note, ShelfViews } from "../../types";
import type { Thread } from "../../domain/threads";
import type { StoredVocabulary as Vocabulary } from "../../domain/motifs";

/** What `posterStats` brings back from the image database. */
interface PosterStats {
  count: number;
  bytes: number;
  quota: { usage?: number; quota?: number } | null;
}

const humanSize = (b: number) =>
  b > 1e6 ? `${(b / 1e6).toFixed(1)} Mo` : `${Math.round(b / 1024)} Ko`;

interface BackupPanelProps {
  films: Film[];
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
}

export function BackupPanel({
  films,
  notes,
  dividers,
  views,
  fils,
  motifs,
  onRestore,
}: BackupPanelProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<PosterStats | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [msg, setMsg] = useState("");
  /* `unknown` au départ, et pas `fragile` : tant qu'on n'a pas la
     réponse, on n'annonce rien — surtout pas une alarme. */
  const [vault, setVault] = useState<Vault>("unknown");
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    posterStats()
      .then(setStats)
      .catch(() => setStats(null));
    setWaiting(mediaPending());
  }, [films]);

  /* L'état du coffre ne dépend pas de la collection : une seule lecture,
     à l'ouverture du panneau. */
  useEffect(() => {
    void vaultState().then(setVault);
  }, []);

  /* Ici la demande vient de la personne, donc `force` : le drapeau
     « on a déjà demandé » ne doit pas rendre un bouton inerte. */
  const protect = async () => {
    const now = await keepTheVault({ force: true });
    setVault(now);
    /* On ne compte que l'accord. Un refus est du navigateur, pas de la
       personne, et le compter mêlerait deux choses différentes. */
    if (now === "kept") doorEvent("porte:coffre-protege");
  };

  const download = async () => {
    setMsg(t("backup.preparing"));
    // db.js is still in JavaScript: its parameters have no declared type
    const data = await exportBackup({ films, notes, dividers, views, fils, motifs } as never);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cine-hub-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(t("backup.downloaded", { count: films.length }));
  };

  const restore = async (file: File) => {
    setMsg("lecture…");
    try {
      const {
        films: f,
        notes: n,
        dividers: d,
        fils: fl,
        motifs: mo,
      } = await importBackup(JSON.parse(await file.text()));
      /* KNOWN BUG, behaviour kept as it is by the refactor: the v4
         backup contains the shelf views and `importBackup` returns them,
         but they are not passed on here. On restoring, App therefore
         falls back on rebuilding from the dividers and the recorded
         arrangement is lost. */
      setMsg(
        `${onRestore({
          films: f as Film[],
          notes: n as Note[],
          dividers: d as Divider[],
          views: null,
          fils: (fl || []) as Thread[],
          motifs: (mo || { custom: [], hidden: [] }) as Vocabulary,
        })} fiche(s) restaurée(s).`
      );
    } catch (e) {
      setMsg((e as Error).message || "Sauvegarde illisible.");
    }
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
        {t("backup.title")}
      </div>
      {stats && (
        <>
          <Tally label={t("backup.postersStored")} value={stats.count} />
          <Tally label={t("backup.spaceUsed")} value={humanSize(stats.bytes)} />
          {stats.quota?.quota && (
            <Tally
              label="place disponible"
              value={humanSize(stats.quota.quota - (stats.quota.usage || 0))}
              ink={C.pine}
            />
          )}
          {/* WHAT HAS NOT YET REACHED THE CONTAINER. Zero is not shown:
              "0 médias en attente" is the same non-news as the empty
              countdown the account drawer used to display, and this
              panel already carries four numbers. */}
          {waiting > 0 && (
            <Tally label={t("backup.mediaWaiting")} value={waiting} ink={C.burgundy} />
          )}
        </>
      )}
      {/* LE REMPART, DIT PAR UN MOT ET PAS PAR UNE COULEUR — cinq des
          peaux avalent le rouge et le vert. `unknown` ne dit rien du
          tout : un navigateur sans l'API n'est pas un navigateur qui va
          effacer, c'est un navigateur qui ne sait pas le dire, et une
          alarme inventée use la confiance qu'on veut mériter. */}
      {vault === "kept" && <Tally label={t("backup.vaultLabel")} value={t("backup.vaultKept")} />}
      {vault === "fragile" && (
        <>
          <Tally label={t("backup.vaultLabel")} value={t("backup.vaultFragile")} ink={C.burgundy} />
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 17,
              color: C.inkFaded,
              margin: "8px 0 10px",
              lineHeight: 1.35,
            }}
          >
            {t("backup.vaultNote")}
          </div>
          <button
            onClick={protect}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              padding: "8px 14px",
              border: `1px solid ${C.line}`,
              color: C.ink,
              fontFamily: F.mono,
              fontSize: 10.5,
            }}
          >
            {t("backup.vaultAsk")}
          </button>
        </>
      )}
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 17,
          color: C.inkFaded,
          margin: "10px 0 12px",
          lineHeight: 1.35,
        }}
      >
        {t("backup.note")}
      </div>
      <input
        ref={ref}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={download}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            padding: "8px 14px",
            background: C.pine,
            color: C.card,
            fontFamily: F.mono,
            fontSize: 10.5,
          }}
        >
          EXPORTER MA COLLECTION
        </button>
        <button
          onClick={() => ref.current?.click()}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            padding: "8px 14px",
            border: `1px solid ${C.line}`,
            color: C.inkFaded,
            fontFamily: F.mono,
            fontSize: 10.5,
          }}
        >
          RESTAURER UNE SAUVEGARDE
        </button>
      </div>
      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 18, color: C.pine, marginTop: 10 }}>{msg}</div>
      )}
    </div>
  );
}
