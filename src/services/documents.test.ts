import { describe, it, expect, beforeEach } from "vitest";
import {
  catchUpDocuments,
  dateOf,
  documentsToSend,
  expectFirstPull,
  fileIncomingDocument,
  forgetSentDocuments,
  noteDocument,
  noteFirstPull,
} from "./documents";
import { store } from "./storage";

/* ============================================================
   LE RATTRAPAGE, QUAND LA LISTE CHANGE

   `sendAllDocuments` ne tourne qu'au premier branchement d'un compte.
   Trois clés de la liste ont été corrigées APRÈS que des gens se soient
   connectés : à leur premier branchement elles n'étaient pas
   reconnaissables, donc pas ramassées, et le compte n'ayant pas changé
   depuis, le rattrapage n'a jamais été rejoué. Une disposition
   d'étagères faite avant le correctif n'est jamais partie — et ne
   serait jamais partie, sauf à y retoucher, ce que rien ne dit.
   ============================================================ */
describe("le rattrapage de la liste", () => {
  beforeEach(() => localStorage.clear());

  it("ramasse ce qui existait déjà, une fois", () => {
    localStorage.setItem("shelf-views", '{"byWall":{}}');
    localStorage.setItem("shelf-decor-custom", "[]");
    localStorage.setItem("shelf-view:mur", "{}");

    expect(catchUpDocuments()).toBe(true);
    const sent = documentsToSend().map((d) => d.key);
    expect(sent).toContain("shelf-views");
    expect(sent).toContain("shelf-decor-custom");
    expect(sent).toContain("shelf-view:mur");

    /* Et une seule fois : sans quoi chaque synchro renverrait tout. */
    expect(catchUpDocuments()).toBe(false);
  });

  it("les renvoie en perdant contre ce que le serveur tient déjà", () => {
    /* RATTRAPER NE DOIT ÉCRASER PERSONNE. Un document non daté part en
       « aube » : le serveur le prend s'il n'a rien, et le refuse s'il a
       mieux. C'est la seule lecture de « je n'ai jamais daté ceci » qui
       ne détruit pas le travail de quelqu'un. */
    localStorage.setItem("shelf-dividers", "[]");
    catchUpDocuments();
    const [doc] = documentsToSend().filter((d) => d.key === "shelf-dividers");
    expect(doc!.updatedAt).toBe(1);
  });

  it("ne ramasse pas ce qui ne voyage pas", () => {
    localStorage.setItem("films", "[]");
    localStorage.setItem("tmdb-key", "abc");
    catchUpDocuments();
    expect(documentsToSend().map((d) => d.key)).toEqual([]);
  });
});

/* ============================================================
   EFFACER SE SYNCHRONISE AUSSI

   Le magasin n'avait que `get` et `set`. Le service qui supprime une vue
   d'étagère appelait donc `localStorage.removeItem` en direct, et aucune
   pierre tombale n'était posée : le document restait sur le serveur pour
   toujours.

   Cela se lisait en base — vingt-deux vues stockées, quatre nommées par
   l'index. Dix-huit supprimées ici, jamais effacées là-bas, qu'un
   ordinateur neuf aurait redescendues sans que rien ne les liste.
   ============================================================ */
describe("supprimer un document", () => {
  beforeEach(() => localStorage.clear());

  /* `store` date ce qu'il écrit par un import DIFFÉRÉ — le registre
     s'écrit lui-même à travers lui, et un import direct ferait une
     boucle entre les deux modules. La note part donc au tour suivant. */
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it("le met en attente comme une tombe", async () => {
    store.set("shelf-view:v1", { id: "v1" });
    await settle();
    forgetSentDocuments(["shelf-view:v1"]);

    store.remove("shelf-view:v1");
    await settle();

    const [gone] = documentsToSend().filter((d) => d.key === "shelf-view:v1");
    expect(gone, "la suppression n'est pas partie").toBeDefined();
    expect(gone!.deleted).toBe(true);
    expect(gone!.content).toBeNull();
  });

  it("ne dit rien de ce qui ne voyage pas", async () => {
    store.set("films", []);
    store.remove("films");
    await settle();
    expect(documentsToSend().map((d) => d.key)).toEqual([]);
  });

  it("efface bel et bien la clé", () => {
    store.set("shelf-view:v2", { id: "v2" });
    store.remove("shelf-view:v2");
    expect(localStorage.getItem("shelf-view:v2")).toBeNull();
  });
});

/* ============================================================
   LE DÉFAUT INVENTÉ AVANT LE TIRAGE

   Un navigateur neuf n'attend pas la synchro : il ne trouve aucun
   agencement, en fabrique un et l'écrit. Daté de MAINTENANT, il battait
   celui que le serveur descendait une seconde plus tard, puis l'écrasait
   là-bas — l'agencement était perdu pour tous les appareils.
   ============================================================ */
describe("la fenêtre du premier tirage", () => {
  beforeEach(() => localStorage.clear());

  it("date à l'aube ce qui s'écrit avant que le tirage ait atterri", () => {
    expectFirstPull();
    store.set("shelf-views", { byWall: {} });
    noteDocument("shelf-views");
    expect(dateOf("shelf-views")).toBe(1);

    /* Et le serveur, si vieux soit-il, gagne. */
    const filed = fileIncomingDocument({
      key: "shelf-views",
      updatedAt: 1000,
      content: { byWall: { watched: ["a"] } },
    });
    expect(filed).toBe(true);
    expect(store.get("shelf-views", null)).toEqual({ byWall: { watched: ["a"] } });
  });

  it("rend leur date aux gestes une fois le tirage atterri", () => {
    expectFirstPull();
    noteFirstPull();
    noteDocument("shelf-views");
    expect(dateOf("shelf-views")).toBeGreaterThan(1);
  });

  /* La garde ne vise que ce qui vient d'être inventé de rien. Un
     document que ce navigateur connaît déjà garde sa date pleine, sans
     quoi une copie plus VIEILLE du serveur le remplacerait au tour
     suivant. */
  it("laisse sa date pleine à un document déjà connu ici", () => {
    noteFirstPull();
    noteDocument("shelf-views");
    const known = dateOf("shelf-views");
    expect(known).toBeGreaterThan(1);

    expectFirstPull();
    noteDocument("shelf-views");
    expect(dateOf("shelf-views")).toBeGreaterThanOrEqual(known);
  });
});
