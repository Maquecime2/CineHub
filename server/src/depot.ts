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

  /* Un blocage rend introuvable, dans les deux sens, et sans le dire :
     c'est le même 404 que « n'existe pas ». Annoncer « vous êtes bloqué »
     ferait de la route un moyen de vérifier qu'on l'est. */
  if (quiDemande && (await bloques(base, quiDemande, p.id))) return null;

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

/* CE QUI COUPE, ET QUI S'INTERPOSE DANS CHAQUE LECTURE COMMUNAUTAIRE.

   Écrit une fois, en fragment, et collé dans les trois requêtes qui
   font se croiser deux personnes — le profil, le fil, les avis. Un
   blocage qui n'agirait que dans un sens laisserait le bloqué continuer
   de lire : la condition regarde donc les deux sens. */
const PAS_BLOQUE = (moi: string, lui: string) =>
  `NOT EXISTS (SELECT 1 FROM blocage b
                WHERE (b.bloqueur_id = ${moi} AND b.bloque_id = ${lui})
                   OR (b.bloqueur_id = ${lui} AND b.bloque_id = ${moi}))`;

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
        AND ${PAS_BLOQUE("$1", "p.id")}
      ORDER BY f.seq DESC
      LIMIT $3`,
    [personneId, avant === null ? null : String(avant), plafond]
  );
}

/* ------------------------------------------------------------
   CE QU'ON DIT D'UNE ŒUVRE
   ------------------------------------------------------------ */

export interface Avis {
  pseudo: string;
  /** L'identifiant de la fiche chez son auteur : c'est ce qu'on signale. */
  fiche: string;
  note: number | null;
  critique: string | null;
  le: Date;
}

export interface Echo {
  /** Combien de collections publiques rangent cette œuvre. */
  collections: number;
  /** La moyenne des notes posées, ou `null` si personne n'a noté. */
  moyenne: number | null;
  notes: number;
  avis: Avis[];
}

/* UNE NOTE EST DU TEXTE TANT QU'ON NE L'A PAS REGARDÉE. Le `jsonb` vient
   de six cents clients différents, dont d'anciennes versions : `rating` y
   est un nombre, une chaîne, une chaîne vide, ou absent. Un `::numeric`
   direct fait tomber la requête ENTIÈRE sur une seule fiche mal formée —
   une moyenne qui disparaît parce qu'un inconnu a une vieille fiche.
   On filtre donc la forme avant de convertir. */
const NOTE = `CASE WHEN f.donnees->>'rating' ~ '^[0-9]+(\\.[0-9]+)?$'
                   THEN (f.donnees->>'rating')::numeric END`;

/**
 * Ce que les collections publiques disent d'une œuvre.
 *
 * LA CLÉ EST `tmdb_id`, ET C'EST LA SEULE POSSIBLE. Deux personnes qui
 * rangent le même film ont deux fiches, deux identifiants, souvent deux
 * titres — l'identité de l'œuvre ne peut venir que de la référence
 * commune. Une fiche saisie à la main, sans `tmdb_id`, ne rejoint donc
 * aucun écho : elle n'existe que chez elle, et c'est cohérent.
 *
 * `quiDemande` sert à deux choses et pas une : écarter les gens bloqués,
 * et s'écarter soi-même — lire son propre avis dans « ce que les autres
 * en pensent » donnerait une moyenne à laquelle on aurait voté deux fois.
 */
export async function echoDeLOeuvre(
  base: Base,
  tmdbId: string,
  quiDemande: string | null,
  plafond = 30
): Promise<Echo> {
  const filtre = quiDemande
    ? `AND p.id <> $2 AND ${PAS_BLOQUE("$2", "p.id")}`
    : `AND ($2::uuid IS NULL)`;
  const args = [tmdbId, quiDemande];

  const compte = await une<{ collections: string; notes: string; moyenne: string | null }>(
    base,
    `SELECT count(*)::text AS collections,
            count(${NOTE})::text AS notes,
            avg(${NOTE})::text AS moyenne
       FROM fiche f JOIN personne p ON p.id = f.personne_id
      WHERE f.tmdb_id = $1 AND p.partage = 'publique'
        AND NOT f.cachee AND NOT f.supprimee ${filtre}`,
    args
  );

  /* Seules les fiches qui DISENT quelque chose remontent : une œuvre
     rangée sans un mot ni une note compte dans le total et n'a rien à
     lire. Afficher des lignes vides ferait passer le silence pour un
     avis. */
  const avis = await base.requete<Avis>(
    `SELECT p.pseudo, f.id AS fiche, ${NOTE} AS note,
            NULLIF(f.donnees->>'review', '') AS critique, f.maj_le AS le
       FROM fiche f JOIN personne p ON p.id = f.personne_id
      WHERE f.tmdb_id = $1 AND p.partage = 'publique'
        AND NOT f.cachee AND NOT f.supprimee ${filtre}
        AND (NULLIF(f.donnees->>'review', '') IS NOT NULL OR ${NOTE} IS NOT NULL)
      ORDER BY f.maj_le DESC
      LIMIT $3`,
    [...args, plafond]
  );

  return {
    collections: Number(compte?.collections ?? 0),
    notes: Number(compte?.notes ?? 0),
    moyenne: compte?.moyenne == null ? null : Math.round(Number(compte.moyenne) * 100) / 100,
    avis: avis.map((a) => ({ ...a, note: a.note == null ? null : Number(a.note) })),
  };
}

/* ------------------------------------------------------------
   SE PROTÉGER : bloquer, signaler
   ------------------------------------------------------------ */

/** Y a-t-il un blocage entre ces deux-là, dans un sens ou dans l'autre ? */
export async function bloques(base: Base, un: string, autre: string): Promise<boolean> {
  const r = await base.requete(
    `SELECT 1 FROM blocage
      WHERE (bloqueur_id = $1 AND bloque_id = $2) OR (bloqueur_id = $2 AND bloque_id = $1)`,
    [un, autre]
  );
  return r.length > 0;
}

/**
 * Bloquer quelqu'un.
 *
 * ET DÉFAIRE LES ABONNEMENTS DES DEUX CÔTÉS, dans la foulée. Bloquer en
 * restant abonné laisserait un lien mort dans sa propre liste, et
 * surtout laisserait l'autre inscrit dans un fil qu'il ne verra plus
 * jamais bouger — un état que rien ne rattrape si l'on débloque un jour.
 */
export async function bloquer(base: Base, bloqueur: string, bloque: string): Promise<void> {
  await base.requete(
    "INSERT INTO blocage (bloqueur_id, bloque_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [bloqueur, bloque]
  );
  await base.requete(
    `DELETE FROM abonnement
      WHERE (suiveur_id = $1 AND suivi_id = $2) OR (suiveur_id = $2 AND suivi_id = $1)`,
    [bloqueur, bloque]
  );
}

export async function debloquer(base: Base, bloqueur: string, bloque: string): Promise<void> {
  await base.requete("DELETE FROM blocage WHERE bloqueur_id = $1 AND bloque_id = $2", [
    bloqueur,
    bloque,
  ]);
}

/** Qui J'AI bloqué — jamais qui m'a bloqué : cela ne se demande pas. */
export async function mesBlocages(base: Base, personneId: string): Promise<string[]> {
  const r = await base.requete<{ pseudo: string }>(
    `SELECT p.pseudo FROM blocage b JOIN personne p ON p.id = b.bloque_id
      WHERE b.bloqueur_id = $1 ORDER BY p.pseudo`,
    [personneId]
  );
  return r.map((l) => l.pseudo);
}

/**
 * Signaler quelque chose.
 *
 * Rend `false` si c'était déjà signalé par la même personne : le geste
 * est le même, et une file de modération qu'un humain devra lire ne
 * doit pas enfler à chaque clic répété.
 */
export async function signaler(
  base: Base,
  auteurId: string,
  quoi: { cibleType: string; cibleId: string; viseId: string | null; motif: string }
): Promise<boolean> {
  const r = await base.requete(
    `INSERT INTO signalement (id, auteur_id, cible_type, cible_id, vise_id, motif)
     VALUES ($1, $2, $3, $4, $5, $6)
     /* LA CLAUSE WHERE FAIT PARTIE DE LA DÉSIGNATION DE L'INDEX.
        L'index d'unicité est partiel — il ne couvre que les
        signalements dont l'auteur existe encore. Sans reprendre ici son
        prédicat, Postgres ne le reconnaît pas et refuse la requête
        entière (42P10) : ce n'est pas une optimisation, c'est la seule
        façon de nommer un index partiel. */
     ON CONFLICT (auteur_id, cible_type, cible_id) WHERE auteur_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [randomUUID(), auteurId, quoi.cibleType, quoi.cibleId, quoi.viseId, quoi.motif]
  );
  return r.length > 0;
}

/* ------------------------------------------------------------
   LES LISTES, ET LES ÉPREUVES QU'ON EN TIRE
   ------------------------------------------------------------ */

export interface Liste {
  id: string;
  titre: string;
  intention: string;
  publique: boolean;
  proprietaire: string;
  /** Combien d'œuvres. */
  oeuvres: number;
  /** Suis-je le propriétaire, et puis-je écrire dedans ? */
  mienne?: boolean;
  membre?: boolean;
}

export interface Oeuvre {
  tmdb_id: string;
  titre: string;
  annee: string | null;
  par: string | null;
}

/** Ce que quelqu'un a le droit de faire d'une liste. */
export interface Droit {
  lire: boolean;
  ecrire: boolean;
  administrer: boolean;
  proprietaire_id: string;
  liste_id: string;
}

/**
 * Les droits de quelqu'un sur une liste, en une requête.
 *
 * TROIS NIVEAUX ET NON DEUX, parce que co-construire n'est pas posséder.
 * Un membre ajoute et retire des œuvres ; il ne renomme pas la liste, ne
 * la rend pas publique et ne l'efface pas. Sans cette asymétrie, une
 * liste à six mains n'a plus personne pour en répondre.
 */
export async function droitsSurListe(
  base: Base,
  listeId: string,
  personneId: string | null
): Promise<Droit | null> {
  const l = await une<{ id: string; proprietaire_id: string; publique: boolean; membre: boolean }>(
    base,
    `SELECT l.id, l.proprietaire_id, l.publique,
            EXISTS (SELECT 1 FROM liste_membre m
                     WHERE m.liste_id = l.id AND m.personne_id = $2) AS membre
       FROM liste l WHERE l.id = $1`,
    [listeId, personneId]
  );
  if (!l) return null;
  const proprio = personneId !== null && l.proprietaire_id === personneId;
  return {
    liste_id: l.id,
    proprietaire_id: l.proprietaire_id,
    lire: l.publique || proprio || l.membre,
    ecrire: proprio || l.membre,
    administrer: proprio,
  };
}

/** Mes listes, et celles où l'on m'a laissé écrire. */
export async function mesListes(base: Base, personneId: string): Promise<Liste[]> {
  return base.requete<Liste>(
    `SELECT l.id, l.titre, l.intention, l.publique,
            p.pseudo AS proprietaire,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres,
            (l.proprietaire_id = $1) AS mienne,
            EXISTS (SELECT 1 FROM liste_membre m
                     WHERE m.liste_id = l.id AND m.personne_id = $1) AS membre
       FROM liste l JOIN personne p ON p.id = l.proprietaire_id
      WHERE l.proprietaire_id = $1
         OR EXISTS (SELECT 1 FROM liste_membre m
                     WHERE m.liste_id = l.id AND m.personne_id = $1)
      ORDER BY l.maj_le DESC`,
    [personneId]
  );
}

/** Les listes publiques de quelqu'un — ce qu'un visiteur peut en voir. */
export async function listesPubliquesDe(base: Base, proprietaireId: string): Promise<Liste[]> {
  return base.requete<Liste>(
    `SELECT l.id, l.titre, l.intention, l.publique,
            p.pseudo AS proprietaire,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres
       FROM liste l JOIN personne p ON p.id = l.proprietaire_id
      WHERE l.proprietaire_id = $1 AND l.publique
      ORDER BY l.maj_le DESC`,
    [proprietaireId]
  );
}

export async function creerListe(
  base: Base,
  proprietaireId: string,
  l: { titre: string; intention?: string; publique?: boolean }
): Promise<string> {
  const id = randomUUID();
  await base.requete(
    "INSERT INTO liste (id, proprietaire_id, titre, intention, publique) VALUES ($1, $2, $3, $4, $5)",
    [id, proprietaireId, l.titre, l.intention ?? "", l.publique ?? false]
  );
  return id;
}

export async function retoucherListe(
  base: Base,
  listeId: string,
  l: { titre?: string; intention?: string; publique?: boolean }
): Promise<void> {
  await base.requete(
    `UPDATE liste
        SET titre = coalesce($2, titre),
            intention = coalesce($3, intention),
            publique = coalesce($4, publique),
            maj_le = now()
      WHERE id = $1`,
    [listeId, l.titre ?? null, l.intention ?? null, l.publique ?? null]
  );
}

export async function effacerListe(base: Base, listeId: string): Promise<void> {
  await base.requete("DELETE FROM liste WHERE id = $1", [listeId]);
}

export async function oeuvresDe(base: Base, listeId: string): Promise<Oeuvre[]> {
  return base.requete<Oeuvre>(
    `SELECT i.tmdb_id, i.titre, i.annee, p.pseudo AS par
       FROM liste_item i LEFT JOIN personne p ON p.id = i.ajoute_par
      WHERE i.liste_id = $1
      ORDER BY i.ajoute_le`,
    [listeId]
  );
}

/** Rend `false` si l'œuvre y était déjà : le même geste, la même réponse. */
export async function ajouterALaListe(
  base: Base,
  listeId: string,
  parQui: string,
  o: { tmdbId: string; titre?: string; annee?: string | null }
): Promise<boolean> {
  const r = await base.requete(
    `INSERT INTO liste_item (liste_id, tmdb_id, titre, annee, ajoute_par)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (liste_id, tmdb_id) DO NOTHING
     RETURNING tmdb_id`,
    [listeId, o.tmdbId, o.titre ?? "", o.annee ?? null, parQui]
  );
  await base.requete("UPDATE liste SET maj_le = now() WHERE id = $1", [listeId]);
  return r.length > 0;
}

export async function retirerDeLaListe(base: Base, listeId: string, tmdbId: string): Promise<void> {
  await base.requete("DELETE FROM liste_item WHERE liste_id = $1 AND tmdb_id = $2", [
    listeId,
    tmdbId,
  ]);
  await base.requete("UPDATE liste SET maj_le = now() WHERE id = $1", [listeId]);
}

export async function membresDe(base: Base, listeId: string): Promise<string[]> {
  const r = await base.requete<{ pseudo: string }>(
    `SELECT p.pseudo FROM liste_membre m JOIN personne p ON p.id = m.personne_id
      WHERE m.liste_id = $1 ORDER BY p.pseudo`,
    [listeId]
  );
  return r.map((l) => l.pseudo);
}

export async function inviterALaListe(
  base: Base,
  listeId: string,
  personneId: string
): Promise<void> {
  await base.requete(
    "INSERT INTO liste_membre (liste_id, personne_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [listeId, personneId]
  );
}

export async function renvoyerDeLaListe(
  base: Base,
  listeId: string,
  personneId: string
): Promise<void> {
  await base.requete("DELETE FROM liste_membre WHERE liste_id = $1 AND personne_id = $2", [
    listeId,
    personneId,
  ]);
}

/* L'AVANCEMENT SE CALCULE, IL NE SE DÉCLARE PAS.

   Personne ne coche « vu » dans un défi : le classeur le sait déjà. Une
   œuvre compte quand une séance datée tombe dans la période — c'est le
   journal, celui-là même qui ne sort jamais d'une collection partagée.
   Il ne sort pas davantage ici : seul un NOMBRE en ressort, et
   seulement pour des gens qui ont demandé à participer.

   `jsonb_typeof` avant tout : `watches` traverse des clients de toutes
   les époques, et `jsonb_array_elements` sur ce qui n'est pas un
   tableau fait tomber la requête entière. Une seule vieille fiche
   suffirait alors à effacer l'avancement de tout le monde.

   `watchedAt` est le repli des fiches d'avant le journal — elles
   existent encore, et les ignorer dirait « pas vu » à quelqu'un qui a
   vu. */
const VU_PENDANT = `EXISTS (
  SELECT 1 FROM fiche f
   WHERE f.personne_id = ep.personne_id
     AND f.tmdb_id = li.tmdb_id
     AND NOT f.supprimee
     AND (
       EXISTS (
         SELECT 1 FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(f.donnees->'watches') = 'array'
                     THEN f.donnees->'watches' ELSE '[]'::jsonb END) w
          WHERE left(w->>'date', 10) BETWEEN to_char(e.debut, 'YYYY-MM-DD')
                                         AND to_char(e.fin, 'YYYY-MM-DD'))
       OR left(f.donnees->>'watchedAt', 10) BETWEEN to_char(e.debut, 'YYYY-MM-DD')
                                                AND to_char(e.fin, 'YYYY-MM-DD')
     ))`;

export interface Epreuve {
  id: string;
  titre: string;
  liste_id: string;
  liste: string;
  debut: string;
  fin: string;
  par: string | null;
  oeuvres: number;
  /** Est-ce que j'y participe ? */
  dedans?: boolean;
}

export interface Avancement {
  pseudo: string;
  faites: number;
}

/**
 * Les défis que je peux voir : les miens, ceux que j'ai rejoints, et
 * ceux bâtis sur une liste publique de quelqu'un que je suis.
 *
 * PAS D'ANNUAIRE DE DÉFIS, pour la même raison qu'il n'y a pas
 * d'annuaire de gens : une liste de tout ce qui se joue ferait de ce
 * classeur une place publique, ce qu'il n'est pas.
 */
export async function mesEpreuves(base: Base, personneId: string): Promise<Epreuve[]> {
  return base.requete<Epreuve>(
    `SELECT e.id, e.titre, e.liste_id, l.titre AS liste,
            to_char(e.debut, 'YYYY-MM-DD') AS debut,
            to_char(e.fin, 'YYYY-MM-DD') AS fin,
            p.pseudo AS par,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres,
            EXISTS (SELECT 1 FROM epreuve_participant x
                     WHERE x.epreuve_id = e.id AND x.personne_id = $1) AS dedans
       FROM epreuve e
       JOIN liste l ON l.id = e.liste_id
       LEFT JOIN personne p ON p.id = e.cree_par
      WHERE e.cree_par = $1
         OR EXISTS (SELECT 1 FROM epreuve_participant x
                     WHERE x.epreuve_id = e.id AND x.personne_id = $1)
         OR (l.publique AND EXISTS (SELECT 1 FROM abonnement a
                                     WHERE a.suiveur_id = $1 AND a.suivi_id = l.proprietaire_id)
             AND ${PAS_BLOQUE("$1", "l.proprietaire_id")})
      ORDER BY e.fin DESC`,
    [personneId]
  );
}

export async function epreuveParId(base: Base, id: string): Promise<Epreuve | null> {
  return une<Epreuve>(
    base,
    `SELECT e.id, e.titre, e.liste_id, l.titre AS liste,
            to_char(e.debut, 'YYYY-MM-DD') AS debut,
            to_char(e.fin, 'YYYY-MM-DD') AS fin,
            p.pseudo AS par,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres
       FROM epreuve e
       JOIN liste l ON l.id = e.liste_id
       LEFT JOIN personne p ON p.id = e.cree_par
      WHERE e.id = $1`,
    [id]
  );
}

export async function creerEpreuve(
  base: Base,
  parQui: string,
  e: { listeId: string; titre: string; debut: string; fin: string }
): Promise<string> {
  const id = randomUUID();
  await base.requete(
    "INSERT INTO epreuve (id, liste_id, cree_par, titre, debut, fin) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, e.listeId, parQui, e.titre, e.debut, e.fin]
  );
  /* Qui lance un défi y participe : l'inverse — un organisateur qui
     regarde les autres courir — n'est pas ce que ces gens-là font. */
  await rejoindreEpreuve(base, id, parQui);
  return id;
}

export async function effacerEpreuve(base: Base, id: string): Promise<void> {
  await base.requete("DELETE FROM epreuve WHERE id = $1", [id]);
}

export async function rejoindreEpreuve(
  base: Base,
  epreuveId: string,
  personneId: string
): Promise<void> {
  await base.requete(
    "INSERT INTO epreuve_participant (epreuve_id, personne_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [epreuveId, personneId]
  );
}

export async function quitterEpreuve(
  base: Base,
  epreuveId: string,
  personneId: string
): Promise<void> {
  await base.requete("DELETE FROM epreuve_participant WHERE epreuve_id = $1 AND personne_id = $2", [
    epreuveId,
    personneId,
  ]);
}

/** Où en est chacun — un nombre par participant, et rien de plus. */
export async function avancementDe(base: Base, epreuveId: string): Promise<Avancement[]> {
  return base.requete<Avancement>(
    `SELECT pe.pseudo,
            (SELECT count(*) FROM liste_item li
              WHERE li.liste_id = e.liste_id AND ${VU_PENDANT})::int AS faites
       FROM epreuve_participant ep
       JOIN epreuve e ON e.id = ep.epreuve_id
       JOIN personne pe ON pe.id = ep.personne_id
      WHERE ep.epreuve_id = $1
      ORDER BY 2 DESC, pe.pseudo`,
    [epreuveId]
  );
}

/** Une liste par son identifiant, sans se demander qui la lit. */
export async function listeParId(base: Base, id: string): Promise<Liste | null> {
  return une<Liste>(
    base,
    `SELECT l.id, l.titre, l.intention, l.publique, p.pseudo AS proprietaire,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres
       FROM liste l JOIN personne p ON p.id = l.proprietaire_id
      WHERE l.id = $1`,
    [id]
  );
}

/* ------------------------------------------------------------
   LA MESURE, ET CE QU'ELLE REFUSE DE SAVOIR
   ------------------------------------------------------------ */

/**
 * Compte un geste, pour la journée en cours.
 *
 * AUCUN IDENTIFIANT NE TRAVERSE CETTE FONCTION, et c'est sa signature
 * qui le garantit : elle ne prend qu'un mot. On ne peut donc pas, même
 * par distraction, lui passer un compte ou une adresse — il n'y a pas
 * de paramètre pour les recevoir.
 */
export async function compter(base: Base, geste: string): Promise<void> {
  await base.requete(
    `INSERT INTO mesure (jour, geste, n) VALUES (current_date, $1, 1)
     ON CONFLICT (jour, geste) DO UPDATE SET n = mesure.n + 1`,
    [geste]
  );
}

export async function mesures(
  base: Base,
  jours = 30
): Promise<{ jour: string; geste: string; n: string }[]> {
  return base.requete(
    `SELECT to_char(jour, 'YYYY-MM-DD') AS jour, geste, n::text
       FROM mesure WHERE jour > current_date - $1::int
      ORDER BY jour DESC, n DESC`,
    [jours]
  );
}

/* ------------------------------------------------------------
   LES NOTIFICATIONS POUSSÉES
   ------------------------------------------------------------ */

export interface Pousse {
  point: string;
  p256dh: string;
  secret: string;
  personne_id: string;
}

export async function rangerPousse(
  base: Base,
  personneId: string,
  p: { point: string; p256dh: string; secret: string }
): Promise<void> {
  /* Le même appareil qui se réabonne remplace sa ligne — et change de
     propriétaire si quelqu'un d'autre s'est connecté sur ce navigateur.
     Sans cela, un ordinateur partagé pousserait les rappels d'une
     personne à une autre. */
  await base.requete(
    `INSERT INTO pousse (point, personne_id, p256dh, secret) VALUES ($1, $2, $3, $4)
     ON CONFLICT (point) DO UPDATE
        SET personne_id = EXCLUDED.personne_id,
            p256dh = EXCLUDED.p256dh,
            secret = EXCLUDED.secret`,
    [p.point, personneId, p.p256dh, p.secret]
  );
}

export async function oublierPousse(base: Base, point: string): Promise<void> {
  await base.requete("DELETE FROM pousse WHERE point = $1", [point]);
}

export async function poussesDe(base: Base, personneId: string): Promise<Pousse[]> {
  return base.requete<Pousse>(
    "SELECT point, p256dh, secret, personne_id FROM pousse WHERE personne_id = $1",
    [personneId]
  );
}

/**
 * Note qu'un rappel a été dit, et rend `false` s'il l'avait déjà été.
 *
 * L'INSERTION EST LE VERROU. Vérifier puis écrire laisserait deux
 * balayages simultanés — un redémarrage pendant un envoi — passer tous
 * les deux. Une notification en double est la façon la plus rapide de
 * faire couper les notifications.
 */
export async function rappelNeuf(base: Base, personneId: string, sujet: string): Promise<boolean> {
  const r = await base.requete(
    `INSERT INTO rappel_envoye (personne_id, sujet) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING sujet`,
    [personneId, sujet]
  );
  return r.length > 0;
}

/**
 * Les défis qui commencent ou s'achèvent aujourd'hui, et qui y participe.
 *
 * C'est le SEUL prétexte à notification de tout ce serveur. Il n'y en
 * aura pas d'autre sans une bonne raison : une application qui trouve
 * des motifs de sonner finit désinstallée.
 */
export async function rappelsDuJour(
  base: Base
): Promise<{ epreuve_id: string; titre: string; personne_id: string; quand: string }[]> {
  return base.requete(
    `SELECT e.id AS epreuve_id, e.titre, ep.personne_id,
            CASE WHEN e.debut = current_date THEN 'debut' ELSE 'fin' END AS quand
       FROM epreuve e JOIN epreuve_participant ep ON ep.epreuve_id = e.id
      WHERE e.debut = current_date OR e.fin = current_date`
  );
}
