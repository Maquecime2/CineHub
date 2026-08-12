/* ============================================================
   LE TIROIR DU COMPTE — et surtout : le droit de se raviser

   Ce fichier n'existait pas, et c'est une partie du problème qu'il
   corrige. `Ailleurs` savait faire taire l'auteur d'une critique — un
   geste testé de bout en bout côté serveur — et rien ne savait le
   défaire : aucun écran n'appelait `unblock`, aucun ne listait
   `myBlocks`. Le manque ne se voyait dans aucune suite, parce que le
   tiroir n'était pas monté une seule fois par un test.

   On ne parle pas au serveur ici : ce qu'on éprouve est le tiroir, pas
   les routes. Celles-ci ont leurs propres tests, dans `server/test`.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompteDrawer } from "./CompteDrawer";
import type { Bilan } from "../../services/sync";

const myBlocks = vi.fn();
const unblock = vi.fn();

vi.mock("../../services/server", () => ({
  ADDRESS: "http://serveur.test",
  myBlocks: (...a: unknown[]) => myBlocks(...a),
  unblock: (...a: unknown[]) => unblock(...a),
  /* Le reste du module : le tiroir les importe, il ne les appelle pas
     dans ces scénarios. Les doubler à vide vaut mieux que de charger le
     vrai module, qui parlerait au réseau au montage. */
  deleteMyAccount: vi.fn(),
  myData: vi.fn(),
  signIn: vi.fn(),
  setSharing: vi.fn(async () => ({ partage: "privee", jeton: null })),
  mySharing: vi.fn(async () => ({ partage: "privee", jeton: null })),
  signOut: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("../../services/push", () => ({
  /* Pas de notifications possibles : la section se tait, et n'entre pas
     dans le chemin de ce test. */
  pushState: vi.fn(async () => ({ possible: false, subscribed: false, denied: false })),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

vi.mock("../../services/sync", async (vrai) => ({
  ...(await vrai<Record<string, unknown>>()),
  oublierLaSynchro: vi.fn(),
}));

const bilan = (connecté: boolean): Bilan =>
  ({
    état: connecté ? "à-jour" : "hors-compte",
    personne: connecté ? { id: "1", pseudo: "varda" } : null,
    le: null,
    enAttente: 0,
  }) as Bilan;

const monter = (connecté = true) =>
  render(
    <CompteDrawer
      bilan={bilan(connecté)}
      onFermer={vi.fn()}
      onSynchroniser={vi.fn()}
      onChangement={vi.fn()}
    />
  );

beforeEach(() => {
  myBlocks.mockReset();
  unblock.mockReset();
  myBlocks.mockResolvedValue({ blocages: [] });
  unblock.mockResolvedValue({ pseudo: "", bloque: false });
});

afterEach(() => vi.clearAllMocks());

describe("ceux qu'on a fait taire", () => {
  it("les nomme, un par un", async () => {
    myBlocks.mockResolvedValue({ blocages: ["genant", "penible"] });
    monter();
    expect(await screen.findByText("genant")).toBeInTheDocument();
    expect(screen.getByText("penible")).toBeInTheDocument();
    expect(screen.getByText("Ceux que vous avez fait taire")).toBeInTheDocument();
  });

  /* Une rubrique « personne » sur un sujet pareil n'apprend rien : il
     n'y a rien à défaire, donc rien à montrer. */
  it("se tait quand il n'y a personne", async () => {
    monter();
    await waitFor(() => expect(myBlocks).toHaveBeenCalled());
    expect(screen.queryByText("Ceux que vous avez fait taire")).not.toBeInTheDocument();
  });

  /* Hors ligne, ou sans serveur : on se tait aussi. Une erreur affichée
     pour une rubrique qui n'a peut-être rien à dire est du bruit. */
  it("se tait quand le serveur ne répond pas", async () => {
    myBlocks.mockRejectedValue(new Error("hors ligne"));
    monter();
    await waitFor(() => expect(myBlocks).toHaveBeenCalled());
    expect(screen.queryByText("Ceux que vous avez fait taire")).not.toBeInTheDocument();
  });

  /* LE GESTE QUI MANQUAIT. Sans lui, faire taire quelqu'un était sans
     retour — et `unblock` n'était appelée par aucun écran. */
  it("rend la parole, et relit la liste ensuite", async () => {
    const user = userEvent.setup();
    myBlocks.mockResolvedValueOnce({ blocages: ["genant"] });
    myBlocks.mockResolvedValue({ blocages: [] });
    monter();

    await user.click(await screen.findByRole("button", { name: /Rendre la parole à genant/ }));
    expect(unblock).toHaveBeenCalledWith("genant");
    /* La liste se relit : la rubrique disparaît puisqu'elle est vide. */
    await waitFor(() =>
      expect(screen.queryByText("Ceux que vous avez fait taire")).not.toBeInTheDocument()
    );
  });

  /* Ce que débloquer ne fait PAS doit être écrit : le serveur ne
     réabonne personne, et laisser croire le contraire serait pire que
     se taire. */
  it("dit que rendre la parole ne renoue pas le lien", async () => {
    myBlocks.mockResolvedValue({ blocages: ["genant"] });
    monter();
    expect(await screen.findByText(/ne le renoue pas/)).toBeInTheDocument();
  });

  /* Sans compte, il n'y a pas de blocages à montrer — et surtout pas de
     requête à faire. */
  it("ne demande rien tant qu'aucun compte n'est ouvert", async () => {
    monter(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(myBlocks).not.toHaveBeenCalled();
  });
});
