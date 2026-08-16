import { useEffect, useRef } from "react";
import { ruledTextarea } from "../../theme/styles";
import { C, alpha } from "../../theme/tokens";
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

  /* OÙ EST LE CURSEUR, EN CARACTÈRES DU TEXTE SÉRIALISÉ.

     ON MESURE CE QUI PRÉCÈDE, on ne cherche plus un point d'arrêt.

     La version d'avant passait `{node, offset}` à `htmlToText`, qui ne
     s'arrête QUE sur un nœud de texte. Or un champ éditable ancre très
     souvent la sélection sur l'ÉLÉMENT — après une image, en fin de
     ligne, sur une ligne vide — avec un décalage qui est un indice
     d'enfant et non une position dans une chaîne. Le parcours ne
     rencontrait alors jamais son arrêt, allait jusqu'au bout, et rendait
     la longueur TOTALE : la vignette se posait à la fin du texte, quoi
     qu'on ait visé.

     C'est aussi ce qui rendait le défaut si difficile à croire, et une
     épreuve avait beau exister, elle plaçait un `Range` sur un nœud de
     texte — le seul cas qui marchait.

     Cloner ce qui précède et le sérialiser répond pour TOUS les
     ancrages, parce que la question posée au navigateur devient « que
     contient l'intervalle » plutôt que « où t'arrêtes-tu ». */
  const caretNow = (): number | null => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount) return null;
    const at = sel.getRangeAt(0);
    if (!el.contains(at.startContainer)) return null;
    const before = document.createRange();
    before.setStart(el, 0);
    before.setEnd(at.startContainer, at.startOffset);
    const holder = document.createElement("div");
    holder.appendChild(before.cloneContents());
    return htmlToText(holder).length;
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

  /* OÙ L'ON SURVOLE, en `Range`.

     `caretPositionFromPoint` est la façon moderne, `caretRangeFromPoint`
     celle de WebKit ; aucune des deux n'est partout, d'où les deux. */
  const rangeFromPoint = (x: number, y: number): Range | null => {
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
      const range = document.createRange();
      range.setStart(spot.offsetNode, spot.offset);
      range.collapse(true);
      return range;
    }
    const got = doc.caretRangeFromPoint?.(x, y);
    return got?.startContainer && el.contains(got.startContainer) ? got : null;
  };

  /* LE REPÈRE DE DÉPÔT, ÉCRIT À LA MAIN PLUTÔT QUE RENDU.

     Un `setState` par mouvement de souris pendant un glissement
     redessinerait le champ entier trente fois par seconde, et le champ
     contient des images. C'est la règle de l'étagère, pour la même
     raison. */
  const markRef = useRef<HTMLDivElement | null>(null);

  const hideMark = () => {
    if (markRef.current) markRef.current.style.display = "none";
  };

  const showMark = (x: number, y: number) => {
    const el = ref.current;
    const mark = markRef.current;
    if (!el || !mark) return;
    const range = rangeFromPoint(x, y);
    if (!range) return hideMark();
    const at = range.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    mark.style.display = "block";
    mark.style.left = `${at.left - box.left + el.scrollLeft}px`;
    mark.style.top = `${at.top - box.top + el.scrollTop}px`;
    mark.style.height = `${at.height || parseFloat(getComputedStyle(el).lineHeight) || 18}px`;
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
      <div style={{ position: "relative" }}>
        <div
          ref={markRef}
          aria-hidden
          style={{
            position: "absolute",
            display: "none",
            width: 2,
            background: C.burgundy,
            boxShadow: `0 0 0 1px ${alpha(C.burgundy, 0.35)}`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
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
          /* ON MONTRE OÙ L'IMAGE VA TOMBER.

           Déplacer une vignette DANS le texte est un geste du navigateur
           — le champ est éditable, il sait le faire, et `onInput` remet
           le texte à jour derrière. Ce qu'il ne fait pas lisiblement,
           c'est DIRE où le lâcher va poser l'image : le curseur natif
           est un trait d'un pixel qu'on ne voit pas au milieu d'une
           phrase, et on lâche à l'aveugle.

           On dessine donc le nôtre, et on le retire dès que le geste
           finit. Il ne participe à rien : c'est un repère, et le dépôt
           reste celui du navigateur. */
          onDragOver={(e) => showMark(e.clientX, e.clientY)}
          onDragLeave={hideMark}
          onDrop={hideMark}
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
    </div>
  );
}
