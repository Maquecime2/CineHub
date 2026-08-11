import { describe, it, expect } from "vitest";
import { sillageMaison, liensEntre, scoreDe, POIDS } from "./sillage";
import { makeFilm } from "./film";
import type { Film } from "../types";

const film = (title: string, extra: Partial<Film> = {}): Film =>
  makeFilm({ title, status: "watched", ...extra });

const titres = (pivot: Film, films: Film[], combien = 8) =>
  sillageMaison(pivot, films, combien).map((v) => v.film.title);

describe("qui entre dans le sillage", () => {
  it("ne rend rien d'une collection vide", () => {
    expect(sillageMaison(film("Seul"), [])).toEqual([]);
  });

  it("ne se propose pas lui-même", () => {
    const pivot = film("Pivot", { director: "Denis Villeneuve" });
    expect(titres(pivot, [pivot])).toEqual([]);
  });

  it("écarte une fiche sans aucun lien : la proximité doit se dire", () => {
    const pivot = film("Pivot", { director: "Denis Villeneuve" });
    const étranger = film("Étranger", { director: "Agnès Varda" });
    expect(titres(pivot, [étranger])).toEqual([]);
  });

  it("écarte les fiches rangées : les archiver, c'est demander à ne plus les voir", () => {
    const pivot = film("Pivot", { director: "Denis Villeneuve" });
    const rangé = film("Rangé", { director: "Denis Villeneuve", archived: true });
    expect(titres(pivot, [rangé])).toEqual([]);
  });

  it("garde la liste « à voir » : « mis de côté, et proche » vaut la peine d'être su", () => {
    const pivot = film("Pivot", { director: "Denis Villeneuve" });
    const àVoir = makeFilm({
      title: "En attente",
      status: "watchlist",
      director: "Denis Villeneuve",
    });
    expect(titres(pivot, [àVoir])).toEqual(["En attente"]);
  });
});

describe("ce qui rapproche deux fiches", () => {
  it("reconnaît un nom écrit avec un accent d'un côté seulement", () => {
    const a = film("A", { crew: { musique: ["Zbigniew Preisner"] } });
    const b = film("B", { crew: { musique: ["zbigniew preïsner"] } });
    expect(liensEntre(a, b).map((l) => l.type)).toEqual(["musique"]);
  });

  it("découpe une réalisation à plusieurs mains", () => {
    const a = film("A", { director: "Joel Coen, Ethan Coen" });
    const b = film("B", { director: "Ethan Coen" });
    expect(liensEntre(a, b)).toEqual([{ type: "réalisation", valeur: "Ethan Coen" }]);
  });

  it("range les liens du plus rare au plus banal", () => {
    const commun = {
      director: "X",
      crew: { image: ["Deakins"] },
      themes: ["désert"],
    };
    const a = film("A", commun);
    const b = film("B", commun);
    expect(liensEntre(a, b).map((l) => l.type)).toEqual(["image", "réalisation", "thème"]);
  });

  /* Le cas qui a motivé tout le champ `keywords` : sur une collection
     importée, `motifs` et `themes` sont vides — ils se posent à la main.
     Sans mots-clés, le sillage ne savait rapprocher que des noms. */
  it("rapproche deux fiches par un mot-clé TMDB, sans aucune saisie", () => {
    const a = film("A", { keywords: ["time loop", "sequel"] });
    const b = film("B", { keywords: ["time loop"] });
    expect(liensEntre(a, b)).toEqual([{ type: "mot-clé", valeur: "time loop" }]);
  });

  it("ne dit pas deux fois la même chose quand un motif recouvre le mot-clé", () => {
    /* « heros-meurt » porte « death of hero » dans sa liste `tmdb` :
       compter les deux ferait deux remarques pour un seul fait. */
    const a = film("A", { motifs: ["heros-meurt"], keywords: ["death of hero"] });
    const b = film("B", { motifs: ["heros-meurt"], keywords: ["death of hero"] });
    expect(liensEntre(a, b)).toEqual([{ type: "motif", valeur: "Le héros meurt" }]);
  });

  it("garde un mot-clé qu'aucun motif partagé ne recouvre", () => {
    const a = film("A", { motifs: ["heros-meurt"], keywords: ["neo-noir"] });
    const b = film("B", { motifs: ["heros-meurt"], keywords: ["neo-noir"] });
    expect(liensEntre(a, b).map((l) => l.type)).toEqual(["motif", "mot-clé"]);
  });

  it("fait passer un motif choisi à la main devant un mot-clé subi", () => {
    const pivot = film("Pivot", { motifs: ["heros-meurt"], keywords: ["neo-noir"] });
    const parMotif = film("Par motif", { motifs: ["heros-meurt"] });
    const parMot = film("Par mot-clé", { keywords: ["neo-noir"] });
    expect(titres(pivot, [parMot, parMotif])).toEqual(["Par motif", "Par mot-clé"]);
  });

  it("ignore un motif que le catalogue ne connaît pas, sans le faire tomber la fiche", () => {
    const a = film("A", { motifs: ["heros-meurt", "motif-fantome"] });
    const b = film("B", { motifs: ["heros-meurt", "motif-fantome"] });
    expect(liensEntre(a, b)).toHaveLength(1);
  });
});

describe("la pondération", () => {
  it("fait passer un chef op partagé devant un réalisateur partagé", () => {
    const pivot = film("Pivot", { director: "X", crew: { image: ["Deakins"] } });
    const même_œil = film("Même œil", { crew: { image: ["Deakins"] } });
    const même_réal = film("Même réal", { director: "X" });
    expect(titres(pivot, [même_réal, même_œil])).toEqual(["Même œil", "Même réal"]);
  });

  it("dégrade un acteur selon son rang au générique", () => {
    const pivot = film("Pivot", { cast: ["Tête", "B", "C", "D", "E", "F", "G", "Queue"] });
    const tête = film("Tête d'affiche", { cast: ["Tête"] });
    const queue = film("Second rôle", { cast: ["Queue"] });
    const rendu = sillageMaison(pivot, [queue, tête]);
    expect(rendu[0]!.film.title).toBe("Tête d'affiche");
    expect(rendu[0]!.score).toBeGreaterThan(rendu[1]!.score);
  });

  it("plafonne les motifs : six banalités ne valent pas un regard partagé", () => {
    const beaucoup = ["heros-meurt", "sacrifice", "tout-le-monde-meurt", "seul-survivant"];
    const pivot = film("Pivot", { motifs: beaucoup, crew: { image: ["Deakins"] } });
    const motifs = film("Motifs", { motifs: beaucoup });
    const œil = film("Œil", { crew: { image: ["Deakins"] } });
    /* Quatre motifs à 2 points feraient 8 sans plafond, et écraseraient
       les 3 points du chef op. Plafonnés à 5, ils passent devant — mais
       de peu, et un seul motif de moins ne suffirait plus. */
    const scores = sillageMaison(pivot, [motifs, œil]);
    expect(scores[0]!.score).toBeLessThan(4 * POIDS.motif);
  });

  it("le goût reclasse mais n'élimine pas : un film détesté reste proposé", () => {
    const pivot = film("Pivot", { crew: { image: ["Deakins"] } });
    const aimé = film("Aimé", { crew: { image: ["Deakins"] }, rating: 5 });
    const détesté = film("Détesté", { crew: { image: ["Deakins"] }, rating: 0.5 });
    expect(titres(pivot, [détesté, aimé])).toEqual(["Aimé", "Détesté"]);
  });
});

describe("ce qui s'écrit sous l'affiche", () => {
  it("nomme le lien le plus fort et compte le reste", () => {
    const pivot = film("Pivot", {
      crew: { image: ["Roger Deakins"] },
      motifs: ["heros-meurt", "sacrifice"],
    });
    const voisin = film("Voisin", {
      crew: { image: ["Roger Deakins"] },
      motifs: ["heros-meurt", "sacrifice"],
    });
    expect(sillageMaison(pivot, [voisin])[0]!.raison).toBe(
      "même chef op — Roger Deakins, + 2 motifs"
    );
  });

  it("ne compte rien quand il n'y a qu'un lien", () => {
    const pivot = film("Pivot", { director: "Chantal Akerman" });
    const voisin = film("Voisin", { director: "Chantal Akerman" });
    expect(sillageMaison(pivot, [voisin])[0]!.raison).toBe("même réalisation — Chantal Akerman");
  });
});

describe("le classement est stable", () => {
  it("ne dépend pas de l'ordre du tableau", () => {
    const pivot = film("Pivot", { director: "X", crew: { musique: ["M"] } });
    const a = film("Alpha", { director: "X" });
    const b = film("Bravo", { director: "X" });
    const c = film("Charlie", { crew: { musique: ["M"] } });
    expect(titres(pivot, [a, b, c])).toEqual(titres(pivot, [c, b, a]));
  });

  it("départage deux fiches jumelles par le titre", () => {
    const pivot = film("Pivot", { director: "X" });
    const a = film("Alpha", { director: "X" });
    const b = film("Bravo", { director: "X" });
    expect(titres(pivot, [b, a])).toEqual(["Alpha", "Bravo"]);
  });

  it("s'arrête au nombre demandé", () => {
    const pivot = film("Pivot", { director: "X" });
    const beaucoup = Array.from({ length: 20 }, (_, i) => film(`F${i}`, { director: "X" }));
    expect(sillageMaison(pivot, beaucoup, 3)).toHaveLength(3);
  });
});

describe("scoreDe", () => {
  it("rend zéro sans aucun lien", () => {
    const a = film("A");
    expect(scoreDe(a, film("B"), [])).toBe(0);
  });
});
