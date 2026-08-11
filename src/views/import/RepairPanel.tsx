/* ============================================================
   RETROUVER SA WATCHLIST — le panneau de réparation
   ============================================================

   « Compléter les fiches » a longtemps fait passer « à voir » → « vu »
   les fiches qu'il enrichissait. Le bouton est réparé (`garderStatut`,
   dans `importing`), mais les collections déjà basculées restent
   basculées : la correction ne remonte pas le temps.

   `domain/repairs` sait DÉSIGNER les fiches suspectes — une fiche
   « vue » qui ne porte aucune trace de visionnage. Il ne sait pas, et ne
   peut pas savoir, laquelle était vraiment une envie. Ce panneau est
   donc une LISTE À COCHER et non un bouton : la machine propose, l'œil
   dispose, et rien ne s'écrit avant la confirmation.

   Il ne s'affiche que s'il a quelque chose à dire. Une collection saine
   ne doit pas porter en permanence le souvenir d'un bug. */
import { useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Tally, Confirmation } from "../../components/ui";
import type { DemandeConfirmation } from "../../components/ui";
import { basculéesParErreur } from "../../domain/repairs";
import type { Film, ImportDiff } from "../../types";

interface RepairPanelProps {
  films: Film[];
  onImport: (diff: ImportDiff) => void;
}

export function RepairPanel({ films, onImport }: RepairPanelProps) {
  const suspectes = useMemo(() => basculéesParErreur(films), [films]);
  /* Rien de coché au départ. Décocher trente fiches sur trois cents est
     un travail ; cocher celles qu'on reconnaît en est un autre — mais le
     second se trompe dans le sens qui ne coûte rien. « TOUT COCHER » est
     là pour qui reconnaît sa watchlist entière d'un coup d'œil. */
  const [choisies, setChoisies] = useState<Set<string>>(new Set());
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null);
  const [bilan, setBilan] = useState("");

  if (suspectes.length === 0) return null;

  const bascule = (id: string) =>
    setChoisies((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toutes = () =>
    setChoisies((s) =>
      s.size === suspectes.length ? new Set() : new Set(suspectes.map((f) => f.id))
    );

  /* On repasse par `onImport` plutôt que par un chemin d'écriture à soi :
     c'est la même fusion champ par champ que l'import, et un seul endroit
     où l'écriture peut se tromper. */
  const remettre = () => {
    const àRemettre = suspectes.filter((f) => choisies.has(f.id));
    if (!àRemettre.length) return;
    setDemande({
      titre: `Remettre ${àRemettre.length} fiche(s) en « à voir » ?`,
      corps:
        "Elles quittent la vidéothèque pour l'onglet À voir. Rien n'est effacé : notes, motifs et fils restent attachés, et une fiche remise se rebascule d'un clic depuis son dossier.",
      action: "REMETTRE EN « À VOIR »",
      onConfirm: () => {
        onImport({
          toCreate: [],
          toUpdate: àRemettre.map((film) => ({ film, changes: { status: "watchlist" as const } })),
          unchanged: [],
        });
        setBilan(`${àRemettre.length} fiche(s) remise(s) dans « À voir ».`);
        setChoisies(new Set());
        setDemande(null);
      },
    });
  };

  return (
    <div
      data-tour="import-repair"
      style={{
        marginTop: 34,
        border: `1px solid ${C.ochre}`,
        background: C.card,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          color: C.ochre,
          letterSpacing: 1,
          marginBottom: 10,
        }}
      >
        RETROUVER DES FICHES BASCULÉES PAR ERREUR
      </div>

      <Tally
        label="fiches « vues » sans aucune trace de visionnage"
        value={suspectes.length}
        ink={C.ochre}
      />
      <Tally label="cochées" value={choisies.size} ink={choisies.size ? C.pine : C.inkFaded} />

      <div
        style={{
          fontFamily: F.hand,
          fontSize: 17,
          color: C.inkFaded,
          margin: "10px 0 12px",
          lineHeight: 1.35,
        }}
      >
        Une version antérieure de « compléter les fiches » faisait passer en « vu » les fiches
        qu&apos;elle enrichissait. Ces fiches-là n&apos;ont ni séance, ni date, ni note, ni texte :
        personne ne les a jamais ouvertes, elles étaient probablement des envies. Probablement
        seulement — <strong>relisez la liste</strong>, un film vu et jamais commenté lui ressemble
        trait pour trait. Faites une sauvegarde avant, elle est juste en dessous.
      </div>

      <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${C.line}` }}>
        {suspectes.map((f) => (
          <label
            key={f.id}
            style={{
              display: "flex",
              gap: 9,
              alignItems: "baseline",
              padding: "6px 12px",
              borderBottom: `1px solid ${C.line}`,
              cursor: "pointer",
              fontFamily: F.body,
              fontSize: 13,
              color: C.ink,
            }}
          >
            <input
              type="checkbox"
              checked={choisies.has(f.id)}
              onChange={() => bascule(f.id)}
              style={{ flexShrink: 0 }}
            />
            <span style={{ flex: 1 }}>
              {f.title} {f.year && <span style={{ color: C.inkFaded }}>({f.year})</span>}
            </span>
            {/* La provenance est le meilleur indice qu'on ait à offrir :
                une fiche venue de Letterboxd a été posée par un relevé de
                watchlist, et c'est justement celles-là qui ont basculé. */}
            {f.source === "letterboxd" && (
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.cobalt }}>letterboxd</span>
            )}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button
          onClick={toutes}
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
          {choisies.size === suspectes.length ? "TOUT DÉCOCHER" : "TOUT COCHER"}
        </button>
        <button
          onClick={remettre}
          disabled={choisies.size === 0}
          style={{
            all: "unset",
            ...tap,
            cursor: choisies.size ? "pointer" : "default",
            opacity: choisies.size ? 1 : 0.45,
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 14px",
            background: C.ochre,
            color: C.card,
            fontFamily: F.mono,
            fontSize: 10.5,
          }}
        >
          <Undo2 size={13} />
          REMETTRE {choisies.size} FICHE(S) EN « À VOIR »
        </button>
      </div>

      {bilan && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.pine, marginTop: 8 }}>{bilan}</div>
      )}

      <Confirmation demande={demande} onClose={() => setDemande(null)} />
    </div>
  );
}
