import { describe, it, expect } from "vitest";
import { sillageMaison, liensEntre, scoreDe, POIDS, familleDe, parQuotas } from "./sillage";
import type { Quotas } from "./sillage";
import { makeFilm } from "./film";
import type { Film } from "../types";

const film = (title: string, extra: Partial<Film> = {}): Film =>
  makeFilm({ title, status: "watched", ...extra });

/* Large par défaut : la plupart des cas veulent voir TOUT ce que le
   sillage a trouvé, et non ce qu'un quota en laisse passer. Les quotas
   ont leur propre section. */
const titres = (pivot: Film, films: Film[], quotas: Partial<Quotas> = { gens: 50, sujets: 50 }) =>
  sillageMaison(pivot, films, quotas).map((v) => v.film.title);

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
    const a = film("A", { motifs: ["hero-dies"], keywords: ["death of hero"] });
    const b = film("B", { motifs: ["hero-dies"], keywords: ["death of hero"] });
    expect(liensEntre(a, b)).toEqual([{ type: "motif", valeur: "Le héros meurt" }]);
  });

  it("garde un mot-clé qu'aucun motif partagé ne recouvre", () => {
    const a = film("A", { motifs: ["hero-dies"], keywords: ["neo-noir"] });
    const b = film("B", { motifs: ["hero-dies"], keywords: ["neo-noir"] });
    expect(liensEntre(a, b).map((l) => l.type)).toEqual(["motif", "mot-clé"]);
  });

  it("fait passer un motif choisi à la main devant un mot-clé subi", () => {
    const pivot = film("Pivot", { motifs: ["hero-dies"], keywords: ["neo-noir"] });
    const parMotif = film("Par motif", { motifs: ["hero-dies"] });
    const parMot = film("Par mot-clé", { keywords: ["neo-noir"] });
    expect(titres(pivot, [parMot, parMotif])).toEqual(["Par motif", "Par mot-clé"]);
  });

  it("ignore un motif que le catalogue ne connaît pas, sans le faire tomber la fiche", () => {
    const a = film("A", { motifs: ["hero-dies", "motif-fantome"] });
    const b = film("B", { motifs: ["hero-dies", "motif-fantome"] });
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
    const beaucoup = ["hero-dies", "sacrifice", "everyone-dies", "sole-survivor"];
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
      motifs: ["hero-dies", "sacrifice"],
    });
    const voisin = film("Voisin", {
      crew: { image: ["Roger Deakins"] },
      motifs: ["hero-dies", "sacrifice"],
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
    expect(sillageMaison(pivot, beaucoup, { gens: 2, sujets: 1, foule: 0 })).toHaveLength(3);
  });
});

describe("les quotas : les gens d'un côté, les sujets de l'autre", () => {
  const pivot = film("Pivot", {
    director: "X",
    crew: { image: ["Deakins"], musique: ["Zimmer"] },
    cast: ["Vedette"],
    motifs: ["hero-dies"],
    keywords: ["neo-noir"],
  });
  const gens = [
    film("G1", { director: "X" }),
    film("G2", { crew: { image: ["Deakins"] } }),
    film("G3", { crew: { musique: ["Zimmer"] } }),
    film("G4", { cast: ["Vedette"] }),
  ];
  const sujets = [
    film("S1", { motifs: ["hero-dies"] }),
    film("S2", { keywords: ["neo-noir"] }),
    film("S3", { motifs: ["hero-dies"], keywords: ["neo-noir"] }),
  ];

  it("range chaque voisin sous son lien le plus fort", () => {
    expect(familleDe(liensEntre(pivot, gens[1]!))).toBe("gens");
    expect(familleDe(liensEntre(pivot, sujets[0]!))).toBe("sujets");
  });

  /* Le défaut que les quotas corrigent : les noms propres pèsent plus
     lourd qu'un motif, si bien qu'un classement par score seul rendait
     des filmographies et jamais un sujet. */
  it("réserve des places aux sujets, que le score seul aurait pris", () => {
    const rendu = sillageMaison(pivot, [...gens, ...sujets], { gens: 2, sujets: 2, foule: 0 });
    const familles = rendu.map((v) => familleDe(v.liens));
    expect(familles.filter((f) => f === "gens")).toHaveLength(2);
    expect(familles.filter((f) => f === "sujets")).toHaveLength(2);
  });

  /* Une collection sans motifs ni mots-clés ne doit pas être punie d'un
     manque qu'elle ne peut pas combler sur-le-champ. */
  it("reverse à l'autre famille ce qu'une famille ne prend pas", () => {
    const rendu = sillageMaison(pivot, gens, { gens: 2, sujets: 2, foule: 0 });
    expect(rendu).toHaveLength(4);
    expect(rendu.every((v) => familleDe(v.liens) === "gens")).toBe(true);
  });

  it("ne rend pas plus que ce qui existe", () => {
    expect(sillageMaison(pivot, [gens[0]!], { gens: 5, sujets: 5, foule: 0 })).toHaveLength(1);
  });
});

describe("parQuotas", () => {
  const item = (nom: string, f: "gens" | "sujets") => ({ nom, f });
  const famille = (i: { f: "gens" | "sujets" }) => i.f;

  /* Servi famille par famille, on lirait cinq « même équipe » puis cinq
     « même sujet » : deux listes collées, pas une réponse. */
  it("rend le tout dans l'ordre du classement, pas famille par famille", () => {
    const triés = [item("a", "gens"), item("b", "sujets"), item("c", "gens"), item("d", "sujets")];
    expect(parQuotas(triés, famille, { gens: 2, sujets: 2, foule: 0 }).map((i) => i.nom)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("ne rend rien d'une liste vide", () => {
    expect(parQuotas([], famille, { gens: 5, sujets: 5, foule: 0 })).toEqual([]);
  });
});

describe("scoreDe", () => {
  it("rend zéro sans aucun lien", () => {
    const a = film("A");
    expect(scoreDe(a, film("B"), [])).toBe(0);
  });
});
