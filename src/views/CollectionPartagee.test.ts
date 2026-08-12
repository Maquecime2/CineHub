import { describe, it, expect } from "vitest";
import { readAddress } from "./CollectionPartagee";

/* L'ADDRESS D'UNE COLLECTION PARTAGÉE se lit dans le fragment, et le
   fragment vient du dehors : d'un lien collé, d'un message recopié à la
   main, d'un scanner de codes-barres. Ce qui suit tient la seule chose
   qui compte — reconnaître ce qui est une adresse, et rien d'autre. */

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
    /* Le pseudonyme part dans une adresse de serveur : tout ce qui
       pourrait en fabriquer une autre est refusé ici, avant même
       l'encodage. */
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
