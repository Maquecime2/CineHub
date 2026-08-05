import { FilmPolaroid } from "../../components/film/FilmPolaroid";
import { DEFAULT_WALL_LOOK, scaleOf, gapOf, type WallLook } from "./wallLook";
import type { Film } from "../../types";

/* Le mur des fiches.

   Il utilisait des colonnes CSS, qui remplissent une colonne de haut en bas
   avant de passer à la suivante : l'ordre trié devenait illisible pour un œil
   qui lit de gauche à droite, au point de faire croire que le tri ne marchait
   pas. Une grille ordonne les fiches ligne par ligne ; le décalage vertical de
   chaque fiche (nudgeOf) suffit à garder le désordre voulu.

   La largeur de colonne n'est plus un nombre écrit ici : elle suit le calibre
   des fiches, sinon une fiche rapetissée flotterait au milieu d'une colonne
   restée large. L'écartement, lui, se règle à part — deux murs de même
   calibre peuvent être serrés ou aérés. */
export function FilmWall({
  films,
  onOpen,
  look = DEFAULT_WALL_LOOK,
}: {
  films: Film[];
  onOpen: (id: string) => void;
  look?: WallLook;
}) {
  const gap = gapOf(look);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(210 * scaleOf(look))}px, 1fr))`,
        gap: `0 ${gap}px`,
        alignItems: "start",
      }}
    >
      {films.map((f) => (
        <FilmPolaroid key={f.id} film={f} look={look} onClick={() => onOpen(f.id)} />
      ))}
    </div>
  );
}
