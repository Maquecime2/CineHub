import { describe, it, expect } from "vitest";
import { isTyping, shortcutOf } from "./keys";

/* Ce qui se teste ici est presque entièrement le REFUS. Ouvrir un tiroir
   quand on demande un tiroir est facile ; ne pas l'ouvrir au milieu
   d'une critique est la seule chose qui rende une touche nue
   supportable. */

const el = (tag: string, editable = false) => {
  const node = document.createElement(tag);
  if (editable) node.setAttribute("contenteditable", "true");
  return node;
};

describe("où le focus se trouve", () => {
  it("reconnaît les champs qui reçoivent du texte", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isTyping(el(tag)), tag).toBe(true);
    }
  });

  /* Le carnet écrit dans du `contenteditable`, qui n'est ni un `input`
     ni un `textarea` : le tester par le nom de balise seul laisserait
     passer exactement l'endroit où l'on écrit le plus. */
  it("reconnaît un contenteditable, et ce qu'il contient", () => {
    const zone = el("div", true);
    const inner = el("span");
    zone.appendChild(inner);
    document.body.appendChild(zone);
    expect(isTyping(zone)).toBe(true);
    /* L'HÉRITAGE COMPTE : on tape dans un enfant de la zone, pas dans la
       zone elle-même. */
    expect(isTyping(inner)).toBe(true);
    zone.remove();
  });

  /* Un îlot non modifiable au milieu d'une zone qui l'est. */
  it("respecte un contenteditable=false", () => {
    const node = el("div");
    node.setAttribute("contenteditable", "false");
    document.body.appendChild(node);
    expect(isTyping(node)).toBe(false);
    node.remove();
  });

  it("laisse passer le reste", () => {
    expect(isTyping(el("div"))).toBe(false);
    expect(isTyping(el("button"))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe("les touches nues", () => {
  it("ouvrent la recherche et la visite", () => {
    expect(shortcutOf({ key: "/", target: el("div") })).toBe("search");
    expect(shortcutOf({ key: "?", shiftKey: true, target: el("div") })).toBe("help");
  });

  /* LE CAS QUI COMPTE. Une barre oblique tapée dans une critique est une
     barre oblique, pas une demande d'ouvrir un tiroir. */
  it("ne font rien pendant qu'on écrit", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(shortcutOf({ key: "/", target: el(tag) }), tag).toBeNull();
      expect(shortcutOf({ key: "?", target: el(tag) }), tag).toBeNull();
    }
  });

  /* `Alt+/` appartient au navigateur ou au système. Le prendre au
     passage est le genre de vol qu'on ne pardonne pas. */
  it("ne volent rien à un modificateur", () => {
    expect(shortcutOf({ key: "/", altKey: true, target: el("div") })).toBeNull();
    expect(shortcutOf({ key: "/", ctrlKey: true, target: el("div") })).toBeNull();
    expect(shortcutOf({ key: "?", metaKey: true, target: el("div") })).toBeNull();
  });

  it("ignorent tout le reste", () => {
    for (const key of ["a", "Enter", "Escape", "ArrowUp", " "]) {
      expect(shortcutOf({ key, target: el("div") }), key).toBeNull();
    }
  });
});

describe("la combinaison, qui garde sa règle", () => {
  /* Une combinaison ne se tape pas par accident, et on la veut
     disponible DEPUIS un champ : c'est là qu'on est quand on cherche. */
  it("marche même en plein texte", () => {
    expect(shortcutOf({ key: "k", ctrlKey: true, target: el("textarea") })).toBe("search");
    expect(shortcutOf({ key: "K", metaKey: true, target: el("input") })).toBe("search");
  });

  it("ne se déclenche pas sans son modificateur", () => {
    expect(shortcutOf({ key: "k", target: el("div") })).toBeNull();
  });
});
