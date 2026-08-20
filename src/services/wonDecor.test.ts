import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  forgetWonDecor,
  isWonMotif,
  listWonDecor,
  refreshWonDecor,
  rememberWonDecor,
  subscribeWonDecor,
  wonCatalogue,
  wonDecorByKey,
  WON_PREFIX,
} from "./wonDecor";
import { decorSpec, shelfDecorTypes, wallDecorTypes } from "../components/shelf/constants";
import type { DecorDef } from "./server";

/* ============================================================
   CE QU'ON A TIRÉ SE POSE SUR UNE ÉTAGÈRE

   C'est TOUT l'objet du changement : un bibelot gagné qui resterait une
   image dans une collection ne servirait à rien. La chaîne qui va du
   serveur à la planche traverse trois modules et une fonction appelée au
   rendu de chaque objet, et rien dans les types ne dit qu'elle est
   branchée — d'où ce fichier.

   ET LE CATALOGUE ENTIER EST GARDÉ, pas seulement ce qu'on possède : la
   collection dessine les cases VIDES, et ce qui manque n'est dans aucune
   réponse, par définition.
   ============================================================ */

const def = (id: string, extra: Partial<DecorDef> = {}): DecorDef => ({
  id,
  packId: "pack-trois",
  rarity: "common",
  media: id,
  label: { fr: id, en: id },
  wall: false,
  tintable: true,
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
  refreshWonDecor();
});

describe("le registre", () => {
  it("ne garde que ce qu'on possède, et garde le catalogue entier", () => {
    rememberWonDecor([def("vig-clap"), def("vig-palme")], [{ decor_id: "vig-clap", copies: 2 }]);
    expect(listWonDecor().map((d) => d.id)).toEqual(["vig-clap"]);
    expect(listWonDecor()[0]!.copies).toBe(2);
    /* La case vide de « palme » doit rester dessinable. */
    expect(wonCatalogue().map((d) => d.id)).toEqual(["vig-clap", "vig-palme"]);
  });

  it("préfixe la clé, et la reconnaît", () => {
    rememberWonDecor([def("vig-clap")], [{ decor_id: "vig-clap", copies: 1 }]);
    const key = `${WON_PREFIX}vig-clap`;
    expect(wonDecorByKey(key)?.id).toBe("vig-clap");
    expect(isWonMotif(key)).toBe(true);
    expect(isWonMotif("plante")).toBe(false);
    expect(isWonMotif("custom:12")).toBe(false);
  });

  it("prévient ses abonnés", () => {
    const seen = vi.fn();
    subscribeWonDecor(seen);
    rememberWonDecor([def("vig-clap")], [{ decor_id: "vig-clap", copies: 1 }]);
    expect(seen).toHaveBeenCalled();
  });

  it("s'en va avec le compte", () => {
    rememberWonDecor([def("vig-clap")], [{ decor_id: "vig-clap", copies: 1 }]);
    forgetWonDecor();
    expect(listWonDecor()).toEqual([]);
  });
});

describe("l'étagère", () => {
  /* LE POINT DU FICHIER. `decorSpec` est appelé au rendu de chaque objet
     posé ; s'il ne connaît pas les objets gagnés, un bibelot tiré se
     pose et ne se dessine pas — un carré vide, sans erreur, sans
     message. */
  it("sait dessiner un objet gagné", () => {
    rememberWonDecor([def("vig-clap")], [{ decor_id: "vig-clap", copies: 1 }]);
    const spec = decorSpec(`${WON_PREFIX}vig-clap`);
    expect(spec).toBeDefined();
    expect(spec!.draw).toBeTypeOf("function");
    expect(spec!.custom).toBe(true);
  });

  it("ne connaît pas celui qu'on ne possède pas", () => {
    rememberWonDecor([def("vig-clap"), def("vig-palme")], [{ decor_id: "vig-clap", copies: 1 }]);
    expect(decorSpec(`${WON_PREFIX}vig-palme`)).toBeUndefined();
  });

  /* UN OBJET VENU D'UN SERVEUR PLUS RÉCENT NE CASSE PAS L'ÉTAGÈRE : le
     catalogue vit là-bas, et un classeur qui n'a pas été rechargé peut
     recevoir une clé qu'il ne connaît pas. */
  it("rend undefined sur une clé inconnue plutôt que de lever", () => {
    expect(() => decorSpec(`${WON_PREFIX}jamais-vu`)).not.toThrow();
    expect(decorSpec(`${WON_PREFIX}jamais-vu`)).toBeUndefined();
  });

  it("range chacun dans sa famille — posé ou pendu", () => {
    rememberWonDecor(
      [def("vig-clap"), def("vig-lanterne", { wall: true })],
      [
        { decor_id: "vig-clap", copies: 1 },
        { decor_id: "vig-lanterne", copies: 1 },
      ]
    );
    const onShelf = shelfDecorTypes().map((d) => d.key);
    const onWall = wallDecorTypes().map((d) => d.key);
    expect(onShelf).toContain(`${WON_PREFIX}vig-clap`);
    expect(onShelf).not.toContain(`${WON_PREFIX}vig-lanterne`);
    expect(onWall).toContain(`${WON_PREFIX}vig-lanterne`);
  });

  /* LES DESSINS DE LA MAISON RESTENT LES PREMIERS. Un cabinet où ce
     qu'on vient de gagner passe devant ce qui a toujours été là se
     réordonne sous la main à chaque pochette. */
  it("laisse la maison en tête du cabinet", () => {
    rememberWonDecor([def("vig-clap")], [{ decor_id: "vig-clap", copies: 1 }]);
    const keys = shelfDecorTypes().map((d) => d.key);
    expect(keys.indexOf(`${WON_PREFIX}vig-clap`)).toBeGreaterThan(0);
  });
});
