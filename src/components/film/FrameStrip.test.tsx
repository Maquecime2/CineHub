import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FrameStrip } from "./FrameStrip";
import { shotsOfFrames } from "../stills/shots";

/* ============================================================
   SIX PLANS, ET CE QU'ILS NE SONT PAS
   ============================================================

   La planche est une LISTE — six images, décodage différé, aucun effet
   cher — et son agrandissement est un MOMENT, donc une couche. Ce qui
   est éprouvé ici est ce qui se casse en silence :

   — les deux tailles. La fiche ne stocke qu'un chemin, précisément pour
     que la bande demande du petit et l'agrandissement du grand ; servir
     la même partout est invisible à l'œil et coûte cinquante fois le
     poids sur une bande de six ;
   — le clavier. Une planche qu'on ne peut que cliquer est une planche
     que la moitié des gens ne peut pas parcourir ;
   — une image que le navigateur refuse SORT de la planche. TMDB connaît
     des chemins dont il ne sert plus l'image, et un carré vide se lit
     comme un chargement qui n'a pas fini.
   ============================================================ */

vi.mock("../../tmdb", () => ({
  FRAME_THUMB: "https://image.tmdb.org/t/p/w300",
  FRAME_FULL: "https://image.tmdb.org/t/p/w1280",
}));

const frames = ["/a.jpg", "/b.jpg", "/c.jpg"];

const open = () => render(<FrameStrip shots={shotsOfFrames(frames)} title="Voyage à Tokyo" />);

describe("the plate", () => {
  it("asks for the SMALL size in the strip", () => {
    const { container } = open();
    const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(srcs).toEqual([
      "https://image.tmdb.org/t/p/w300/a.jpg",
      "https://image.tmdb.org/t/p/w300/b.jpg",
      "https://image.tmdb.org/t/p/w300/c.jpg",
    ]);
  });

  it("defers the decoding, six being a list and not a moment", () => {
    const { container } = open();
    for (const img of container.querySelectorAll("img"))
      expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("draws one button per frame, each saying which it is", () => {
    open();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Agrandir le plan 1 sur 3/ })).toBeInTheDocument();
  });

  it("shows nothing at all rather than an empty heading", () => {
    const { container } = render(<FrameStrip shots={[]} title="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("enlarging one", () => {
  it("opens a layer on the LARGE size, and says where one is", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: /Agrandir le plan 2 sur 3/ }));

    const plate = screen.getByRole("dialog");
    expect(within(plate).getByText("2 sur 3")).toBeInTheDocument();
    /* w1280 et non w300 : c'est toute la raison de ne stocker qu'un
       chemin sur la fiche. */
    const img = plate.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://image.tmdb.org/t/p/w1280/b.jpg");
  });

  it("walks the plate with the arrows, and stops at both ends", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: /Agrandir le plan 1 sur 3/ }));

    await user.keyboard("{ArrowRight}");
    expect(within(screen.getByRole("dialog")).getByText("2 sur 3")).toBeInTheDocument();

    /* On ne boucle pas : on doit sentir qu'on est au bout. */
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(within(screen.getByRole("dialog")).getByText("1 sur 3")).toBeInTheDocument();
  });

  it("gives the screen back on Escape", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: /Agrandir le plan 1 sur 3/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
