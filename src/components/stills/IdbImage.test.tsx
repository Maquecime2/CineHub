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

/* ------------------------------------------------------------
   THE MIRROR, AND THE ACCOUNT IT NEEDS

   `readMedia` looks in the vault first and asks the container next — but
   the container answers nobody without an account. On a machine that has
   just signed in, the account is unknown for the length of the first
   round trip, and every image mounted in that window used to settle on
   "absente" for good. Here the mirror is a second map, opened by the
   account. */
const conteneur = new Map<string, Blob>();
let connecte = false;
const guetteurs = new Set<() => void>();

vi.mock("../../services/server", () => ({
  accountOpen: () => connecte,
  watchAccount: (fn: () => void) => {
    guetteurs.add(fn);
    return () => guetteurs.delete(fn);
  },
}));

/* `holdMedia` RATHER QUE `readMedia` : l'image n'est plus lue puis
   relâchée à chaque montage, elle est TENUE — le mirroir garde l'URL et
   la partage, ce qui est ce qui permet à une pellicule de vignettes de
   défiler sans relire le coffre vingt fois. Le double ici en a la même
   forme : une URL quand il y a un blob, `null` sinon, et un relâchement
   par prise. */
const relaches: string[] = [];

vi.mock("../../services/media", () => ({
  holdMedia: async (key: string) => {
    if (refuse) throw new Error("coffre ferme");
    const blob = coffre.get(key) ?? (connecte ? (conteneur.get(key) ?? null) : null);
    return blob ? `blob:${key}` : null;
  },
  releaseMedia: (key: string) => relaches.push(key),
}));

/** Somebody signs in: the account is known, and the watchers are told. */
const seConnecter = () => {
  connecte = true;
  for (const fn of guetteurs) fn();
};

const { IdbImage } = await import("./IdbImage");

beforeEach(() => {
  coffre.clear();
  conteneur.clear();
  connecte = false;
  guetteurs.clear();
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

  it("asks the mirror again once the account is open", async () => {
    /* The screenshot is in the container, and this machine has just
       signed in: while the first `/me` round trip was in flight the
       mirror refused, and the image settled on "absente". It must ask
       again when the account arrives — nobody reloads a page to see a
       screenshot. */
    conteneur.set("k1", new Blob(["…"], { type: "image/png" }));
    render(<IdbImage imageKey="k1" alt="une capture" />);
    await waitFor(() =>
      expect(screen.getByText(/restée sur l'autre appareil/)).toBeInTheDocument()
    );

    seConnecter();
    await waitFor(() => expect(screen.getByAltText("une capture")).toBeInTheDocument());
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
