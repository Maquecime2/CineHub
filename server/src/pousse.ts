/* ============================================================
   LES NOTIFICATIONS POUSSÉES — une par mois, au plus
   ============================================================

   UNE SEULE RAISON DE SONNER : un défi qui commence, un défi qui
   s'achève. Pas de « quelqu'un que vous suivez a noté un film », pas de
   « revenez, votre collection vous attend ». Une application qui se
   trouve des motifs de sonner finit désinstallée, et le classeur
   deviendrait ce qu'il refuse d'être depuis le premier jour.

   ELLES SONT FACULTATIVES DE BOUT EN BOUT. Sans clés VAPID posées, ce
   module se tait, les routes répondent « pas de service », et rien
   d'autre ne change. Le serveur est déjà un confort ; ceci est un
   confort du confort.

   CE QUE LE SERVEUR PEUT ET NE PEUT PAS. Il pousse vers un point que le
   navigateur lui a donné, chiffré avec des clés que le navigateur a
   fabriquées. Il ne sait pas si le message a été lu, ni si l'appareil
   est allumé ; il apprend seulement, par un 404 ou un 410, qu'un
   abonnement est mort — et l'efface alors, plutôt que de réessayer
   jusqu'à la fin des temps.
   ============================================================ */
import webpush from "web-push";
import type { Base } from "./base.ts";
import * as depot from "./depot.ts";

export interface Vapid {
  publique: string;
  privee: string;
  /** À qui le service de push doit écrire en cas d'ennui. */
  contact: string;
}

let reglee: Vapid | null = null;

export function reglerLesPoussees(v: Vapid | null): void {
  reglee = v;
  if (v) webpush.setVapidDetails(v.contact, v.publique, v.privee);
}

export const pousseesPossibles = (): boolean => reglee !== null;
export const clePublique = (): string | null => reglee?.publique ?? null;

/**
 * Pousse un message à tous les appareils de quelqu'un.
 *
 * Rend le nombre d'appareils atteints. Les abonnements morts sont
 * effacés au passage : c'est le seul moment où l'on apprend qu'ils le
 * sont, et ne pas le faire ici les garderait pour toujours.
 */
export async function pousserA(
  base: Base,
  personneId: string,
  message: { titre: string; corps: string; url?: string }
): Promise<number> {
  if (!reglee) return 0;
  const abonnements = await depot.poussesDe(base, personneId);
  let atteints = 0;

  for (const a of abonnements) {
    try {
      await webpush.sendNotification(
        { endpoint: a.point, keys: { p256dh: a.p256dh, auth: a.secret } },
        JSON.stringify(message)
      );
      atteints += 1;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      /* 404 et 410 : ce point n'existe plus — navigateur désinstallé,
         permission retirée, abonnement expiré. Toute autre erreur est
         passagère (le service de push est en panne, le réseau est
         coupé) et ne doit surtout pas faire perdre l'abonnement. */
      if (code === 404 || code === 410) await depot.oublierPousse(base, a.point);
    }
  }
  return atteints;
}

/**
 * Le balayage quotidien : les défis qui commencent ou s'achèvent.
 *
 * Rend ce qu'il a fait, pour que l'appelant puisse le journaliser sans
 * que ce module ait à connaître un journal.
 */
export async function rappelerLesDefis(base: Base): Promise<{ dits: number; appareils: number }> {
  if (!reglee) return { dits: 0, appareils: 0 };
  let dits = 0;
  let appareils = 0;

  for (const r of await depot.rappelsDuJour(base)) {
    /* Le verrou est l'insertion, pas une vérification : deux balayages
       simultanés — un redémarrage pendant un envoi — passeraient tous
       les deux au travers d'un simple « est-ce déjà dit ? ». */
    const sujet = `epreuve:${r.epreuve_id}:${r.quand}`;
    if (!(await depot.rappelNeuf(base, r.personne_id, sujet))) continue;

    dits += 1;
    appareils += await pousserA(base, r.personne_id, {
      titre: r.quand === "debut" ? "Un défi commence" : "Dernier jour",
      corps:
        r.quand === "debut"
          ? `« ${r.titre} » démarre aujourd'hui.`
          : `« ${r.titre} » s'achève ce soir.`,
      url: "#",
    });
  }
  return { dits, appareils };
}
