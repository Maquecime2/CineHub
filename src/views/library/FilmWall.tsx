import { useEffect, useRef, useState } from "react";
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

/* ============================================================
   LE MUR NE MONTE QUE CE QU'ON REGARDE
   ============================================================

   Cinq cents fiches, c'est cinq cents polaroïds montés d'un coup : une
   affiche, un ruban ou une punaise, des étoiles, un numéro de dossier.
   Le premier rendu bloquait le fil, et chaque coup de molette repeignait
   ce que personne ne regardait.

   ON NE VIRTUALISE PAS LA GRILLE, ET C'EST DÉLIBÉRÉ. Le nombre de
   colonnes est décidé par `auto-fill` — donc par le navigateur, d'après
   la largeur disponible — et les hauteurs varient d'une fiche à l'autre
   (le décalage semé, le format de l'affiche). Calculer des rangées en
   JavaScript reviendrait à réimplémenter la mise en page pour la
   deviner, et à la deviner faux un jour sur deux.

   On garde donc la grille telle quelle, et l'on vide les CASES qu'on ne
   voit pas — en leur laissant exactement la hauteur qu'elles avaient. La
   mise en page ne bouge pas d'un pixel, le défilement ne saute jamais,
   l'ascenseur garde sa taille, et `WallStudio` continue de voir le mur
   entier puisque toutes les cases sont là.

   Le désordre reste intact : `tiltOf` et `nudgeOf` sont semés par
   l'identifiant du film, jamais par son rang de rendu — une fiche qui
   sort de vue et revient revient IDENTIQUE. */

/* De quoi monter une bonne hauteur d'écran d'avance, de chaque côté :
   on ne veut pas voir apparaître les fiches, seulement ne pas les
   porter toutes. */
const MARGE = "900px";

/* En dessous de ce nombre, on ne fait rien : l'observation coûte plus
   qu'elle ne rapporte, et un mur de quarante fiches n'a jamais ramé. */
const SEUIL = 60;

function Case({
  film,
  look,
  onOpen,
}: {
  film: Film;
  look: WallLook;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  /* `null` : la case est montée. Un nombre : elle est vidée, et c'est la
     hauteur qu'elle avait au moment où on l'a vidée.

     UN ÉTAT ET NON UNE RÉFÉRENCE, parce que la valeur est LUE PENDANT LE
     RENDU — c'est elle qui donne sa hauteur au vide. Une référence lue
     au rendu ne prévient pas React qu'il faut redessiner, et rien ne
     garantit qu'on lise la bonne : le premier jet le faisait, et le
     lint a eu raison de le refuser. */
  const [vidéeÀ, setVidéeÀ] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    /* Un navigateur sans `IntersectionObserver` garde le mur d'avant :
       plus lourd, mais entier. Une dégradation ne doit jamais faire
       disparaître le contenu. */
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting) setVidéeÀ(null);
        /* On mesure AVANT de vider, pendant que la case a encore son
           contenu — après, il n'y aurait plus rien à mesurer. */
        else setVidéeÀ(el.getBoundingClientRect().height || 1);
      },
      { rootMargin: MARGE }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={vidéeÀ == null ? undefined : { height: vidéeÀ }}>
      {vidéeÀ == null && <FilmPolaroid film={film} look={look} onClick={() => onOpen(film.id)} />}
    </div>
  );
}

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
  const fenêtré = films.length >= SEUIL;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(210 * scaleOf(look))}px, 1fr))`,
        gap: `0 ${gap}px`,
        alignItems: "start",
      }}
    >
      {films.map((f) =>
        fenêtré ? (
          <Case key={f.id} film={f} look={look} onOpen={onOpen} />
        ) : (
          <FilmPolaroid key={f.id} film={f} look={look} onClick={() => onOpen(f.id)} />
        )
      )}
    </div>
  );
}
