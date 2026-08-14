import { describe, it, expect, beforeEach } from "vitest";
import { catchUpDocuments, documentsToSend } from "./documents";

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
