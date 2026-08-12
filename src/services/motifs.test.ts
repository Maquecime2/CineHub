import { describe, it, expect } from "vitest";
import { normalizeVocabulaire } from "./motifs";

/* ============================================================
   LE VOCABULAIRE D'AVANT LA TRADUCTION

   Les motifs que VOUS avez créés sont écrits dans le `localStorage`, et
   ils portent une famille. Les familles ont changé de nom en passant à
   l'anglais — `récit` est devenu `narrative` — et `normalizeVocabulaire`
   est la seule porte par laquelle ces motifs entrent.

   Sans reprise, ils ne disparaîtraient pas : ils se retrouveraient tous
   rangés d'office dans « la façon de raconter », c'est-à-dire au mauvais
   endroit et sans que rien ne le signale. C'est exactement le genre de
   dégât qu'on ne voit qu'en rouvrant le tiroir six mois plus tard.
   ============================================================ */
describe("les motifs perso d'avant la bascule", () => {
  const perso = (famille: unknown) => ({
    perso: [{ id: "il-pleut", label: "Il pleut", famille }],
    masqués: [],
  });

  it.each([
    ["destin", "fate"],
    ["fin", "ending"],
    ["récit", "narrative"],
    ["figure", "figures"],
    ["ton", "tone"],
    ["monde", "world"],
  ])("relit la famille « %s »", (ancienne, attendue) => {
    const v = normalizeVocabulaire(perso(ancienne));
    expect(v.perso[0]!.famille).toBe(attendue);
  });

  it("laisse intacte une famille déjà traduite", () => {
    expect(normalizeVocabulaire(perso("world")).perso[0]!.famille).toBe("world");
  });

  it("se rabat sur le récit pour une famille qu'il ne sait pas lire", () => {
    /* Une famille inconnue ne doit pas rendre le motif invisible : mieux
       vaut le ranger quelque part que le perdre. */
    expect(normalizeVocabulaire(perso("famille-inventée")).perso[0]!.famille).toBe("narrative");
  });

  it("garde l'identifiant d'un motif perso, qui n'est pas du catalogue", () => {
    /* Son identifiant est tiré de son libellé et n'a jamais été traduit :
       le migrer le rendrait orphelin des fiches qui le portent. */
    expect(normalizeVocabulaire(perso("monde")).perso[0]!.id).toBe("il-pleut");
  });
});

describe("ce qui sort du disque", () => {
  it("survit à n'importe quelle forme", () => {
    expect(normalizeVocabulaire(null)).toEqual({ perso: [], masqués: [] });
    expect(normalizeVocabulaire({ perso: "pas une liste" })).toEqual({ perso: [], masqués: [] });
    expect(normalizeVocabulaire({ perso: [{ id: "x" }] }).perso).toEqual([]);
  });

  it("écarte un motif sans libellé plutôt que d'afficher une ligne vide", () => {
    const v = normalizeVocabulaire({ perso: [{ id: "x", label: "   ", famille: "monde" }] });
    expect(v.perso).toEqual([]);
  });
});
