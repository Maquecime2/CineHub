import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/* ============================================================
   WHAT WE SHOW WHEN THE IMAGE IS NOT THERE

   The stills live in the vault of the device that filed them; the card,
   on the other hand, travels. So a second device knows the list of a
   film's stills without owning a single image — and used to draw a mute
   rectangle, taken in testing for a synchronisation failure.

   That reading was reasonable: nothing told "not here" from "broken".
   That is what these tests hold.
   ============================================================ */

const coffre = new Map<string, Blob>();
let refuse = false;

vi.mock("../../db", () => ({
  getImage: async (key: string) => {
    if (refuse) throw new Error("coffre ferme");
    return coffre.get(key);
  },
}));

const { IdbImage } = await import("./IdbImage");

beforeEach(() => {
  coffre.clear();
  refuse = false;
  /* jsdom measures nothing: without this stand-in, every box is zero and
     the wide version would never be put to the test. */
  Element.prototype.getBoundingClientRect = function () {
    return { width: 300, height: 200 } as DOMRect;
  };
});

afterEach(cleanup);

describe("an image from the vault", () => {
  it("shows when it is there", async () => {
    coffre.set("k1", new Blob(["…"], { type: "image/png" }));
    render(<IdbImage imageKey="k1" alt="une capture" />);
    await waitFor(() => expect(screen.getByAltText("une capture")).toBeInTheDocument());
  });

  it("says it is elsewhere when the vault does not have it", async () => {
    render(<IdbImage imageKey="absente" />);
    await waitFor(() =>
      expect(screen.getByText(/restée sur l'autre appareil/)).toBeInTheDocument()
    );
  });

  it("says the same when the vault refuses to answer", async () => {
    /* Private mode, locked database: for whoever is looking, it is the
       same as a missing image. */
    refuse = true;
    render(<IdbImage imageKey="k1" />);
    await waitFor(() =>
      expect(screen.getByText(/restée sur l'autre appareil/)).toBeInTheDocument()
    );
  });

  it("reproaches nothing while it is looking", async () => {
    /* Announcing a missing image before we have finished looking for it
       would make the reproach blink on every opening. */
    coffre.set("k1", new Blob(["…"]));
    render(<IdbImage imageKey="k1" />);
    expect(screen.queryByText(/restée sur l'autre appareil/)).toBeNull();
  });

  it("in a thumbnail a sign is enough — the sentence would not fit", async () => {
    Element.prototype.getBoundingClientRect = function () {
      return { width: 22, height: 22 } as DOMRect;
    };
    const { container } = render(<IdbImage imageKey="absente" />);
    await waitFor(() => expect(container.querySelector("svg")).toBeTruthy());
    expect(screen.queryByText(/restée sur l'autre appareil/)).toBeNull();
    /* The message is not lost: it moves into the tooltip. */
    expect(container.querySelector("[title]")?.getAttribute("title")).toMatch(
      /ne se synchronisent/
    );
  });
});
