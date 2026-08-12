/* ============================================================
   THE [img:N] TOKENS

   A still can be called into a review's text by an [img:N] token. The
   source of truth stays the token string saved on the card; the HTML is
   only an editable projection of it.
   ============================================================ */
import { C } from "../../theme/tokens";
import type { Still } from "../../types";

export const STILL_TOKEN = /\[img:(\d+)\]/g;

/* A global regex carries a cursor (`lastIndex`): sharing it between an
   `exec` loop and a React render would amount to mutating module state
   during a render. So the step-by-step walks take their own copy. */
export const stillTokenScanner = () => new RegExp(STILL_TOKEN.source, "g");

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );

/* Text (with tokens) → displayable HTML. The thumbnail is an atomic,
   non-editable block: the cursor crosses it in one go, like a character. */
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

/** Where to stop in the walk, to measure the cursor's position. */
export interface CaretStop {
  node: Node | null;
  offset: number;
}

/* HTML → text (with tokens). `stopAt` allows the cursor's position in
   the serialised text to be measured, so as to reinsert cleanly. */
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

/* Puts the cursor at a position expressed in characters of the serialised text. */
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
