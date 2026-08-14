/* ============================================================
   LES TAMPONS — ce qu'on porte à côté de son nom
   ============================================================

   UN TAMPON N'EXISTE QUE LÀ OÙ DES PSEUDONYMES SE CROISENT : le fil, un
   palmarès, les scores d'un quiz, une collection partagée. C'est ce qui
   permet de les vendre sans rien retirer à personne — sans compte, il
   n'y a personne à qui les montrer, donc leur absence n'est pas une
   chose retenue, c'est une pièce où l'on n'est pas entré.

   LES MOTS SONT DANS LES CATALOGUES, pas ici. Ce fichier ne porte que
   les ENCRES, parce qu'une encre est une décision de dessin et qu'un
   libellé se traduit. Même partage que pour les peaux, dont la clé vit
   dans `theme/skins` et le nom dans `i18n`.

   L'identifiant est celui du serveur (`server/src/shop.ts`) et il est
   définitif : il est écrit dans `owned` et dans `person.stamp`. En
   renommer un reprendrait en silence une chose achetée à quelqu'un.
   ============================================================ */
import { C } from "../../theme/tokens";

/** L'encre de chaque cachet. Absent : le bordeaux, l'encre par défaut. */
export const STAMP_INK: Record<string, string> = {
  "stamp-habitue": C.burgundy,
  "stamp-noctambule": C.cobalt,
  "stamp-premiere-seance": C.ochre,
  "stamp-projectionniste": C.pine,
};

/** La clé du catalogue où le mot est écrit, dans les deux langues. */
export const stampLabel = (id: string): string => `stamps.${id.replace(/^stamp-/, "")}`;
