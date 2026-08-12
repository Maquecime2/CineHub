import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MAX_DISMISSALS,
  alreadyInstalled,
  isIOS,
  readInstallState,
  noteInstalled,
  noteDismissal,
  mayOffer,
} from "./installation";

/* What gets tested: who we offer the installation to, and above all when
   we keep quiet. An invitation that comes back on every opening is no
   longer an invitation, it is a banner — exactly what the browser
   already does and what we took away from it. */

const setUA = (ua: string, touchPoints = 0) => {
  vi.stubGlobal("navigator", { userAgent: ua, maxTouchPoints: touchPoints });
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("the invitation to install", () => {
  it("keeps offering itself until we have said no twice", () => {
    expect(mayOffer()).toBe(true);
    noteDismissal();
    expect(mayOffer()).toBe(true);
    noteDismissal();
    expect(readInstallState().dismissals).toBe(MAX_DISMISSALS);
    expect(mayOffer()).toBe(false);
  });

  it("stops offering itself once the binder is installed", () => {
    noteInstalled();
    expect(mayOffer()).toBe(false);
  });

  it("a damaged value does not silence the invitation", () => {
    localStorage.setItem(
      "installation",
      JSON.stringify({ dismissals: "beaucoup", installed: "oui" })
    );
    expect(readInstallState()).toEqual({ dismissals: 0, installed: false });
    expect(mayOffer()).toBe(true);
  });

  it("already installed: the display mode says so on Android, a property on iOS", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("standalone"), media: q }));
    expect(alreadyInstalled()).toBe(true);

    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
    vi.stubGlobal("navigator", { userAgent: "iPhone", standalone: true, maxTouchPoints: 5 });
    expect(alreadyInstalled()).toBe(true);
  });
});

/* ============================================================
   WHAT WAS WRITTEN BEFORE THE TRANSLATION

   `refus` became `dismissals` and `posée` became `installed`, under the
   same `installation` key. Without reading the old spellings back,
   somebody who has already said no twice would be asked a third time —
   a small thing, and exactly the kind of small thing that makes an
   application feel like it does not listen.
   ============================================================ */
describe("a state written before the switch", () => {
  it("reads `refus` back", () => {
    localStorage.setItem("installation", JSON.stringify({ refus: 2, posée: false }));
    expect(readInstallState().dismissals).toBe(2);
    expect(mayOffer()).toBe(false);
  });

  it("reads `posée` back", () => {
    localStorage.setItem("installation", JSON.stringify({ refus: 0, posée: true }));
    expect(readInstallState().installed).toBe(true);
    expect(mayOffer()).toBe(false);
  });

  it("does not let the old keys back out onto the disk", () => {
    localStorage.setItem("installation", JSON.stringify({ refus: 1, posée: false }));
    noteDismissal();
    const written = JSON.parse(localStorage.getItem("installation") || "{}");
    expect(written).toEqual({ dismissals: 2, installed: false });
  });

  it("leaves a state already written in English alone", () => {
    localStorage.setItem("installation", JSON.stringify({ dismissals: 1, installed: false }));
    expect(readInstallState()).toEqual({ dismissals: 1, installed: false });
  });
});

describe("recognising iOS", () => {
  it("an iPhone names itself", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(isIOS()).toBe(true);
  });

  it("a recent iPad calls itself Macintosh, and only its touch screen gives it away", () => {
    setUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5);
    expect(isIOS()).toBe(true);
  });

  it("a real Mac stays a Mac", () => {
    setUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0);
    expect(isIOS()).toBe(false);
  });
});
