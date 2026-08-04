/* LES LIGNES DE BOIS D'UNE RANGÉE.

   Une rangée n'est pas une bande qui se replie toute seule : c'est une
   PILE de lignes, et chaque ligne a sa planche. Le repli laissé au
   navigateur ne savait pas poser de bois sous les lignes du haut — les
   boîtiers y flottaient, et une boîte un peu remplie grandissait en
   hauteur sans que rien ne la porte.

   On découpe donc nous-mêmes, en cases. Une case tient un boîtier. Une
   boîte n'est plus un objet indivisible qui se replierait à l'intérieur
   d'elle-même : elle prend les cases qui restent sur la ligne, puis
   CONTINUE sur la ligne suivante — bois compris. C'est le seul endroit
   du fichier qui décide où l'on va à la ligne. */
import { useEffect, useState } from "react";
import { BOX_W, GAP_X } from "./constants";

/* Ce qu'on tient quand on n'a encore rien mesuré, et ce qu'on tient si
   le navigateur ne sait pas mesurer. Dix, comme la rangée neuve. */
export const FALLBACK_CAP = 10;

/* Découpe les objets d'une rangée en lignes de `cap` cases.

   Rend un tableau de lignes, chaque ligne étant un tableau de segments :
   - `{ t:"f"|"d", it, key }` — un objet, une case ;
   - `{ t:"c", cat, items, first, last, key }` — la TRANCHE d'une boîte
     qui tient sur cette ligne, avec de quoi savoir si elle porte
     l'en-tête (`first`) et si elle s'arrête là (`last`).

   Une rangée vide rend une ligne vide plutôt qu'aucune : elle a quand
   même une planche et un mot à dire. */
export function splitRow(items, cap) {
  const n = Math.max(1, Math.floor(cap) || 1);
  const lines = [];
  let cur = [];
  let free = n;

  const turn = () => {
    lines.push(cur);
    cur = [];
    free = n;
  };

  for (const it of items || []) {
    if (it.t === "c") {
      const total = it.items.length;
      // une boîte vide occupe quand même sa case : elle porte l'invite
      if (total === 0) {
        if (free === 0) turn();
        cur.push({ t: "c", cat: it, items: [], first: true, last: true, key: it.id });
        free -= 1;
        continue;
      }
      let at = 0;
      let first = true;
      while (at < total) {
        if (free === 0) turn();
        const end = at + Math.min(free, total - at);
        cur.push({
          t: "c",
          cat: it,
          items: it.items.slice(at, end),
          first,
          last: end >= total,
          key: `${it.id}@${at}`,
        });
        free -= end - at;
        at = end;
        first = false;
      }
      continue;
    }
    if (free === 0) turn();
    cur.push({ t: it.t, it, key: it.id });
    free -= 1;
  }

  if (cur.length || lines.length === 0) lines.push(cur);
  return lines;
}

/* LE COMPTE EFFECTIF D'UNE RANGÉE.

   Un compte réglé à la main est le compte, et on ne mesure rien. En
   « auto », le compte n'était rien du tout : on laissait le navigateur
   replier, c'est-à-dire précisément ce qu'on ne veut plus. On mesure
   donc la rangée pour savoir combien de boîtiers y tiennent, et « auto »
   redevient un compte comme un autre — celui de la largeur.

   `pad` est ce que les bandes perdent en marge intérieure ; on le retire
   avant de diviser, sinon la dernière case déborderait de la planche.

   On n'écrit l'état que lorsque le nombre CHANGE : un `ResizeObserver`
   parle à chaque pixel, et rendre la rangée à chaque pixel ferait de la
   poignée de fenêtre un rabot. */
export function useRowCap(ref, perRow, pad = 20) {
  const [measured, setMeasured] = useState(null);

  useEffect(() => {
    if (perRow != null) return undefined;
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const read = (w) => {
      /* Une largeur nulle n'est pas une rangée étroite, c'est une rangée
         qu'on n'a pas encore mise en page — un rayon replié, un onglet en
         arrière-plan. La croire donnerait une case par ligne. */
      if (!(w > 0)) return;
      const fit = Math.max(1, Math.floor((w - pad) / (BOX_W + GAP_X)));
      setMeasured((c) => (c === fit ? c : fit));
    };

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) read(e.contentRect.width);
    });
    ro.observe(el);
    read(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref, perRow, pad]);

  if (perRow != null) return Math.max(1, perRow);
  return measured ?? FALLBACK_CAP;
}
