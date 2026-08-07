import { describe, it, expect } from "vitest";
import { suggestionsMaison } from "./chezvous";
import { makeFilm } from "./film";
import type { Film, Watch } from "../types";

/* Une date de référence fixe : tout ce que ce module calcule est une
   durée depuis aujourd'hui, et un test qui vieillit est un test qui
   passera un jour sans qu'on sache pourquoi. */
const AUJOURD_HUI = Date.parse("2026-08-07T12:00:00Z");
const ilYA = (jours: number): string =>
  new Date(AUJOURD_HUI - jours * 24 * 3600 * 1000).toISOString().slice(0, 10);

const vu = (title: string, watches: Watch[], extra: Partial<Film> = {}): Film =>
  makeFilm({ title, status: "watched", watches, ...extra });

const suggestions = (films: Film[], combien = 6) =>
  suggestionsMaison(films, AUJOURD_HUI, combien);

const titres = (films: Film[], combien = 6) => suggestions(films, combien).map((s) => s.film.title);

describe("qui entre dans les propositions", () => {
  it("ne rend rien d'une collection vide", () => {
    expect(suggestions([])).toEqual([]);
  });

  it("ignore la liste « à voir » : c'est la question de « lequel ce soir »", () => {
    const àVoir = makeFilm({
      title: "En attente",
      status: "watchlist",
      rating: 5,
      watches: [{ date: ilYA(1000), rating: 5 }],
    });
    expect(titres([àVoir])).toEqual([]);
  });

  it("ignore les fiches mises de côté", () => {
    const f = vu("Rangé", [{ date: ilYA(1000), rating: 5 }], { archived: true, rating: 5 });
    expect(titres([f])).toEqual([]);
  });

  it("ignore une fiche sans séance datée : il n'y a pas d'oubli à mesurer", () => {
    expect(titres([vu("Sans date", [], { rating: 5 })])).toEqual([]);
  });
});

describe("à revoir", () => {
  it("rappelle ce qu'on a aimé et laissé de côté", () => {
    const f = vu("Adoré", [{ date: ilYA(1000), rating: 5 }], { rating: 5 });
    const s = suggestions([f]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ nature: "revoir", titre: "À revoir" });
    expect(s[0]!.raison).toContain("2 ans");
  });

  it("laisse tranquille un film vu récemment", () => {
    // le proposer ressemblerait à de l'insistance
    expect(titres([vu("Frais", [{ date: ilYA(100), rating: 5 }], { rating: 5 })])).toEqual([]);
  });

  it("ne rappelle pas une déception", () => {
    expect(titres([vu("Bof", [{ date: ilYA(1000), rating: 2 }], { rating: 2 })])).toEqual([]);
  });

  it("retient la MEILLEURE note jamais donnée, pas la dernière", () => {
    /* Un film adoré à la première séance et tiédi à la seconde reste un
       film qu'on a aimé : `rating` seul l'aurait écarté. */
    const f = vu(
      "Réévalué",
      [
        { date: ilYA(1000), rating: 5 },
        { date: ilYA(900), rating: 3 },
      ],
      { rating: 3 }
    );
    expect(titres([f])).toEqual(["Réévalué"]);
  });

  it("place le mieux noté devant", () => {
    const films = [
      vu("Quatre", [{ date: ilYA(1000), rating: 4 }], { rating: 4 }),
      vu("Cinq", [{ date: ilYA(1000), rating: 5 }], { rating: 5 }),
    ];
    expect(titres(films)[0]).toBe("Cinq");
  });
});

describe("un motif délaissé", () => {
  const avecMotif = (n: number, jours: number, note: number, motifs: string[]) =>
    vu(`Film ${n}`, [{ date: ilYA(jours), rating: note }], { rating: note, motifs });

  it("signale une veine qu'on n'a plus croisée", () => {
    const films = [
      avecMotif(1, 900, 3, ["melancolie"]),
      avecMotif(2, 800, 3.5, ["melancolie"]),
    ];
    const s = suggestions(films).find((x) => x.nature === "motif");
    expect(s).toBeDefined();
    expect(s!.titre).toBe("Mélancolie");
    expect(s!.raison).toContain("2 films portent ce motif");
  });

  it("ne dit rien d'un motif porté par une seule fiche", () => {
    // un motif isolé est un accident, pas une veine délaissée
    const s = suggestions([avecMotif(1, 900, 3, ["melancolie"])]);
    expect(s.some((x) => x.nature === "motif")).toBe(false);
  });

  it("se tait quand la veine a été croisée récemment", () => {
    const films = [avecMotif(1, 900, 3, ["melancolie"]), avecMotif(2, 30, 3, ["melancolie"])];
    expect(suggestions(films).some((x) => x.nature === "motif")).toBe(false);
  });

  it("ignore un motif inconnu du catalogue plutôt que de l'afficher nu", () => {
    const films = [
      avecMotif(1, 900, 3, ["motif-fantome"]),
      avecMotif(2, 800, 3, ["motif-fantome"]),
    ];
    expect(suggestions(films).some((x) => x.nature === "motif")).toBe(false);
  });

  it("propose le mieux noté de la veine, non le plus poussiéreux", () => {
    const films = [
      avecMotif(1, 1200, 2, ["melancolie"]),
      avecMotif(2, 900, 5, ["melancolie"]),
    ];
    const s = suggestions(films).find((x) => x.nature === "motif");
    expect(s!.film.title).toBe("Film 2");
  });
});

describe("un cinéaste délaissé", () => {
  const deLui = (n: number, jours: number, note: number, director: string) =>
    vu(`Film ${n}`, [{ date: ilYA(jours), rating: note }], { rating: note, director });

  it("rappelle quelqu'un qu'on suivait", () => {
    const films = [deLui(1, 900, 4, "Ozu"), deLui(2, 800, 5, "Ozu")];
    const s = suggestions(films).find((x) => x.nature === "cinéaste");
    expect(s).toBeDefined();
    expect(s!.titre).toBe("Ozu");
    expect(s!.raison).toContain("2 films chez vous");
  });

  it("n'invente pas un cinéaste suivi à partir d'un seul film", () => {
    const s = suggestions([deLui(1, 900, 5, "Ozu")]);
    expect(s.some((x) => x.nature === "cinéaste")).toBe(false);
  });

  it("ne rappelle pas quelqu'un qu'on n'a pas aimé", () => {
    const films = [deLui(1, 900, 2, "Bof"), deLui(2, 800, 2.5, "Bof")];
    expect(suggestions(films).some((x) => x.nature === "cinéaste")).toBe(false);
  });

  it("découpe un champ à plusieurs mains", () => {
    const films = [deLui(1, 900, 5, "Coen, Coen"), deLui(2, 800, 5, "Coen, Coen")];
    const noms = suggestions(films)
      .filter((x) => x.nature === "cinéaste")
      .map((x) => x.titre);
    expect(noms).toEqual(["Coen"]);
  });
});

/* ============================================================
   LES SEUILS SUIVENT LA PRATIQUE

   CES TESTS ONT DÉJÀ SERVI. Le premier jet écrivait « deux ans » et
   « dix-huit mois » en dur — des durées raisonnables pour une
   collection tenue depuis dix ans, et qui disqualifiaient TOUT sur un
   classeur ouvert il y a dix-huit mois. La section entière restait
   vide, sans que rien ne dise pourquoi. Un seuil absolu ne mesure pas
   l'oubli : il mesure l'ancienneté du classeur.
   ============================================================ */
describe("les seuils suivent l'étendue de la pratique", () => {
  it("propose sur un classeur jeune, là où deux ans en dur ne rendaient rien", () => {
    /* Dix-huit mois de pratique : le tiers fait six mois. Un film adoré
       et pas revu depuis treize mois est bien un oubli — pour cette
       collection-là. */
    const films = [
      vu("Le plus ancien", [{ date: ilYA(540), rating: 3 }], { rating: 3 }),
      vu("Adoré et oublié", [{ date: ilYA(400), rating: 5 }], { rating: 5 }),
      vu("Vu hier", [{ date: ilYA(1), rating: 4 }], { rating: 4 }),
    ];
    expect(titres(films)).toContain("Adoré et oublié");
  });

  it("garde un plancher : un classeur tout neuf n'a rien d'oublié", () => {
    /* Trois semaines de pratique : le tiers ferait sept jours, ce qui
       n'est pas un oubli mais un rappel intempestif. Le plancher tient,
       et la section reste vide — ce qui est la bonne réponse. */
    const films = [
      vu("A", [{ date: ilYA(21), rating: 5 }], { rating: 5 }),
      vu("B", [{ date: ilYA(1), rating: 5 }], { rating: 5 }),
    ];
    expect(titres(films)).toEqual([]);
  });

  it("garde le plafond de deux ans sur une longue pratique", () => {
    /* Quinze ans de journal : le tiers ferait cinq ans, et l'on ne
       verrait plus rien de la dernière décennie. Au-delà de quelques
       années, deux ans est bien la bonne mesure de l'oubli. */
    const films = [
      vu("Antique", [{ date: ilYA(5475), rating: 3 }], { rating: 3 }),
      vu("Il y a trois ans", [{ date: ilYA(1100), rating: 5 }], { rating: 5 }),
      vu("L'an dernier", [{ date: ilYA(365), rating: 5 }], { rating: 5 }),
    ];
    const t = titres(films);
    expect(t).toContain("Il y a trois ans");
    expect(t).not.toContain("L'an dernier");
  });
});

describe("l'assemblage", () => {
  it("ne propose jamais deux fois le même film", () => {
    /* Le même film peut être « à revoir », porter un motif délaissé ET
       venir d'un cinéaste délaissé : trois raisons, une seule carte. */
    const films = [
      vu("A", [{ date: ilYA(1000), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancolie"],
      }),
      vu("B", [{ date: ilYA(900), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancolie"],
      }),
    ];
    const ids = suggestions(films).map((s) => s.film.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("entrelace les natures plutôt que de les mettre bout à bout", () => {
    const films = [
      vu("A", [{ date: ilYA(1000), rating: 5 }], { rating: 5, director: "Ozu", motifs: ["melancolie"] }),
      vu("B", [{ date: ilYA(900), rating: 5 }], { rating: 5, director: "Ozu", motifs: ["melancolie"] }),
      vu("C", [{ date: ilYA(950), rating: 4.5 }], { rating: 4.5, director: "Varda", motifs: ["contemplatif"] }),
      vu("D", [{ date: ilYA(920), rating: 4.5 }], { rating: 4.5, director: "Varda", motifs: ["contemplatif"] }),
    ];
    const natures = suggestions(films).map((s) => s.nature);
    // les trois angles paraissent, plutôt que trois « à revoir » d'affilée
    expect(new Set(natures).size).toBeGreaterThan(1);
  });

  /* CE TEST A DÉJÀ SERVI. Le premier jet gardait, pour un film désigné
     par plusieurs natures, celle qui arrivait la première — et « à
     revoir » arrivait toujours la première. Il raflait donc tous les
     films, et les deux autres natures, privées de sujet, ne
     paraissaient jamais. Le défaut était invisible sur une carte
     isolée : il ne se voyait qu'à l'échelle de la liste. */
  it("laisse la raison la plus spécifique l'emporter sur « à revoir »", () => {
    /* A est aimé (donc « à revoir »), porte un motif délaissé ET vient
       d'un cinéaste délaissé. Il ne doit pas paraître sous la raison la
       plus pauvre des trois. */
    const films = [
      vu("A", [{ date: ilYA(1000), rating: 5 }], { rating: 5, director: "Ozu", motifs: ["melancolie"] }),
      vu("B", [{ date: ilYA(900), rating: 5 }], { rating: 5, director: "Ozu", motifs: ["melancolie"] }),
    ];
    const pourA = suggestions(films).find((s) => s.film.title === "A")!;
    expect(pourA.nature).toBe("motif");
    // et « à revoir » n'a pas disparu pour autant : il ramasse le reste
    expect(suggestions(films).map((s) => s.nature)).toContain("revoir");
  });

  it("s'arrête au nombre demandé", () => {
    const films = Array.from({ length: 20 }, (_, i) =>
      vu(`F${i}`, [{ date: ilYA(1000 + i), rating: 5 }], { rating: 5 })
    );
    expect(suggestions(films, 3)).toHaveLength(3);
  });

  it("ne tourne pas en rond quand il y a moins à dire que demandé", () => {
    const films = [vu("Seul", [{ date: ilYA(1000), rating: 5 }], { rating: 5 })];
    expect(suggestions(films, 10)).toHaveLength(1);
  });

  it("rend des clés distinctes, utilisables comme identité", () => {
    const films = [
      vu("A", [{ date: ilYA(1000), rating: 5 }], { rating: 5, director: "Ozu", motifs: ["melancolie"] }),
      vu("B", [{ date: ilYA(900), rating: 5 }], { rating: 5, director: "Ozu", motifs: ["melancolie"] }),
    ];
    const clés = suggestions(films).map((s) => s.clé);
    expect(new Set(clés).size).toBe(clés.length);
  });
});
