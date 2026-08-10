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
  return une<Personne>(base, "SELECT id, pseudo, courriel FROM personne WHERE pseudo = $1", [
    pseudo,
  ]);
}

export async function trouverParId(base: Base, id: string): Promise<Personne | null> {
  return une<Personne>(base, "SELECT id, pseudo, courriel FROM personne WHERE id = $1", [id]);
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
    `SELECT p.id, p.pseudo, p.courriel
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
  visibilite: string;
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
    `SELECT id, seq, tmdb_id, visibilite, donnees, maj_le, supprimee
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
    visibilite?: string;
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
    `INSERT INTO fiche (personne_id, id, tmdb_id, visibilite, donnees, maj_le, supprimee)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     ON CONFLICT (personne_id, id) DO UPDATE
        SET tmdb_id = EXCLUDED.tmdb_id,
            visibilite = EXCLUDED.visibilite,
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
      f.visibilite ?? "privee",
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
