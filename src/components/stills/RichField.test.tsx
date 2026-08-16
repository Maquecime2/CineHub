import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { RichField } from "./RichField";
import type { Still } from "../../types";

/* ============================================================
   OÙ LE JETON SE POSE

   LE DÉFAUT QUE CE FICHIER GARDE FERMÉ : on posait le curseur au milieu
   d'une phrase, on descendait cliquer « insérer », et la vignette se
   collait À LA FIN du texte. Le clic sur le bouton déplace la sélection
   hors du champ ; `window.getSelection()` ne désignait alors plus rien
   de nous, et le repli était la fin du texte.

   Le champ retient donc la position tant qu'elle est chez lui. Il n'a
   pas besoin d'avoir le focus pour savoir où l'on écrivait — et c'est
   exactement la situation dans laquelle on l'interroge.

   LE GLISSEMENT DEPUIS LA PELLICULE A ÉTÉ RETIRÉ : deux façons de poser
   la même image, dont une qui demande de viser un point dans un texte
   qu'on ne voit pas encore. « Insérer » pose au curseur, et c'est DANS
   le texte qu'on déplace ensuite la vignette — geste natif du champ
   éditable, que le navigateur assure et que `onInput` resérialise.
   ============================================================ */

vi.mock("./useStillUrls", () => ({ useStillUrls: () => ({}) }));

const stills: Still[] = [{ id: "s1", key: "k1" } as Still, { id: "s2", key: "k2" } as Still];

afterEach(cleanup);

/** Rend le champ et rend l'inséreur qu'il publie. */
function mount(value: string, onChange = vi.fn()) {
  let insert: ((token: string) => string) | null = null;
  render(
    <RichField
      label="Critique"
      value={value}
      onChange={onChange}
      stills={stills}
      onOpenStill={vi.fn()}
      onInsertToken={(fn) => {
        insert = fn;
      }}
    />
  );
  const field = document.querySelector("[contenteditable]") as HTMLElement;
  return { field, onChange, insert: () => insert! };
}

describe("l'insertion d'une capture", () => {
  it("publie un inséreur au montage", () => {
    const { insert } = mount("bonjour");
    expect(insert()).toBeTypeOf("function");
  });

  /* SANS CURSEUR CONNU, LA FIN DU TEXTE EST LE BON REPLI : on n'a jamais
     écrit dans ce champ, il n'y a pas d'endroit à deviner. */
  it("pose à la fin quand on n'a jamais écrit dedans", () => {
    const { insert } = mount("bonjour");
    expect(insert()("[img:1]")).toBe("bonjour[img:1]");
  });

  /* LE POINT DU FICHIER. On simule ce que fait un vrai clic sur
     « insérer » : le curseur était dans le champ, puis il n'y est plus. */
  it("retient où l'on écrivait, même après avoir quitté le champ", () => {
    const { field, insert } = mount("bonjour");

    const text = field.firstChild ?? field;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(text, 3);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    fireEvent.mouseUp(field);

    /* Le bouton emporte la sélection : c'est précisément ce qui cassait. */
    sel.removeAllRanges();

    expect(insert()("[img:1]")).toBe("bon[img:1]jour");
  });
});
