/* ============================================================
   COMPLÉTER LES FICHES — remplir les trous depuis TMDB
   ============================================================

   Une fiche ancienne ne porte ni casting, ni durée, ni pays : ces
   champs sont arrivés après elle, et `migrate` ne peut que les poser
   vides — il tourne au chargement, hors ligne et sans clé.

   Jusqu'ici le seul chemin pour les remplir était de redéposer son
   export Letterboxd, ce qui est absurde : le fichier ne contient rien
   de tout cela, il ne sert qu'à déclencher les appels TMDB. On déclenche
   donc les appels directement, depuis la collection elle-même.

   RIEN DE NEUF SOUS LE CAPOT. On fabrique des lignes d'import à partir
   des fiches, et on les passe à la chaîne existante — `enrichRows`, qui
   a déjà le cache, la limite de concurrence et le compte-rendu de
   progression, puis `diffImport`, qui montre avant d'écrire. Un second
   chemin d'écriture serait un second endroit où la fusion peut se
   tromper.

   DEUX GARDE-FOUS, ET LE SECOND EST LE PLUS IMPORTANT.

   1. On n'interroge que les fiches INCOMPLÈTES. Sans ce tri, compléter
      trois films en demanderait cinq cents à TMDB.

   2. On écarte `toCreate`. `diffImport` crée une fiche quand rien ne
      correspond ; or ici chaque ligne SORT d'une fiche. Une
      non-correspondance ne peut donc signifier qu'une chose : la clé
      d'appariement ne se retrouve pas elle-même — ce qui arrive, le
      `slugOf` du projet ayant un défaut connu sur les titres commençant
      par « Les ». Laisser passer la création ferait alors un DOUBLON de
      la fiche qu'on voulait compléter. */
import { useState } from "react";
import { Sparkles, Tags } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Tally } from "../../components/ui";
import { enrichRows } from "../../tmdb";
import { diffImport } from "../../domain/importing";
import { isIncomplete, withoutKeywords } from "../../domain/film";
import type { Film, ImportDiff, ImportRow } from "../../types";

interface CompletePanelProps {
  films: Film[];
  apiKey: string;
  onImport: (diff: ImportDiff) => void;
}

export function CompletePanel({ films, apiKey, onImport }: CompletePanelProps) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [diff, setDiff] = useState<ImportDiff | null>(null);
  const [msg, setMsg] = useState("");

  const àFaire = films.filter(isIncomplete);
  /* Les fiches sans le moindre mot-clé — l'absence ET le vide. Une
     collection entière a été figée à `[]` par un défaut de récolte, et
     `isIncomplete` ne peut pas les voir : voir `domain/film`. */
  const sansSujets = films.filter(withoutKeywords);

  const lancer = async (cibles: Film[]) => {
    const key = apiKey.trim();
    if (!key || cibles.length === 0) return;
    setMsg("");
    setDiff(null);
    setProgress({ done: 0, total: cibles.length });

    /* Une ligne par fiche. `tmdbId` quand on l'a : il évite une
       recherche par titre, et surtout les faux positifs de
       `searchMovie`, qui prend le premier résultat sans comparer. */
    const rows: ImportRow[] = cibles.map((f) => ({
      title: f.title,
      year: f.year,
      rating: null,
      watchedAt: null,
      uri: null,
      tmdbId: f.tmdbId ?? null,
    }));

    try {
      const res = await enrichRows(rows, key, {
        onProgress: (d: number, t: number) => setProgress({ done: d, total: t }),
      } as never);

      /* `keepStatus` N'EST PAS UNE PRÉCAUTION, C'EST LE SUJET.

         Ce panneau va chercher une durée et un casting : il n'a rien
         appris sur ce que vous avez vu. Le statut passé ici ne servait
         qu'aux fiches créées — et comme on n'en crée aucune, on l'a cru
         inerte. Il ne l'était pas : `diffImport` s'en sert aussi pour
         faire passer « à voir » → « vu » les fiches existantes, et
         compléter sa collection vidait la watchlist dans la
         vidéothèque. */
      const brut = diffImport(films, res.rows as ImportRow[], "watched", {
        keepStatus: true,
      });
      setDiff(brut);
      if (brut.toCreate.length)
        console.warn(
          "compléter : lignes sans fiche correspondante, écartées",
          brut.toCreate.map((f) => f.title)
        );
      if (res.failed) setMsg(`${res.failed} fiche(s) introuvable(s) chez TMDB.`);
    } catch (e) {
      setMsg((e as Error).message || "TMDB n'a pas répondu.");
    } finally {
      setProgress(null);
    }
  };

  const écrire = () => {
    if (!diff) return;
    // toCreate est délibérément vidé : voir l'en-tête du fichier
    onImport({ toCreate: [], toUpdate: diff.toUpdate, unchanged: diff.unchanged });
    setMsg(`${diff.toUpdate.length} fiche(s) complétée(s).`);
    setDiff(null);
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
        COMPLÉTER LES FICHES DEPUIS TMDB
      </div>

      <Tally label="fiches dans la collection" value={films.length} />
      <Tally
        label="fiches à compléter"
        value={àFaire.length}
        ink={àFaire.length ? C.burgundy : C.pine}
      />
      {/* Les mots-clés comptés à part : ils sont arrivés après le reste,
          et une collection déjà complétée les a tous à zéro. Le dire
          évite de croire que « fiches à compléter » a mal compté. */}
      {/* Le vide compte comme un manque : une fiche figée à « demandé,
          il n'y en a pas » n'a pas plus de sujets qu'une fiche jamais
          interrogée, et c'est ce nombre-là qu'on veut voir descendre. */}
      <Tally label="fiches sans mots-clés TMDB" value={sansSujets.length} ink={C.inkFaded} />

      <div
        style={{
          fontFamily: F.hand,
          fontSize: 17,
          color: C.inkFaded,
          margin: "10px 0 12px",
          lineHeight: 1.35,
        }}
      >
        {àFaire.length === 0
          ? "Tout est déjà rempli — rien à demander à TMDB."
          : "Va chercher le casting, l’équipe, la durée, le pays, la langue et les mots-clés des fiches qui n’en ont pas. Les mots-clés sont ce qui permet au sillage d’un film de rapprocher deux fiches autrement que par les noms de leur équipe. Rien n’est écrit avant que vous ayez vu le détail."}
      </div>

      {progress && (
        <div style={{ margin: "10px 0" }}>
          <div style={{ height: 4, background: C.paperDark, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                right: `${100 - (progress.done / progress.total) * 100}%`,
                background: C.burgundy,
              }}
            />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 5 }}>
            {progress.done} / {progress.total} interrogés…
          </div>
        </div>
      )}

      {diff && (
        <div style={{ margin: "12px 0" }}>
          <Tally label="fiches à compléter" value={diff.toUpdate.length} ink={C.burgundy} />
          <Tally label="fiches déjà à jour" value={diff.unchanged.length} />
          {diff.toUpdate.length > 0 && (
            <div
              style={{
                marginTop: 8,
                maxHeight: 150,
                overflowY: "auto",
                fontFamily: F.body,
                fontSize: 12.5,
                color: C.ink,
              }}
            >
              {diff.toUpdate.slice(0, 40).map(({ film, changes }) => (
                <div key={film.id} style={{ display: "flex", gap: 8, padding: "2px 0" }}>
                  <span style={{ flex: 1 }}>{film.title}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                    {Object.keys(changes).join(" · ")}
                  </span>
                </div>
              ))}
              {diff.toUpdate.length > 40 && (
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 4 }}>
                  … et {diff.toUpdate.length - 40} autres
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => lancer(àFaire)}
          disabled={!apiKey.trim() || àFaire.length === 0 || !!progress}
          style={{
            all: "unset",
            ...tap,
            cursor: !apiKey.trim() || àFaire.length === 0 || progress ? "default" : "pointer",
            opacity: !apiKey.trim() || àFaire.length === 0 || progress ? 0.45 : 1,
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 14px",
            background: C.slate,
            color: C.card,
            fontFamily: F.mono,
            fontSize: 10.5,
          }}
        >
          <Sparkles size={13} />
          {progress ? "EN COURS…" : `COMPLÉTER ${àFaire.length} FICHE(S)`}
        </button>

        {/* LE RATTRAPAGE DES MOTS-CLÉS, à part et volontaire.

            Un défaut de récolte a figé des collections entières à
            « demandé, il n'y en a pas » : plus rien ne pouvait les
            réparer, puisque tout ce qui remplit ne vise que l'absence.
            Ce bouton vise AUSSI le vide. Il est distinct du premier
            parce qu'il coûte un appel par fiche visée — le nombre est
            écrit dessus, et c'est à l'utilisateur de décider. */}
        {sansSujets.length > 0 && (
          <button
            onClick={() => lancer(sansSujets)}
            disabled={!apiKey.trim() || !!progress}
            title="Redemande les mots-clés, y compris pour les fiches qui avaient répondu vide"
            style={{
              all: "unset",
              cursor: !apiKey.trim() || progress ? "default" : "pointer",
              opacity: !apiKey.trim() || progress ? 0.45 : 1,
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 14px",
              border: `1px solid ${C.slate}`,
              color: C.slate,
              fontFamily: F.mono,
              fontSize: 10.5,
            }}
          >
            <Tags size={13} />
            REDEMANDER LES MOTS-CLÉS ({sansSujets.length})
          </button>
        )}

        {diff && diff.toUpdate.length > 0 && (
          <button
            onClick={écrire}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              padding: "8px 14px",
              background: C.burgundy,
              color: C.card,
              fontFamily: F.mono,
              fontSize: 10.5,
            }}
          >
            ÉCRIRE LES {diff.toUpdate.length} MODIFICATIONS
          </button>
        )}
      </div>

      {!apiKey.trim() && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy, marginTop: 8 }}>
          Il faut de quoi interroger TMDB : une clé, plus haut — ou un compte, qui vous en dispense.
        </div>
      )}
      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginTop: 8 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
