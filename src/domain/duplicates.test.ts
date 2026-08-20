import { describe, it, expect } from "vitest";
import { mergeDuplicate, duplicatePairs, akaOf } from "./duplicates";
import { makeFilm } from "./film";
import { filmKey } from "./importing";
import type { Film } from "../types";

/* ============================================================
   FONDRE DEUX FICHES SANS RIEN PERDRE

   Cette fonction EFFACE une fiche. C'est la seule de ce dépôt dont une
   erreur ne se rattrape pas en relançant : une note, une critique, une
   séance n'existent nulle part ailleurs, là où une affiche et un
   générique se redemandent à TMDB.

   Ce fichier tient donc surtout ce qu'on doit RETENIR, et il tient le
   cas gênant en premier : les deux fiches portent une critique. En
   garder une reviendrait à en effacer une.
   ============================================================ */

const card = (over: Partial<Film>): Film => makeFilm({ title: "Un film", ...over });

describe("merging a duplicate", () => {
  it("keeps BOTH reviews rather than choosing one", () => {
    /* Le cas gênant, et le seul qui n'ait pas de bonne réponse : deux
       textes écrits à la main ne se départagent pas. Bout à bout, c'est
       laid une fois et récupérable toujours. */
    const keep = card({ id: "a", tmdbId: 55, review: "Vu au Champo." });
    const drop = card({ id: "b", review: "Le plan du port." });
    expect(mergeDuplicate(keep, drop).review).toBe("Vu au Champo.\n\nLe plan du port.");
  });

  it("does not double a review that is the same on both", () => {
    const keep = card({ id: "a", tmdbId: 55, review: "Le même texte." });
    const drop = card({ id: "b", review: "Le même texte." });
    expect(mergeDuplicate(keep, drop).review).toBe("Le même texte.");
  });

  it("takes what the survivor lacks, and touches what it has", () => {
    const keep = card({ id: "a", tmdbId: 55, rating: 0, themes: ["deuil"] });
    const drop = card({ id: "b", rating: 4, themes: ["mer"], notes: "prêté à Léa" });
    const out = mergeDuplicate(keep, drop);
    expect(out.rating).toBe(4);
    expect(out.notes).toBe("prêté à Léa");
    expect(out.themes).toEqual(["deuil", "mer"]);
  });

  it("never lets a filled field be overwritten by an empty one", () => {
    const keep = card({ id: "a", tmdbId: 55, rating: 5, director: "Bergman" });
    const drop = card({ id: "b", rating: 0, director: "" });
    const out = mergeDuplicate(keep, drop);
    expect(out.rating).toBe(5);
    expect(out.director).toBe("Bergman");
  });

  it("melts the screenings and counts a day only once", () => {
    /* Deux imports du même journal décrivent la même soirée : la
       compter deux fois gonflerait un compteur que plus personne ne
       peut corriger. */
    const keep = card({
      id: "a",
      tmdbId: 55,
      watches: [{ date: "2026-03-04", rating: null }],
    });
    const drop = card({
      id: "b",
      watches: [
        { date: "2026-03-04T21:00:00Z", rating: null },
        { date: "2025-01-09", rating: null },
      ],
    });
    expect(mergeDuplicate(keep, drop).watches.map((w) => w.date)).toEqual([
      "2025-01-09",
      "2026-03-04",
    ]);
  });

  it("keeps the identity of the card TMDB recognised", () => {
    const keep = card({ id: "a", tmdbId: 55, title: "Scènes de la vie conjugale" });
    const drop = card({ id: "b", title: "Scenes from a Marriage" });
    const out = mergeDuplicate(keep, drop);
    expect(out.id).toBe("a");
    expect(out.tmdbId).toBe(55);
    expect(out.title).toBe("Scènes de la vie conjugale");
  });

  it("LEARNS the title it has just been reconciled with", () => {
    /* C'est ce qui referme la boucle : sans cela le prochain import
       recréerait la fiche disparue, comme il l'a déjà fait. */
    const keep = card({ id: "a", tmdbId: 55, title: "Scènes de la vie conjugale", year: 1973 });
    const drop = card({ id: "b", title: "Scenes from a Marriage", year: 1973 });
    expect(akaOf(mergeDuplicate(keep, drop))).toContain(filmKey(drop));
  });

  it("carries over the aliases the vanished card had already learnt", () => {
    const keep = card({ id: "a", tmdbId: 55, title: "Solaris", year: 1972 });
    const drop = card({ id: "b", title: "Soliaris", year: 1972, aka: ["solyaris|1972"] });
    expect(akaOf(mergeDuplicate(keep, drop))).toEqual(
      expect.arrayContaining(["solyaris|1972", filmKey(drop)])
    );
  });

  it("does not learn its OWN key, which would say nothing", () => {
    const keep = card({ id: "a", tmdbId: 55, title: "Solaris", year: 1972 });
    const drop = card({ id: "b", title: "Solaris", year: 1972 });
    expect(akaOf(mergeDuplicate(keep, drop))).not.toContain(filmKey(keep));
  });

  it("takes the furthest status and the earliest arrival", () => {
    /* Une fiche vue et un doublon à voir : on a vu le film. Et la date
       d'arrivée est celle de la PREMIÈRE, le doublon ne l'a pas
       décalée. */
    const keep = card({ id: "a", tmdbId: 55, status: "watchlist", addedAt: 900 });
    const drop = card({ id: "b", status: "watched", addedAt: 100 });
    const out = mergeDuplicate(keep, drop);
    expect(out.status).toBe("watched");
    expect(out.addedAt).toBe(100);
  });
});

describe("finding the pairs", () => {
  const bergman = card({ id: "good", tmdbId: 55, title: "Scènes de la vie conjugale" });
  const rotten = card({ id: "bad", title: "Scenes from a Marriage" });

  it("pairs on the IDENTITY TMDB gave, never on a likeness", () => {
    const pairs = duplicatePairs([bergman, rotten], new Map([["bad", 55]]));
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.keep.id).toBe("good");
    expect(pairs[0]!.drop.id).toBe("bad");
  });

  it("says nothing about a card that answers to nothing held", () => {
    /* Ce n'est pas un doublon : c'est une fiche à raccrocher, et c'est
       le panneau de complétion qui s'en occupe. Proposer une fusion
       ici demanderait d'effacer quelque chose pour rien. */
    expect(duplicatePairs([bergman, rotten], new Map([["bad", 999]]))).toEqual([]);
    expect(duplicatePairs([bergman, rotten], new Map())).toEqual([]);
  });

  it("never pairs a card with itself", () => {
    const alone = card({ id: "solo", tmdbId: 77 });
    expect(duplicatePairs([alone], new Map([["solo", 77]]))).toEqual([]);
  });

  it("leaves alone the cards that already carry an identity", () => {
    /* Une fiche qui a son `tmdbId` n'est pas le problème qu'on traite,
       et la résoudre de nouveau coûterait une requête pour rien. */
    const other = card({ id: "x", tmdbId: 55, title: "Un homonyme" });
    expect(duplicatePairs([bergman, other], new Map([["x", 55]]))).toEqual([]);
  });
});
