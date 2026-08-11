/* ============================================================
   LE CLASSEUR D'EXEMPLE TIENT SA PROMESSE

   Ces douze films n'existent que pour donner à la visite guidée quelque
   chose à montrer. Le seul défaut qu'on puisse leur faire est donc
   d'oublier un des repères qu'ils bouchaient — et ce défaut ne se voit
   pas à la lecture : il se voit sept cents millisecondes de voile
   opaque plus tard, chez quelqu'un qui ouvre l'application pour la
   première fois.

   Chaque test ci-dessous nomme l'étape de visite qu'il protège.
   ============================================================ */
import { describe, it, expect } from "vitest";
import {
  PRÉFIXE_DÉMO,
  classeurEncoreDémo,
  estDémo,
  filmsDeDémonstration,
  notesDeDémonstration,
  sansDémo,
} from "./demo";
import { MOTIFS } from "../domain/motifs";
import { makeFilm } from "../domain/film";

const films = filmsDeDémonstration();

describe("le classeur de démonstration", () => {
  it("compte une douzaine de fiches", () => {
    expect(films.length).toBeGreaterThanOrEqual(10);
  });

  it("se reconnaît à son préfixe, et rien d'autre", () => {
    expect(films.every(estDémo)).toBe(true);
    expect(estDémo(makeFilm({ title: "à moi" }))).toBe(false);
  });

  it("rend des fiches neuves à chaque appel", () => {
    expect(filmsDeDémonstration()[0]).not.toBe(films[0]);
  });

  it("n'a pas deux fois le même identifiant", () => {
    expect(new Set(films.map((f) => f.id)).size).toBe(films.length);
  });
});

describe("il couvre ce que la visite montre", () => {
  /* Étape « Ce qui attend » : sans fiche mise de côté, l'onglet « À
     voir » ouvre un mur vide et la bulle entoure du rien. */
  it("a au moins un film mis de côté", () => {
    expect(films.filter((f) => f.status === "watchlist").length).toBeGreaterThan(0);
  });

  /* Étape « Une fiche s'ouvre » : il faut du monde sur les DEUX murs. */
  it("a aussi des films vus", () => {
    expect(films.filter((f) => f.status === "watched").length).toBeGreaterThan(5);
  });

  /* Étape « Le fil rouge », et la constellation entière. */
  it("tend des fils entre ses fiches, dans les deux sens", () => {
    const paires = films.flatMap((f) =>
      (f.linkedWorks || []).filter((w) => w.pairId).map((w) => w.pairId!)
    );
    expect(paires.length).toBeGreaterThan(0);
    /* Un fil s'écrit des deux côtés : chaque `pairId` paraît deux fois. */
    for (const p of new Set(paires)) expect(paires.filter((x) => x === p)).toHaveLength(2);
  });

  it("relie une œuvre qui n'est pas un film", () => {
    const hors = films.flatMap((f) => (f.linkedWorks || []).filter((w) => w.type !== "film"));
    expect(hors.length).toBeGreaterThan(0);
  });

  /* Les deux bouts d'un fil doivent se désigner l'un l'autre, sans quoi
     la constellation dessine des arêtes qui ne mènent nulle part. */
  it("ne renvoie jamais vers une fiche absente", () => {
    const ids = new Set(films.map((f) => f.id));
    for (const f of films)
      for (const w of f.linkedWorks || []) if (w.filmId) expect(ids.has(w.filmId)).toBe(true);
  });

  /* Étape « Mots-clés et motifs » : un motif inconnu du catalogue est
     ignoré à l'affichage, donc invisible — et l'étape montre le vide. */
  it("pose des motifs qui existent vraiment au catalogue", () => {
    const connus = new Set(MOTIFS.map((m) => m.id));
    const posés = films.flatMap((f) => f.motifs);
    expect(posés.length).toBeGreaterThan(5);
    for (const m of posés) expect(connus.has(m), `motif inconnu : ${m}`).toBe(true);
  });

  /* Étape « L'almanach » : une seule année ne fait pas un millésime, et
     « TOUJOURS » n'aurait rien à comparer. */
  it("a des séances sur au moins trois années", () => {
    const années = new Set(films.flatMap((f) => f.watches.map((w) => w.date.slice(0, 4))));
    expect(années.size).toBeGreaterThanOrEqual(3);
  });

  it("a un film revu, pour que le journal ait quelque chose à dire", () => {
    expect(films.some((f) => f.watches.length > 1)).toBe(true);
  });

  /* `watchedAt` est le reflet de `watches` : les laisser diverger ferait
     mentir le tri de la bibliothèque dès la première ouverture. */
  it("accorde watchedAt avec la séance la plus récente", () => {
    for (const f of films) expect(f.watchedAt).toBe(f.watches[0]?.date ?? null);
  });

  /* Étape « Dans le sillage » et parentés de la constellation : elles se
     tiennent aux gens des génériques, et pas seulement aux cinéastes. */
  it("a un chef opérateur et un compositeur", () => {
    expect(films.some((f) => (f.crew.image || []).length)).toBe(true);
    expect(films.some((f) => (f.crew.musique || []).length)).toBe(true);
  });

  it("fait revenir au moins un nom, sinon rien ne se rapproche", () => {
    const compte = (noms: string[]) => {
      const n = new Map<string, number>();
      for (const x of noms) n.set(x, (n.get(x) || 0) + 1);
      return [...n.values()];
    };
    expect(Math.max(...compte(films.map((f) => f.director)))).toBeGreaterThan(1);
    expect(Math.max(...compte(films.flatMap((f) => f.crew.image || [])))).toBeGreaterThan(1);
  });

  /* Étape « La fiche catalogue » : elle montre ce que TMDB rapporte. */
  it("remplit le catalogue des fiches vues", () => {
    for (const f of films.filter((x) => x.status === "watched")) {
      expect(f.runtime, f.title).toBeGreaterThan(0);
      expect(f.cast.length, f.title).toBeGreaterThan(0);
      expect(f.genres.length, f.title).toBeGreaterThan(0);
      expect((f.keywords || []).length, f.title).toBeGreaterThan(0);
      expect(f.countries.length, f.title).toBeGreaterThan(0);
      expect(f.language, f.title).not.toBe("");
      expect(f.tmdbRating, f.title).toBeGreaterThan(0);
    }
  });

  /* Étape « Vos mots », et l'écart à la note publique de l'almanach. */
  it("porte des notes et des critiques", () => {
    const vus = films.filter((f) => f.status === "watched");
    expect(vus.every((f) => f.rating > 0)).toBe(true);
    expect(vus.every((f) => f.review.trim() !== "")).toBe(true);
    expect(vus.some((f) => f.notes.trim() !== "")).toBe(true);
  });

  /* LES NOTES SONT SUR CINQ, ET RIEN NE LE DIT DANS LE TYPE.
     `Film.rating` est un `number` nu ; ce sont `InkStars`, l'histogramme
     de l'almanach (onze cases, 0 à 5) et `écartAuPublic` — qui double la
     note pour la comparer à TMDB — qui portent l'échelle. Une note à 9
     passait donc tous les contrôles, et ressortait en « vous : 17,8 sur
     10 » sur la planche des écarts. Un demi-point est le pas le plus fin
     que l'étoile sache poser. */
  it("note sur cinq, par demi-points", () => {
    for (const f of films) {
      expect(f.rating, f.title).toBeLessThanOrEqual(5);
      expect((f.rating * 2) % 1, f.title).toBe(0);
      for (const w of f.watches) {
        if (w.rating == null) continue;
        expect(w.rating, `${f.title} — ${w.date}`).toBeLessThanOrEqual(5);
        expect((w.rating * 2) % 1, `${f.title} — ${w.date}`).toBe(0);
      }
    }
  });

  /* AUCUNE AFFICHE, ET C'EST VOULU : une adresse morte donnerait douze
     rectangles cassés là où l'application dessine une émulsion teintée.
     Le test est là pour que personne n'en colle « juste une » plus tard
     sans se demander ce qu'elle devient hors ligne. */
  it("ne dépend d'aucune image distante", () => {
    for (const f of films) expect(f.poster, f.title).toBe("");
  });
});

describe("le carnet de démonstration", () => {
  it("a une page, préfixée comme le reste", () => {
    const notes = notesDeDémonstration();
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.id.startsWith(PRÉFIXE_DÉMO))).toBe(true);
  });
});

describe("il se retire d'un geste", () => {
  it("reconnaît un classeur qui n'est que l'exemple", () => {
    expect(classeurEncoreDémo(films)).toBe(true);
  });

  it("se tait dès qu'une fiche est à vous", () => {
    expect(classeurEncoreDémo([...films, makeFilm({ title: "à moi" })])).toBe(false);
  });

  it("se tait aussi sur un classeur vide", () => {
    expect(classeurEncoreDémo([])).toBe(false);
  });

  it("ne laisse rien derrière lui", () => {
    expect(sansDémo(films)).toHaveLength(0);
  });

  it("ne touche pas à ce qui n'est pas l'exemple", () => {
    const mien = makeFilm({ title: "à moi" });
    expect(sansDémo([...films, mien])).toEqual([mien]);
  });
});
