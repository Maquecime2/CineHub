/* ============================================================
   UNE IMAGE À REGARDER, D'OÙ QU'ELLE VIENNE
   ============================================================

   IL Y AVAIT DEUX FAÇONS DE REGARDER UNE IMAGE DANS CE PRODUIT, et rien
   ne les distinguait à l'usage. `StillsStrip` montrait VOS captures et
   `StillLightbox` les agrandissait ; `FrameStrip` montrait les plans que
   TMDB sert et redessinait sa propre visionneuse — voile, flèches,
   compteur, fermeture au clavier. Deux visionneuses à corriger au lieu
   d'une, et deux allures pour le même geste.

   CE QUI LES SÉPARAIT N'EST PAS L'AFFICHAGE, C'EST LA PROVENANCE. Une
   capture vit dans le coffre de l'appareil et se lit par sa clé ; un
   plan est une adresse que TMDB sert, en deux tailles. C'est la seule
   différence, et elle tient en une propriété — d'où cette forme, et une
   seule bande et une seule visionneuse par-dessus.

   ELLES NE DEVIENNENT PAS LA MÊME CHOSE POUR AUTANT, et `CLAUDE.md` le
   dit : `stills` sont à vous, comptent dans `MEDIA_CEILING`, se
   légendent et s'effacent ; `frames` ne coûtent rien, ne s'annotent pas
   et ne se miroitent pas. On unifie le REGARD, pas la nature.
   ============================================================ */
import type { CSSProperties } from "react";
import { IdbImage } from "./IdbImage";
import { FRAME_FULL, FRAME_THUMB } from "../../tmdb";
import type { Still } from "../../types";

export interface Shot {
  /** Clé stable pour React, et rien d'autre. */
  id: string;
  /** Une capture du coffre : sa clé. Exclusif de `path`. */
  vaultKey?: string;
  /** Un plan de TMDB : le CHEMIN, pas l'URL — les deux tailles se
      composent ici, pour que la fiche n'ait pas à être réécrite le jour
      où l'une des deux change. */
  path?: string;
  /** Ce qu'on a écrit dessus. Un plan de TMDB n'en a pas. */
  caption?: string;
}

/** Vos captures, telles que la fiche les porte. */
export const shotsOfStills = (stills: readonly Still[] = []): Shot[] =>
  stills.map((s) => ({ id: s.id, vaultKey: s.key, caption: s.caption }));

/** Les plans que TMDB sert. */
export const shotsOfFrames = (frames: readonly string[] = []): Shot[] =>
  frames.map((path) => ({ id: path, path }));

/**
 * L'image elle-même.
 *
 * `big` DÉCIDE DE LA TAILLE DEMANDÉE À TMDB, et de rien d'autre : une
 * bande tire du w300, un agrandissement du w1280. Une capture du coffre
 * ignore la question — il n'y en a qu'un exemplaire, et le redimensionner
 * à la volée coûterait plus que de le poser.
 */
export function ShotImage({
  shot,
  big,
  onBroken,
  style,
}: {
  shot: Shot;
  big?: boolean;
  /** Une adresse que TMDB ne sert plus. Voir `Plate`. */
  onBroken?: () => void;
  style?: CSSProperties;
}) {
  if (shot.vaultKey) return <IdbImage imageKey={shot.vaultKey} style={style} />;
  return (
    <img
      src={`${big ? FRAME_FULL : FRAME_THUMB}${shot.path}`}
      alt=""
      /* Une bande vaut une LISTE et non un moment : décodage différé,
         aucun filtre, aucun mélange de calques. */
      loading={big ? undefined : "lazy"}
      decoding="async"
      onError={onBroken}
      style={style}
    />
  );
}
