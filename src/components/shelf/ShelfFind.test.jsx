import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ShelfFind } from "./ShelfFind";

/* ============================================================
   CHERCHER SUR L'ETAGERE

   Ce qui compte ici n'est pas le dessin : c'est CE QU'ON DERANGE. Le
   tour des trouves se lit dans le document, et une seule chose de tout
   ce fichier a le droit de changer l'ecran de quelqu'un — ouvrir le
   tiroir des mis de cote. Elle doit donc etre exacte dans les deux sens.

   LE DEFAUT QUI A DONNE CE FICHIER : `onReveal` etait appele a CHAQUE
   saut, « au cas ou ». Chercher un film pose sur une planche faisait
   surgir un panneau qui n'avait rien a montrer, a chaque clic. Aucun des
   1787 cas du projet ne l'a vu, parce qu'aucun ne regardait ce que la
   recherche DERANGE.
   ============================================================ */

/* Le rangement, tel que le document le porte : l'ordre des noeuds EST
   l'ordre a l'ecran, et le contenu du tiroir ferme y figure — il est
   rendu, simplement invisible. C'est tout ce que `ShelfFind` lit. */
const shelf = (onPlank, inDrawer = []) => {
  const root = document.createElement("div");
  for (const id of onPlank) {
    const node = document.createElement("div");
    node.dataset.shelfItem = id;
    root.append(node);
  }
  const drawer = document.createElement("div");
  drawer.setAttribute("data-set-aside", "");
  for (const id of inDrawer) {
    const node = document.createElement("div");
    node.dataset.shelfItem = id;
    drawer.append(node);
  }
  root.append(drawer);
  document.body.append(root);
  return root;
};

/* jsdom ne sait pas defiler : la fonction n'existe simplement pas sur un
   element. On la pose, sans quoi le premier saut leve. */
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const next = () => fireEvent.click(screen.getByText(/suivant/i));
const previous = () => fireEvent.click(screen.getByText(/pr[ée]c[ée]dent/i));

describe("ShelfFind — ce que la recherche derange", () => {
  /* LE DEFAUT LUI-MEME. Un panneau qui surgit sans raison a chaque clic
     est un defaut de plus, pas la correction d'un defaut. */
  it("n'ouvre PAS le tiroir pour un film pose sur une planche", () => {
    shelf(["a", "b", "c"], ["z"]);
    const onReveal = vi.fn();
    render(<ShelfFind matching={new Set(["b"])} onReveal={onReveal} />);

    next();
    expect(onReveal).not.toHaveBeenCalled();
  });

  /* ET IL RESTE JOIGNABLE. Le contenu du tiroir ferme est rendu en
     `visibility: hidden` : sans cette ouverture, le boitier etait COMPTE,
     vise, et `scrollIntoView` ne faisait rien — un clic avale, en
     silence. */
  it("ouvre le tiroir pour un film qui y dort", () => {
    shelf(["a", "b"], ["z"]);
    const onReveal = vi.fn();
    render(<ShelfFind matching={new Set(["z"])} onReveal={onReveal} />);

    next();
    expect(onReveal).toHaveBeenCalled();
  });

  /* Une recherche qui trouve des DEUX cotes ne derange qu'en arrivant du
     cote qui cache : c'est la meme regle, vue depuis le tour. */
  it("n'ouvre le tiroir qu'en arrivant sur le boitier qui y est", () => {
    shelf(["a"], ["z"]);
    const onReveal = vi.fn();
    render(<ShelfFind matching={new Set(["a", "z"])} onReveal={onReveal} />);

    next(); // « a », sur la planche
    expect(onReveal).not.toHaveBeenCalled();
    next(); // « z », dans le tiroir
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  /* ON REPART DE RIEN QUAND LA RECHERCHE CHANGE. Le rang vit dans un
     `ref` — un etat redessinerait la colonne de vue a chaque saut — et
     un rang garde d'une recherche a l'autre faisait partir « suivant »
     au septieme resultat d'un ensemble qu'on venait de composer. */
  it("repart du premier quand la recherche change", () => {
    shelf(["a", "b", "c"]);
    const { rerender } = render(<ShelfFind matching={new Set(["a", "b", "c"])} />);

    next();
    next();
    expect(screen.getByText("2 sur 3")).toBeInTheDocument();

    rerender(<ShelfFind matching={new Set(["b", "c"])} />);
    next();
    expect(screen.getByText("1 sur 2")).toBeInTheDocument();
  });

  /* AVANCER PUIS RECULER RAMENE OU L'ON ETAIT : c'est tout ce que le
     bouton « precedent » promet. */
  it("revient sur ses pas", () => {
    shelf(["a", "b", "c"]);
    render(<ShelfFind matching={new Set(["a", "b", "c"])} />);

    next();
    next();
    expect(screen.getByText("2 sur 3")).toBeInTheDocument();
    previous();
    expect(screen.getByText("1 sur 3")).toBeInTheDocument();
  });

  /* On ne cherche rien : rien a annoncer. Une ligne vide en permanence a
     cote du champ serait un mot de plus a ignorer. */
  it("se tait quand on ne cherche rien", () => {
    const { container } = render(<ShelfFind matching={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
