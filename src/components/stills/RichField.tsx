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
  /** Reçoit une fonction qui rend le texte augmenté d'un jeton au curseur. */
  onInsertToken?: (fn: (token: string) => string) => void;
  placeholder?: string;
  minHeight?: number;
}

/* Le champ d'écriture : on y tape normalement, et les captures insérées
   s'y affichent en vignette au milieu des phrases. Un textarea ne peut
   contenir que du texte brut — d'où un champ éditable riche, dont la
   source de vérité reste la chaîne à jetons enregistrée dans la fiche. */
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

  /* Renvoie le texte augmenté du jeton, sans rien écrire : c'est l'appelant
     qui décide quand enregistrer. Une fonction qui déclencherait elle-même
     une sauvegarde écraserait les captures enregistrées juste avant. */
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

  /* On ne réécrit le contenu que si la valeur vient d'ailleurs (insertion,
     chargement, suppression d'une capture) : réécrire à chaque frappe ferait
     sauter le curseur. */
  const lastSig = useRef("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // les URL des blobs arrivent après coup : sans les suivre, les vignettes
    // resteraient des images vides larges de quelques pixels
    const sig = (stills || []).map((s) => urls[s.key] || "").join("|");
    const textChanged = value !== lastEmitted.current;
    const urlsChanged = sig !== lastSig.current;
    if (!textChanged && !urlsChanged && el.dataset.ready === "1") return;

    // un re-rendu déplace le curseur : on note où il était pour l'y remettre
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
          // cliquer une vignette ouvre la capture, sans casser la saisie
          const n = (e.target as HTMLElement)?.dataset?.still;
          if (n) {
            e.preventDefault();
            onOpenStill(Number(n) - 1);
          }
        }}
        onPaste={(e) => {
          // le collage d'images est traité plus haut ; ici on force le texte brut
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
