/* ============================================================
   LES FAITS QUE SEUL L'ÉDITEUR CONNAÎT
   ============================================================

   Les mentions légales nomment une personne ou une société réelle, avec
   une adresse et un contact réels. Rien de tout cela ne se devine, et
   inventer un éditeur plausible serait pire que ne rien écrire : ça
   donnerait à la page l'apparence d'être en règle.

   CE FICHIER EST DONC À REMPLIR, une fois, avant d'ouvrir l'adresse au
   public. Tant qu'un champ vaut `""`, le panneau affiche « à compléter »
   à sa place plutôt qu'une ligne vide — un trou qui se voit est un trou
   qu'on bouche.

   POURQUOI PAS DANS LE CATALOGUE DE TRADUCTION : ces valeurs ne se
   traduisent pas. Une raison sociale et une adresse sont les mêmes dans
   les deux langues, et les recopier dans `fr` et dans `en` garantirait
   qu'une des deux finisse périmée.
   ============================================================ */

export interface Operator {
  /** Raison sociale, ou prénom et nom si l'éditeur est une personne. */
  name: string;
  /** Statut : « auto-entrepreneur », « SASU », « particulier »… */
  status: string;
  /** Adresse postale complète, en une ligne. */
  address: string;
  /** Une adresse de courriel à laquelle on répond vraiment. */
  contact: string;
  /** Identifiant d'entreprise, s'il y en a un. Vide pour un particulier. */
  registration: string;
  /** Qui héberge le site et le serveur, avec son adresse. */
  host: string;
}

export const OPERATOR: Operator = {
  name: "",
  status: "",
  address: "",
  contact: "",
  registration: "",
  host: "",
};

/** Depuis quand la version affichée des conditions est en vigueur. */
export const TERMS_SINCE = "2026-08-15";

/**
 * L'éditeur s'est-il nommé ?
 *
 * SERT À NE PAS MENTIR PAR OMISSION. Sans ces champs, le panneau se
 * montre quand même — il porte la politique de confidentialité, qui est
 * vraie de toute façon — mais il dit en tête qu'il est incomplet, au
 * lieu de laisser croire le contraire.
 */
export const operatorNamed = (): boolean =>
  OPERATOR.name.trim() !== "" && OPERATOR.contact.trim() !== "";

/** Ce qu'on affiche à la place d'un champ vide. */
export const orBlank = (value: string, blank: string): string =>
  value.trim() === "" ? blank : value.trim();
