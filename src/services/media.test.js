import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
   LE MIROIR DES MÉDIAS

   IndexedDB stays the original and the container is a copy: everything
   worth testing here follows from that one sentence.

   WHAT IS ON THE PATH OF A GESTURE. Nothing. Importing a poster writes
   to the vault and returns; the upload waits for the next
   synchronisation. So `readMedia` must answer from the vault WITHOUT
   asking anybody anything when the image is there — a wall of five
   hundred cards that each ask the server would be a wall nobody
   scrolls.

   WHAT AN ADDRESS IS. `remotePath` is where the two kinds of media part
   company: a decor goes to a shared prefix under its SERVER identity, a
   screenshot goes under its owner's. Getting that wrong would file
   somebody's private capture where a friend can fetch it.

   AND WHAT NOTHING MUST EVER SKIP: an SVG arriving from outside is
   vetted before it is kept. `CustomDraw` injects the markup inline.
   ============================================================ */

const vault = new Map();
vi.mock("../db", () => ({
  putImage: async (k, blob) => vault.set(k, blob),
  getImage: async (k) => vault.get(k),
  deleteImage: async (k) => void vault.delete(k),
}));

/* The container, standing in for Azure: a ticket is a URL, and fetching
   it hands back whatever was put at that address. */
const container = new Map();
let signedOut = false;

const tickets = vi.fn(async (paths) => paths.map((path) => ({ path, url: `ticket:${path}` })));
const ticket = vi.fn(async (path) => (container.has(path) ? `ticket:${path}` : null));

vi.mock("./server", () => ({
  serverConfigured: () => true,
  accountOpen: () => !signedOut,
  mediaTickets: (...a) => tickets(...a),
  mediaTicket: (...a) => ticket(...a),
  mediaDeleteTicket: async (path) => `ticket:${path}`,
}));

vi.mock("./customDecor", () => ({
  DECOR_IMAGE_PREFIX: "decor:",
  remoteIdOfDecor: (key) => (key === "decor:connu" ? "d-1234" : undefined),
}));

/* `fetch` is the only door to the container: PUT files, GET serves,
   DELETE removes. */
globalThis.fetch = vi.fn(async (url, options = {}) => {
  const path = String(url).replace(/^ticket:/, "");
  if (options.method === "PUT") {
    container.set(path, options.body);
    return { ok: true };
  }
  if (options.method === "DELETE") {
    container.delete(path);
    return { ok: true };
  }
  const blob = container.get(path);
  return blob ? { ok: true, blob: async () => blob } : { ok: false };
});

const { noteMedia, mediaPending, remotePath, pushMedia, readMedia, dropMedia, forgetMedia } =
  await import("./media");

const ME = "3f1a2b4c-5d6e-4f70-8192-a3b4c5d6e7f8";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("synchro-account", JSON.stringify(ME));
  vault.clear();
  container.clear();
  signedOut = false;
  tickets.mockClear();
  ticket.mockClear();
  globalThis.fetch.mockClear();
});

describe("l'adresse d'un blob", () => {
  it("sépare le privé du partageable", () => {
    expect(remotePath("still-abc-1")).toBe(`p/${ME}/still-abc-1`);
    expect(remotePath("decor:connu")).toBe("decor/d-1234");
  });

  it("n'en donne aucune à un décor qui n'est pas encore monté", () => {
    /* Un objet ajouté hors ligne existe sur l'étagère sans identité
       serveur : il n'a pas d'adresse, et ce n'est pas une erreur. */
    expect(remotePath("decor:tout-neuf")).toBeNull();
  });

  it("n'en donne aucune sans compte ouvert", () => {
    localStorage.removeItem("synchro-account");
    expect(remotePath("still-abc-1")).toBeNull();
  });
});

describe("le registre", () => {
  it("ne note qu'une fois ce qui attend", () => {
    noteMedia("une-affiche");
    noteMedia("une-affiche");
    expect(mediaPending()).toBe(1);
  });

  it("oublie ce qui s'en est allé", () => {
    noteMedia("une-affiche");
    forgetMedia("une-affiche");
    expect(mediaPending()).toBe(0);
  });
});

describe("déposer", () => {
  it("envoie ce qui attend, et ne le renvoie pas", async () => {
    vault.set("une-affiche", new Blob(["png"]));
    noteMedia("une-affiche");

    expect(await pushMedia()).toBe(1);
    expect(container.get(`p/${ME}/une-affiche`)).toBeInstanceOf(Blob);
    expect(mediaPending()).toBe(0);

    /* Un second passage ne redemande aucun ticket : c'est tout l'objet
       du registre. */
    tickets.mockClear();
    expect(await pushMedia()).toBe(0);
    expect(tickets).not.toHaveBeenCalled();
  });

  it("cesse d'attendre un blob effacé du coffre entre-temps", async () => {
    noteMedia("disparue");
    expect(await pushMedia()).toBe(0);
    expect(mediaPending()).toBe(0);
  });

  it("ne fait rien sans compte, et garde ce qui attend", async () => {
    signedOut = true;
    vault.set("une-affiche", new Blob(["png"]));
    noteMedia("une-affiche");

    expect(await pushMedia()).toBe(0);
    /* Hors ligne, le blob reste ici — c'est-à-dire là où il était en
       sûreté de toute façon. */
    expect(mediaPending()).toBe(1);
  });

  it("ne coule pas le paquet quand le container refuse", async () => {
    vault.set("une-affiche", new Blob(["png"]));
    noteMedia("une-affiche");
    tickets.mockRejectedValueOnce(new Error("503"));

    expect(await pushMedia()).toBe(0);
    expect(mediaPending()).toBe(1);
  });
});

describe("lire", () => {
  it("répond du coffre sans rien demander à personne", async () => {
    vault.set("ici", new Blob(["png"]));
    expect(await readMedia("ici")).toBeInstanceOf(Blob);
    /* Cinq cents cartes qui interrogent chacune le serveur feraient un
       mur que personne ne fait défiler. */
    expect(ticket).not.toHaveBeenCalled();
  });

  it("va chercher au container ce que le coffre n'a pas, et le range", async () => {
    container.set(`p/${ME}/ailleurs`, new Blob(["png"]));

    const blob = await readMedia("ailleurs");
    expect(blob).toBeInstanceOf(Blob);
    /* Rangé au passage : la deuxième lecture ne repart pas sur le
       réseau. */
    expect(vault.get("ailleurs")).toBeInstanceOf(Blob);
    ticket.mockClear();
    await readMedia("ailleurs");
    expect(ticket).not.toHaveBeenCalled();
  });

  it("rend null quand il n'y a rien nulle part", async () => {
    /* C'est le moment où « restée sur l'autre appareil » dit vrai. */
    expect(await readMedia("nulle-part")).toBeNull();
  });

  it("passe les octets au contrôle avant de les garder", async () => {
    container.set(`p/${ME}/suspect`, new Blob(["<svg onload=alert(1)/>"]));

    const refuse = await readMedia("suspect", async () => null);
    expect(refuse).toBeNull();
    /* CE QUI EST REFUSÉ N'EST PAS MIS EN CACHE. Sans cette ligne, le
       markup écarté serait servi tel quel à la lecture suivante. */
    expect(vault.has("suspect")).toBe(false);

    const propre = await readMedia("suspect", async () => new Blob(["<svg/>"]));
    expect(await propre.text()).toBe("<svg/>");
    expect(await vault.get("suspect").text()).toBe("<svg/>");
  });
});

describe("effacer", () => {
  it("retire la copie du container", async () => {
    container.set(`p/${ME}/vieille`, new Blob(["png"]));
    await dropMedia("vieille");
    expect(container.has(`p/${ME}/vieille`)).toBe(false);
  });

  it("se tait quand il n'y a pas d'adresse", async () => {
    /* Un décor jamais monté n'a rien à effacer là-bas, et un ménage
       local ne doit pas s'arrêter pour autant. */
    await expect(dropMedia("decor:tout-neuf")).resolves.toBeUndefined();
  });
});
