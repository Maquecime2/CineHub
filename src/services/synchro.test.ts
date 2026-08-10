import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ============================================================
   LE MOTEUR DE SYNCHRONISATION

   Ce qui se teste ici tient en une phrase : rien ne doit se perdre, ni
   quand ça marche, ni surtout quand ça échoue. Le serveur est doublé —
   on n'éprouve pas le réseau, on éprouve la décision.
   ============================================================ */

const faux = {
  personne: { id: "p1", pseudo: "varda" } as { id: string; pseudo: string } | null,
  reçus: [] as { jusqua: number; encore?: boolean; fiches: unknown[] }[],
  poussés: [] as unknown[][],
  jetteAuTirage: null as null | { code: number; message: string },
  jetteÀLEnvoi: null as null | { code: number; message: string },
};

class ErreurServeurFausse extends Error {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message);
  }
}

vi.mock("./serveur", () => ({
  ErreurServeur: ErreurServeurFausse,
  PAR_ENVOI: 2,
  serveurConfigure: () => true,
  quiSuisJe: async () => faux.personne,
  tirerDepuis: async (depuis: number) => {
    if (faux.jetteAuTirage) {
      throw new ErreurServeurFausse(faux.jetteAuTirage.message, faux.jetteAuTirage.code);
    }
    return faux.reçus.shift() ?? { jusqua: depuis, encore: false, fiches: [] };
  },
  pousser: async (fiches: unknown[]) => {
    if (faux.jetteÀLEnvoi) {
      throw new ErreurServeurFausse(faux.jetteÀLEnvoi.message, faux.jetteÀLEnvoi.code);
    }
    faux.poussés.push(fiches);
    return { rangees: fiches.length, perimees: 0, illisibles: 0 };
  },
}));

const { synchroniser, oublierLaSynchro, enAttente } = await import("./synchro");
const { chargerFilms, enregistrerFilms, oublierLeCache } = await import("./collection");
const { makeFilm } = await import("../domain/film");

const fiche = (p: Record<string, unknown> = {}) => makeFilm({ title: "Playtime", ...p });

beforeEach(async () => {
  localStorage.clear();
  oublierLeCache([]);
  oublierLaSynchro();
  faux.personne = { id: "p1", pseudo: "varda" };
  faux.reçus = [];
  faux.poussés = [];
  faux.jetteAuTirage = null;
  faux.jetteÀLEnvoi = null;
  await chargerFilms();
});

afterEach(() => localStorage.clear());

describe("un tour complet", () => {
  it("tire d'abord, pousse ensuite", async () => {
    /* Pousser en premier enverrait des fiches sur le point d'être
       remplacées : du travail pour rien, et une fenêtre où le serveur
       porte une version qu'on s'apprête à abandonner. */
    await enregistrerFilms([fiche({ id: "local", updatedAt: 5000 })]);
    faux.reçus = [
      {
        jusqua: 12,
        encore: false,
        fiches: [{ id: "venue", majLe: 3000, donnees: { title: "Yi Yi" } }],
      },
    ];

    let vus: unknown[] = [];
    const bilan = await synchroniser((films) => (vus = films));

    expect(bilan.état).toBe("à-jour");
    expect((vus as { id: string }[]).map((f) => f.id).sort()).toEqual(["local", "venue"]);
    /* La fiche venue du serveur ne repart PAS : elle porte sa date. */
    expect(faux.poussés.flat().map((f) => (f as { id: string }).id)).toEqual(["local"]);
  });

  it("redemande tant que le serveur dit qu'il en reste", async () => {
    faux.reçus = [
      { jusqua: 5, encore: true, fiches: [{ id: "a", majLe: 1, donnees: {} }] },
      { jusqua: 9, encore: false, fiches: [{ id: "b", majLe: 1, donnees: {} }] },
    ];
    let vus: unknown[] = [];
    await synchroniser((films) => (vus = films));
    expect((vus as { id: string }[]).map((f) => f.id).sort()).toEqual(["a", "b"]);
  });

  it("découpe les gros envois", async () => {
    await enregistrerFilms([
      fiche({ id: "a", updatedAt: 5000 }),
      fiche({ id: "b", updatedAt: 5000 }),
      fiche({ id: "c", updatedAt: 5000 }),
    ]);
    await synchroniser(() => {});
    expect(faux.poussés.map((p) => p.length)).toEqual([2, 1]);
  });

  it("ce qui vient du serveur ne repart pas au tour suivant", async () => {
    /* Le piège : redater une fiche reçue la ferait passer pour une
       modification locale, et elle rebondirait indéfiniment. */
    faux.reçus = [
      {
        jusqua: 7,
        encore: false,
        fiches: [{ id: "venue", majLe: 3000, donnees: { title: "Stalker" } }],
      },
    ];
    await synchroniser(() => {});
    faux.poussés = [];
    await synchroniser(() => {});
    expect(faux.poussés).toEqual([]);
  });
});

describe("quand le réseau manque", () => {
  it("l'appareil reste où il était, et le dit sans rougir", async () => {
    await enregistrerFilms([fiche({ id: "local", updatedAt: 5000 })]);
    faux.jetteAuTirage = { code: 0, message: "Le serveur ne répond pas." };

    const bilan = await synchroniser(() => {});
    expect(bilan.état).toBe("en-attente");
    expect(bilan.enAttente).toBe(1);
  });

  it("et rattrape tout au retour du réseau", async () => {
    await enregistrerFilms([fiche({ id: "local", updatedAt: 5000 })]);
    faux.jetteÀLEnvoi = { code: 0, message: "coupé" };
    expect((await synchroniser(() => {})).état).toBe("en-attente");
    expect(faux.poussés).toEqual([]);

    faux.jetteÀLEnvoi = null;
    const bilan = await synchroniser(() => {});
    expect(bilan.état).toBe("à-jour");
    expect(faux.poussés.flat().map((f) => (f as { id: string }).id)).toEqual(["local"]);
  });

  it("une vraie erreur du serveur se distingue d'une absence de réseau", async () => {
    faux.jetteAuTirage = { code: 500, message: "ça a cassé" };
    const bilan = await synchroniser(() => {});
    expect(bilan.état).toBe("erreur");
    expect(bilan.message).toBe("ça a cassé");
  });
});

describe("sans compte", () => {
  it("rien ne part, et ce n'est pas une panne", async () => {
    faux.personne = null;
    await enregistrerFilms([fiche({ id: "local", updatedAt: 5000 })]);
    const bilan = await synchroniser(() => {});
    expect(bilan.état).toBe("hors-compte");
    expect(faux.poussés).toEqual([]);
  });
});

describe("ce qui attend", () => {
  it("se compte sans rien demander au réseau", async () => {
    await enregistrerFilms([fiche({ id: "a", updatedAt: 5000 })]);
    expect(enAttente()).toBe(1);
    await synchroniser(() => {});
    expect(enAttente()).toBe(0);
  });

  it("une fiche effacée compte comme une chose à dire", async () => {
    /* `a` est le MÊME objet d'un enregistrement à l'autre : seule `b`
       s'en va, et c'est son départ qu'on veut voir compté. */
    const a = fiche({ id: "a" });
    await enregistrerFilms([a, fiche({ id: "b" })]);
    await synchroniser(() => {});
    await enregistrerFilms([a]);
    expect(enAttente()).toBe(1);

    await synchroniser(() => {});
    const dernier = faux.poussés.at(-1)!.at(-1) as { id: string; supprimee?: boolean };
    expect(dernier).toMatchObject({ id: "b", supprimee: true });
  });
});
