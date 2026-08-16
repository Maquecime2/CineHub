import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { QuickFile } from "./QuickFile";

/* ============================================================
   LE CLASSEUR RAPIDE

   Ce qui compte ici n'est pas le dessin, c'est le CONTRAT AVEC LE
   GLISSEMENT : le panneau est monté en permanence et ouvert à la main,
   parce qu'un `setState` au début d'un glissement redessine l'étagère et
   coûte la fluidité de tout le geste. Un composant qui se monterait sur
   condition passerait ces épreuves-ci et casserait cette garantie-là,
   d'où la première.
   ============================================================ */

const box = (over = {}) => ({
  kind: "main",
  rowId: "r1",
  catId: "c1",
  label: "Les policiers",
  color: "burgundy",
  count: 3,
  ...over,
});

describe("le classeur rapide", () => {
  it("est dans le document, et fermé, avant qu'on glisse quoi que ce soit", () => {
    const ref = createRef();
    render(<QuickFile ref={ref} boxes={[box()]} onDrop={vi.fn()} />);
    /* MONTÉ : c'est ce qui permet de l'ouvrir sans rendu. */
    expect(ref.current).not.toBeNull();
    expect(ref.current.style.display).toBe("none");
  });

  it("nomme chaque boîte et dit ce qu'elle contient", () => {
    render(
      <QuickFile
        ref={createRef()}
        boxes={[box(), box({ catId: "c2", label: "Les muets", count: 12 })]}
        onDrop={vi.fn()}
      />
    );
    expect(screen.getByText("Les policiers")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Les muets")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  /* UNE ÉTAGÈRE SANS BOÎTE N'A RIEN À PROPOSER, et un cadre vide qui
     apparaît à chaque glissement est une gêne de plus. */
  it("ne dessine rien quand il n'y a aucune boîte", () => {
    const { container } = render(<QuickFile ref={createRef()} boxes={[]} onDrop={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/classer vite/)).toBeNull();
  });

  it("rend la boîte visée au lâcher", () => {
    const onDrop = vi.fn();
    const target = box();
    render(<QuickFile ref={createRef()} boxes={[target]} onDrop={onDrop} />);
    fireEvent.drop(screen.getByText("Les policiers").parentElement);
    expect(onDrop).toHaveBeenCalledWith(target);
  });

  /* LE SURVOL DOIT ÊTRE ACCEPTÉ EXPLICITEMENT : sans `preventDefault`
     sur `dragover`, le navigateur refuse le lâcher et la boîte n'est
     jamais atteinte — le défaut classique, et parfaitement muet. */
  it("accepte le survol, sans quoi rien ne peut être lâché", () => {
    render(<QuickFile ref={createRef()} boxes={[box()]} onDrop={vi.fn()} />);
    const row = screen.getByText("Les policiers").parentElement;
    const over = new Event("dragover", { bubbles: true, cancelable: true });
    Object.assign(over, { dataTransfer: { dropEffect: "" } });
    row.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
  });

  /* LE LÂCHER NE REMONTE PAS. Sans `stopPropagation`, le `drop` du
     panneau traverserait ce qu'il y a dessous et la fiche serait rangée
     deux fois — une fois dans la boîte, une fois là où le panneau
     flotte.

     ON L'ÉPROUVE SUR L'ÉVÉNEMENT ET NON SUR UN ÉCOUTEUR PLACÉ PLUS
     HAUT : le panneau est rendu dans un portail, donc dans `body`, et
     React y pose sa propre écoute — l'ordre entre la sienne et celle
     d'une épreuve n'est pas garanti. Ce qu'on veut vérifier est que le
     gestionnaire ARRÊTE la remontée ; c'est exactement ce que dit cet
     appel. */
  it("garde le lâcher pour lui", () => {
    render(<QuickFile ref={createRef()} boxes={[box()]} onDrop={vi.fn()} />);
    const row = screen.getByText("Les policiers").parentElement;
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    const stopped = vi.spyOn(drop, "stopPropagation");
    row.dispatchEvent(drop);
    expect(stopped).toHaveBeenCalled();
  });
});
