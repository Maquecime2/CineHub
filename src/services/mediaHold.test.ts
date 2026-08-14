import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
   LE MÊME BLOB, MONTRÉ DEUX FOIS, N'EST LU QU'UNE

   Le mur vide les cases qu'on ne regarde pas, et c'est bien : cinq cents
   polaroïds montés d'un coup bloquaient le fil. Mais chaque carte qui
   REVENAIT refaisait tout le trajet pour son compte — une transaction de
   coffre, un `createObjectURL` neuf, un décodage entier — et celui
   qu'elle avait fait trente secondes plus tôt était jeté en sortant. Un
   aller-retour de molette sur deux cents cartes, c'était deux cents
   transactions pour des images que le navigateur avait déjà décodées.

   Ce fichier tient les trois promesses de `holdMedia` :
   — on ne lit qu'une fois, même à deux lecteurs simultanés ;
   — une URL que quelqu'un montre n'est JAMAIS révoquée sous ses yeux ;
   — une clé à zéro lecteur est GARÉE, pas jetée : c'est exactement la
     carte qu'on vient de dépasser, donc celle qui revient.
   ============================================================ */

const coffre = new Map<string, Blob>();
let lectures = 0;

vi.mock("../db", () => ({
  getImage: async (key: string) => {
    lectures++;
    return coffre.get(key) ?? null;
  },
  putImage: async () => {},
  allImageKeys: async () => [],
}));

/* Le miroir ne répond à personne sans compte : ici il n'y en a pas, donc
   `pullMedia` renonce et le coffre est seul juge. */
vi.mock("./server", () => ({
  accountOpen: () => false,
  serverConfigured: () => false,
  mediaTickets: async () => [],
  mediaDeleteTicket: async () => null,
}));

const revoquees: string[] = [];
let numero = 0;
globalThis.URL.createObjectURL = () => `blob:${++numero}`;
globalThis.URL.revokeObjectURL = (url: string) => void revoquees.push(url);

const { holdMedia, releaseMedia, forgetHeldMedia } = await import("./media");

beforeEach(() => {
  coffre.clear();
  revoquees.length = 0;
  lectures = 0;
});

describe("tenir une image plutôt que la relire", () => {
  it("ne lit le coffre qu'une fois pour deux lecteurs du même instant", async () => {
    coffre.set("a", new Blob(["…"]));
    const [un, deux] = await Promise.all([holdMedia("a"), holdMedia("a")]);

    expect(un).toBe(deux);
    /* LA VRAIE MESURE : une pellicule de vingt vignettes et un mur qui
       remonte demandent la même clé dans le même souffle. */
    expect(lectures).toBe(1);

    releaseMedia("a");
    releaseMedia("a");
  });

  it("garde l'URL vivante tant qu'un seul lecteur la montre", async () => {
    coffre.set("b", new Blob(["…"]));
    const url = await holdMedia("b");
    await holdMedia("b");

    releaseMedia("b");
    /* Une URL révoquée dans un `src` vivant, c'est une image cassée — et
       c'est la seule carte qui avait raison d'être là. */
    expect(revoquees).not.toContain(url);

    releaseMedia("b");
  });

  it("resert la carte revenue sans retourner au coffre", async () => {
    coffre.set("c", new Blob(["…"]));
    const url = await holdMedia("c");
    releaseMedia("c"); // la case sort de l'écran
    expect(revoquees).not.toContain(url); // garée, pas jetée

    const retour = await holdMedia("c"); // et elle revient
    expect(retour).toBe(url);
    expect(lectures).toBe(1);

    releaseMedia("c");
  });

  it("ne rend rien quand le coffre n'a rien, et n'en garde pas la trace", async () => {
    expect(await holdMedia("absente")).toBeNull();
    /* Rien n'est retenu : le jour où l'image arrive — un compte qui
       s'ouvre, une synchro qui passe — on redemande vraiment. */
    expect(await holdMedia("absente")).toBeNull();
    expect(lectures).toBe(2);
  });

  it("oublie une clé dont le blob a changé, sans aveugler qui la montre", async () => {
    coffre.set("d", new Blob(["avant"]));
    const avant = await holdMedia("d");

    forgetHeldMedia("d");
    /* Quelqu'un la montre encore : on ne révoque pas sous ses yeux. */
    expect(revoquees).not.toContain(avant);

    const apres = await holdMedia("d");
    expect(apres).not.toBe(avant);
    expect(lectures).toBe(2);

    releaseMedia("d");
    releaseMedia("d");
  });
});
