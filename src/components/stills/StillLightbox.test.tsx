import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StillLightbox } from "./StillLightbox";

/* ============================================================
   LA LANTERNE

   IL N'Y A PAS DE TEST DE COULEUR DANS CE PROJET, ET ON N'EN INVENTE PAS
   UN ICI. `skins.test.ts` garde les prix et la peau libre, jamais les
   contrastes, et un seuil de lisibilite epingle en chiffres serait une
   seconde verite a cote des dix-sept peaux.

   CE QUI SE TIENT, EN REVANCHE, C'EST QUE L'ENCRE NE SOIT PLUS UN JETON.
   Le voile est peint en dur ; tout ce qui se pose dessus l'etait aussi
   par un `C.paper` que huit peaux sur dix-sept rendent SOMBRE. Le cas
   ci-dessous ne juge pas la teinte : il refuse `var(--c-paper)` sur ces
   elements, c'est-a-dire le retour du defaut, quelle que soit la valeur
   claire qu'on choisira ensuite.

   Le reste garde les deux choses qu'une visionneuse doit a tout le monde :
   elle se ferme, et elle porte un nom.
   ============================================================ */

const shots = [
  { id: "a", path: "/a.jpg", caption: "Le couloir" },
  { id: "b", path: "/b.jpg" },
];

afterEach(cleanup);

const draw = (over = {}) => {
  const onClose = vi.fn();
  const utils = render(
    <StillLightbox shots={shots} index={0} onClose={onClose} onIndex={() => {}} {...over} />
  );
  return { ...utils, onClose };
};

describe("StillLightbox", () => {
  it("se nomme, et se dit modale", () => {
    draw({ title: "Suspiria" });
    const box = screen.getByRole("dialog");
    expect(box).toHaveAttribute("aria-modal", "true");
    expect(box.getAttribute("aria-label")).toBeTruthy();
  });

  /* LA CROIX FERME, ET ELLE PORTE UN NOM. Sans nom elle n'est qu'un
     dessin au lecteur d'ecran ; c'est la seule sortie visible d'une
     couche qui prend tout l'ecran. */
  it("se ferme par la croix, qui porte un nom", () => {
    const { onClose } = draw();
    const cross = screen.getByTitle(/fermer/i);
    expect(cross).toBeInTheDocument();
    fireEvent.click(cross);
    expect(onClose).toHaveBeenCalled();
  });

  /* LA CROIX SE POSE SUR L'IMAGE, PAS SUR LE VOILE : sans fond a elle,
     une croix claire disparait sur un plan clair. */
  it("la croix porte son propre fond", () => {
    draw();
    const cross = screen.getByTitle(/fermer/i);
    expect(cross.getAttribute("style")).toMatch(/background/);
  });

  /* QUAND LA SURFACE EST FIXE, L'ENCRE DOIT L'ETRE AUSSI. On refuse le
     jeton, pas une teinte : `var(--c-paper)` est precisement ce qui
     rendait la legende et la croix invisibles sous huit peaux. */
  it("ne peint plus le texte du voile avec un jeton qui bascule", () => {
    draw();
    const legend = screen.getByText("Le couloir");
    expect(legend.getAttribute("style")).not.toMatch(/--c-paper/);
    expect(screen.getByTitle(/fermer/i).getAttribute("style")).not.toMatch(/--c-paper/);
  });

  /* Une capture sans legende porte son rang, pour qu'aucune ne soit
     muette. */
  it("nomme une capture qui n'a pas de legende", () => {
    draw({ index: 1 });
    expect(screen.getByRole("dialog").textContent).toMatch(/2/);
  });
});
