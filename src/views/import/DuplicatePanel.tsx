/* ============================================================
   LA MÊME ŒUVRE, DEUX FOIS — et le film qui revient à chaque import
   ============================================================

   LE SYMPTÔME EST QU'UN FILM REVIENT. On redépose son fichier, et les
   mêmes titres se recréent dans « à voir », à côté de la fiche qu'on a
   déjà. Ce n'est pas l'import qui insiste : c'est qu'il ne RECONNAÎT
   pas. Une fiche jamais rapprochée de TMDB n'a que son titre pour se
   faire reconnaître, et « Scenes from a Marriage » ne rencontrera jamais
   « Scènes de la vie conjugale ».

   ON DEMANDE À TMDB QUI EST QUI, ET RIEN D'AUTRE. Deux fiches font une
   paire quand elles désignent le MÊME identifiant — une identité, pas
   une ressemblance. Un rapprochement par titre approchant aurait fondu
   « Solaris » 1972 et « Solaris » 2002, et il n'y a pas de retour.

   RIEN N'EST FUSIONNÉ SANS QU'ON L'AIT COCHÉ. Le panneau propose, il ne
   range pas : `mergeDuplicate` efface une fiche, et c'est le seul geste
   de ce dépôt dont une erreur ne se rattrape pas en relançant. Ce qui a
   été écrit à la main est repris — note, critique, séances, captures —
   et quand LES DEUX fiches portent une critique, les deux sont gardées.

   IL NE SE DESSINE PAS QUAND IL N'A RIEN À DIRE. Un classeur sain n'a
   pas de fiche sans identité, donc pas de panneau : une section qui
   annonce « zéro doublon » est une section qu'on lit une fois et qu'on
   ne relit jamais.
   ============================================================ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Tally, Trouble, Confirmation, type ConfirmRequest } from "../../components/ui";
import { enrichRows } from "../../tmdb";
import { duplicatePairs } from "../../domain/duplicates";
import type { Film, ImportRow } from "../../types";

export interface Pair {
  keep: Film;
  drop: Film;
}

export function DuplicatePanel({
  films,
  apiKey,
  onMerge,
}: {
  films: Film[];
  apiKey: string;
  onMerge: (pairs: Pair[]) => void;
}) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [trouble, setTrouble] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  /* LES FICHES QUI N'ONT PAS D'IDENTITÉ, et elles seules. Une fiche déjà
     rapprochée n'est pas le problème qu'on traite, et la redemander
     coûterait une requête pour rien. */
  const stray = films.filter((f) => !f.tmdbId);
  if (stray.length === 0) return null;

  const look = async () => {
    const key = apiKey.trim();
    if (!key) return;
    setTrouble(null);
    setMsg("");
    setPairs(null);
    setProgress({ done: 0, total: stray.length });

    const rows: ImportRow[] = stray.map((f) => ({
      title: f.title,
      year: f.year,
      rating: null,
      watchedAt: null,
      uri: null,
    }));

    try {
      const res = await enrichRows(rows, key, {
        onProgress: (d: number, n: number) => setProgress({ done: d, total: n }),
      } as never);
      /* L'ORDRE EST CELUI QU'ON A ENVOYÉ — `enrichRows` rend une ligne
         par ligne, à la même place. C'est ce qui permet de recoudre
         chaque réponse à SA fiche sans rien deviner. */
      const resolved = new Map<string, number | string>();
      (res.rows as ImportRow[]).forEach((r, i) => {
        const from = stray[i];
        if (from && r?.tmdbId) resolved.set(from.id, r.tmdbId);
      });
      const found = duplicatePairs(films, resolved);
      setPairs(found);
      setChosen(new Set(found.map((p) => p.drop.id)));
      if (found.length === 0) setMsg(t("dupes.none"));
    } catch (e) {
      setTrouble((e as Error).message || t("complete.noAnswer"));
    } finally {
      setProgress(null);
    }
  };

  const picked = (pairs ?? []).filter((p) => chosen.has(p.drop.id));

  const ask = () => {
    if (!picked.length) return;
    setRequest({
      title: t("dupes.confirmTitle", { count: picked.length }),
      body: t("dupes.confirmBody"),
      action: t("dupes.confirmAction"),
      severe: true,
      onConfirm: () => {
        onMerge(picked);
        setMsg(t("dupes.done", { count: picked.length }));
        setPairs(null);
        setChosen(new Set());
      },
    });
  };

  const line = (f: Film) => [f.title, f.year || null].filter(Boolean).join(" · ");

  return (
    <div
      data-tour="import-dupes"
      style={{
        marginTop: 34,
        border: `1px solid ${C.line}`,
        background: C.card,
        padding: "16px 20px",
      }}
    >
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaded, letterSpacing: 1 }}>
        {t("dupes.title")}
      </div>
      <Tally label={t("dupes.stray")} value={stray.length} ink={C.ochre} />
      <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 8 }}>
        {t("dupes.intro")}
      </div>

      <button
        onClick={look}
        disabled={!apiKey.trim() || progress !== null}
        style={{
          all: "unset",
          ...tap,
          cursor: apiKey.trim() && !progress ? "pointer" : "default",
          marginTop: 12,
          padding: "6px 13px",
          background: C.ink,
          color: C.card,
          fontFamily: F.mono,
          fontSize: 10.5,
          opacity: apiKey.trim() && !progress ? 1 : 0.45,
        }}
      >
        <Copy size={12} />{" "}
        {progress
          ? t("dupes.looking", { done: progress.done, total: progress.total })
          : t("dupes.look")}
      </button>

      {!apiKey.trim() && (
        <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
          {t("dupes.needsKey")}
        </div>
      )}

      <Trouble>{trouble}</Trouble>
      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.moss, marginTop: 8 }}>{msg}</div>
      )}

      {pairs && pairs.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
            {pairs.map(({ keep, drop }) => (
              <label
                key={drop.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                  padding: "6px 7px",
                  border: `1px solid ${C.line}`,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={chosen.has(drop.id)}
                  onChange={() =>
                    setChosen((was) => {
                      const next = new Set(was);
                      if (next.has(drop.id)) next.delete(drop.id);
                      else next.add(drop.id);
                      return next;
                    })
                  }
                  style={{ marginTop: 3 }}
                />
                <span style={{ minWidth: 0 }}>
                  {/* CE QUI RESTE, PUIS CE QUI PART — dans cet ordre, parce
                      que c'est l'ordre de la phrase qu'on se dit. */}
                  <span
                    style={{ display: "block", fontFamily: F.body, fontSize: 15, color: C.ink }}
                  >
                    {line(keep)}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontFamily: F.mono,
                      fontSize: 10.5,
                      color: C.burgundy,
                      textDecoration: "line-through",
                    }}
                  >
                    {line(drop)}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={ask}
            disabled={picked.length === 0}
            style={{
              all: "unset",
              ...tap,
              cursor: picked.length ? "pointer" : "default",
              marginTop: 12,
              padding: "6px 13px",
              background: C.burgundy,
              color: C.card,
              fontFamily: F.mono,
              fontSize: 10.5,
              opacity: picked.length ? 1 : 0.45,
            }}
          >
            {t("dupes.mergeN", { count: picked.length })}
          </button>
        </>
      )}

      <Confirmation request={request} onClose={() => setRequest(null)} />
    </div>
  );
}
