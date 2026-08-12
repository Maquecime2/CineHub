import { describe, it, expect } from "vitest";
import { readAddress } from "./SharedCollectionView";

/* THE ADDRESS OF A SHARED COLLECTION is read in the fragment, and the
   fragment comes from outside: from a pasted link, from a message copied
   out by hand, from a barcode scanner. What follows holds the only thing
   that matters — recognising what is an address, and nothing else. */

describe("reading a collection's address", () => {
  it("recognises a handle", () => {
    expect(readAddress("#/chez/agnes-varda")).toEqual({ pseudo: "agnes-varda", token: null });
  });

  it("recognises a secret link", () => {
    expect(readAddress("#/chez/varda?jeton=aB3_-x")).toEqual({ pseudo: "varda", token: "aB3_-x" });
  });

  it("ignores everything else: it is the binder that opens", () => {
    for (const nothing of ["", "#", "#/", "#/ailleurs", "#/chez/", "#/chez/ab", "#/chez/Varda"]) {
      expect({ nothing, lu: readAddress(nothing) }).toEqual({ nothing, lu: null });
    }
  });

  it("does not let itself be made to say something else", () => {
    /* The username leaves inside a server address: anything that could
       build another one is refused here, before even the encoding. */
    for (const crooked of [
      "#/chez/../admin",
      "#/chez/varda/../autre",
      "#/chez/varda?jeton=a b",
      "#/chez/varda#autre",
      "#/chez/varda?autre=1",
    ]) {
      expect({ crooked, lu: readAddress(crooked) }).toEqual({ crooked, lu: null });
    }
  });
});
