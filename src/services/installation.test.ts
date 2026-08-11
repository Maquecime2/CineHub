import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  REFUS_MAX,
  déjàInstallée,
  estIOS,
  lireInstallation,
  noterPosée,
  noterRefus,
  peutProposer,
} from "./installation";

/* Ce qui se teste : à qui l'on propose l'installation, et surtout quand
   l'on se tait. Une invitation qui revient à chaque ouverture n'est plus
   une invitation, c'est une bannière — exactement ce que le navigateur
   fait déjà et qu'on lui a repris. */

const poserUA = (ua: string, touches = 0) => {
  vi.stubGlobal("navigator", { userAgent: ua, maxTouchPoints: touches });
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("l'invitation à installer", () => {
  it("se propose tant qu'on n'a pas dit non deux fois", () => {
    expect(peutProposer()).toBe(true);
    noterRefus();
    expect(peutProposer()).toBe(true);
    noterRefus();
    expect(lireInstallation().refus).toBe(REFUS_MAX);
    expect(peutProposer()).toBe(false);
  });

  it("ne se propose plus une fois le classeur posé", () => {
    noterPosée();
    expect(peutProposer()).toBe(false);
  });

  it("une valeur abîmée ne fait pas taire l'invitation", () => {
    localStorage.setItem("installation", JSON.stringify({ refus: "beaucoup", posée: "oui" }));
    expect(lireInstallation()).toEqual({ refus: 0, posée: false });
    expect(peutProposer()).toBe(true);
  });

  it("déjà installée : le mode d'affichage le dit sur Android, une propriété sur iOS", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("standalone"), media: q }));
    expect(déjàInstallée()).toBe(true);

    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
    vi.stubGlobal("navigator", { userAgent: "iPhone", standalone: true, maxTouchPoints: 5 });
    expect(déjàInstallée()).toBe(true);
  });
});

describe("reconnaître iOS", () => {
  it("un iPhone se nomme", () => {
    poserUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(estIOS()).toBe(true);
  });

  it("un iPad récent se dit Macintosh, et ne se trahit que par le tactile", () => {
    poserUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5);
    expect(estIOS()).toBe(true);
  });

  it("un vrai Mac reste un Mac", () => {
    poserUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0);
    expect(estIOS()).toBe(false);
  });
});
