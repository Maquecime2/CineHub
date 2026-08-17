/* ============================================================
   COMBIEN DE TEMPS ÇA A PRIS
   ============================================================

   UNE DURÉE SE LIT, ELLE NE SE COMPTE PAS. « 3601 secondes » demande un
   calcul mental à qui veut savoir s'il a mis une heure ; « 1 h 00 » se
   lit. C'est la seule raison d'être de ce fichier.

   IL EST PUR, ET IL EST ICI PLUTÔT QUE DANS LA VUE parce que ses cas
   limites sont exactement ceux qu'on n'essaie jamais à la main : la
   seconde pile, la minute pile, l'heure pile, et le zéro. Un formateur
   écrit dans un composant est un formateur qu'on ne teste pas.

   IL NE TRADUIT RIEN. Les unités sont des symboles — `s`, `min`, `h` —
   et non des mots : les trois se lisent dans les deux langues du
   classeur, et une durée qui traverserait le catalogue coûterait trois
   clés pour ne rien apprendre à personne. */

/**
 * Une durée en secondes, telle qu'on la dit.
 *
 * Sous la minute, des secondes. Sous l'heure, des minutes et des
 * secondes. Au-delà, des heures et des minutes — et PLUS de secondes :
 * à ce niveau-là elles ne distinguent plus rien et allongent la ligne.
 *
 * Une valeur absente, négative ou aberrante rend une chaîne vide plutôt
 * que « NaN » ou « -3 s ». Une horloge qui recule — le serveur redémarre,
 * un fuseau change — ne doit pas écrire une absurdité sur un tableau des
 * scores.
 */
export const elapsed = (seconds: number | null | undefined): string => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "";
  const whole = Math.floor(seconds);
  if (whole < 60) return `${whole} s`;

  const minutes = Math.floor(whole / 60);
  if (minutes < 60) {
    const rest = whole % 60;
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  /* Les minutes sur deux chiffres : « 1 h 05 » et non « 1 h 5 », qui se
     lit une seconde de trop. */
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
};
