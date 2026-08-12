/* ============================================================
   RANGER CE FILM DANS UNE LISTE
   ============================================================

   LE GESTE PART DE LA FICHE, et non de la vue des listes : c'est ici
   qu'on a le film sous les yeux, et surtout son identifiant d'œuvre.
   Remplir une liste depuis la vue des listes aurait demandé d'y
   reconstruire une recherche TMDB entière — le même travail, à un
   endroit où l'on n'a rien à regarder.

   D'où le corollaire : une fiche SANS `tmdbId` ne se range nulle part,
   et ce n'est pas un défaut. Une liste contient des œuvres, pas des
   exemplaires ; un film saisi à la main n'a pas d'identité commune
   avec le même film chez quelqu'un d'autre.
   ============================================================ */
import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label } from "../ui";
import { myLists, addToList, serverConfigured, type List } from "../../services/server";
import type { Film } from "../../types";

export function RangerDansUneListe({ film, connecte }: { film: Film; connecte: boolean }) {
  const [listes, setListes] = useState<List[]>([]);
  const [choix, setChoix] = useState("");
  const [dit, setDit] = useState<string | null>(null);

  useEffect(() => {
    if (!serverConfigured() || !connecte || !film.tmdbId) return;
    let vivant = true;
    myLists()
      .then((r) => vivant && setListes(r.listes))
      /* Une panne du serveur ne doit pas faire parler la fiche : la
         section disparaît, le classeur continue. */
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [connecte, film.tmdbId]);

  if (!film.tmdbId || listes.length === 0) return null;

  const ranger = async () => {
    if (!choix) return;
    const r = await addToList(choix, {
      tmdbId: film.tmdbId!,
      titre: film.title,
      annee: film.year,
    });
    /* « Déjà dedans » n'est pas une erreur : c'est le même geste, et il
       mérite la même réponse tranquille. */
    setDit(r.neuf ? "rangé" : "y était déjà");
  };

  return (
    <div data-tour="detail-listes" style={{ marginTop: 18 }}>
      <Label>Ranger dans une liste</Label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
        <select
          value={choix}
          onChange={(e) => {
            setChoix(e.target.value);
            setDit(null);
          }}
          style={{
            ...tap,
            fontFamily: F.mono,
            fontSize: 11,
            color: C.ink,
            background: "transparent",
            border: `1px solid ${C.line}`,
            padding: "5px 8px",
            maxWidth: 220,
          }}
        >
          <option value="">choisir…</option>
          {listes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.titre}
            </option>
          ))}
        </select>
        <button
          onClick={ranger}
          disabled={!choix}
          style={{
            all: "unset",
            ...tap,
            cursor: choix ? "pointer" : "not-allowed",
            gap: 5,
            padding: "6px 10px",
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1,
            color: C.card,
            background: choix ? C.moss : C.line,
          }}
        >
          <ListPlus size={12} /> RANGER
        </button>
        {dit && <span style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>{dit}</span>}
      </div>
    </div>
  );
}
