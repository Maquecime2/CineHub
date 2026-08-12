import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useInstallation, type Installation } from "./useInstallation";
import { readInstallState } from "../services/installation";

/* L'invitation ne se fabrique pas : elle attend un événement que le
   navigateur émet quand il juge le site installable, et qui NE REVIENT
   PAS une fois passé. Tout le hook tient dans cette retenue-là, et rien
   de tout cela ne se voit à la relecture. */

/* `renderHook` monte le hook seul et rend sa dernière valeur : c'est
   fait pour ça, et un composant-sonde qui écrirait dans une variable du
   dessus est justement ce que les règles de React interdisent. */
let sonde: { current: Installation };

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
    sonde = renderHook(() => useInstallation()).result;
    expect(sonde.current.invite).toBe(false);
  });

  it("attrape l'événement, et empêche la bannière du navigateur", () => {
    sonde = renderHook(() => useInstallation()).result;
    const ev = inviter();
    expect(sonde.current.invite).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("install ouvre la boîte du système et retient que c'est fait", async () => {
    sonde = renderHook(() => useInstallation()).result;
    const ev = inviter("accepted");
    await act(async () => {
      await sonde.current.install();
    });
    expect(ev.prompt).toHaveBeenCalled();
    expect(readInstallState().installed).toBe(true);
    expect(sonde.current.invite).toBe(false);
  });

  it("refuser la boîte compte comme « pas maintenant », pas comme un oui", async () => {
    sonde = renderHook(() => useInstallation()).result;
    inviter("dismissed");
    await act(async () => {
      await sonde.current.install();
    });
    expect(readInstallState()).toEqual({ dismissals: 1, installed: false });
  });

  it("dismiss compte le refus, et deux refus ferment le sujet", () => {
    sonde = renderHook(() => useInstallation()).result;
    inviter();
    act(() => sonde.current.dismiss());
    expect(sonde.current.invite).toBe(false);
    expect(readInstallState().dismissals).toBe(1);

    cleanup();
    sonde = renderHook(() => useInstallation()).result;
    inviter();
    act(() => sonde.current.dismiss());
    expect(readInstallState().dismissals).toBe(2);
    cleanup();

    /* Troisième ouverture : plus personne n'écoute, et l'événement du
       navigateur ne réveille plus rien. */
    sonde = renderHook(() => useInstallation()).result;
    inviter();
    expect(sonde.current.invite).toBe(false);
  });

  it("sur iOS, personne n'émettra jamais rien : on explique de nous-mêmes", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" });
    sonde = renderHook(() => useInstallation()).result;
    expect(sonde.current.apple).toBe(true);
    expect(sonde.current.invite).toBe(true);
  });

  it("déjà posée sur l'écran d'accueil : on n'en parle plus", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("standalone"), media: q }));
    sonde = renderHook(() => useInstallation()).result;
    inviter();
    expect(sonde.current.invite).toBe(false);
  });
});
