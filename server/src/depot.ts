/* ============================================================
   LE DÉPÔT — les seules questions que le serveur pose à la base
   ============================================================

   Toutes les requêtes vivent ici, et nulle part ailleurs. Une route qui
   écrirait son SQL dans son gestionnaire ferait perdre la seule chose
   qu'on gagne à les rassembler : pouvoir relire, en une page, tout ce
   que le serveur sait faire des données de quelqu'un.
   ============================================================ */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Base } from "./base.ts";
import { une } from "./base.ts";

export interface Personne {
  id: string;
  pseudo: string;
  courriel: string | null;
  partage?: string;
  jeton?: string | null;
}

export interface CleAcces {
  id: string;
  personne_id: string;
  cle_publique: Uint8Array;
  compteur: string | number;
  transports: string[];
}

/* ------------------------------------------------------------
   LES PERSONNES
   ------------------------------------------------------------ */

export async function trouverParPseudo(base: Base, pseudo: string): Promise<Personne | null> {
  return une<Personne>(
    base,
    "SELECT id, pseudo, courriel, partage, jeton FROM personne WHERE pseudo = $1",
    [pseudo]
  );
}

export async function trouverParId(base: Base, id: string): Promise<Personne | null> {
  return une<Personne>(
    base,
    "SELECT id, pseudo, courriel, partage, jeton FROM personne WHERE id = $1",
    [id]
  );
}

export async function creerPersonne(base: Base, pseudo: string): Promise<Personne> {
  const p = await une<Personne>(
    base,
    "INSERT INTO personne (id, pseudo) VALUES ($1, $2) RETURNING id, pseudo, courriel",
    [randomUUID(), pseudo]
  );
  if (!p) throw new Error("personne non créée");
  return p;
}

/** Le droit à l'effacement, en une ligne : le schéma emporte le reste. */
export async function effacerPersonne(base: Base, id: string): Promise<void> {
  await base.requete("DELETE FROM personne WHERE id = $1", [id]);
}

/* ------------------------------------------------------------
   LES CLÉS D'ACCÈS
   ------------------------------------------------------------ */

export async function clesDe(base: Base, personneId: string): Promise<CleAcces[]> {
  return base.requete<CleAcces>(
    "SELECT id, personne_id, cle_publique, compteur, transports FROM cle_acces WHERE personne_id = $1",
    [personneId]
  );
}

export async function cleParId(base: Base, id: string): Promise<CleAcces | null> {
  return une<CleAcces>(
    base,
    "SELECT id, personne_id, cle_publique, compteur, transports FROM cle_acces WHERE id = $1",
    [id]
  );
}

export async function ajouterCle(
  base: Base,
  cle: {
    id: string;
    personneId: string;
    clePublique: Uint8Array;
    compteur: number;
    transports: string[];
  }
): Promise<void> {
  await base.requete(
    `INSERT INTO cle_acces (id, personne_id, cle_publique, compteur, transports)
     VALUES ($1, $2, $3, $4, $5)`,
    [cle.id, cle.personneId, Buffer.from(cle.clePublique), cle.compteur, cle.transports]
  );
}

export async function noterUsage(base: Base, id: string, compteur: number): Promise<void> {
  await base.requete("UPDATE cle_acces SET compteur = $2, vue_le = now() WHERE id = $1", [
    id,
    compteur,
  ]);
}

/* ------------------------------------------------------------
   LES DÉFIS
   ------------------------------------------------------------
   Le hasard d'une cérémonie WebAuthn. Il vit quelques minutes et se
   consomme en UNE fois : le relire après usage doit échouer, sinon une
   signature interceptée pourrait resservir. */

const VIE_DEFI_MS = 5 * 60 * 1000;

export async function poserDefi(
  base: Base,
  valeur: string,
  quoi: { personneId?: string; pseudo?: string } = {}
): Promise<string> {
  const id = randomUUID();
  await base.requete(
    "INSERT INTO defi (id, valeur, personne_id, pseudo, expire_le) VALUES ($1, $2, $3, $4, $5)",
    [id, valeur, quoi.personneId ?? null, quoi.pseudo ?? null, new Date(Date.now() + VIE_DEFI_MS)]
  );
  return id;
}

export async function consommerDefi(
  base: Base,
  id: string
): Promise<{ valeur: string; personne_id: string | null; pseudo: string | null } | null> {
  /* Lecture et suppression dans la MÊME requête : entre un SELECT et un
     DELETE séparés, deux requêtes simultanées peuvent consommer le même
     défi. `DELETE … RETURNING` ne laisse pas cet intervalle. */
  return une(
    base,
    "DELETE FROM defi WHERE id = $1 AND expire_le > now() RETURNING valeur, personne_id, pseudo",
    [id]
  );
}

export async function balayerDefis(base: Base): Promise<void> {
  await base.requete("DELETE FROM defi WHERE expire_le <= now()");
}

/* ------------------------------------------------------------
   LES SESSIONS
   ------------------------------------------------------------ */

const VIE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/* LE COOKIE PORTE UN SECRET, LA BASE N'EN GARDE QUE L'EMPREINTE.
   Une fuite de la table des sessions ne donne alors aucune session
   utilisable : c'est le raisonnement des mots de passe, appliqué à ce
   qui les remplace. SHA-256 suffit ici et un algorithme lent serait un
   contresens — le secret fait 256 bits de hasard, il ne se devine pas. */
export const empreinteDe = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex");

export async function ouvrirSession(base: Base, personneId: string): Promise<string> {
  const secret = randomBytes(32).toString("base64url");
  await base.requete(
    "INSERT INTO session (empreinte, personne_id, expire_le) VALUES ($1, $2, $3)",
    [empreinteDe(secret), personneId, new Date(Date.now() + VIE_SESSION_MS)]
  );
  return secret;
}

export async function personneDeSession(base: Base, secret: string): Promise<Personne | null> {
  return une<Personne>(
    base,
    `SELECT p.id, p.pseudo, p.courriel, p.partage, p.jeton
       FROM session s JOIN personne p ON p.id = s.personne_id
      WHERE s.empreinte = $1 AND s.expire_le > now()`,
    [empreinteDe(secret)]
  );
}

export async function fermerSession(base: Base, secret: string): Promise<void> {
  await base.requete("DELETE FROM session WHERE empreinte = $1", [empreinteDe(secret)]);
}

/* ------------------------------------------------------------
   LES FICHES
   ------------------------------------------------------------ */

export interface FicheRangee {
  id: string;
  seq: string | number;
  tmdb_id: string | null;
  cachee: boolean;
  donnees: Record<string, unknown>;
  maj_le: Date;
  supprimee: boolean;
}

/**
 * Ce qui a bougé depuis un rang, dans l'ordre d'arrivée au serveur.
 *
 * PAS DEPUIS UNE DATE : les dates viennent des clients, dont les
 * horloges divergent. Un appareil en retard rangerait ses fiches
 * « avant » le curseur des autres, qui ne les verraient jamais. Le rang,
 * lui, est donné par le serveur et ne recule pas.
 *
 * Le plafond est là parce qu'une première synchronisation peut ramener
 * une collection entière : mieux vaut plusieurs pages qu'une réponse de
 * trente mégaoctets qui expire en chemin.
 */
export async function fichesDepuis(
  base: Base,
  personneId: string,
  depuis: bigint | number,
  plafond = 500
): Promise<FicheRangee[]> {
  return base.requete<FicheRangee>(
    `SELECT id, seq, tmdb_id, cachee, donnees, maj_le, supprimee
       FROM fiche WHERE personne_id = $1 AND seq > $2
      ORDER BY seq ASC LIMIT $3`,
    [personneId, String(depuis), plafond]
  );
}

/**
 * Range une fiche venue d'un appareil.
 *
 * LE DERNIER ÉCRIVAIN GAGNE, ET C'EST LA BASE QUI EN DÉCIDE. La clause
 * `WHERE fiche.maj_le < EXCLUDED.maj_le` refuse une version plus
 * ancienne que celle déjà rangée : deux appareils qui poussent en même
 * temps ne peuvent pas se doubler, quel que soit l'ordre d'arrivée.
 * Arbitrer côté serveur en lisant puis en écrivant laisserait
 * exactement cet intervalle-là.
 */
export async function rangerFiche(
  base: Base,
  personneId: string,
  f: {
    id: string;
    tmdbId?: string | null;
    cachee?: boolean;
    donnees: unknown;
    majLe: Date;
    supprimee?: boolean;
  }
): Promise<boolean> {
  /* `RETURNING` ne rend une ligne QUE si l'insertion ou la mise à jour a
     eu lieu : quand la clause `WHERE` écarte une version périmée, il ne
     rend rien. C'est ainsi que l'appelant apprend qu'il a poussé dans le
     vide — sans seconde requête, et sans intervalle entre les deux. */
  const ecrite = await base.requete(
    /* ON PASSE L'OBJET, JAMAIS SA SÉRIALISATION, et ce n'est pas un
       détail de style.

       Le pilote de production sérialise LUI-MÊME ce qui va dans une
       colonne `jsonb`. Lui donner une chaîne déjà sérialisée la fait
       sérialiser une seconde fois : la fiche est rangée comme une
       CHAÎNE JSON et non comme un objet, `donnees->>'title'` ne trouve
       plus rien, et tout ce qui la relit reçoit du texte. La conversion
       explicite n'y change rien — mesuré sur les deux moteurs.

       Le Postgres des tests, lui, accepte les deux formes sans broncher.
       Le défaut était donc invisible en test et systématique en vrai :
       la seule espèce qu'une suite verte ne rattrape jamais. Il a fallu
       pousser une fiche dans un vrai Postgres pour le voir. */
    `INSERT INTO fiche (personne_id, id, tmdb_id, cachee, donnees, maj_le, supprimee)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     ON CONFLICT (personne_id, id) DO UPDATE
        SET tmdb_id = EXCLUDED.tmdb_id,
            cachee = EXCLUDED.cachee,
            donnees = EXCLUDED.donnees,
            maj_le = EXCLUDED.maj_le,
            supprimee = EXCLUDED.supprimee,
            /* UN RANG NEUF À CHAQUE ÉCRITURE, sans quoi la fiche
               modifiée garderait sa place dans la file et les autres
               appareils, déjà passés par là, ne la reverraient jamais. */
            seq = nextval('fiche_seq')
      WHERE fiche.maj_le < EXCLUDED.maj_le
     RETURNING seq`,
    [
      personneId,
      f.id,
      f.tmdbId ?? null,
      f.cachee ?? false,
      f.donnees,
      f.majLe,
      f.supprimee ?? false,
    ]
  );
  return ecrite.length > 0;
}

export async function compterFiches(base: Base, personneId: string): Promise<number> {
  const r = await une<{ n: string }>(
    base,
    "SELECT count(*)::text AS n FROM fiche WHERE personne_id = $1 AND NOT supprimee",
    [personneId]
  );
  return Number(r?.n ?? 0);
}

/* ------------------------------------------------------------
   LES DOCUMENTS — le reste du classeur
   ------------------------------------------------------------
   Mêmes règles que les fiches, à la lettre : rang du serveur pour
   l'ordre, date du client pour l'arbitrage, et le refus d'une version
   périmée écrit dans la requête plutôt que dans la route. */

export interface DocRange {
  cle: string;
  seq: string | number;
  contenu: unknown;
  maj_le: Date;
  supprime: boolean;
}

export async function docsDepuis(
  base: Base,
  personneId: string,
  depuis: bigint | number,
  plafond = 200
): Promise<DocRange[]> {
  return base.requete<DocRange>(
    `SELECT cle, seq, contenu, maj_le, supprime
       FROM doc WHERE personne_id = $1 AND seq > $2
      ORDER BY seq ASC LIMIT $3`,
    [personneId, String(depuis), plafond]
  );
}

export async function rangerDoc(
  base: Base,
  personneId: string,
  d: { cle: string; contenu: unknown; majLe: Date; supprime?: boolean }
): Promise<boolean> {
  const ecrit = await base.requete(
    `INSERT INTO doc (personne_id, cle, contenu, maj_le, supprime)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (personne_id, cle) DO UPDATE
        SET contenu = EXCLUDED.contenu,
            maj_le = EXCLUDED.maj_le,
            supprime = EXCLUDED.supprime,
            seq = nextval('doc_seq')
      WHERE doc.maj_le < EXCLUDED.maj_le
     RETURNING seq`,
    [personneId, d.cle, d.contenu, d.majLe, d.supprime ?? false]
  );
  return ecrit.length > 0;
}

/* ------------------------------------------------------------
   PARTAGER SA COLLECTION
   ------------------------------------------------------------ */

export async function reglerLePartage(
  base: Base,
  personneId: string,
  partage: string,
  jeton: string | null
): Promise<void> {
  await base.requete("UPDATE personne SET partage = $2, jeton = $3 WHERE id = $1", [
    personneId,
    partage,
    jeton,
  ]);
}

/* CE QUI NE SORT JAMAIS, ÉCARTÉ ICI ET PAS AILLEURS.

   Les notes sont un carnet intime, et le journal des séances un relevé
   de présence : ni l'un ni l'autre n'a affaire au visiteur. Ils sont
   retirés dans la REQUÊTE, par soustraction sur le `jsonb`, et non dans
   la route.

   La différence n'est pas théorique. Une route qui filtre est une route
   qu'on duplique un jour pour un autre besoin, en oubliant la moitié du
   filtre ; une soustraction écrite dans la seule requête qui sert le
   public ne s'oublie pas — il n'y a rien d'autre à appeler. */
const SANS_LE_PRIVE = `f.donnees - 'notes' - 'watches' - 'watchedAt' AS donnees`;

export interface FichePublique {
  id: string;
  tmdb_id: string | null;
  donnees: Record<string, unknown>;
}

/**
 * La collection d'une personne, vue du dehors.
 *
 * `null` si elle ne partage pas, ou si le jeton ne correspond pas. Le
 * même `null` dans les deux cas : dire « ce compte existe mais ne
 * partage pas » renseignerait sur qui est inscrit.
 */
export async function collectionPubliqueDe(
  base: Base,
  pseudo: string,
  jeton: string | null
): Promise<{ pseudo: string; films: FichePublique[] } | null> {
  const p = await trouverParPseudo(base, pseudo);
  if (!p) return null;
  if (p.partage === "publique") {
    /* rien à vérifier */
  } else if (p.partage === "lien") {
    if (!jeton || !p.jeton || jeton !== p.jeton) return null;
  } else {
    return null;
  }

  const films = await base.requete<FichePublique>(
    `SELECT f.id, f.tmdb_id, ${SANS_LE_PRIVE}
       FROM fiche f
      WHERE f.personne_id = $1 AND NOT f.cachee AND NOT f.supprimee
      ORDER BY f.maj_le DESC`,
    [p.id]
  );
  return { pseudo: p.pseudo, films };
}

/** Retirer une fiche du partage, ou l'y remettre. */
export async function cacherFiche(
  base: Base,
  personneId: string,
  ficheId: string,
  cachee: boolean
): Promise<boolean> {
  const r = await base.requete(
    `UPDATE fiche SET cachee = $3, seq = nextval('fiche_seq')
      WHERE personne_id = $1 AND id = $2 RETURNING seq`,
    [personneId, ficheId, cachee]
  );
  return r.length > 0;
}

/* ------------------------------------------------------------
   SUIVRE, ET LE FIL
   ------------------------------------------------------------ */

export interface Profil {
  pseudo: string;
  /** Combien de films sa collection montre. */
  films: number;
  /** Est-ce que je le suis déjà ? */
  suivi?: boolean;
}

/**
 * Le profil de quelqu'un — et il n'existe QUE s'il se montre.
 *
 * On ne peut donc trouver que des gens qui ont choisi d'être
 * trouvables : pas d'annuaire, pas de liste, et un pseudonyme deviné au
 * hasard ne dit rien de plus qu'un pseudonyme inventé. Le partage par
 * lien n'ouvre pas de profil : un lien se donne à quelqu'un, il ne rend
 * pas public.
 */
export async function profilPublicDe(
  base: Base,
  pseudo: string,
  quiDemande?: string
): Promise<Profil | null> {
  const p = await trouverParPseudo(base, pseudo);
  if (!p || p.partage !== "publique") return null;

  const n = await une<{ n: string }>(
    base,
    "SELECT count(*)::text AS n FROM fiche WHERE personne_id = $1 AND NOT cachee AND NOT supprimee",
    [p.id]
  );
  const suivi = quiDemande
    ? (
        await base.requete("SELECT 1 FROM abonnement WHERE suiveur_id = $1 AND suivi_id = $2", [
          quiDemande,
          p.id,
        ])
      ).length > 0
    : undefined;

  return { pseudo: p.pseudo, films: Number(n?.n ?? 0), suivi };
}

export async function suivre(base: Base, suiveur: string, suivi: string): Promise<void> {
  /* `ON CONFLICT DO NOTHING` : suivre deux fois est le même geste, et
     doit répondre la même chose. */
  await base.requete(
    "INSERT INTO abonnement (suiveur_id, suivi_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [suiveur, suivi]
  );
}

export async function nePlusSuivre(base: Base, suiveur: string, suivi: string): Promise<void> {
  await base.requete("DELETE FROM abonnement WHERE suiveur_id = $1 AND suivi_id = $2", [
    suiveur,
    suivi,
  ]);
}

/** Qui je suis, avec ce que leur collection montre encore. */
export async function abonnementsDe(base: Base, personneId: string): Promise<Profil[]> {
  return base.requete<Profil>(
    `SELECT p.pseudo,
            (SELECT count(*) FROM fiche f
              WHERE f.personne_id = p.id AND NOT f.cachee AND NOT f.supprimee)::int AS films,
            (p.partage = 'publique') AS ouverte
       FROM abonnement a JOIN personne p ON p.id = a.suivi_id
      WHERE a.suiveur_id = $1
      ORDER BY p.pseudo`,
    [personneId]
  );
}

export interface Nouvelle {
  pseudo: string;
  seq: string | number;
  id: string;
  tmdb_id: string | null;
  donnees: Record<string, unknown>;
  maj_le: Date;
}

/**
 * Le fil : ce que les gens suivis ont touché récemment.
 *
 * CE QU'IL DIT, ET CE QU'IL NE PRÉTEND PAS DIRE. Le serveur ne garde
 * aucune histoire : il sait qu'une fiche a bougé, pas ce qui a changé
 * dedans. Le fil montre donc des films récemment touchés, avec la note
 * et la critique du moment — et n'écrit jamais « a noté 4 étoiles »,
 * ce qu'il serait incapable de prouver.
 *
 * Il se calcule à la lecture, sans table de fil. Pour quelques dizaines
 * d'abonnements, l'index `fiche_suite` suffit largement ; le jour où il
 * ne suffira plus, ce sera un vrai problème d'échelle, et pas avant.
 */
export async function filDe(
  base: Base,
  personneId: string,
  avant: bigint | number | null,
  plafond = 40
): Promise<Nouvelle[]> {
  return base.requete<Nouvelle>(
    `SELECT p.pseudo, f.seq, f.id, f.tmdb_id, ${SANS_LE_PRIVE}, f.maj_le
       FROM abonnement a
       JOIN personne p ON p.id = a.suivi_id
       JOIN fiche f ON f.personne_id = p.id
      WHERE a.suiveur_id = $1
        AND p.partage = 'publique'
        AND NOT f.cachee AND NOT f.supprimee
        AND ($2::bigint IS NULL OR f.seq < $2::bigint)
      ORDER BY f.seq DESC
      LIMIT $3`,
    [personneId, avant === null ? null : String(avant), plafond]
  );
}
