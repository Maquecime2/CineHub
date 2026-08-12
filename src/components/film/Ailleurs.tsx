/* ============================================================
   AILLEURS — ce que les autres ont dit du même film
   ============================================================

   Le seul endroit du classeur où le texte de quelqu'un d'autre entre
   dans une fiche. Trois choix le gouvernent, et ils tiennent ensemble.

   IL SE TAIT PLUTÔT QUE DE S'EXCUSER. Pas de serveur, pas de compte,
   pas de `tmdbId`, personne n'a rien dit : il n'y a rien à afficher, et
   surtout aucun bandeau pour annoncer qu'il n'y a rien. Une fiche qui
   vit très bien seule ne doit pas se mettre à réclamer un compte.

   IL NE MÉLANGE PAS SA NOTE ET CELLE DES AUTRES. La moyenne rendue par
   le serveur exclut la sienne : lire son propre avis dans « ce qu'on en
   pense ailleurs » donnerait une moyenne à laquelle on aurait voté deux
   fois, et l'impression d'être approuvé par soi-même.

   BLOQUER ET SIGNALER SONT LÀ DÈS LA PREMIÈRE LIGNE PUBLIÉE. Le jour où
   un texte pose un problème n'est pas le jour où l'on développe le
   bouton pour le faire taire.
   ============================================================ */
import { useEffect, useState } from "react";
import { Flag, Star, UserMinus, Users } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label } from "../ui";
import { block, echoOfWork, serverConfigured, report, type Echo } from "../../services/server";
import type { Film } from "../../types";

export function Ailleurs({ film, connecte }: { film: Film; connecte: boolean }) {
  const [echo, setEcho] = useState<Echo | null>(null);
  const tmdbId = film.tmdbId;

  useEffect(() => {
    setEcho(null);
    if (!serverConfigured() || !connecte || !tmdbId) return;
    let vivant = true;
    echoOfWork(tmdbId)
      .then((e) => vivant && setEcho(e))
      /* Le silence est la bonne réponse à une panne ici : cette section
         est un supplément, et une fiche ne doit pas afficher d'erreur
         pour ce qu'on ne lui a pas demandé. */
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [tmdbId, connecte]);

  if (!echo || echo.collections === 0) return null;

  const cacher = (pseudo: string) =>
    setEcho((e) => (e ? { ...e, avis: e.avis.filter((a) => a.pseudo !== pseudo) } : e));

  return (
    <div data-tour="detail-ailleurs" style={{ marginTop: 22 }}>
      <Label>Ailleurs</Label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 4,
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
        }}
      >
        <Users size={12} />
        <span>
          {echo.collections} vidéothèque{echo.collections > 1 ? "s" : ""} le range
          {echo.collections > 1 ? "nt" : ""}
        </span>
        {echo.moyenne !== null && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.burgundy }}>
            <Star size={12} fill={C.burgundy} strokeWidth={1.4} />
            {echo.moyenne.toFixed(1)}
            <span style={{ color: C.inkFaded }}>
              sur {echo.notes} note{echo.notes > 1 ? "s" : ""}
            </span>
          </span>
        )}
      </div>

      {echo.avis.map((a) => (
        <AvisLu key={`${a.pseudo}-${a.fiche}`} avis={a} onSilence={() => cacher(a.pseudo)} />
      ))}
    </div>
  );
}

function AvisLu({ avis, onSilence }: { avis: Echo["avis"][number]; onSilence: () => void }) {
  const [fait, setFait] = useState<string | null>(null);

  const faireTaire = async () => {
    await block(avis.pseudo);
    onSilence();
  };

  const dire = async () => {
    /* `prompt` est laid, et c'est le bon outil : un motif se dit en une
       phrase, et une modale de plus dans une fiche déjà dense se paierait
       en confusion pour un geste qu'on fait deux fois par an. */
    const motif = window.prompt(`Qu'est-ce qui ne va pas dans ce qu'a écrit ${avis.pseudo} ?`);
    if (!motif?.trim()) return;
    await report({ pseudo: avis.pseudo, fiche: avis.fiche, motif });
    setFait("signalé — nous le lirons");
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: "9px 11px",
        background: alpha(C.ink, 0.03),
        borderLeft: `2px solid ${C.line}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <a
          href={`#/chez/${avis.pseudo}`}
          style={{ fontFamily: F.mono, fontSize: 10, color: C.burgundy, textDecoration: "none" }}
        >
          chez {avis.pseudo}
        </a>
        {avis.note !== null && (
          <span style={{ display: "flex", gap: 1 }} aria-label={`${avis.note} sur 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={10}
                color={C.burgundy}
                fill={avis.note! >= n ? C.burgundy : "none"}
                strokeWidth={1.4}
              />
            ))}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {fait ? (
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>{fait}</span>
        ) : (
          <>
            <button onClick={dire} title="Signaler" style={petit}>
              <Flag size={11} />
            </button>
            <button
              onClick={faireTaire}
              title={`Ne plus rien voir de ${avis.pseudo}`}
              style={petit}
            >
              <UserMinus size={11} />
            </button>
          </>
        )}
      </div>
      {avis.critique && (
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {avis.critique}
        </div>
      )}
    </div>
  );
}

const petit = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  color: C.inkFaded,
};
