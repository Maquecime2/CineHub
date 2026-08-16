/* ============================================================
   L'ANNOTATION — ce qu'on écrit dans la marge quand c'est fait
   ============================================================

   IL N'Y AVAIT AUCUN RETOUR APRÈS UNE ACTION, et c'est le manque le plus
   répandu du produit. Un import qui se termine, une sauvegarde écrite,
   un film ajouté depuis le bureau des découvertes, une note prise, un
   abonnement : rien ne le disait, ou bien un `msg` local dans un coin
   du fichier concerné, différent partout.

   CE N'EST PAS UNE BULLE DE MATÉRIAU, et c'est la seule contrainte de
   dessin qui compte ici. Un rectangle sombre à coins arrondis qui glisse
   depuis un bord est le vocabulaire d'un autre produit ; celui-ci est un
   carnet. On écrit donc À LA MAIN, dans la marge, sur un bout de papier
   qui penche — et l'inclinaison est SEMÉE par le texte, jamais tirée au
   sort, sinon la même phrase pencherait autrement à chaque fois.

   IL N'Y EN A JAMAIS DEUX. Le même arbitrage que les cartes basses de
   `Installation` : une annotation remplace la précédente au lieu de
   s'empiler. Une pile de messages est une pile qu'on ne lit pas.

   ELLE PASSE PAR `<Layer>`. Elle est en `position: fixed`, et elle est
   demandée depuis n'importe quelle vue : rendue dans la colonne, elle
   s'ancrerait sur la colonne — qui porte une transformation pendant son
   animation d'entrée — au lieu de la fenêtre.

   ET ELLE EST ANNONCÉE. `role="status"` avec `aria-live="polite"` :
   « c'est enregistré » est exactement le genre de phrase qu'on ne voit
   pas quand on ne regarde pas l'écran.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { C, F, alpha } from "../../theme/tokens";
import { tiltOf } from "../../domain/seeded";
import { Layer } from "./Layer";

/** Combien de temps une annotation reste avant de s'effacer. */
const LIFE_MS = 3200;

type Say = (text: string) => void;

const Channel = createContext<Say>(() => {});

/**
 * Dire quelque chose, de n'importe où.
 *
 * Rend une fonction stable : on peut la mettre dans les dépendances d'un
 * effet sans le relancer à chaque rendu.
 */
export const useSay = (): Say => useContext(Channel);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [note, setNote] = useState<{ text: string; at: number } | null>(null);

  /* `at` fait partie de l'état pour que DEUX FOIS LA MÊME PHRASE se
     voie deux fois. Sans lui, « enregistré » suivi de « enregistré »
     n'aurait rien changé du tout, et le second geste aurait eu l'air de
     n'avoir rien fait. */
  const say = useCallback<Say>((text) => {
    if (text) setNote({ text, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!note) return;
    const gone = setTimeout(() => setNote(null), LIFE_MS);
    return () => clearTimeout(gone);
  }, [note]);

  const channel = useMemo(() => say, [say]);

  return (
    <Channel.Provider value={channel}>
      {children}
      {note && (
        <Layer>
          <div
            role="status"
            aria-live="polite"
            key={note.at}
            style={{
              position: "fixed",
              /* AU-DESSUS DE LA BARRE DU BAS DU TÉLÉPHONE, sous la
                 modale : elle accompagne, elle n'interrompt pas. Le
                 budget de `z-index` est dans CLAUDE.md. */
              zIndex: 48,
              right: 18,
              bottom: "calc(18px + env(safe-area-inset-bottom, 0px) + 58px)",
              maxWidth: "min(320px, calc(100vw - 36px))",
              padding: "9px 14px 10px",
              background: C.paper,
              border: `1px solid ${C.line}`,
              borderLeft: `3px solid ${C.pine}`,
              boxShadow: "2px 4px 14px rgba(20,14,8,0.28)",
              transform: `rotate(${tiltOf(note.text)}deg)`,
              fontFamily: F.hand,
              fontSize: 17,
              lineHeight: 1.25,
              color: C.ink,
              animation: "sheetIn var(--motion-slow) var(--motion-ease) backwards",
              pointerEvents: "none",
            }}
          >
            {/* Le trait de soulignement d'une note prise vite. */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 4,
                height: 1,
                background: alpha(C.pine, 0.35),
              }}
            />
            {note.text}
          </div>
        </Layer>
      )}
    </Channel.Provider>
  );
}
