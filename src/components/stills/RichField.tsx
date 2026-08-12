import { useEffect, useRef } from "react";
import { ruledTextarea } from "../../theme/styles";
import { Label } from "../ui";
import { useStillUrls } from "./useStillUrls";
import { htmlToText, placeCaret, textToHtml } from "./tokens";
import type { Still } from "../../types";

interface RichFieldProps {
  label: string;
  value: string;
  onChange: (text: string) => void;
  stills: Still[];
  onOpenStill: (i: number) => void;
  /** Receives a function returning the text with a token at the cursor. */
  onInsertToken?: (fn: (token: string) => string) => void;
  placeholder?: string;
  minHeight?: number;
}

/* The writing field: you type in it normally, and the stills inserted
   show as thumbnails among the sentences. A textarea can only hold plain
   text — hence a rich editable field, whose source of truth stays the
   token string saved on the card. */
export function RichField({
  label,
  value,
  onChange,
  stills,
  onOpenStill,
  onInsertToken,
  placeholder,
  minHeight = 120,
}: RichFieldProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef(value); // ce que le champ vient de produire
  const pendingCaret = useRef<number | null>(null); // où replacer le curseur après un rendu
  const urls = useStillUrls(stills);

  /* Returns the text with the token added, without writing anything: it
     is the caller that decides when to save. A function that triggered a
     save itself would overwrite the stills saved just before. */
  const withTokenAtCursor = (token: string) => {
    const el = ref.current;
    const sel = window.getSelection();
    let at = value.length;
    if (el && sel?.rangeCount && sel.anchorNode && el.contains(sel.anchorNode)) {
      at = htmlToText(el, { node: sel.anchorNode, offset: sel.anchorOffset }).length;
    }
    pendingCaret.current = at + token.length;
    return `${value.slice(0, at)}${token}${value.slice(at)}`;
  };
  useEffect(() => {
    onInsertToken?.(withTokenAtCursor);
  });

  /* We only rewrite the content if the value comes from elsewhere
     (insertion, load, deletion of a still): rewriting on every keystroke
     would make the cursor jump. */
  const lastSig = useRef("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // the blob URLs arrive afterwards: without following them, the
    // thumbnails would stay empty images a few pixels wide
    const sig = (stills || []).map((s) => urls[s.key] || "").join("|");
    const textChanged = value !== lastEmitted.current;
    const urlsChanged = sig !== lastSig.current;
    if (!textChanged && !urlsChanged && el.dataset.ready === "1") return;

    // a re-render moves the cursor: we note where it was to put it back
    const sel = window.getSelection();
    const focused = document.activeElement === el;
    const keep =
      pendingCaret.current != null
        ? pendingCaret.current
        : focused && sel?.rangeCount && sel.anchorNode && el.contains(sel.anchorNode)
          ? htmlToText(el, { node: sel.anchorNode, offset: sel.anchorOffset }).length
          : null;

    el.innerHTML = textToHtml(value, stills, urls);
    el.dataset.ready = "1";
    lastEmitted.current = value;
    lastSig.current = sig;

    if (keep != null && (focused || pendingCaret.current != null)) {
      el.focus();
      placeCaret(el, keep);
    }
    pendingCaret.current = null;
  }, [value, urls, stills]);

  const emit = () => {
    if (!ref.current) return;
    const text = htmlToText(ref.current);
    lastEmitted.current = text;
    onChange(text);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        onClick={(e) => {
          // clicking a thumbnail opens the still, without breaking the input
          const n = (e.target as HTMLElement)?.dataset?.still;
          if (n) {
            e.preventDefault();
            onOpenStill(Number(n) - 1);
          }
        }}
        onPaste={(e) => {
          // pasting images is handled above; here we force plain text
          const hasImage = [...(e.clipboardData?.items || [])].some(
            (i) => i.kind === "file" && i.type.startsWith("image/")
          );
          if (hasImage) return;
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        style={{
          ...ruledTextarea,
          minHeight,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          cursor: "text",
          display: "block",
        }}
      />
    </div>
  );
}
