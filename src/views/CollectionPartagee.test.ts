import { describe, it, expect } from "vitest";
import { readAddress } from "./CollectionPartagee";

/* THE ADDRESS OF A SHARED COLLECTION is read in the fragment, and the
   fragment comes from outside: from a pasted link, from a message copied
   out by hand, from a barcode scanner. What follows holds the only thing
   that matters — recognising what is an address, and nothing else. */

describe("lire l'adresse d'une collection", () => {
  it("reconnaît un pseudonyme", () => {
    expect(readAddress("#/chez/agnes-varda")).toEqual({ pseudo: "agnes-varda", jeton: null });
  });

  it("reconnaît un lien secret", () => {
    expect(readAddress("#/chez/varda?jeton=aB3_-x")).toEqual({ pseudo: "varda", jeton: "aB3_-x" });
  });

  it("ignore tout le reste : c'est le classeur qui s'ouvre", () => {
    for (const rien of ["", "#", "#/", "#/ailleurs", "#/chez/", "#/chez/ab", "#/chez/Varda"]) {
      expect({ rien, lu: readAddress(rien) }).toEqual({ rien, lu: null });
    }
  });

  it("n'accepte pas qu'on lui fasse dire autre chose", () => {
    /* The username leaves inside a server address: anything that could
       build another one is refused here, before even the encoding. */
    for (const tordu of [
      "#/chez/../admin",
      "#/chez/varda/../autre",
      "#/chez/varda?jeton=a b",
      "#/chez/varda#autre",
      "#/chez/varda?autre=1",
    ]) {
      expect({ tordu, lu: readAddress(tordu) }).toEqual({ tordu, lu: null });
    }
  });
});
