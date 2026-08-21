/* ============================================================
   LE RECUL — voir l'étagère en entier, sans rien lui faire

   Quatre cents boîtiers sur trois rayons se parcouraient à l'ascenseur.
   Or ce qu'on a rangé À LA MAIN — quel rayon est chargé, où sont les
   objets posés, où le bois respire — est précisément la seule chose
   qu'on ne pouvait pas regarder.

   ON RECULE, ON NE RÉSUME PAS. Une carte réduite à côté aurait été une
   seconde vérité à tenir, et `ShelfFind` a déjà tranché cette
   question-là : « une liste tenue à côté aurait doublé le rangement et
   se serait décalée au premier déplacement ». Plier un rayon en bandeau
   aurait été pire encore — ça cache la disposition qu'on venait voir.
   L'étagère entière rétrécit : rien ne disparaît, rien ne se résume,
   l'ordre est celui qu'on avait le nez dessus.

   ─────────────────────────────────────────────────────────────
   DEUX CHOSES SEULEMENT, ET LA SECONDE EST CELLE QU'ON OUBLIE

   1. LES CRANS, et le fait qu'ils se DÉSARMENT pendant un glissement.
      Le cache de rectangles de `ShelfBoard` compare du CLIENT à du
      CLIENT : à échelle constante les deux sont réduits ensemble et le
      cache reste juste — il est d'ailleurs neuf à chaque geste. Ce qui
      le casserait est que l'échelle CHANGE en cours de route. Le
      glissement pose déjà `document.documentElement.dataset.dragging` :
      on le lit, et on ne bouge pas tant qu'une main tient un boîtier.

   2. LA HAUTEUR. Un bloc mis à l'échelle réserve sa hauteur ENTIÈRE :
      à 40 %, six dixièmes de la page seraient du vide sous une étagère
      minuscule. On observe donc la hauteur de MISE EN PAGE du
      sous-arbre — que la transformation ne touche pas, c'est tout le
      principe — et on la rend à l'enveloppe multipliée par l'échelle.

   LA MESURE EST HORS DU CHEMIN CHAUD, comme celle de `useRowCap` : un
   `ResizeObserver` parle à chaque pixel, et on n'écrit l'état que quand
   le nombre CHANGE.
   ============================================================ */
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * QUATRE CRANS, ET NON UN CURSEUR CONTINU.
 *
 * À 0,87 les tranches ne se lisent déjà plus et les boîtiers ne sont pas
 * encore petits : un cran arbitraire n'a rien à dire. Quatre valeurs
 * disent quatre choses — le nez dessus, le rayon, l'étagère, le meuble.
 */
export const NOTCHES = [1, 0.75, 0.55, 0.4] as const;

/** Le cran le plus proche d'une valeur venue du disque. */
export const nearestNotch = (k: unknown): number => {
  const want = typeof k === "number" && k > 0 ? k : 1;
  let best: number = NOTCHES[0];
  for (const n of NOTCHES) if (Math.abs(n - want) < Math.abs(best - want)) best = n;
  return best;
};

/** Une main tient-elle un boîtier en ce moment ? */
export const dragging = (): boolean =>
  typeof document !== "undefined" && document.documentElement.dataset.dragging != null;

/**
 * La hauteur que l'enveloppe doit réserver pour un sous-arbre réduit.
 *
 * `null` tant qu'on n'a rien mesuré, et c'est le cas qui doit rester sans
 * effort : sans hauteur imposée, le bloc occupe la sienne — exactement ce
 * qu'il faut à l'échelle pleine, où il n'y a rien à compenser.
 */
export function useStepBack(ref: RefObject<HTMLElement | null>, k: number): number | null {
  const [tall, setTall] = useState<number | null>(null);
  /* La dernière hauteur de MISE EN PAGE, gardée hors de l'état : elle
     doit survivre à un changement de cran, qui ne la modifie pas. */
  const raw = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const read = (h: number) => {
      /* Une hauteur de zéro n'est pas une étagère plate, c'est une
         étagère pas encore disposée — un onglet en arrière-plan. La
         croire replierait la page. C'est la garde de `useRowCap`, et
         c'est le même piège. */
      if (!(h > 0)) return;
      raw.current = h;
      setTall((c) => {
        const next = Math.round(h * k);
        return c === next ? c : next;
      });
    };

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) read(e.contentRect.height);
    });
    ro.observe(el);
    /* `offsetHeight` ET NON UN RECTANGLE CLIENT, pour la raison qui fait
       tout ce fichier : on veut la hauteur AVANT la transformation. Un
       rectangle client rendrait la hauteur déjà réduite, on la
       réduirait une seconde fois, et l'étagère se replierait sur
       elle-même à chaque cran. */
    read(el.offsetHeight);
    return () => ro.disconnect();
  }, [ref, k]);

  /* Le cran change sans que la hauteur de mise en page bouge : on
     recompose depuis la dernière mesure plutôt que d'attendre que
     l'observateur veuille bien reparler — il n'a aucune raison de le
     faire, rien n'a changé de son point de vue. */
  useEffect(() => {
    const h = raw.current;
    if (h == null) return;
    setTall((c) => {
      const next = Math.round(h * k);
      return c === next ? c : next;
    });
  }, [k]);

  return k === 1 ? null : tall;
}
