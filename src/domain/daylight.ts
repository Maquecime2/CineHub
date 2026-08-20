/* ============================================================
   LA LUMIÈRE DE L'HEURE — ce qui fait qu'une pièce n'est pas une image

   Le bois d'une étagère ne renvoie pas la même lumière à neuf heures et
   à vingt-deux. C'est le genre de fait qu'on ne remarque jamais et dont
   l'absence se remarque : une planche éclairée identiquement à toute
   heure se lit comme un décor imprimé, ce que le projet refuse déjà
   ailleurs (« un mur qui gigote n'est pas un mur », et son symétrique).

   IL REND UNE CLÉ ET UN NOMBRE, JAMAIS UNE PHRASE — la règle de
   `shelfReading`. La clé sert à qui veut le DIRE, la chaleur à qui veut
   le DESSINER, et aucune des deux n'est du français.

   `now` EST UN PARAMÈTRE, comme dans `patina.ts` : la moitié de ce que
   ce module calcule est une heure, et sans l'argument il serait
   intestable.

   IL PARLE DE LA PIÈCE, PAS D'UN OBJET. C'est ce qui l'autorise à être
   partout à la fois sans contredire « si chaque boîtier porte une
   marque, aucun n'est marqué » : une lumière qui ne toucherait qu'un
   rayon sur deux ne serait pas une lumière.
   ============================================================ */

/**
 * QUATRE MOMENTS, ET CELUI DU MILIEU NE DESSINE RIEN.
 *
 * - `dawn` — le matin, froid et bas.
 * - `day` — le plein jour. **Le cas ordinaire**, et il est plat.
 * - `dusk` — le couchant, tiède et rasant.
 * - `night` — la lampe, chaude et proche.
 */
export type LightKey = "dawn" | "day" | "dusk" | "night";

export interface Daylight {
  /** Le QUAND. Une clé, jamais une phrase — l'écran la met en mots. */
  key: LightKey;
  /**
   * De -1 (froid) à 1 (chaud), 0 à midi. Le dessin n'a besoin que de
   * cela : le SIGNE choisit l'encre, la VALEUR ABSOLUE son opacité. Deux
   * champs — une teinte et une force — auraient laissé écrire une teinte
   * froide avec une force de couchant.
   */
  warmth: number;
}

/** Le moment du jour, et sa chaleur. */
export function lightOf(now: number = Date.now()): Daylight {
  const h = new Date(now).getHours();
  if (h < 5) return { key: "night", warmth: 0.55 };
  if (h < 9) return { key: "dawn", warmth: -0.7 };
  if (h < 12) return { key: "dawn", warmth: -0.35 };
  if (h < 17) return { key: "day", warmth: 0 };
  if (h < 20) return { key: "dusk", warmth: 0.7 };
  if (h < 23) return { key: "dusk", warmth: 0.4 };
  return { key: "night", warmth: 0.55 };
}
