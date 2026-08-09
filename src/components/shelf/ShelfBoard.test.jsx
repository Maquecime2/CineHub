/* Ce que ces tests gardent, ce n'est pas un affichage : c'est le COÛT d'un
   glissement.

   `dragover` tire en continu tant qu'on tient quelque chose, souris immobile
   comprise. Tout ce que le survol s'autorise à faire est donc payé soixante
   fois par seconde, sans interruption, pendant tout le geste — et l'étagère a
   déjà tué un onglet pour l'avoir oublié. Les deux mesures ci-dessous sont
   celles qui l'avaient tué : les rectangles relus, et les boîtiers refaits.

   On compte donc des appels plutôt que d'inspecter du HTML. C'est inhabituel,
   mais c'est la seule chose que le rendu ne dit pas et que l'utilisateur, lui,
   sentait tout de suite. */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

/* `hueOf` est appelée dans le corps de `FilmBox`, une fois par rendu et par
   boîtier : la compter, c'est compter les rendus de boîtiers sans avoir à
   instrumenter React. */
const hueCalls = { n: 0 };
vi.mock("../../theme/ink", async () => {
  const real = await vi.importActual("../../theme/ink");
  return {
    ...real,
    hueOf: (id) => {
      hueCalls.n += 1;
      return real.hueOf(id);
    },
  };
});

/* `isUnplaced` est appelée dans le corps de `ShelfRow` : elle compte les
   rendus de RANGÉES, la couche que l'identité de `dnd` atteint réellement.
   Les boîtiers, eux, reçoivent les gestionnaires un par un — déjà stables —
   et sont protégés quoi qu'il arrive au paquet. */
const rowCalls = { n: 0 };
vi.mock("../../shelf-views", async () => {
  const real = await vi.importActual("../../shelf-views");
  return {
    ...real,
    isUnplaced: (row) => {
      rowCalls.n += 1;
      return real.isUnplaced(row);
    },
  };
});

const { ShelfBoard } = await import("./ShelfBoard");
const { makeView } = await import("../../shelf-views");

const films = Array.from({ length: 40 }, (_, i) => ({
  id: `f${i}`,
  title: `Film ${i}`,
  addedAt: 1000 + i,
  status: "watched",
  rating: 3,
  genres: [],
  chevet: false,
  archived: false,
}));

/* Un vrai `DragEvent` n'existe pas sous jsdom ; React n'écoute de toute façon
   que le nom de l'événement et sa cible. Un `Event` qui bouillonne suffit,
   augmenté des seuls champs que le code lit. */
const fire = (node, type, extra = {}) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, {
    clientX: 0,
    clientY: 0,
    dataTransfer: { setData() {}, setDragImage() {} },
    ...extra,
  });
  node.dispatchEvent(e);
};

const renderBoard = () => {
  let doc = makeView({ id: "v1", films });
  const onDoc = vi.fn((next) => {
    doc = next;
  });
  const utils = render(
    <ShelfBoard films={films} doc={doc} onDoc={onDoc} onOpen={() => {}} onUpdateMany={() => {}} />
  );
  return {
    ...utils,
    onDoc,
    get doc() {
      return doc;
    },
  };
};

/* Chaque nœud compte ses propres mesures. jsdom rend des rectangles nuls, ce
   qui ne gêne pas : on ne vérifie pas OÙ va le repère, seulement combien de
   fois on a demandé au navigateur de le calculer. */
const countRects = (container) => {
  const seen = new Map();
  container.querySelectorAll("*").forEach((node) => {
    seen.set(node, 0);
    node.getBoundingClientRect = () => {
      seen.set(node, seen.get(node) + 1);
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
    };
  });
  return seen;
};

const grab = (container) => {
  const wrap = container.querySelector("[data-shelf-item]");
  const handle = wrap.querySelector("[draggable]") || wrap;
  fire(handle, "dragstart");
  return wrap;
};

beforeEach(() => {
  hueCalls.n = 0;
  rowCalls.n = 0;
  cleanup();
});

describe("ShelfBoard — le coût d'un glissement", () => {
  it("ne mesure une enveloppe qu'UNE fois, quel que soit le nombre de survols", () => {
    const { container } = renderBoard();
    const wrap = grab(container);
    const rects = countRects(container);

    for (let i = 0; i < 50; i += 1) fire(wrap, "dragover", { clientX: 10 + (i % 3) });

    /* Avant, c'était cinquante — une mise en page complète forcée par survol,
       contre des enveloppes en `content-visibility: auto` qui venaient
       justement d'être sautées. */
    expect(rects.get(wrap)).toBe(1);
  });

  it("remesure au glissement SUIVANT : le cache ne vaut que pour un geste", () => {
    const { container } = renderBoard();
    const wrap = grab(container);
    const rects = countRects(container);

    fire(wrap, "dragover", { clientX: 10 });
    expect(rects.get(wrap)).toBe(1);

    fire(wrap, "dragend");
    fire(wrap.querySelector("[draggable]") || wrap, "dragstart");
    fire(wrap, "dragover", { clientX: 10 });

    // l'étagère a pu être rangée autrement entre les deux : on remesure
    expect(rects.get(wrap)).toBe(2);
  });

  it("ne mesure pas non plus la rangée à chaque survol de son fond", () => {
    const { container } = renderBoard();
    const wrap = grab(container);
    const strip = container.querySelector("[data-shelf-row]");
    const rects = countRects(container);

    /* Le fond de rangée se dédoublonne déjà ; on l'oblige à repasser en
       alternant avec un boîtier, ce qui casse sa mémoire de survol. */
    for (let i = 0; i < 20; i += 1) {
      fire(strip, "dragover");
      fire(wrap, "dragover", { clientX: 10 });
    }

    expect(rects.get(strip)).toBe(1);
  });

  it("ne refait ni rangée ni boîtier quand l'étagère se rend à nouveau pendant le geste", () => {
    const { container } = renderBoard();
    grab(container);
    const rowsBefore = rowCalls.n;
    const boxesBefore = hueCalls.n;
    expect(rowsBefore).toBeGreaterThan(0);
    expect(boxesBefore).toBeGreaterThan(0);

    /* Survoler la languette du tiroir en tenant un boîtier ouvre le tiroir :
       c'est le seul `setState` qu'un glissement déclenche, et il rend donc
       tout `ShelfBoard` au beau milieu du geste. Ce rendu ne doit coûter que
       le tiroir.

       Le paquet `dnd` descend jusqu'aux rangées ; s'il change d'identité à
       chaque rendu, leur `React.memo` ne retient plus rien et les rangées se
       refont — avec elles, les enveloppes que les mesures retenues plus haut
       désignaient. C'est là que les deux correctifs se rejoignent. */
    /* Le tiroir se rend dans le CORPS du document et non dans le conteneur
       de rendu : c'est un `Calque`, pour que ses coordonnées d'écran ne
       dépendent pas de la colonne de vue et de sa transformation. On le
       cherche donc où il est vraiment. */
    const tab = document.querySelector("[data-drawer-tab]");
    expect(tab).toBeTruthy();
    // `act` : sans lui le rendu déclenché resterait en attente et le compte mentirait
    act(() => {
      fire(tab, "dragover");
    });

    expect(rowCalls.n).toBe(rowsBefore);
    expect(hueCalls.n).toBe(boxesBefore);
  });
});
