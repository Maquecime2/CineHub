/* ============================================================
   ÉCARTER CETTE FICHE DU PARTAGE
   ============================================================

   La visite le promettait depuis longtemps — « vous pouvez écarter une
   fiche à part » — et il n'y avait aucun bouton. La route existait
   (`PUT /fiche/:id/cachee`), la colonne existait, le partage la
   respectait déjà : il manquait de quoi la lire, et de quoi la cliquer.

   POURQUOI ICI ET NON DANS « CE QU'ON EN FAIT ». Mettre de côté, ranger
   au bedside, supprimer : ce sont des gestes qui déplacent la fiche CHEZ
   SOI. Écarter du partage ne déplace rien chez soi — la fiche reste au
   mur, dans l'almanach, dans la constellation. Ce qui change est ce que
   les AUTRES voient, et c'est pourquoi ce bouton se tient à côté
   d'`Ailleurs` et de `RangerDansUneListe`, les deux autres blocs qui ne
   parlent que du dehors.

   ELLE NE PARAÎT QUE QUAND ELLE VEUT DIRE QUELQUE CHOSE : sans serveur,
   sans compte, ou quand la collection n'est montrée à personne, il n'y
   a rien à écarter de rien.
   ============================================================ */
import { useEffect, useState } from "react";
import { EyeOff, Eye } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label } from "../ui";
import {
  cacherLaFiche,
  fichesCachees,
  monPartage,
  serveurConfigure,
  type Partage,
} from "../../services/serveur";
import type { Film } from "../../types";

export function EcarterDuPartage({ film, connecte }: { film: Film; connecte: boolean }) {
  const [cachée, setCachée] = useState<boolean | null>(null);
  const [partage, setPartage] = useState<Partage | null>(null);
  const [occupé, setOccupé] = useState(false);

  useEffect(() => {
    if (!serveurConfigure() || !connecte) return;
    let vivant = true;
    Promise.all([fichesCachees(), monPartage()])
      .then(([c, p]) => {
        if (!vivant) return;
        setCachée(c.ids.includes(film.id));
        setPartage(p.partage);
      })
      /* Une panne du serveur ne fait pas parler la fiche : la section
         disparaît, le classeur continue. */
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [connecte, film.id]);

  /* « Personne » ne se discute pas fiche par fiche : quand rien n'est
     montré, tout est déjà écarté, et proposer de l'écarter davantage
     serait une case sans effet. */
  if (cachée == null || partage == null || partage === "privee") return null;

  const basculer = async () => {
    setOccupé(true);
    try {
      const r = await cacherLaFiche(film.id, !cachée);
      setCachée(r.cachee);
    } finally {
      setOccupé(false);
    }
  };

  return (
    <div data-tour="detail-partage" style={{ marginTop: 18 }}>
      <Label>Ce que les autres en voient</Label>
      <button
        onClick={basculer}
        disabled={occupé}
        style={{
          all: "unset",
          ...tap,
          cursor: occupé ? "default" : "pointer",
          opacity: occupé ? 0.5 : 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 4,
          fontFamily: F.mono,
          fontSize: 10,
          color: cachée ? C.burgundy : C.inkFaded,
        }}
      >
        {cachée ? <EyeOff size={12} /> : <Eye size={12} />}
        {cachée ? "ÉCARTÉE DU PARTAGE" : "ÉCARTER DU PARTAGE"}
      </button>
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 5 }}>
        {cachée
          ? "Personne ne la voit chez vous. Elle reste au mur, dans l'almanach et dans la constellation — c'est le dehors qui l'ignore."
          : "Elle paraît dans votre collection partagée, avec sa note et votre critique. Vos notes libres et votre journal de séances ne sortent jamais."}
      </div>
    </div>
  );
}
