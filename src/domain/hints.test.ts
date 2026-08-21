import { describe, it, expect } from "vitest";
import {
  binderHints,
  crossedHints,
  readCrossNote,
  hintFromLink,
  hintId,
  hintedBonds,
  hintsTouching,
  isHinted,
  readCreditNote,
  usefulHints,
} from "./hints";
import type { CrossPerson, CrossRole, Hint } from "./hints";
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

/* ============================================================
   LE CROISEMENT DE DEUX GÉNÉRIQUES

   Il comble le trou que les deux autres laissent : `binderHints` ne voit
   que les films qu'on POSSÈDE, Wikidata ne connaît qu'un centième des
   cinéastes. Le croisement lit les filmographies entières et parle donc
   là où les deux se taisent — mais seulement de gens que le classeur
   nommait déjà, et c'est sa limite qu'il faut épingler autant que son
   apport.
   ============================================================ */
describe("le croisement de deux génériques", () => {
  const who = (name: string, ...credits: [number, CrossRole][]): CrossPerson => ({
    name,
    credits: credits.map(([film, role]) => ({ film, role })),
  });

  /* LE CAS QUI JUSTIFIE TOUT LE CHANTIER. Le film 1 n'a aucune raison
     d'être dans le classeur : c'est précisément ce qu'on vient
     apprendre, et `binderHints` en est incapable par construction. */
  it("voit qui a éclairé pour qui, sur un film qu'on ne possède pas", () => {
    const hints = crossedHints([
      who("Riccardo Freda", [1, "réalisation"]),
      who("Mario Bava", [1, "image"], [2, "réalisation"]),
    ]);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      kind: "affinity",
      fromName: "Mario Bava",
      toName: "Riccardo Freda",
      source: "tmdb",
    });
  });

  /* C'EST UNE AFFINITÉ, JAMAIS UN MAGISTÈRE. « A éclairé trois films
     de » est un fait ; « a été formé par » est une lecture, et c'est
     celle de la personne — dans le formulaire. */
  it("ne propose jamais un magistère", () => {
    const hints = crossedHints([who("A", [1, "réalisation"]), who("B", [1, "scénario"])]);
    expect(hints[0]!.kind).toBe("affinity");
  });

  it("compte les films plutôt que de répéter la piste", () => {
    const hints = crossedHints([
      who("Freda", [1, "réalisation"], [2, "réalisation"], [3, "réalisation"]),
      who("Bava", [1, "image"], [2, "image"], [3, "image"]),
    ]);
    expect(hints).toHaveLength(1);
    expect(readCrossNote(hints[0]!.note)).toEqual({ role: "image", n: 3 });
  });

  /* Se croiser soi-même n'est pas un lien : un cinéaste qui éclaire son
     propre film reste un seul homme. */
  it("ne relie personne à soi-même", () => {
    const hints = crossedHints([who("Bava", [1, "réalisation"], [1, "image"])]);
    expect(hints).toHaveLength(0);
  });

  /* Le même nom écrit autrement est la même personne — `normalize` est
     la seule identité du domaine des gens. */
  it("reconnaît la même personne sous une autre orthographe", () => {
    const hints = crossedHints([
      who("Riccardo FREDA", [1, "réalisation"]),
      who("riccardo freda", [1, "image"]),
    ]);
    expect(hints).toHaveLength(0);
  });

  /* SA LIMITE, ÉPINGLÉE. Sans le générique de l'autre bout, il n'y a pas
     de croisement : présenter un inconnu est le travail de Wikidata. */
  it("ne présente jamais quelqu'un dont on n'a pas demandé le générique", () => {
    const hints = crossedHints([who("Bava", [1, "image"], [2, "réalisation"])]);
    expect(hints).toHaveLength(0);
  });

  /* LA CORÉALISATION N'EST PAS UNE FILIATION, et c'est le refus le moins
     évident : c'est pourtant le cas le plus fréquent. Deux cinéastes qui
     signent ensemble sont des PAIRS — un film à sketches relierait ses
     segments sans que personne l'ait demandé. */
  it("ne relie pas deux coréalisateurs", () => {
    const hints = crossedHints([who("A", [1, "réalisation"]), who("B", [1, "réalisation"])]);
    expect(hints).toHaveLength(0);
  });

  /* LE CAS BAVA, ET IL A FAILLI PASSER À TRAVERS. Sur l'« Inferno »
     d'Argento, Bava n'est crédité qu'à la SECONDE ÉQUIPE : la filiation
     la plus célèbre du lot ne sortait pas, alors que la donnée était là.
     Mesuré ensuite : l'assistanat est le métier qui apparaît le plus
     souvent dans un croisement, devant la photographie. */
  it("voit l'assistanat, qui est le vrai signal d'apprentissage", () => {
    const hints = crossedHints([
      who("Dario Argento", [1, "réalisation"]),
      who("Mario Bava", [1, "assistanat"], [2, "réalisation"]),
    ]);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toMatchObject({
      kind: "affinity",
      fromName: "Mario Bava",
      toName: "Dario Argento",
      source: "tmdb",
    });
    expect(readCrossNote(hints[0]!.note)).toEqual({ role: "assistanat", n: 1 });
  });

  /* LA PRODUCTION RESTE DEHORS : produire le film de quelqu'un est un
     rapport d'argent, pas un apprentissage. Elle n'entre pas dans la
     table du croisement, donc `personCrew` ne la rend même pas — ce cas
     garde la porte du domaine, qui est la dernière. */
  it("ne connaît aucun rôle hors de sa table", () => {
    const hints = crossedHints([who("A", [1, "réalisation"]), who("B", [1, "interprétation"])]);
    expect(hints).toHaveLength(0);
  });

  /* LA MARQUE ENTRE DANS `MARKS`, sans quoi le retrait en bloc laisse
     des orphelins que plus rien ne sait reprendre. */
  it("pose une marque que le retrait en bloc emporte", () => {
    const hints = crossedHints([who("A", [1, "réalisation"]), who("B", [1, "musique"])]);
    expect(isHinted(makeBond({ ...hints[0]! })!)).toBe(true);
  });

  /* LA NOTE EST UNE DONNÉE, jamais une phrase : un rôle et un compte,
     que l'écran met en mots. Y écrire du français figerait la langue du
     jour dans les données de quelqu'un. */
  it("écrit une référence et jamais une phrase", () => {
    const hints = crossedHints([who("A", [1, "réalisation"]), who("B", [1, "image"])]);
    expect(hints[0]!.note).toBe("crossed image 1");
    expect(readCreditNote(hints[0]!.note)).toBeNull();
  });

  /* LE CLASSEUR PASSE DEVANT SUR LA MÊME AFFINITÉ. Les deux disent la
     même chose ; celui qui la tient de VOS fiches la tient de plus près,
     et il est gratuit. `usefulHints` dédoublonne par `bondId`, premier
     arrivé gagne, et l'ordre du mélange est donc une décision — écrite
     dans `useLineageHints` et dans `HintHarvest`, aux deux endroits. */
  it("laisse la priorité au classeur sur la même affinité", () => {
    const cross = crossedHints([
      who("Riccardo Freda", [1, "réalisation"]),
      who("Mario Bava", [1, "image"]),
    ]);
    const mine = binderHints([
      makeFilm({
        id: "a",
        title: "a",
        director: "Riccardo Freda",
        crew: { image: ["Mario Bava"] },
      }),
      makeFilm({ id: "b", title: "b", director: "Mario Bava" }),
    ]);
    const both = usefulHints([...mine, ...cross], []);
    expect(both).toHaveLength(1);
    expect(both[0]!.source).toBe("binder");
  });

  /* UN MAGISTÈRE ET UNE AFFINITÉ NE SONT PAS UN DOUBLON, et c'est le
     modèle qui le dit : `bondId` trie les clés d'un lien SYMÉTRIQUE et
     pas celles d'un lien ORIENTÉ, donc les deux identifiants diffèrent.
     Wikidata énonce « a formé » ; le croisement constate « a éclairé
     pour ». Les fondre perdrait la moitié de ce qu'on vient d'apprendre. */
  it("coexiste avec un magistère venu de Wikidata", () => {
    const wiki = hintFromLink(link("B", "P1066", "A"))!;
    const cross = crossedHints([who("A", [1, "réalisation"]), who("B", [1, "image"])]);
    const both = usefulHints([wiki, ...cross], []);
    expect(both).toHaveLength(2);
    expect(both.map((h) => h.source)).toEqual(["wikidata", "tmdb"]);
  });
});
