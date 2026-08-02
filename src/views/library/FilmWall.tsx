import { FilmPolaroid } from "../../components/film/FilmPolaroid";
import type { Film } from "../../types";

/* Le mur des fiches.

   Il utilisait des colonnes CSS, qui remplissent une colonne de haut en bas
   avant de passer à la suivante : l'ordre trié devenait illisible pour un œil
   qui lit de gauche à droite, au point de faire croire que le tri ne marchait
   pas. Une grille ordonne les fiches ligne par ligne ; le décalage vertical de
   chaque fiche (nudgeOf) suffit à garder le désordre voulu. */
export function FilmWall({ films, onOpen }: { films: Film[]; onOpen: (id: string) => void }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
        gap: "0 34px",
        alignItems: "start",
      }}
    >
      {films.map((f) => (
        <FilmPolaroid key={f.id} film={f} onClick={() => onOpen(f.id)} />
      ))}
    </div>
  );
}
