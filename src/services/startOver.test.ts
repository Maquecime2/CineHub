import { describe, it, expect, beforeEach, vi } from "vitest";
import { forgetLocally, startOver } from "./startOver";
import { isFirstRun, shouldHint, shouldSeed } from "./onboarding";

/* ============================================================
   TOUT EFFACER, VRAIMENT

   CE TEST EXISTE PARCE QUE LE BOUTON A MENTI UNE FOIS. Il effaçait le
   serveur, rechargeait, et les films étaient toujours là — forcément :
   ils n'ont jamais vécu là-bas. Le classeur est local d'abord, le
   serveur est une copie, et l'écran qui promettait « tout effacer »
   avait oublié laquelle des deux était la source.

   Ce qui est éprouvé ici est donc l'inverse de ce qu'on éprouve
   d'habitude : non pas qu'un appel réseau est parti, mais que la MÉMOIRE
   DU NAVIGATEUR est bien vide ensuite — et qu'elle l'est même quand le
   réseau, lui, a refusé.
   ============================================================ */

/** Une base d'images qui répond, sans qu'il y ait d'IndexedDB au banc. */
const fakeIdb = (how: "success" | "error" | "blocked") => {
  const deleteDatabase = vi.fn(() => {
    const req: Record<string, unknown> = { error: new Error("non") };
    queueMicrotask(() => {
      const fn = req[`on${how}`] as (() => void) | undefined;
      fn?.();
    });
    return req;
  });
  vi.stubGlobal("indexedDB", { deleteDatabase });
  return deleteDatabase;
};

/* CE QUI RESTE, ET C'EST VOULU : la marque « déjà ouvert ». Sans elle le
   classeur se croit neuf et sème douze fiches de démonstration dans ce
   qu'on vient de vider. Les tests comptent donc ce qui reste EN PLUS
   d'elle, ce qui dit mieux l'intention que « zéro ». */
const KEPT = "onboarding";
const leftovers = () => Object.keys(localStorage).filter((k) => k !== KEPT);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("effacer la mémoire du navigateur", () => {
  it("vide tout, et pas une liste de clés choisies", async () => {
    /* LE CŒUR DU BUG. Une liste tenue à la main aurait laissé derrière
       elle la clé qu'on avait oubliée — et « il me reste des films » est
       exactement ce qu'on avait. */
    localStorage.setItem("films", '[{"id":"a"}]');
    localStorage.setItem("notebook-notes", "{}");
    localStorage.setItem("shelf-dividers", "[]");
    localStorage.setItem("cinehub.skins.owned", '["skin-japon"]');
    localStorage.setItem("synchro-person", '{"pseudo":"moi"}');
    localStorage.setItem("une-clé-que-personne-n-a-listée", "42");
    sessionStorage.setItem("quelque-chose", "1");
    fakeIdb("success");

    const survived = await forgetLocally();

    expect(leftovers()).toEqual([]);
    expect(sessionStorage.length).toBe(0);
    expect(survived).toEqual({ local: false, images: false });
  });

  it("supprime la base d'images, elle ne la vide pas", async () => {
    const asked = fakeIdb("success");
    await forgetLocally();
    expect(asked).toHaveBeenCalledWith("cine-hub");
  });

  it("le dit quand un autre onglet tient la base", async () => {
    fakeIdb("blocked");
    localStorage.setItem("films", "[]");

    const survived = await forgetLocally();
    /* Les affiches restent, et l'écran doit pouvoir le dire plutôt que
       de laisser croire que tout est parti. */
    expect(survived.images).toBe(true);
    /* Mais le reste a bien été effacé : on ne renonce pas à la moitié
       qu'on peut faire. */
    expect(leftovers()).toEqual([]);
  });

  it("survit à une base qui refuse", async () => {
    fakeIdb("error");
    const survived = await forgetLocally();
    expect(survived.images).toBe(true);
    expect(survived.local).toBe(false);
  });
});

describe("le classeur vidé ne se croit pas neuf", () => {
  /* CE QUI S'EST PASSÉ EN VRAI : le bouton effaçait tout le stockage, y
     compris la marque « déjà ouvert ». Le classeur se croyait à sa
     première visite, semait douze fiches de démonstration dans ce qu'on
     venait de vider, et la synchro les poussait sur le serveur qu'on
     venait de vider aussi. On effaçait tout et on se retrouvait avec des
     films. */
  it("ne sème pas les fiches de démonstration", async () => {
    fakeIdb("success");
    await forgetLocally();
    expect(shouldSeed()).toBe(false);
  });

  it("ne rejoue pas la visite", async () => {
    fakeIdb("success");
    await forgetLocally();
    expect(isFirstRun()).toBe(false);
  });

  it("ne pose pas non plus le carton de rappel", async () => {
    /* Quelqu'un qui sait effacer son classeur sait où est la visite. */
    fakeIdb("success");
    await forgetLocally();
    expect(shouldHint()).toBe(false);
  });
});

describe("effacer des deux côtés", () => {
  it("demande au serveur AVANT de perdre de quoi le savoir", async () => {
    const order: string[] = [];
    localStorage.setItem("synchro-person", '{"pseudo":"moi"}');
    fakeIdb("success");

    await startOver(async () => {
      /* Le pseudonyme retenu est encore là quand le serveur répond :
         c'est ce qui donne l'ordre des deux moitiés. */
      order.push(localStorage.getItem("synchro-person") ? "sait-qui" : "ne-sait-plus");
    });

    expect(order).toEqual(["sait-qui"]);
    expect(leftovers()).toEqual([]);
  });

  it("efface le navigateur même si le serveur refuse", async () => {
    /* LE PIRE DES DEUX RÉSULTATS serait de tout laisser en place parce
       que le réseau est tombé : ce qu'on a sous la main est ce qu'on
       voit. */
    localStorage.setItem("films", '[{"id":"a"}]');
    fakeIdb("success");

    const survived = await startOver(async () => {
      throw new Error("hors ligne");
    });

    expect(survived.server).toBe(true);
    expect(localStorage.getItem("films")).toBeNull();
  });

  it("marche sans serveur du tout", async () => {
    localStorage.setItem("films", "[]");
    fakeIdb("success");
    const survived = await startOver();
    expect(survived.server).toBe(false);
    expect(leftovers()).toEqual([]);
  });
});
