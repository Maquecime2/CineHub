import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useInstallation, type Installation } from "./useInstallation";
import { readInstallState } from "../services/installation";

/* The invitation is not manufactured: it awaits an event the browser
   emits when it judges the site installable, and which DOES NOT COME
   BACK once gone. The whole hook rests on that holding back, and none of
   it shows on a re-reading. */

/* `renderHook` mounts the hook on its own and yields its last value:
   that is what it is for, and a probe component writing into a variable
   above is precisely what React's rules forbid. */
let probe: { current: Installation };

/** The browser's event, with the promises it carries. */
const offer = (answer: "accepted" | "dismissed" = "accepted") => {
  /* `cancelable`, like the real one: that is what makes
     `preventDefault` effective, hence what prevents the banner Chrome
     would lay down of its own accord over the rail. */
  const ev = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  ev.prompt = vi.fn().mockResolvedValue(undefined);
  ev.userChoice = Promise.resolve({ outcome: answer });
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
    probe = renderHook(() => useInstallation()).result;
    expect(probe.current.invite).toBe(false);
  });

  it("attrape l'événement, et empêche la bannière du navigateur", () => {
    probe = renderHook(() => useInstallation()).result;
    const ev = offer();
    expect(probe.current.invite).toBe(true);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("install ouvre la boîte du système et retient que c'est fait", async () => {
    probe = renderHook(() => useInstallation()).result;
    const ev = offer("accepted");
    await act(async () => {
      await probe.current.install();
    });
    expect(ev.prompt).toHaveBeenCalled();
    expect(readInstallState().installed).toBe(true);
    expect(probe.current.invite).toBe(false);
  });

  it("refuser la boîte compte comme « pas maintenant », pas comme un oui", async () => {
    probe = renderHook(() => useInstallation()).result;
    offer("dismissed");
    await act(async () => {
      await probe.current.install();
    });
    expect(readInstallState()).toEqual({ dismissals: 1, installed: false });
  });

  it("écarter compte le refus, et deux refus ferment le sujet", () => {
    probe = renderHook(() => useInstallation()).result;
    offer();
    act(() => probe.current.dismiss());
    expect(probe.current.invite).toBe(false);
    expect(readInstallState().dismissals).toBe(1);

    cleanup();
    probe = renderHook(() => useInstallation()).result;
    offer();
    act(() => probe.current.dismiss());
    expect(readInstallState().dismissals).toBe(2);
    cleanup();

    /* Third opening: nobody is listening any more, and the browser's
       event wakes nothing up. */
    probe = renderHook(() => useInstallation()).result;
    offer();
    expect(probe.current.invite).toBe(false);
  });

  it("sur iOS, personne n'émettra jamais rien : on explique de nous-mêmes", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" });
    probe = renderHook(() => useInstallation()).result;
    expect(probe.current.apple).toBe(true);
    expect(probe.current.invite).toBe(true);
  });

  it("déjà posée sur l'écran d'accueil : on n'en parle plus", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("standalone"), media: q }));
    probe = renderHook(() => useInstallation()).result;
    offer();
    expect(probe.current.invite).toBe(false);
  });
});
