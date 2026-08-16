import { useEffect, useRef } from "react";
import { ruledTextarea } from "../../theme/styles";
import { Label } from "../ui";
import { useStillUrls } from "./useStillUrls";
import { htmlToText, placeCaret, textToHtml, STILL_DRAG } from "./tokens";
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
  const pendingCaret = useRef<number | null>(null); // where to put the caret back after a render
  const urls = useStillUrls(stills);

  /* OÙ ÉTAIT LE CURSEUR LA DERNIÈRE FOIS QU'ON ÉCRIVAIT ICI.

     C'est ce qui manquait, et le défaut se lisait ainsi : on posait le
     curseur au milieu d'une phrase, on descendait cliquer « insérer »,
     et le jeton se posait À LA FIN du texte. Le clic sur le bouton
     déplace la sélection hors du champ ; `window.getSelection()` ne
     désigne alors plus rien de nous, et le repli était la fin.

     On retient donc la position à chaque fois qu'elle est chez nous, et
     on s'en sert quand la sélection est partie ailleurs. Le champ n'a
     pas besoin d'avoir le focus pour savoir où l'on écrivait. */
  const lastCaret = useRef<number | null>(null);

  const caretNow = (): number | null => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount || !sel.anchorNode || !el.contains(sel.anchorNode)) return null;
    return htmlToText(el, { node: sel.anchorNode, offset: sel.anchorOffset }).length;
  };

  const rememberCaret = () => {
    const at = caretNow();
    if (at != null) lastCaret.current = at;
  };

  /** Le texte avec le jeton posé à `at`, et le curseur qui suit. */
  const withTokenAt = (token: string, at: number) => {
    const where = Math.max(0, Math.min(at, value.length));
    pendingCaret.current = where + token.length;
    return `${value.slice(0, where)}${token}${value.slice(where)}`;
  };

  /* Returns the text with the token added, without writing anything: it
     is the caller that decides when to save. A function that triggered a
     save itself would overwrite the stills saved just before. */
  const withTokenAtCursor = (token: string) =>
    withTokenAt(token, caretNow() ?? lastCaret.current ?? value.length);

  /* OÙ L'ON A LÂCHÉ, converti en position dans le texte.

     `caretPositionFromPoint` est la façon moderne, `caretRangeFromPoint`
     celle de WebKit ; aucune des deux n'est partout, d'où les deux. Sans
     l'une ni l'autre on retombe sur le curseur retenu, ce qui vaut mieux
     que de refuser le geste. */
  const caretFromPoint = (x: number, y: number): number | null => {
    const el = ref.current;
    if (!el) return null;
    const doc = document as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number
      ) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const spot = doc.caretPositionFromPoint?.(x, y);
    if (spot?.offsetNode && el.contains(spot.offsetNode)) {
      return htmlToText(el, { node: spot.offsetNode, offset: spot.offset }).length;
    }
    const range = doc.caretRangeFromPoint?.(x, y);
    if (range?.startContainer && el.contains(range.startContainer)) {
      return htmlToText(el, { node: range.startContainer, offset: range.startOffset }).length;
    }
    return null;
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
        onInput={() => {
          rememberCaret();
          emit();
        }}
        onKeyUp={rememberCaret}
        onMouseUp={rememberCaret}
        onBlur={() => {
          rememberCaret();
          emit();
        }}
        /* LA PELLICULE SE LÂCHE DANS LE TEXTE, à l'endroit visé.

           C'est le geste que le bouton « insérer » remplaçait mal :
           poser le curseur, descendre, cliquer, revenir. Ici on prend la
           vignette et on la pose où elle doit être. */
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(STILL_DRAG)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          /* ON VÉRIFIE LE TYPE, PAS SEULEMENT LE CONTENU. Lire
             `getData` sans regarder ce qu'on lit fait entrer n'importe
             quel glissement — un mot tiré d'une autre page, un fichier —
             et le numéro devient `NaN` : le texte reçoit un `[img:NaN]`
             que plus rien ne peut résoudre. C'est la même garde que
             `dragover` juste au-dessus, et elle doit être aux deux
             endroits : l'un décide de l'accueil, l'autre de l'effet. */
          if (!e.dataTransfer.types.includes(STILL_DRAG)) return;
          const n = Number(e.dataTransfer.getData(STILL_DRAG));
          if (!Number.isInteger(n) || n < 1) return;
          e.preventDefault();
          const at = caretFromPoint(e.clientX, e.clientY);
          if (at != null) lastCaret.current = at;
          onChange(withTokenAt(`[img:${n}]`, at ?? lastCaret.current ?? value.length));
        }}
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
