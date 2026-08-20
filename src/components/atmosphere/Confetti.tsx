/* ============================================================
   LES CONFETTIS — la seule fête que ce carnet s'autorise

   Une fin de partie ne disait rien. Le chiffre tombait, la liste des
   questions ratées s'ouvrait dessous, et on lisait un constat là où il
   aurait fallu un applaudissement. C'est le seul endroit du produit qui
   demande à être bruyant ; partout ailleurs, une annotation dans la
   marge suffit.

   IL EST DANS `atmosphere/` PARCE QU'IL NE PARLE PAS. Ce dossier est
   exempté du test de littéraux (`i18n/literals.test.ts`) précisément
   pour cette raison : ce qui est ici dessine, et n'écrit jamais une
   phrase. Un confetti qui porterait un mot serait à sortir d'ici.

   LE DÉSORDRE EST SEMÉ, JAMAIS TIRÉ AU SORT. `Math.random` ferait
   retomber les morceaux ailleurs à chaque rendu de React — et il y en a
   plusieurs, puisque le tableau de la partie relit le serveur juste
   après la fin. Semés sur l'identifiant de la partie, ils tombent une
   fois et restent tombés. C'est la règle du mur d'archives, appliquée à
   quelque chose qui bouge.

   LES DURÉES VIENNENT DES JETONS, ET C'EST CE QUI ÉTEINT LA FÊTE.
   `prefers-reduced-motion` met `--motion-slow` à zéro (`theme/tokens`),
   donc l'animation atteint son dernier état — invisible — sans qu'un
   test de média soit écrit ici. Une durée à la main y échapperait.

   AUCUN `mixBlendMode`, AUCUN `filter`. C'est un MOMENT, donc les
   effets chers y seraient permis ; mais vingt-quatre éléments restent
   vingt-quatre éléments, et un fondu de mélange par morceau se paie sur
   la couche entière.
   ============================================================ */
import type { CSSProperties } from "react";
import { C } from "../../theme/tokens";
import { hash, pickFrom, seededRand } from "../../domain/seeded";

/* Six encres du thème, et pas une valeur écrite en dur : quatorze peaux
   les réécrivent, dont des sombres. Le vert et le rouge sont là comme
   couleurs, jamais comme verdict — c'est le tampon qui dit le mot. */
const INKS = [C.burgundy, C.ochre, C.pine, C.cobalt, C.plum, C.vermillion] as const;

export function Confetti({ seed, count = 24 }: { seed: string; count?: number }) {
  const base = Math.abs(hash(seed));

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        /* LA FÊTE NE PREND PAS LE CLIC. Elle est posée par-dessus le
           chiffre et les gains, qui restent sélectionnables et
           cliquables dessous. */
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const r = (n: number) => seededRand(base + i * 13 + n);
        const ink = pickFrom(INKS, base + i * 7);
        /* Un morceau sur trois est un ruban étroit, les autres des
           carrés : deux formes suffisent à ce que la chute ne se lise
           pas comme une grille. */
        const ribbon = (base + i) % 3 === 0;
        const style = {
          position: "absolute",
          left: `${(r(1) * 96).toFixed(1)}%`,
          top: `${(r(2) * 18).toFixed(1)}%`,
          width: ribbon ? 3 : 6 + Math.round(r(3) * 4),
          height: ribbon ? 11 + Math.round(r(4) * 6) : 6 + Math.round(r(3) * 4),
          background: ink,
          borderRadius: ribbon ? 1 : 0,
          opacity: 0,
          animation: `flutter calc(var(--motion-slow) * ${(6 + r(5) * 5).toFixed(1)}) var(--motion-ease) ${(r(6) * 0.5).toFixed(2)}s both`,
          /* Les quatre variables que la keyframe lit. Elles sont ici et
             non dans `tokens.ts` parce qu'elles changent d'un morceau à
             l'autre ; la forme de la chute, elle, est là-bas. */
          "--drift": `${Math.round((r(7) - 0.5) * 120)}px`,
          "--fall": `${180 + Math.round(r(8) * 160)}px`,
          "--spin-from": `${Math.round(r(9) * 90)}deg`,
          "--spin-to": `${Math.round((r(10) - 0.5) * 1400)}deg`,
        } as CSSProperties;
        return <span key={i} style={style} />;
      })}
    </div>
  );
}
