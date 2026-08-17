/* ============================================================
   LA MAIN, OU LA MACHINE
   ============================================================

   Deux cent trois endroits de l'application écrivent en `F.hand`, et le
   reproche fait à la cursive est juste : jolie sur une ligne, elle est
   LENTE À LIRE dans un bloc de texte et dans un sous-titre de neuf
   pixels. Mais elle est aussi ce qui distingue ce classeur d'une
   application ordinaire, et on ne tranche pas cela à l'aveugle.

   D'OÙ UN RÉGLAGE, ET NON UNE DÉCISION. Il tient en une variable :
   `--f-hand` est lue par les deux cent trois endroits, donc la basculer
   les change TOUS sans qu'un seul fichier de vue soit touché. C'est
   exactement ce que la couche de jetons promettait, et la première
   occasion de s'en servir.

   IL VIT À CÔTÉ DE LA PEAU ET NON DEDANS. Une peau choisit sa cursive
   parmi les siennes ; ce réglage-ci dit si l'on veut une cursive DU
   TOUT. Les ranger ensemble aurait obligé à réécrire dix-sept peaux pour
   ajouter un choix qui n'en concerne aucune, et à recommencer à la
   dix-huitième. `skinVars` le consulte, ce qui suffit : changer de peau
   ou changer d'avis repasse par le même endroit. */

export const HAND_KEY = "site-hand";

/** `plume` : la cursive de la peau. `plain` : la police de labeur. */
export type Hand = "plume" | "plain";

export const HANDS: Hand[] = ["plume", "plain"];

const isHand = (v: unknown): v is Hand => v === "plume" || v === "plain";

/* La plume est le défaut : c'est ce que le classeur a toujours été, et
   un réglage neuf ne change pas l'aspect de qui ne l'a pas demandé. */
let current: Hand = "plume";

try {
  const kept = localStorage.getItem(HAND_KEY);
  if (isHand(kept)) current = kept;
} catch {
  /* Un stockage refusé — navigation privée, réglage du navigateur — ne
     doit pas empêcher l'application de s'afficher. On garde le défaut. */
}

export const readHand = (): Hand => current;

/* ------------------------------------------------------------
   S'ABONNER, POUR QUE LE SÉLECTEUR SE VOIE CHANGER
   ------------------------------------------------------------
   Le reste de l'application n'a rien à écouter : les variables CSS
   descendent toutes seules. Seul le bouton qui porte le choix a besoin
   de se redessiner, et `useSyncExternalStore` veut un abonnement. */
const listeners = new Set<() => void>();

export const watchHand = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function setHand(next: Hand): void {
  if (!isHand(next) || next === current) return;
  current = next;
  try {
    localStorage.setItem(HAND_KEY, next);
  } catch {
    /* Le choix vaut pour cette session, faute de mieux. */
  }
  for (const fn of listeners) fn();
}
