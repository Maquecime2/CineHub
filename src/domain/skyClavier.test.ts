import { describe, it, expect } from "vitest";
import { voisinDansLaDirection } from "./sky";
import type { PlacedNode } from "../types";

const astre = (id: string, x: number, y: number): PlacedNode => ({
  id,
  kind: "film",
  label: id,
  sub: "",
  degree: 1,
  x,
  y,
});

/* Une petite croix : le centre, et un astre à chaque point cardinal.
   L'axe des ordonnées descend, comme en SVG. */
const centre = astre("centre", 100, 100);
const droite = astre("droite", 200, 100);
const gauche = astre("gauche", 0, 100);
const haut = astre("haut", 100, 0);
const bas = astre("bas", 100, 200);
const croix = [centre, droite, gauche, haut, bas];

describe("se déplacer au clavier dans le ciel", () => {
  it("va bien dans les quatre directions", () => {
    expect(voisinDansLaDirection(croix, "centre", "droite")?.id).toBe("droite");
    expect(voisinDansLaDirection(croix, "centre", "gauche")?.id).toBe("gauche");
    expect(voisinDansLaDirection(croix, "centre", "haut")?.id).toBe("haut");
    expect(voisinDansLaDirection(croix, "centre", "bas")?.id).toBe("bas");
  });

  it("prend le plus proche parmi ceux qui sont du bon côté", () => {
    const loin = astre("loin", 400, 100);
    const près = astre("près", 150, 100);
    expect(voisinDansLaDirection([centre, loin, près], "centre", "droite")?.id).toBe("près");
  });

  /* Sans cône, les quatre flèches désigneraient toutes le même voisin en
     diagonale, et l'on tournerait en rond entre deux astres. */
  it("ignore ce qui n'est pas franchement dans la direction", () => {
    const diagonale = astre("diagonale", 110, 200); // presque droit en dessous
    expect(voisinDansLaDirection([centre, diagonale], "centre", "droite")).toBeNull();
    expect(voisinDansLaDirection([centre, diagonale], "centre", "bas")?.id).toBe("diagonale");
  });

  it("ne bouge pas quand il n'y a rien de ce côté", () => {
    expect(voisinDansLaDirection([centre, droite], "centre", "gauche")).toBeNull();
  });

  it("ne se rend jamais lui-même", () => {
    expect(voisinDansLaDirection([centre], "centre", "droite")).toBeNull();
  });

  /* Entrer dans la carte : la première flèche doit poser le curseur
     quelque part plutôt que de ne rien faire. */
  it("prend le premier astre quand on ne vient de nulle part", () => {
    expect(voisinDansLaDirection(croix, null, "droite")?.id).toBe("centre");
  });

  it("prend le premier astre quand le point de départ a disparu", () => {
    expect(voisinDansLaDirection(croix, "effacé", "haut")?.id).toBe("centre");
  });

  it("ne rend rien d'un ciel vide", () => {
    expect(voisinDansLaDirection([], null, "bas")).toBeNull();
  });

  it("ignore un astre exactement superposé", () => {
    const jumeau = astre("jumeau", 100, 100);
    expect(voisinDansLaDirection([centre, jumeau], "centre", "droite")).toBeNull();
  });
});
