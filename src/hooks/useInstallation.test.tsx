import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useInstallation, type Installation } from "./useInstallation";
import { lireInstallation } from "../services/installation";

/* L'invitation ne se fabrique pas : elle attend un événement que le
   navigateur émet quand il juge le site installable, et qui NE REVIENT
   PAS une fois passé. Tout le hook tient dans cette retenue-là, et rien
   de tout cela ne se voit à la relecture. */

let vu: Installation;
const Sonde = () => {
  vu = useInstallation();
  return null;
};

/** L'événement du navigateur, avec ce qu'il porte de promesses. */
const inviter = (réponse: "accepted" | "dismissed" = "accepted") => {
  /* `cancelable`, comme le vrai : c'est ce qui rend `preventDefault`
     effectif, donc ce qui empêche la bannière que Chrome poserait de
     lui-même par-dessus le rail. */
  const ev = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  ev.prompt = vi.fn().mockResolvedValue(undefined);
  ev.userChoice = Promise.resolve({ outcome: réponse });
  act(() => {
    window.dispatchEvent(ev);
  });
  return ev;
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14)", maxTouchPoints: 5 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useInstallation", () => {
  it("se tait tant que le navigateur n'a rien proposé", () => {
    render(<Sonde />);
    expect(vu.invite).toBe(false);
  });

  it("attrape l'événement, et empêche la bannière du navigateur", () => {
    render(<Sonde />);
    const ev = inviter();
    expect(vu.invite).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("installer ouvre la boîte du système et retient que c'est fait", async () => {
    render(<Sonde />);
    const ev = inviter("accepted");
    await act(async () => {
      await vu.installer();
    });
    expect(ev.prompt).toHaveBeenCalled();
    expect(lireInstallation().posée).toBe(true);
    expect(vu.invite).toBe(false);
  });

  it("refuser la boîte compte comme « pas maintenant », pas comme un oui", async () => {
    render(<Sonde />);
    inviter("dismissed");
    await act(async () => {
      await vu.installer();
    });
    expect(lireInstallation()).toEqual({ refus: 1, posée: false });
  });

  it("écarter compte le refus, et deux refus ferment le sujet", () => {
    const { unmount } = render(<Sonde />);
    inviter();
    act(() => vu.écarter());
    expect(vu.invite).toBe(false);
    expect(lireInstallation().refus).toBe(1);

    unmount();
    const deux = render(<Sonde />);
    inviter();
    act(() => vu.écarter());
    expect(lireInstallation().refus).toBe(2);
    deux.unmount();

    /* Troisième ouverture : plus personne n'écoute, et l'événement du
       navigateur ne réveille plus rien. */
    render(<Sonde />);
    inviter();
    expect(vu.invite).toBe(false);
  });

  it("sur iOS, personne n'émettra jamais rien : on explique de nous-mêmes", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" });
    render(<Sonde />);
    expect(vu.pomme).toBe(true);
    expect(vu.invite).toBe(true);
  });

  it("déjà posée sur l'écran d'accueil : on n'en parle plus", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("standalone"), media: q }));
    render(<Sonde />);
    inviter();
    expect(vu.invite).toBe(false);
  });
});
