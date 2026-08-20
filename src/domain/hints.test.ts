import { describe, it, expect } from "vitest";
import {
  binderHints,
  hintFromLink,
  hintId,
  hintedBonds,
  hintsTouching,
  isHinted,
  readCreditNote,
  usefulHints,
} from "./hints";
import type { Hint } from "./hints";
import { makeBond } from "./bonds";
import { makeFilm } from "./film";
import type { Bond } from "./bonds";

const link = (from: string, prop: string, to: string) => ({ from, to, prop, seed: "1" });
const bond = (kind: "master" | "influence", from: string, to: string): Bond =>
  makeBond({ kind, fromName: from, toName: to })!;

/* ============================================================
   THE DIRECTION, WHICH IS THE WHOLE FILE

   Getting one of these backwards fails nothing at all: it draws a map
   where the pupils taught their masters, and no screen would say so.
   One test per line of the table in `hints.ts`.
   ============================================================ */
describe("reading a Wikidata triple", () => {
  it('P1066 says "a is the pupil of b", so b is the master', () => {
    const hint = hintFromLink(link("Kiyoshi Kurosawa", "P1066", "Shigehiko Hasumi"));
    expect(hint).toMatchObject({
      kind: "master",
      fromName: "Shigehiko Hasumi",
      toName: "Kiyoshi Kurosawa",
      source: "wikidata",
    });
  });

  it('P802 says "a has b for a pupil", so a is the master', () => {
    const hint = hintFromLink(link("Shigehiko Hasumi", "P802", "Kiyoshi Kurosawa"));
    expect(hint).toMatchObject({
      kind: "master",
      fromName: "Shigehiko Hasumi",
      toName: "Kiyoshi Kurosawa",
    });
  });

  it('P737 says "a is influenced by b", so the influence runs from b', () => {
    const hint = hintFromLink(link("Hou Hsiao-hsien", "P737", "Yasujiro Ozu"));
    expect(hint).toMatchObject({
      kind: "influence",
      fromName: "Yasujiro Ozu",
      toName: "Hou Hsiao-hsien",
    });
  });

  it("turns down a property this version does not read", () => {
    /* Rather than guess a kind: a bond with no kind has no spring
       length, no ink and no wording. */
    expect(hintFromLink(link("A", "P22", "B"))).toBeNull();
  });

  it("turns down a nameless end", () => {
    expect(hintFromLink(link("", "P1066", "B"))).toBeNull();
    expect(hintFromLink(link("A", "P1066", "   "))).toBeNull();
  });

  it("writes a reference in the note and never a sentence", () => {
    /* `Bond.note` goes to disk and synchronises: a French phrase here
       would freeze the day's language into somebody's data. */
    expect(hintFromLink(link("A", "P1066", "B"))!.note).toBe("Wikidata P1066");
  });
});

describe("what is worth offering", () => {
  const master = (from: string, to: string): Hint => ({
    kind: "master",
    fromName: from,
    toName: to,
    note: "",
    source: "wikidata",
  });

  it("keeps a film-maker the collection has never heard of", () => {
    /* `buildLineage` already draws the orphan node, and somebody's
       master is very often somebody one owns no film by — which is the
       thing worth learning. */
    expect(usefulHints([master("Shigehiko Hasumi", "Kiyoshi Kurosawa")], [])).toHaveLength(1);
  });

  it("does not offer twice what P1066 and P802 both state", () => {
    /* The pair is stated from both ends as often as not, and the relay
       reads the seed on both sides. */
    const both = [
      hintFromLink(link("Kurosawa", "P1066", "Hasumi"))!,
      hintFromLink(link("Hasumi", "P802", "Kurosawa"))!,
    ];
    expect(usefulHints(both, [])).toHaveLength(1);
  });

  it("says nothing about a bond already laid down", () => {
    const already = [bond("master", "Hasumi", "Kurosawa")];
    expect(usefulHints([master("Hasumi", "Kurosawa")], already)).toEqual([]);
  });

  it("drops what the form would refuse as a contradiction", () => {
    /* A click that answers with a complaint is the bug the gatherings
       took a whole rewrite to lose: the filter here is the form's own,
       run early. */
    const already = [bond("master", "Kurosawa", "Hasumi")];
    expect(usefulHints([master("Hasumi", "Kurosawa")], already)).toEqual([]);
  });

  it("drops a loop", () => {
    expect(usefulHints([master("Ozu", "Ozu")], [])).toEqual([]);
  });

  it("compares on keys, not on spellings", () => {
    /* `makeBond` normalises, so an accent or a case does not slip a
       second copy of the same filiation past the filter. */
    const already = [bond("master", "Jean Renoir", "Satyajit Ray")];
    expect(usefulHints([master("jean renoir", "SATYAJIT RAY")], already)).toEqual([]);
  });

  it("keeps the same pair under a different kind", () => {
    /* A master and an influence are two statements, not one written
       twice: `bondId` carries the kind. */
    const already = [bond("master", "Ozu", "Hou")];
    const other: Hint = { ...master("Ozu", "Hou"), kind: "influence" };
    expect(usefulHints([other], already)).toHaveLength(1);
  });
});

describe("the hints touching one person", () => {
  const hint = (from: string, to: string): Hint => ({
    kind: "master",
    fromName: from,
    toName: to,
    note: "",
    source: "wikidata",
  });

  it("finds them at either end", () => {
    const all = [hint("Hasumi", "Kurosawa"), hint("Renoir", "Ray"), hint("Kurosawa", "Aoyama")];
    expect(hintsTouching(all, "kurosawa")).toHaveLength(2);
  });

  it("keys the way the collection does", () => {
    expect(hintsTouching([hint("Jean Renoir", "Satyajit Ray")], "satyajit ray")).toHaveLength(1);
  });
});

describe("the identity a hint would take", () => {
  it("matches the bond it becomes", () => {
    const h = hintFromLink(link("Kurosawa", "P1066", "Hasumi"))!;
    expect(hintId(h)).toBe(bond("master", "Hasumi", "Kurosawa").id);
  });

  it("is empty for a hint that cannot become one", () => {
    expect(
      hintId({ kind: "master", fromName: "Ozu", toName: "Ozu", note: "", source: "wikidata" })
    ).toBe("");
  });
});

/* ============================================================
   RECONNAÎTRE CE QU'ON N'A PAS ÉCRIT SOI-MÊME

   Une moisson en masse peut couvrir la carte de liens qu'on ne voulait
   pas : il faut pouvoir les reprendre d'un geste, et donc les
   distinguer. La NOTE porte déjà la provenance — un champ de plus sur
   `Bond` aurait voyagé sur le disque pour une information qu'on affiche
   de toute façon.
   ============================================================ */
describe("un lien venu d'une piste", () => {
  const laid = (note: string): Bond => ({
    ...makeBond({ kind: "master", fromName: "Hasumi", toName: "Kurosawa" })!,
    note,
  });

  it("se reconnaît à sa note", () => {
    expect(isHinted(laid("Wikidata P1066"))).toBe(true);
    expect(isHinted(laid("Wikidata P737"))).toBe(true);
  });

  it("laisse tranquille ce qu'une main a écrit", () => {
    expect(isHinted(laid(""))).toBe(false);
    expect(isHinted(laid("vu dans un entretien"))).toBe(false);
    /* Récrire la note, c'est reprendre le lien à son compte : le retrait
       en bloc ne doit plus l'emporter. */
    expect(isHinted(laid("d'après Wikidata, mais vérifié"))).toBe(false);
  });

  it("ne rend que les liens à reprendre", () => {
    const mine = laid("de mémoire");
    const theirs = { ...laid("Wikidata P1066"), id: "autre" };
    expect(hintedBonds([mine, theirs])).toEqual([theirs]);
  });

  it("marque bien ce que la lecture d'une piste produit", () => {
    /* Le contrat tient des deux bouts, ou le retrait ne trouverait
       rien. */
    const hint = hintFromLink(link("Kurosawa", "P1066", "Hasumi"))!;
    const bond = makeBond({ ...hint })!;
    expect(isHinted(bond)).toBe(true);
  });
});

/* ============================================================
   CE QUE VOS PROPRES FICHES SAVENT DÉJÀ

   Wikidata couvre un centième des réalisateurs : Mario Bava n'y porte
   aucune des trois propriétés, et il n'est pas une exception. Or il a été
   le chef opérateur de Riccardo Freda — un fait déjà rangé dans le
   classeur, que ces tests prennent pour cas d'école.
   ============================================================ */
describe("les pistes tirées du classeur", () => {
  const film = (
    id: string,
    director: string,
    crew: Record<string, string[]> = {},
    cast: string[] = []
  ) => makeFilm({ id, title: id, director, crew, cast });

  it("voit un cinéaste au générique du film d'un autre", () => {
    const hints = binderHints([
      film("a", "Riccardo Freda", { image: ["Mario Bava"] }),
      film("b", "Mario Bava"),
    ]);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      kind: "affinity",
      fromName: "Mario Bava",
      toName: "Riccardo Freda",
      source: "binder",
    });
  });

  it("compte les films plutôt que de répéter la piste", () => {
    /* « Chef opérateur sur trois films de » vaut mieux que trois pistes
       identiques. */
    const hints = binderHints([
      film("a", "Riccardo Freda", { image: ["Mario Bava"] }),
      film("b", "Riccardo Freda", { image: ["Mario Bava"] }),
      film("c", "Mario Bava"),
    ]);
    expect(hints).toHaveLength(1);
    expect(readCreditNote(hints[0]!.note)).toEqual({ role: "image", n: 2 });
  });

  it("ne retient que ceux qui réalisent aussi, quelque part", () => {
    /* Sans ce filtre, chaque chef opérateur de la collection deviendrait
       un nœud de la carte des CINÉASTES. */
    expect(binderHints([film("a", "Freda", { image: ["Un technicien"] })])).toEqual([]);
  });

  it("ne fait pas d'un homme deux personnes", () => {
    /* Un cinéaste qui éclaire son propre film reste un seul homme. */
    expect(binderHints([film("a", "Mario Bava", { image: ["Mario Bava"] })])).toEqual([]);
  });

  it("écarte l'interprétation", () => {
    /* Un caméo chez un confrère est une anecdote, et les rôles d'acteur
       sont si nombreux que la carte se remplirait de liens que personne
       n'a voulus. */
    const hints = binderHints([
      film("a", "Riccardo Freda", {}, ["Mario Bava"]),
      film("b", "Mario Bava"),
    ]);
    expect(hints).toEqual([]);
  });

  it("propose une AFFINITÉ, jamais un magistère", () => {
    /* « A éclairé trois films de » n'est pas « a été formé par » : le
       premier est un fait, le second une lecture, et c'est la vôtre. */
    const hints = binderHints([
      film("a", "Riccardo Freda", { image: ["Mario Bava"] }),
      film("b", "Mario Bava"),
    ]);
    expect(hints[0]!.kind).toBe("affinity");
  });

  it("porte une marque, donc se reprend en bloc comme les autres", () => {
    const hints = binderHints([
      film("a", "Riccardo Freda", { image: ["Mario Bava"] }),
      film("b", "Mario Bava"),
    ]);
    expect(isHinted(makeBond({ ...hints[0]! })!)).toBe(true);
  });

  it("se mêle à Wikidata sans doublon", () => {
    /* `usefulHints` dédoublonne par `bondId` : une filiation que les deux
       sources énoncent ne se propose qu'une fois. */
    const same = { kind: "affinity" as const, fromName: "Bava", toName: "Freda" };
    const both = [
      { ...same, note: "Wikidata P737", source: "wikidata" as const },
      { ...same, note: "credits image 2", source: "binder" as const },
    ];
    expect(usefulHints(both, [])).toHaveLength(1);
    /* Et c'est la source qui DIT qui l'emporte sur celle qui suggère. */
    expect(usefulHints(both, [])[0]!.source).toBe("wikidata");
  });
});
