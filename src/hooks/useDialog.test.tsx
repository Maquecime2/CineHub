import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useDialog } from "./useDialog";

/* ============================================================
   DEUX COUCHES EMPILÉES, ET UNE SEULE A LA MAIN
   ============================================================

   L'écouteur de ce crochet est posé sur `document`, EN CAPTURE, une fois
   par couche montée. Tant qu'il n'y en avait jamais deux à la fois, rien
   ne se voyait ; une feuille qui en ouvre une seconde — la carte des
   cinéastes et le formulaire d'un lien — fait paraître un défaut qui NE
   SE VOIT PAS À LA SOURIS : Échap ferme les deux d'un coup, parce que
   `stopPropagation` n'arrête pas les autres écouteurs du MÊME nœud.

   LE PIÈGE À FOCUS, LUI, TENAIT DÉJÀ — la couche du dessus s'inscrit en
   dernier, donc elle parle en dernier et repêche le curseur. Il est
   éprouvé ici quand même : c'est le comportement qu'on ne veut pas
   perdre en rangeant l'autre, et il ne tenait que par un ordre
   d'inscription que personne n'avait choisi.

   C'est le pendant clavier du budget de `z-index` : ce qui est
   visuellement au-dessus est ce qui a la main. */

function Layer({
  name,
  onClose,
  children,
}: {
  name: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const box = useDialog(onClose, { autoFocus: false });
  return (
    <div ref={box} role="dialog" aria-label={name}>
      <button>{`${name} — premier`}</button>
      <button>{`${name} — dernier`}</button>
      {children}
    </div>
  );
}

/* CHACUNE DANS SON PORTAIL, ET C'EST TOUT LE SUJET. `Layer` rend dans le
   CORPS du document : imbriquées dans le DOM, la couche du dessous
   « contient » celle du dessus et son piège à focus ne se déclenche
   jamais — le défaut ne se reproduit pas, et le filet ne garde rien. */
function Stack({ onFirst, onSecond }: { onFirst: () => void; onSecond: () => void }) {
  const [deep, setDeep] = useState(false);
  return (
    <Layer name="dessous" onClose={onFirst}>
      <button onClick={() => setDeep(true)}>ouvrir la seconde</button>
      {deep &&
        createPortal(
          <Layer
            name="dessus"
            onClose={() => {
              onSecond();
              setDeep(false);
            }}
          />,
          document.body
        )}
    </Layer>
  );
}

describe("two layers on top of one another", () => {
  it("closes only the TOP one on Escape", async () => {
    const user = userEvent.setup();
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    render(<Stack onFirst={onFirst} onSecond={onSecond} />);

    await user.click(screen.getByRole("button", { name: "ouvrir la seconde" }));
    await user.keyboard("{Escape}");

    expect(onSecond).toHaveBeenCalledTimes(1);
    /* Celle du dessous ne bouge pas : on referme ce qu'on vient
       d'ouvrir, jamais tout ce qui est ouvert. */
    expect(onFirst).not.toHaveBeenCalled();
  });

  it("keeps Tab inside the TOP one, instead of letting the one below take it", async () => {
    const user = userEvent.setup();
    render(<Stack onFirst={vi.fn()} onSecond={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "ouvrir la seconde" }));
    const top = screen.getByRole("dialog", { name: "dessus" });
    screen.getByRole("button", { name: "dessus — dernier" }).focus();
    await user.tab();

    /* Le cycle referme sur la couche du dessus, et n'en sort pas. */
    expect(top.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "dessus — premier" }));
  });

  it("hands the key back to the layer below once the top one is gone", async () => {
    const user = userEvent.setup();
    const onFirst = vi.fn();
    render(<Stack onFirst={onFirst} onSecond={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "ouvrir la seconde" }));
    /* Le premier Échap referme celle du dessus... */
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "dessus" })).not.toBeInTheDocument();
    expect(onFirst).not.toHaveBeenCalled();

    /* ...et le second, alors seulement, celle du dessous. Une couche qui
       se démonte rend la main, elle ne la garde pas. */
    await user.keyboard("{Escape}");
    expect(onFirst).toHaveBeenCalledTimes(1);
  });
});

describe("one layer on its own", () => {
  it("still traps the focus and answers Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Layer name="seule" onClose={onClose} />);

    screen.getByRole("button", { name: "seule — dernier" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "seule — premier" }));

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives the hand back to whatever held it before", async () => {
    const user = userEvent.setup();
    function Door() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>la porte</button>
          {open && <Layer name="ouverte" onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<Door />);
    const door = screen.getByRole("button", { name: "la porte" });
    await user.click(door);
    await user.keyboard("{Escape}");

    expect(document.activeElement).toBe(door);
  });
});

/* ============================================================
   LE PIÈGE APPARTIENT À LA VIE DE LA COUCHE
   ============================================================

   Presque tous les appelants écrivent leur fermeture en ligne
   (`onClose={() => setOpen(false)}`) : une identité neuve à chaque
   rendu. Tant que l'effet en dépendait, chaque rendu du parent
   DÉMONTAIT le piège — donc rendait la main à l'ouvreur — puis le
   REMONTAIT — donc la reprenait.

   Invisible partout, sauf là où perdre le focus ÉCRIT : dans le dossier
   d'un film, la critique enregistre au `blur`, enregistrer redessine, et
   la boucle se nourrit d'elle-même jusqu'à « Maximum update depth ». */
describe("a layer whose parent keeps re-rendering", () => {
  function Case() {
    const [open, setOpen] = useState(false);
    const [n, setN] = useState(0);
    return (
      <>
        <button onClick={() => setOpen(true)}>ouvrir</button>
        <button onClick={() => setN((x) => x + 1)}>rendre à nouveau {n}</button>
        {open &&
          createPortal(
            /* EN LIGNE, EXPRÈS : c'est ce que fait le produit, et c'est
               ce qui déclenchait le défaut. */
            <Layer name="couche" onClose={() => setOpen(false)} />,
            document.body
          )}
      </>
    );
  }

  it("arms the focus trap ONCE, and never hands the focus back and forth", async () => {
    const user = userEvent.setup();
    render(<Case />);

    const opener = screen.getByRole("button", { name: "ouvrir" });
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "couche" })).toBeInTheDocument();

    /* On compte À PARTIR DE LÀ : le clic d'ouverture donne la main à
       l'ouvreur, c'est normal. Ce qui ne l'est pas, c'est qu'il la
       reprenne ensuite, à chaque rendu. */
    let grabbed = 0;
    opener.addEventListener("focus", () => {
      grabbed += 1;
    });

    /* Trois rendus du parent, la couche ouverte tout du long. */
    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole("button", { name: /rendre à nouveau/ }));
    }

    /* PAS UNE SEULE REPRISE. Avec l'ancienne dépendance, l'ouvreur
       reprenait la main À CHAQUE rendu — trois rendus, trois reprises —
       et chacune faisait perdre la sienne à ce qui l'avait. C'est ce
       va-et-vient qui, dans le dossier d'un film, écrivait la fiche en
       boucle jusqu'à faire tomber la vue. */
    expect(grabbed).toBe(0);
  });
});
