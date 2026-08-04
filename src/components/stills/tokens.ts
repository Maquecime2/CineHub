/* ============================================================
   LES JETONS [img:N]

   Une capture peut être appelée dans le texte d'une critique par un jeton
   [img:N]. La source de vérité reste la chaîne à jetons enregistrée dans la
   fiche ; le HTML n'en est qu'une projection éditable.
   ============================================================ */
import { C } from "../../theme/tokens";
import type { Still } from "../../types";

export const STILL_TOKEN = /\[img:(\d+)\]/g;

/* Une regex globale porte un curseur (`lastIndex`) : la partager entre un
   `exec` en boucle et un rendu React reviendrait à muter un état de module
   pendant le rendu. Les parcours pas-à-pas prennent donc leur propre copie. */
export const stillTokenScanner = () => new RegExp(STILL_TOKEN.source, "g");

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );

/* Texte (avec jetons) → HTML affichable. La vignette est un bloc atomique
   non éditable : le curseur la franchit d'un coup, comme un caractère. */
export function textToHtml(text: string, stills: Still[], urls: Record<string, string>): string {
  return escapeHtml(text || "")
    .replace(STILL_TOKEN, (_full, n: string) => {
      const still = stills[Number(n) - 1];
      if (!still)
        return `<span data-missing="1" style="font-family:'Special Elite',monospace;font-size:11px;color:${C.burgundy}">[capture ${n} manquante]</span>`;
      const src = urls[still.key] || "";
      return (
        `<img data-still="${n}" src="${src}" alt="" contenteditable="false" draggable="false"` +
        ` style="display:inline-block;vertical-align:middle;height:64px;margin:2px 4px;` +
        `border:1px solid ${C.burgundy};padding:2px;background:${C.card};` +
        `box-shadow:1px 2px 5px rgba(30,20,10,0.3);transform:rotate(-1.2deg);cursor:zoom-in" />`
      );
    })
    .replace(/\n/g, "<br>");
}

/** Où s'arrêter dans le parcours, pour mesurer la position du curseur. */
export interface CaretStop {
  node: Node | null;
  offset: number;
}

/* HTML → texte (avec jetons). `stopAt` permet de mesurer la position du
   curseur dans le texte sérialisé, pour y réinsérer proprement. */
export function htmlToText(root: HTMLElement, stopAt?: CaretStop): string {
  let out = "";
  let done = false;
  const walk = (node: Node) => {
    for (const n of Array.from(node.childNodes)) {
      if (done) return;
      if (stopAt && n === stopAt.node && n.nodeType === 3) {
        out += (n.nodeValue || "").slice(0, stopAt.offset);
        done = true;
        return;
      }
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeName === "IMG" && (n as HTMLElement).dataset.still)
        out += `[img:${(n as HTMLElement).dataset.still}]`;
      else if (n.nodeName === "BR") out += "\n";
      else {
        if (/^(DIV|P)$/.test(n.nodeName) && out && !out.endsWith("\n")) out += "\n";
        walk(n);
        if (done) return;
      }
      if (stopAt && n === stopAt.node) {
        done = true;
        return;
      }
    }
  };
  walk(root);
  return out;
}

/* Place le curseur à une position exprimée en caractères du texte sérialisé. */
export function placeCaret(root: HTMLElement, target: number): void {
  let seen = 0,
    placed = false;
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const walk = (node: Node) => {
    for (const n of Array.from(node.childNodes)) {
      if (placed) return;
      if (n.nodeType === 3) {
        const len = (n.nodeValue || "").length;
        if (seen + len >= target) {
          range.setStart(n, target - seen);
          placed = true;
          return;
        }
        seen += len;
      } else if (n.nodeName === "IMG" && (n as HTMLElement).dataset.still) {
        seen += `[img:${(n as HTMLElement).dataset.still}]`.length;
        if (seen >= target) {
          range.setStartAfter(n);
          placed = true;
          return;
        }
      } else if (n.nodeName === "BR") {
        seen += 1;
        if (seen >= target) {
          range.setStartAfter(n);
          placed = true;
          return;
        }
      } else walk(n);
    }
  };
  walk(root);
  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
