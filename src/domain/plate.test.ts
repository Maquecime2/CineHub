import { describe, it, expect } from "vitest";
import { plateShots } from "./almanac";
import type { FilmOfYear } from "./almanac";
import type { Film } from "../types";

/* ============================================================
   CE QUE LA PLANCHE CHOISIT

   On n'éprouve pas des pixels : `drawYearPlate` rend un `Blob`, et un
   test de canevas ne dirait que ce qu'un canevas fait. Ce qui se décide
   ici est le CHOIX des images, et c'est là que sont les règles.

   LA PLUS IMPORTANTE : `stills` et `frames` ne sont pas la même chose,
   et les confondre coûterait de l'argent. Les premières sont à vous,
   miroitées, comptées dans le plafond ; les secondes appartiennent à
   TMDB et ne coûtent rien. La planche existe pour montrer les
   premières, et n'emprunte les secondes que pour ne pas être vide.
   ============================================================ */

const film = (id: string, patch: Partial<Film> = {}): Film =>
  ({ id, title: id.toUpperCase(), stills: [], frames: [], ...patch }) as Film;

const seen = (f: Film): FilmOfYear => ({ film: f, rating: null, n: 1, date: "2026-01-01" });

const IDB = "idb:";
const at = (p: string) => `https://tmdb/${p}`;

describe("les images d'une planche", () => {
  it("prend une capture à soi avant un photogramme emprunté", () => {
    const shots = plateShots(
      [
        seen(film("a", { frames: ["/f-a.jpg"] })),
        seen(film("b", { stills: [{ id: "s", key: "k-b", caption: "" }] })),
      ],
      8,
      IDB,
      at
    );
    expect(shots.map((s) => s.filmId)).toEqual(["b", "a"]);
    expect(shots[0]!.mine).toBe(true);
    expect(shots[1]!.mine).toBe(false);
  });

  /* Décoder du 4K pour une case de planche est ce que `thumbKey` existe
     pour éviter. */
  it("lit la vignette et non l'originale", () => {
    const shots = plateShots(
      [seen(film("a", { stills: [{ id: "s", key: "gros", thumbKey: "petit", caption: "" }] }))],
      8,
      IDB,
      at
    );
    expect(shots[0]!.src).toBe("idb:petit");
  });

  it("retombe sur la clé quand il n'y a pas de vignette", () => {
    const shots = plateShots(
      [seen(film("a", { stills: [{ id: "s", key: "seul", caption: "" }] }))],
      8,
      IDB,
      at
    );
    expect(shots[0]!.src).toBe("idb:seul");
  });

  /* SANS LES EMPRUNTS, LA PLANCHE SERAIT VIDE POUR TOUT LE MONDE le
     jour de sa sortie : aucune fiche au monde ne porte de capture. */
  it("emprunte à TMDB quand on n'a rien capturé", () => {
    const shots = plateShots([seen(film("a", { frames: ["/f-a.jpg", "/f-b.jpg"] }))], 8, IDB, at);
    expect(shots).toHaveLength(1);
    expect(shots[0]!.src).toBe("https://tmdb//f-a.jpg");
    expect(shots[0]!.mine).toBe(false);
  });

  /* Six captures d'un même film diraient « j'ai travaillé cette
     fiche », pas « voici mon année ». */
  it("ne prend qu'une image par film", () => {
    const shots = plateShots(
      [
        seen(
          film("a", {
            stills: [
              { id: "1", key: "k1", caption: "" },
              { id: "2", key: "k2", caption: "" },
            ],
          })
        ),
      ],
      8,
      IDB,
      at
    );
    expect(shots).toHaveLength(1);
  });

  it("ignore un film qui n'a ni l'un ni l'autre", () => {
    expect(plateShots([seen(film("a"))], 8, IDB, at)).toEqual([]);
  });

  it("s'arrête au nombre demandé", () => {
    const many = ["a", "b", "c", "d"].map((id) => seen(film(id, { frames: [`/${id}.jpg`] })));
    expect(plateShots(many, 2, IDB, at)).toHaveLength(2);
  });

  /* LE COMPTE SE FAIT APRÈS LE CLASSEMENT, et non avant : une année de
     vingt films dont deux capturés doit rendre les deux, pas les
     laisser tomber derrière huit emprunts. */
  it("garde les siennes même arrivées tard dans l'année", () => {
    const rows = [
      ...["a", "b", "c"].map((id) => seen(film(id, { frames: [`/${id}.jpg`] }))),
      seen(film("z", { stills: [{ id: "s", key: "k-z", caption: "" }] })),
    ];
    const shots = plateShots(rows, 2, IDB, at);
    expect(shots.map((s) => s.filmId)).toContain("z");
  });
});
