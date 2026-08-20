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

  /* LE CAS QUI A RÉSISTÉ À DEUX CORRECTIONS, et le seul qu'aucune
     épreuve ne couvrait : insérer JUSTE APRÈS une vignette déjà posée.

     Là, le champ éditable n'ancre pas la sélection sur un nœud de texte
     mais sur l'ÉLÉMENT, avec un décalage qui est un indice d'enfant. La
     mesure d'avant cherchait un point d'arrêt sur un nœud de texte, ne
     le rencontrait jamais, parcourait tout et rendait la longueur
     TOTALE — la seconde vignette se posait à la fin du texte.

     Les épreuves précédentes plaçaient toutes un `Range` sur du texte :
     elles passaient, et la fonctionnalité ne marchait pas. */
  it("pose la suivante juste après celle qui est déjà là", () => {
    const { field, insert } = mount("avant[img:1]apres");

    const img = field.querySelector("img");
    expect(img).not.toBeNull();

    /* Ancré sur l'ÉLÉMENT, après l'image : ce que fait le navigateur
       quand on clique là, et ce que la mesure ne savait pas lire. */
    const after = [...field.childNodes].indexOf(img!) + 1;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(field, after);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    expect(insert()("[img:2]")).toBe("avant[img:1][img:2]apres");
  });
});

/* ============================================================
   CE QU'ON TAPE NE SE FAIT PAS REPRENDRE

   LE DÉFAUT : « de légers retours en arrière en tapant sa critique ».
   Le champ ne se réécrivait que si `value` différait de ce qu'il venait
   d'émettre — ce qui a l'air d'une garde, et n'en est pas une : elle est
   vraie AUSSI quand la valeur qui revient est plus VIEILLE que ce qu'on
   a tapé depuis. Le champ reprenait alors le texte d'avant, et les
   caractères frappés entre-temps disparaissaient.

   Un parent en retard d'une frappe suffit à le montrer, et c'est le cas
   ordinaire : la fiche remonte par un chemin — l'écho d'une écriture,
   une synchro, un rendu groupé — qui ne connaît pas la dernière lettre.

   TANT QU'ON A LA MAIN DANS LE CHAMP, C'EST LE CHAMP QUI FAIT FOI.
   ============================================================ */
describe("typing, while the card answers late", () => {
  it("does not take back what was typed after the value it echoes", () => {
    const onChange = vi.fn();
    const { rerender, container } = render(
      <RichField
        label="Critique"
        value=""
        onChange={onChange}
        stills={stills}
        onOpenStill={() => {}}
      />
    );
    const field = container.querySelector("[contenteditable]") as HTMLDivElement;
    field.focus();

    /* On tape « Cléo », puis « de 5 à 7 » — sans que le parent ait eu le
       temps de rendre la première moitié. */
    field.textContent = "Cléo";
    fireEvent.input(field);
    expect(onChange).toHaveBeenLastCalledWith("Cléo");

    field.textContent = "Cléo de 5 à 7";
    fireEvent.input(field);
    expect(onChange).toHaveBeenLastCalledWith("Cléo de 5 à 7");

    /* LA FICHE REVIENT AVEC « Cléo », en retard de neuf caractères. */
    rerender(
      <RichField
        label="Critique"
        value="Cléo"
        onChange={onChange}
        stills={stills}
        onOpenStill={() => {}}
      />
    );

    expect(field.textContent).toBe("Cléo de 5 à 7");
  });

  it("still accepts a value that comes from elsewhere when one is not typing", () => {
    /* La garde ne vaut que TANT QU'ON A LA MAIN. Sans le focus, une
       valeur venue d'ailleurs — un import, une synchro, une capture
       retirée — doit continuer de s'afficher, sinon le champ ne se
       remplirait jamais à l'ouverture d'une fiche. */
    const { rerender, container } = render(
      <RichField
        label="Critique"
        value=""
        onChange={() => {}}
        stills={stills}
        onOpenStill={() => {}}
      />
    );
    const field = container.querySelector("[contenteditable]") as HTMLDivElement;
    rerender(
      <RichField
        label="Critique"
        value="Venu d'ailleurs"
        onChange={() => {}}
        stills={stills}
        onOpenStill={() => {}}
      />
    );
    expect(field.textContent).toBe("Venu d'ailleurs");
  });
});
