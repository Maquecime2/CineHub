import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
   LE PLAFOND REFUSE, ET IL LE DIT

   LE SERVEUR L'ÉCRIVAIT DEPUIS TOUJOURS ET PERSONNE NE LE LISAIT. Un
   chemin que le plafond refuse vaut un ticket manquant, pas un lot en
   erreur — et la route pose `full: true` à côté des tickets, avec un
   commentaire disant que « le client voit dans `full` qu'il n'y a plus
   la place ». Or `mediaTickets` ne gardait que `r.tickets`.

   La conséquence n'était pas une panne, ce qui est bien pire : les
   captures cessaient simplement d'être recopiées, sans un mot. On
   l'apprenait en changeant d'ordinateur, c'est-à-dire une fois que la
   copie qui aurait dû suivre n'existait pas.

   C'est la ligne perdue qu'on épingle ici, et rien d'autre : le drapeau
   traverse, et il devient une phrase que le tiroir sait dire.
   ============================================================ */

const coffre = new Map<string, Blob>();

vi.mock("../db", () => ({
  getImage: async (key: string) => coffre.get(key) ?? null,
  putImage: async () => {},
  allImageKeys: async () => [...coffre.keys()],
}));

let answer: { tickets: { path: string; url: string }[]; full?: boolean } = { tickets: [] };

vi.mock("./server", () => ({
  accountOpen: () => true,
  serverConfigured: () => true,
  mediaTickets: async () => answer,
  mediaDeleteTicket: async () => null,
}));

vi.mock("./customDecor", () => ({
  remoteIdOfDecor: () => null,
  DECOR_IMAGE_PREFIX: "decor-image:",
}));

const { noteMedia, pushMedia, mediaTrouble } = await import("./media");
const { store } = await import("./storage");

/* Le chemin privé se compose sur l'identifiant du compte : sans lui,
   `remotePath` rend `null` et rien ne part. */
const ME = "moi";

beforeEach(() => {
  localStorage.clear();
  coffre.clear();
  store.set("synchro-account", ME);
  answer = { tickets: [] };
  globalThis.fetch = vi.fn(async () => new Response("", { status: 201 })) as typeof fetch;
});

const lay = (key: string) => {
  coffre.set(key, new Blob(["x"], { type: "image/png" }));
  noteMedia(key);
};

describe("ce que le plafond refuse", () => {
  it("dit « plein » quand le serveur refuse un chemin", async () => {
    lay("still-1");
    answer = { tickets: [], full: true };

    await pushMedia();
    expect(mediaTrouble().kind).toBe("full");
  });

  /* LE CAS QUI COMPTE, et celui qu'un simple booléen aurait manqué :
     quarante-sept images passent, trois sont refusées. Le lot a l'air
     d'un succès, et trois captures ne partiront jamais. Se taire là
     est exactement le silence qu'on retire. */
  it("le dit même quand le reste du lot est arrivé", async () => {
    lay("still-1");
    lay("still-2");
    answer = { tickets: [{ path: `p/${ME}/still-1`, url: "https://ailleurs/1" }], full: true };

    await pushMedia();
    expect(mediaTrouble().kind).toBe("full");
  });

  it("se tait quand tout est passé", async () => {
    lay("still-1");
    answer = { tickets: [{ path: `p/${ME}/still-1`, url: "https://ailleurs/1" }] };

    await pushMedia();
    expect(mediaTrouble().kind).toBe("none");
  });

  /* CE QUI EST REFUSÉ RESTE DANS LA FILE. C'est ce qui rend la phrase
     honnête : « elles partiront dès qu'il y aura de la place » serait
     un mensonge si le refus les effaçait de la file. */
  it("garde en file ce qui n'a pas eu de ticket", async () => {
    lay("still-1");
    answer = { tickets: [], full: true };

    await pushMedia();
    expect(store.get<string[]>("medias-a-envoyer", [])).toContain("still-1");
  });
});
