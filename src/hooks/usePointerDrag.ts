/* ============================================================
   LE GLISSEMENT AU DOIGT — un pont, et non une seconde étagère
   ============================================================

   L'étagère se range en glissant : on prend un boîtier, on le pose entre
   deux autres, et le rayon où on le lâche lui donne son statut. Tout ce
   geste est écrit en événements de glisser-déposer HTML5 — `dragstart`,
   `dragover`, `drop` — et ces événements N'EXISTENT PAS sous un doigt.
   Aucun navigateur tactile ne les émet. Sur un téléphone, l'étagère
   n'était donc pas maladroite : elle était inerte.

   IL Y AVAIT DEUX FAÇONS DE RÉPONDRE, ET UNE SEULE TIENT.

   La première : donner à `src/components/shelf/` un second jeu de
   gestionnaires, tactile, à côté du premier. C'est mille lignes qui
   savent placer un repère, mesurer une rangée, écarter deux voisins et
   arbitrer une charnière — dupliquées, et vouées à diverger à la
   première correction portée d'un seul côté.

   La seconde, celle-ci : ne rien dupliquer, et TRADUIRE. Le doigt parle
   en `pointerdown`/`pointermove`/`pointerup` ; l'étagère écoute
   `dragstart`/`dragover`/`drop`. On écoute donc l'un et on émet l'autre,
   pour de vrai, sur le nœud qui se trouve sous le doigt — React attache
   ses écouteurs à la racine du document et ne fait aucune différence
   entre un événement du navigateur et un événement qu'on lui envoie.
   L'étagère ne sait pas qu'on la touche, et c'est exactement le but :
   pas une ligne de `shelf/` ne change, et toute correction faite à la
   souris profite au doigt le jour même.

   RIEN N'EST CÂBLÉ À L'ÉTAGÈRE ICI. Le pont ne connaît qu'une chose du
   document : `[draggable="true"]`. Ce qui se glisse à la souris se
   glisse au doigt, sur l'étagère comme sur le mur, et une vue future qui
   rend un objet saisissable l'obtient sans rien demander. */
import { useEffect } from "react";

/* CE QU'ON N'ATTRAPE PAS EN GLISSANT. Un boîtier saisissable porte des
   boutons — ouvrir la fiche, renommer un carton. Un appui long sur l'un
   d'eux doit rester un appui sur ce bouton. */
const INERT = "button, a, input, textarea, select, [contenteditable]";

/* LE TEMPS QU'IL FAUT POUR DIRE « JE PRENDS » PLUTOT QUE « JE FAIS
   DEFILER ».

   C'est l'arbitrage central, et il n'a pas de bonne reponse en pixels.
   Un seuil de distance — on saisit des que le doigt a bouge de huit
   pixels — condamne le defilement : l'etagere defile horizontalement, et
   le premier geste de balayage arracherait un boitier au lieu de faire
   glisser la rangee.

   L'appui maintenu tranche parce qu'il ne coute rien a qui veut
   defiler : le doigt part tout de suite, et la saisie n'a jamais lieu.
   C'est aussi le geste que le systeme lui-meme emploie pour reordonner
   une liste, donc celui qu'on essaie sans qu'on l'explique.

   Deux cent soixante millisecondes : au-dessous on saisit par accident
   en balayant vite, au-dessus on croit que rien ne repond. */
const HOLD_MS = 260;

/* Le doigt tremble. Tant qu'on n'a pas saisi, ce tremblement doit rester
   un tremblement — mais au-dela de dix pixels c'est un balayage, et
   l'appui maintenu est abandonne au profit du defilement. */
const SLOP = 10;

/* LE BORD QUI DEFILE.

   Sur un telephone, une rangee tient trois boitiers : la fente visee est
   presque toujours hors de l'ecran. A la souris on a la molette ; au
   doigt on n'a rien, puisque le doigt est deja pris par le geste. Sans
   ce qui suit, deplacer un film au-dela de ce que l'ecran montre est
   simplement impossible.

   Quatre-vingts pixels de bande, dix-huit pixels par trame au plus fort
   — soit environ mille par seconde, le temps de traverser une page sans
   qu'on ait le sentiment de fuir. La vitesse suit l'enfoncement dans la
   bande : effleurer la bande avance a peine, coller au bord file.

   `prefers-reduced-motion` NE COUPE PAS ce defilement. Ce n'est pas un
   ornement qui bouge tout seul : c'est le seul chemin vers une cible
   hors champ, et le supprimer rendrait le geste inachevable. */
const EDGE = 80;
const SPEED = 18;

/* Le conteneur qui defile sous ce qu'on survole. On remonte a la main
   plutot qu'avec `closest()` : le selecteur ne sait rien du style
   calcule, et un conteneur qui n'a rien a defiler ne doit pas capter le
   geste a la place de la page. */
const scroller = (node: Element | null): Element => {
  for (let el = node; el; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return document.scrollingElement ?? document.documentElement;
};

/* Le pas d'une trame, en pixels, signe : negatif vers le haut. Zero tant
   que le doigt n'est dans aucune des deux bandes. */
const pace = (y: number): number => {
  const top = EDGE - y;
  if (top > 0) return -SPEED * Math.min(1, top / EDGE);
  const bottom = y - (window.innerHeight - EDGE);
  if (bottom > 0) return SPEED * Math.min(1, bottom / EDGE);
  return 0;
};

/* CE QUE `dataTransfer` DOIT ÊTRE POUR QUE PERSONNE NE S'EN APERÇOIVE.

   Un `DragEvent` construit à la main naît avec `dataTransfer` à `null`,
   et le premier gestionnaire venu écrit `e.dataTransfer.effectAllowed =
   "move"` — ce qui jette. Le presse-papiers du glissement ne sert à rien
   ici (la source est retenue par l'étagère elle-même, pas lue dans le
   transfert), mais il doit RÉPONDRE. */
const fakeTransfer = () => {
  const data = new Map<string, string>();
  return {
    dropEffect: "move",
    effectAllowed: "move",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [] as readonly string[],
    setData: (k: string, v: string) => void data.set(k, v),
    getData: (k: string) => data.get(k) ?? "",
    clearData: () => data.clear(),
    setDragImage: () => {},
  } as unknown as DataTransfer;
};

/** Émettre un vrai événement de glissement, que React entendra. */
const emit = (node: Element | null, type: string, x: number, y: number, dt: DataTransfer) => {
  if (!node) return;
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
  /* `DragEvent` n'existe pas partout — jsdom, où tournent les tests, ne
     l'implémente pas. Un `MouseEvent` porte déjà tout ce que les
     gestionnaires lisent vraiment (le type, les coordonnées, la
     propagation) ; ce qui manquait, `dataTransfer`, est de toute façon
     posé à la main juste en dessous. */
  const Ctor = typeof DragEvent === "function" ? DragEvent : MouseEvent;
  const ev: Event = new Ctor(type, init);
  /* `dataTransfer` est un accesseur du prototype, et il n'est pas
     alimenté par le constructeur. On le pose sur l'instance. */
  Object.defineProperty(ev, "dataTransfer", { value: dt, configurable: true });
  node.dispatchEvent(ev);
};

/* Ce qui se trouve sous le doigt, la chose tenue mise à part : elle est
   sous le doigt en permanence, et se recevrait donc elle-même. */
const under = (x: number, y: number, held: HTMLElement): Element | null => {
  const before = held.style.pointerEvents;
  held.style.pointerEvents = "none";
  const el = document.elementFromPoint(x, y);
  held.style.pointerEvents = before;
  return el;
};

interface Gesture {
  id: number;
  source: HTMLElement;
  x: number;
  y: number;
  dt: DataTransfer;
  timer: number | null;
  /** L'appui a tenu : on glisse pour de bon. */
  live: boolean;
  /** Le dernier nœud survolé, pour lui dire qu'on le quitte. */
  over: Element | null;
  /** La trame de défilement en cours, s'il y en a une. */
  raf: number | null;
  /** Le pas de défilement, en pixels par trame ; zéro hors des bandes. */
  pan: number;
}

/** Traduit le doigt en glisser-déposer, pour tout `[draggable="true"]`. */
export function usePointerDrag(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let g: Gesture | null = null;

    const clearTimer = () => {
      if (g?.timer != null) {
        window.clearTimeout(g.timer);
        g.timer = null;
      }
    };

    /* Fin du geste, quelle qu'en soit la raison. `dragend` est émis même
       quand le dépôt a eu lieu : c'est lui qui remet l'étagère à plat
       (voir `reset`, dans ShelfBoard), et un geste qui se termine sans
       lui laisse un boîtier translucide et une racine encore marquée. */
    const finish = (drop: { x: number; y: number } | null) => {
      if (!g) return;
      const { source, dt, live, over } = g;
      const done = g;
      g = null;
      clearTimerOf(done);
      stopPan(done);
      if (!live) return;
      if (drop) {
        const target = under(drop.x, drop.y, source);
        emit(target, "drop", drop.x, drop.y, dt);
      } else if (over) {
        emit(over, "dragleave", done.x, done.y, dt);
      }
      emit(source, "dragend", done.x, done.y, dt);
      delete source.dataset.pointerDrag;
    };

    const clearTimerOf = (x: Gesture) => {
      if (x.timer != null) window.clearTimeout(x.timer);
      x.timer = null;
    };

    const stopPan = (x: Gesture) => {
      if (x.raf != null) cancelAnimationFrame(x.raf);
      x.raf = null;
      x.pan = 0;
    };

    /* Ce que le survol produit : le changement de cible, puis le
       `dragover` qui place le repere. Appele par le doigt qui bouge, et
       par chaque trame de defilement — car sous un doigt immobile, c'est
       l'etagere qui bouge, et la cible change tout autant. */
    const hover = (x: number, y: number) => {
      if (!g) return;
      const target = under(x, y, g.source);
      if (target !== g.over) {
        if (g.over) emit(g.over, "dragleave", x, y, g.dt);
        if (target) emit(target, "dragenter", x, y, g.dt);
        g.over = target;
      }
      /* `dragover` tire en continu tant que la souris bouge : c'est lui
         qui place le repère, et c'est donc lui qu'il faut répéter. */
      emit(target, "dragover", x, y, g.dt);
    };

    /* Une trame de defilement : on pousse le conteneur, on regarde ce
       qui est passe sous le doigt, on redemande une trame. Si le
       conteneur n'a pas bouge, on est en butee et la boucle s'arrete —
       la rejouer a vide ne ferait que rejouer le meme `dragover`. */
    const frame = () => {
      if (!g?.live || !g.pan) return;
      g.raf = null;
      const el = scroller(g.over ?? under(g.x, g.y, g.source));
      const before = el.scrollTop;
      el.scrollTop = before + g.pan;
      if (el.scrollTop === before) {
        g.pan = 0;
        return;
      }
      hover(g.x, g.y);
      if (g?.live && g.pan) g.raf = requestAnimationFrame(frame);
    };

    const begin = () => {
      if (!g) return;
      g.live = true;
      /* `touch-action: none` n'arrive qu'ICI, et c'est tout l'équilibre
         du geste : le poser d'avance sur chaque boîtier rendrait
         l'étagère impossible à faire défiler au doigt. La règle vit dans
         les jetons, sur `[data-pointer-drag]`. */
      g.source.dataset.pointerDrag = "1";
      /* Un retour physique dit que la chose est prise. Le clavier tactile
         d'iOS n'en donne pas ; ceux qui l'ont y gagnent, les autres ne
         perdent rien. */
      navigator.vibrate?.(12);
      emit(g.source, "dragstart", g.x, g.y, g.dt);
    };

    const onDown = (e: PointerEvent) => {
      if (g || e.button !== 0) return;
      const el = e.target as Element | null;
      if (!el || el.closest(INERT)) return;
      const source = el.closest<HTMLElement>('[draggable="true"]');
      if (!source) return;
      g = {
        id: e.pointerId,
        source,
        x: e.clientX,
        y: e.clientY,
        dt: fakeTransfer(),
        timer: window.setTimeout(begin, HOLD_MS),
        live: false,
        over: null,
        raf: null,
        pan: 0,
      };
    };

    const onMove = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      if (!g.live) {
        /* Le doigt est parti avant que l'appui ait tenu : c'est un
           balayage, et il appartient au defilement. */
        if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > SLOP) {
          clearTimer();
          g = null;
        }
        return;
      }
      /* A partir d'ici le geste est a nous, et la page ne doit plus
         bouger sous lui. D'ou l'ecouteur non passif plus bas : sans
         cela, cet appel serait sans effet et le navigateur le dirait. */
      e.preventDefault();
      g.x = e.clientX;
      g.y = e.clientY;
      hover(e.clientX, e.clientY);
      /* Entrer dans une bande allume la boucle, en sortir l'eteint ;
         entre les deux, on se contente de corriger la vitesse. */
      if (!g) return;
      g.pan = pace(e.clientY);
      if (g.pan && g.raf == null) g.raf = requestAnimationFrame(frame);
      else if (!g.pan) stopPan(g);
    };

    const onUp = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      finish({ x: e.clientX, y: e.clientY });
    };

    const onCancel = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      finish(null);
    };

    /* Un appui maintenu ouvre le menu contextuel d'un navigateur mobile,
       et ce menu vole le geste au moment précis où il commence. */
    const onContext = (e: Event) => {
      if (g?.live) e.preventDefault();
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("contextmenu", onContext);
    return () => {
      if (g) finish(null);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("contextmenu", onContext);
    };
  }, [enabled]);
}
