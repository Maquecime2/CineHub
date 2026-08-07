import { describe, it, expect } from "vitest";
import { classerLaSoirée, languesDeLaListe, CRÉNEAUX } from "./soir";
import { makeFilm } from "./film";
import type { Film } from "../types";

const àVoir = (title: string, partial: Partial<Film> = {}) =>
  makeFilm({ title, status: "watchlist", ...partial });

const vu = (title: string, partial: Partial<Film> = {}) =>
  makeFilm({ title, status: "watched", ...partial });

/** L'ordre des titres proposés — la seule chose qu'on veuille lire. */
const ordre = (props: ReturnType<typeof classerLaSoirée>) => props.map((p) => p.film.title);

const SANS_ENVIE = { minutes: null, humeur: [], langues: [] };

describe("qui entre dans la soirée", () => {
  it("ne rend rien d'une collection vide", () => {
    expect(classerLaSoirée([], SANS_ENVIE)).toEqual([]);
  });

  it("ne propose que la liste « à voir »", () => {
    const out = classerLaSoirée([vu("Déjà vu"), àVoir("En attente")], SANS_ENVIE);
    expect(ordre(out)).toEqual(["En attente"]);
  });

  it("laisse les fiches mises de côté où elles sont", () => {
    const out = classerLaSoirée(
      [àVoir("Rangé", { archived: true }), àVoir("Sur la pile")],
      SANS_ENVIE
    );
    expect(ordre(out)).toEqual(["Sur la pile"]);
  });
});

describe("le temps dont on dispose", () => {
  it("place devant celui qui tient dans le créneau", () => {
    const out = classerLaSoirée(
      [àVoir("Fleuve", { runtime: 210 }), àVoir("Court", { runtime: 95 })],
      { ...SANS_ENVIE, minutes: 120 }
    );
    expect(ordre(out)[0]).toBe("Court");
  });

  it("accepte un léger dépassement plutôt que de le rejeter", () => {
    // 125 min pour deux heures : un quart d'heure de retard, pas une erreur
    const out = classerLaSoirée(
      [àVoir("Un peu long", { runtime: 125 }), àVoir("Beaucoup trop long", { runtime: 200 })],
      { ...SANS_ENVIE, minutes: 120 }
    );
    expect(ordre(out)).toEqual(["Un peu long", "Beaucoup trop long"]);
    expect(out[0]!.dépassement).toBe(5);
    expect(out[0]!.raisons.join(" ")).toContain("de trop");
  });

  it("n'écarte pas une durée inconnue, et le dit", () => {
    const out = classerLaSoirée([àVoir("Sans durée", { runtime: null })], {
      ...SANS_ENVIE,
      minutes: 90,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.duréeInconnue).toBe(true);
    expect(out[0]!.raisons).toContain("durée inconnue");
  });

  it("range la durée inconnue après ce qui tient, avant ce qui déborde", () => {
    const out = classerLaSoirée(
      [
        àVoir("Inconnue", { runtime: null }),
        àVoir("Tient", { runtime: 100 }),
        àVoir("Déborde", { runtime: 190 }),
      ],
      { ...SANS_ENVIE, minutes: 120 }
    );
    expect(ordre(out)).toEqual(["Tient", "Inconnue", "Déborde"]);
  });

  it("ne compte pas le temps quand on n'en demande pas", () => {
    const out = classerLaSoirée(
      [àVoir("Fleuve", { runtime: 240 }), àVoir("Court", { runtime: 80 })],
      SANS_ENVIE
    );
    // rien ne les départage sur la durée : c'est l'ancienneté qui tranche
    expect(out).toHaveLength(2);
    expect(out[0]!.dépassement).toBe(0);
  });
});

describe("l'humeur", () => {
  it("fait remonter ce qui la porte", () => {
    const out = classerLaSoirée(
      [àVoir("Gai", { motifs: ["burlesque"] }), àVoir("Triste", { motifs: ["melancolie"] })],
      { ...SANS_ENVIE, humeur: ["melancolie"] }
    );
    expect(ordre(out)[0]).toBe("Triste");
    expect(out[0]!.raisons).toContain("mélancolie");
  });

  it("lit aussi les motifs devinés, qu'aucune fiche non vue ne porte", () => {
    /* Un film qu'on n'a pas vu ne porte pas de motifs : c'est tout
       l'objet de la devinette par mots-clés TMDB. */
    const f = àVoir("Deviné");
    const out = classerLaSoirée(
      [f, àVoir("Rien")],
      { ...SANS_ENVIE, humeur: ["melancolie"] },
      new Map([[f.id, ["melancolie"]]])
    );
    expect(ordre(out)[0]).toBe("Deviné");
  });

  it("préfère celui qui répond à deux humeurs sur deux", () => {
    const out = classerLaSoirée(
      [
        àVoir("Une seule", { motifs: ["melancolie"] }),
        àVoir("Les deux", { motifs: ["melancolie", "contemplatif"] }),
      ],
      { ...SANS_ENVIE, humeur: ["melancolie", "contemplatif"] }
    );
    expect(ordre(out)[0]).toBe("Les deux");
  });

  it("ne réclame rien quand aucune humeur n'est posée", () => {
    const out = classerLaSoirée([àVoir("A", { motifs: ["melancolie"] }), àVoir("B")], SANS_ENVIE);
    expect(out).toHaveLength(2);
  });
});

describe("la langue", () => {
  it("écarte ce qui n'est pas dans la langue demandée", () => {
    const out = classerLaSoirée(
      [àVoir("Japonais", { language: "ja" }), àVoir("Suédois", { language: "sv" })],
      { ...SANS_ENVIE, langues: ["ja"] }
    );
    expect(ordre(out)).toEqual(["Japonais"]);
  });

  it("garde une langue inconnue plutôt que de punir l'incomplétude", () => {
    const out = classerLaSoirée(
      [àVoir("Sans langue", { language: "" }), àVoir("Suédois", { language: "sv" })],
      { ...SANS_ENVIE, langues: ["ja"] }
    );
    expect(ordre(out)).toEqual(["Sans langue"]);
  });
});

describe("l'ancienneté", () => {
  it("départage en faveur de celui qu'on avait oublié", () => {
    const vieux = àVoir("Oublié", { runtime: 100, addedAt: 1_000 });
    const neuf = àVoir("D'hier", { runtime: 100, addedAt: 9_000_000_000 });
    const out = classerLaSoirée([neuf, vieux], { ...SANS_ENVIE, minutes: 120 });
    expect(ordre(out)[0]).toBe("Oublié");
  });
});

describe("sans profil de goût", () => {
  it("classe quand même, sans inventer d'affinité", () => {
    // moins de trois films vus : `taste.isEmpty`
    const out = classerLaSoirée([àVoir("A", { runtime: 90, genres: ["Drame"] })], {
      ...SANS_ENVIE,
      minutes: 120,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.raisons.join(" ")).not.toContain("vous aimez");
  });
});

describe("languesDeLaListe", () => {
  it("ne rend que les langues de la liste « à voir », les plus fournies d'abord", () => {
    const out = languesDeLaListe([
      àVoir("A", { language: "ja" }),
      àVoir("B", { language: "fr" }),
      àVoir("C", { language: "fr" }),
      vu("D", { language: "de" }),
      àVoir("E", { language: "" }),
    ]);
    expect(out).toEqual([
      { code: "fr", n: 2 },
      { code: "ja", n: 1 },
    ]);
  });
});

describe("les créneaux", () => {
  it("vont du plus court au plus long", () => {
    const m = CRÉNEAUX.map((c) => c.minutes);
    expect(m).toEqual([...m].sort((a, b) => a - b));
  });
});
