import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/* ============================================================
   CE QU'ON MONTRE QUAND L'IMAGE N'EST PAS LÀ

   Les captures vivent dans le coffre de l'appareil qui les a rangées ;
   la fiche, elle, voyage. Un second appareil connaît donc la liste des
   captures d'un film sans posséder une seule image — et rendait un
   rectangle muet, pris en essai pour une panne de synchronisation.

   La lecture était raisonnable : rien ne distinguait « pas ici » de
   « cassé ». C'est ce que ces tests tiennent.
   ============================================================ */

const coffre = new Map<string, Blob>();
let refuse = false;

vi.mock("../../db", () => ({
  getImage: async (clé: string) => {
    if (refuse) throw new Error("coffre ferme");
    return coffre.get(clé);
  },
}));

const { IdbImage } = await import("./IdbImage");

beforeEach(() => {
  coffre.clear();
  refuse = false;
  /* jsdom ne mesure rien : sans cette doublure, toute boîte fait zéro et
     la version large ne serait jamais éprouvée. */
  Element.prototype.getBoundingClientRect = function () {
    return { width: 300, height: 200 } as DOMRect;
  };
});

afterEach(cleanup);

describe("une image du coffre", () => {
  it("s'affiche quand elle est là", async () => {
    coffre.set("k1", new Blob(["…"], { type: "image/png" }));
    render(<IdbImage imageKey="k1" alt="une capture" />);
    await waitFor(() => expect(screen.getByAltText("une capture")).toBeInTheDocument());
  });

  it("dit qu'elle est ailleurs quand le coffre ne l'a pas", async () => {
    render(<IdbImage imageKey="absente" />);
    await waitFor(() =>
      expect(screen.getByText(/restée sur l'autre appareil/)).toBeInTheDocument()
    );
  });

  it("dit la même chose quand le coffre refuse de répondre", async () => {
    /* Mode privé, base verrouillée : pour qui regarde, c'est la même
       chose qu'une image absente. */
    refuse = true;
    render(<IdbImage imageKey="k1" />);
    await waitFor(() =>
      expect(screen.getByText(/restée sur l'autre appareil/)).toBeInTheDocument()
    );
  });

  it("ne reproche rien pendant qu'elle cherche", async () => {
    /* Annoncer une image manquante avant d'avoir fini de la chercher
       ferait clignoter le reproche à chaque ouverture. */
    coffre.set("k1", new Blob(["…"]));
    render(<IdbImage imageKey="k1" />);
    expect(screen.queryByText(/restée sur l'autre appareil/)).toBeNull();
  });

  it("dans une vignette, un signe suffit — la phrase ne tiendrait pas", async () => {
    Element.prototype.getBoundingClientRect = function () {
      return { width: 22, height: 22 } as DOMRect;
    };
    const { container } = render(<IdbImage imageKey="absente" />);
    await waitFor(() => expect(container.querySelector("svg")).toBeTruthy());
    expect(screen.queryByText(/restée sur l'autre appareil/)).toBeNull();
    /* Le propos n'est pas perdu : il passe dans l'infobulle. */
    expect(container.querySelector("[title]")?.getAttribute("title")).toMatch(
      /ne se synchronisent/
    );
  });
});
