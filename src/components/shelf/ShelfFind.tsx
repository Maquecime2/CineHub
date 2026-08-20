/* ============================================================
   CHERCHER SUR L'ÉTAGÈRE — dire COMBIEN, et mener JUSQUE-LÀ

   Sur l'étagère, chercher ne filtre pas : ça TERNIT. La décision est
   juste et on n'y touche pas — retirer les fiches qui ne répondent pas
   démonterait le rangement à chaque lettre tapée, et rendrait les lignes
   absurdes.

   Mais elle s'arrêtait là. On tapait un titre, quatre cents boîtiers
   pâlissaient, et RIEN ne disait combien on avait trouvé ni où c'était.
   Une recherche sans résultat se lisait exactement comme une recherche
   réussie hors de l'écran : tout ternit, rien ne répond. C'est-à-dire
   comme une panne.

   Trois choses, donc, et aucune ne touche au ternissement : le compte,
   annoncé ; le compte PAR RAYON, que le bandeau de chaque ligne porte
   déjà (`domain/shelfReading`) ; et de quoi aller au suivant.

   ON NE TIENT AUCUNE LISTE. Le prochain boîtier se cherche dans le
   DOCUMENT, par `data-shelf-item` — l'attribut que le glissement pose
   déjà pour savoir ce qu'il vise. C'est le seul endroit où l'ordre à
   l'écran est vrai : une liste tenue à côté aurait doublé le rangement
   et se serait décalée au premier déplacement.
   ============================================================ */
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";

/* Un défilement est un DÉPLACEMENT et non une décoration : il a lieu
   quoi qu'il arrive, comme le défilement automatique du glissement s'en
   explique déjà. C'est sa DOUCEUR qui est une animation, et elle seule
   se retire. */
const gently = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? ("auto" as const)
    : ("smooth" as const);

export function ShelfFind({ matching }: { matching: Set<string> | null }) {
  const { t } = useTranslation();
  /* Où l'on en est dans le tour des trouvés. Un `ref` et non un état :
     personne ne le lit à l'écran, et le poser en état redessinerait la
     colonne de vue à chaque saut. */
  const at = useRef(0);

  /* On ne cherche rien : il n'y a rien à annoncer, et une ligne vide en
     permanence à côté du champ serait un mot de plus à ignorer. */
  if (!matching) return null;

  const count = matching.size;

  const jump = () => {
    const found = [...document.querySelectorAll<HTMLElement>("[data-shelf-item]")].filter((node) =>
      matching.has(node.dataset.shelfItem || "")
    );
    if (found.length === 0) return;
    at.current = at.current % found.length;
    const node = found[at.current];
    at.current = (at.current + 1) % found.length;
    if (!node) return;
    node.scrollIntoView({ behavior: gently(), block: "center", inline: "center" });
    /* On retire la marque avant de la reposer : rejouer une animation
       CSS demande que l'attribut parte et revienne, sinon un second clic
       sur le même boîtier ne montrerait rien. */
    node.removeAttribute("data-found-flash");
    void node.offsetWidth;
    node.setAttribute("data-found-flash", "");
  };

  return (
    <div
      data-tour="shelf-find"
      style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 22 }}
    >
      {/* IL S'ANNONCE, parce qu'un compte qui change en silence pendant
          qu'on tape ne se lit pas au clavier. */}
      <span
        role="status"
        aria-live="polite"
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          letterSpacing: 0.5,
          color: count > 0 ? C.ink : C.inkFaded,
        }}
      >
        {count > 0 ? t("shelf.find.count", { count }) : t("shelf.find.none")}
      </span>
      {count > 0 && (
        <button
          onClick={jump}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            fontFamily: F.mono,
            fontSize: 9,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: C.inkFaded,
            borderBottom: `1px dashed ${C.line}`,
          }}
        >
          {t("shelf.find.next")}
        </button>
      )}
    </div>
  );
}
