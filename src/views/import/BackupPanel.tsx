import { useEffect, useRef, useState } from "react";
import { C, F } from "../../theme/tokens";
import { Tally } from "../../components/ui";
import { posterStats, exportBackup, importBackup } from "../../db";
import type { Divider, Film, Note, ShelfViews } from "../../types";
import type { Fil } from "../../domain/fils";
import type { VocabulaireStocké as Vocabulaire } from "../../domain/motifs";

/** Ce que `posterStats` rapporte de la base d'images. */
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

export function BackupPanel({
  films,
  notes,
  dividers,
  views,
  fils,
  motifs,
  onRestore,
}: BackupPanelProps) {
  const [stats, setStats] = useState<PosterStats | null>(null);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    posterStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [films]);

  const download = async () => {
    setMsg("préparation…");
    // db.js est encore en JavaScript : ses paramètres n'ont pas de type déclaré
    const data = await exportBackup({ films, notes, dividers, views, fils, motifs } as never);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cine-hub-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(`sauvegarde de ${films.length} fiche(s) téléchargée.`);
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
      /* BUG CONNU, comportement conservé tel quel par le refactor : la
         sauvegarde v4 contient les vues d'étagère et `importBackup` les
         renvoie, mais elles ne sont pas transmises ici. À la restauration,
         App retombe donc sur la reconstruction depuis les intercalaires et
         le rangement enregistré est perdu. */
      setMsg(
        `${onRestore({
          films: f as Film[],
          notes: n as Note[],
          dividers: d as Divider[],
          views: null,
          fils: (fl || []) as Fil[],
          motifs: (mo || { perso: [], masqués: [] }) as Vocabulaire,
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
        COFFRE À AFFICHES ET SAUVEGARDE
      </div>
      {stats && (
        <>
          <Tally label="affiches rangées dans la base" value={stats.count} />
          <Tally label="place occupée" value={humanSize(stats.bytes)} />
          {stats.quota?.quota && (
            <Tally
              label="place disponible"
              value={humanSize(stats.quota.quota - (stats.quota.usage || 0))}
              ink={C.pine}
            />
          )}
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
        Tout est stocké sur cette machine, captures en qualité d'origine. Exportez de temps en temps
        : vider les données du navigateur effacerait la collection.
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
