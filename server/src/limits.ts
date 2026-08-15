/* ============================================================
   CE QU'UN COMPTE PEUT OCCUPER — les plafonds, en un seul endroit
   ============================================================

   Il n'y en avait AUCUN. Le dépôt d'un média se fait par ticket signé,
   le navigateur écrit directement dans le container, et le serveur ne
   voyait donc ni le nombre ni la taille de ce qu'on lui laissait. Sur un
   classeur personnel c'est sans conséquence ; sur une adresse ouverte au
   public, une place illimitée qu'on héberge est une facture illimitée,
   et il suffit d'une personne pour la faire.

   ------------------------------------------------------------
   POURQUOI UN SEUL JEU DE CHIFFRES
   ------------------------------------------------------------

   Le produit va vers l'abonnement, donc vers des paliers. Ils
   n'existent pas encore, et inventer une table de droits avant d'avoir
   une facturation serait construire la moitié d'un mécanisme que
   personne ne peut exercer. Ces plafonds sont donc CEUX DE TOUT LE
   MONDE aujourd'hui, et le jour où un palier arrive, c'est ici qu'il
   viendra chercher ses chiffres — pas dans quinze requêtes.

   ILS SE RÈGLENT PAR L'ENVIRONNEMENT. Une instance qui héberge trois
   personnes et une qui en héberge trois mille n'ont pas la même idée de
   « raisonnable », et redéployer pour changer un nombre est le genre de
   friction qui fait qu'on ne le change jamais.

   ------------------------------------------------------------
   CE QU'ILS PROTÈGENT, ET CE QU'ILS NE TOUCHENT PAS
   ------------------------------------------------------------

   RIEN ICI NE CONCERNE LE CLASSEUR. Ranger, noter, chercher, importer,
   exporter restent sans borne et sans compte : ces plafonds bornent ce
   que le SERVEUR héberge — le miroir des médias et les décors —, ce qui
   est exactement la ligne écrite dans `CLAUDE.md`. Un classeur qui
   atteint son plafond de miroir continue entier sur la machine ; ce
   qu'il perd, c'est la copie au chaud.
   ============================================================ */

const nombre = (raw: string | undefined, defaut: number): number => {
  const n = Number((raw ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : defaut;
};

/**
 * Combien de médias privés un compte peut faire autoriser.
 *
 * DEUX MILLE, et le chiffre vient d'un usage : une collection de six
 * cents films porte six cents affiches, plus quelques captures sur les
 * fiches qu'on travaille. On borne large — le plafond est là pour
 * arrêter l'abus, pas pour gêner quelqu'un qui range.
 */
export const MEDIA_CEILING = nombre(process.env.PLAFOND_MEDIAS, 2000);

/**
 * Combien d'objets de décor un compte peut déposer.
 *
 * Beaucoup plus bas, et ce n'est pas une inégalité de traitement : un
 * décor se dessine ou s'importe un par un, à la main. Deux cents, c'est
 * déjà une armoire que personne n'a remplie.
 */
export const DECOR_CEILING = nombre(process.env.PLAFOND_DECORS, 200);

/**
 * Ce que les décors d'un compte peuvent peser en tout, en octets.
 *
 * LA TAILLE EST DÉCLARÉE PAR LE CLIENT, donc ce plafond-ci ne protège
 * pas contre quelqu'un qui ment — c'est celui du NOMBRE qui le fait,
 * puisqu'on sait compter des lignes exactement. Celui-ci attrape le cas
 * honnête et bien plus fréquent : quarante objets énormes.
 */
export const DECOR_BYTES_CEILING = nombre(process.env.PLAFOND_DECORS_OCTETS, 40 * 1024 * 1024);

/**
 * Le plafond est atteint.
 *
 * UNE ERREUR ET NON UNE VALEUR DE RETOUR, et c'est pour rester
 * cohérent : `createDecor` signalait déjà ses refus en jetant — une
 * étiquette vide, un genre inconnu — parce que ce sont des contraintes
 * du schéma. Celui-ci en est une aussi ; en faire un `null` aurait donné
 * deux façons de dire non dans la même fonction, dont une que dix
 * appelants ignorent en silence.
 *
 * `quel` nomme ce qui est plein, pour que la route puisse le dire sans
 * relire la phrase.
 */
export class QuotaReached extends Error {
  constructor(readonly quel: "medias" | "decors" | "decors-octets") {
    super("Plafond atteint.");
    this.name = "QuotaReached";
  }
}
