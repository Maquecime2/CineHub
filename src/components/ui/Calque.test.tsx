import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Calque } from "./Calque";
import { DropMark } from "../shelf/items";

/* Ce qui se teste ici ne se voit pas : un panneau rendu au mauvais
   endroit s'affiche quand meme, seulement il s'ancre sur la colonne au
   lieu de la fenetre et son `z-index` cesse de compter. Le defaut ne
   paraissait qu'au telephone, et seulement pendant les trois cent
   quarante millisecondes de l'animation d'entree — autant dire jamais a
   la relecture. */

afterEach(cleanup);

describe("le calque", () => {
  it("rend dans le corps du document, et pas la ou on l'appelle", () => {
    const { container } = render(
      <div data-enters>
        <Calque>
          <div data-sonde />
        </Calque>
      </div>
    );
    expect(container.querySelector("[data-sonde]")).toBeNull();
    const sonde = document.body.querySelector("[data-sonde]");
    expect(sonde).toBeTruthy();
    expect(sonde?.parentElement).toBe(document.body);
  });

  it("l'arbre React tient : l'evenement remonte au parent qui l'a ecrit", () => {
    let entendu = 0;
    render(
      <div onClick={() => entendu++}>
        <Calque>
          <button data-sonde>poser</button>
        </Calque>
      </div>
    );
    (document.body.querySelector("[data-sonde]") as HTMLElement).click();
    expect(entendu).toBe(1);
  });

  it("le repere de depot quitte la colonne de vue", () => {
    /* Il se place en coordonnees d'ECRAN a chaque survol : rendu sous une
       colonne transformee, les memes coordonnees designent un autre
       point, et le repere se pose a cote de la fente visee. */
    const { container } = render(
      <div data-enters>
        <DropMark />
      </div>
    );
    expect(container.querySelector("[data-drop-mark]")).toBeNull();
    expect(document.body.querySelector("[data-drop-mark]")?.parentElement).toBe(document.body);
  });
});
