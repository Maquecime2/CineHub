/* ============================================================
   LE SERVEUR — ce qu'il accepte de faire, et rien de plus
   ============================================================

   Squelette : les comptes par clé d'accès, une session, et deux routes
   de collection qui prouvent la chaîne de bout en bout. Le reste du
   communautaire (profils, abonnements, avis, listes) viendra dessus,
   sur ce socle-là.

   CE QUI EST DÉJÀ LÀ ALORS QUE RIEN NE L'EXIGE : la limitation de
   débit, l'export et l'effacement de compte. Ce ne sont pas des
   fonctions à ajouter plus tard — ce sont des propriétés qu'on n'ajoute
   jamais si elles ne sont pas là au premier jour.
   ============================================================ */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Base } from "./base.ts";
import * as depot from "./depot.ts";
import { poserLesRelais } from "./relais.ts";

export interface Reglages {
  base: Base;
  /** Le domaine que les clés d'accès signeront. `localhost` en développement. */
  domaine: string;
  /** L'origine exacte du client — une clé signée pour une autre ne vaut rien. */
  origine: string;
  /** Cookies `Secure` : faux en développement, où il n'y a pas de HTTPS. */
  securise?: boolean;
  /**
   * La clé TMDB, si l'on en a une de ce côté-ci.
   *
   * Absente, le relais répond « pas de service » et le classeur continue
   * d'utiliser celle que la personne a saisie chez elle. C'est
   * volontairement dégradable : le serveur est un confort, pas une
   * condition d'usage.
   */
  cleTmdb?: string;
}

const COOKIE = "session";

/* Le pseudonyme est une adresse publique autant qu'un nom : il vivra
   dans l'URL d'une collection partagée. On refuse donc ici ce que le
   schéma refuse aussi, pour répondre par une phrase plutôt que par une
   erreur de base de données. */
const PSEUDO_OK = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export async function construireApp(reglages: Reglages): Promise<FastifyInstance> {
  const { base, domaine, origine } = reglages;
  const app = Fastify({ logger: false });

  await app.register(cookie);
  await app.register(cors, {
    origin: origine,
    /* Sans cela le navigateur n'enverrait pas le cookie de session : une
       requête d'une origine à l'autre est anonyme par défaut. */
    credentials: true,
  });
  /* CENT REQUÊTES PAR MINUTE ET PAR ADRESSE. Ce n'est pas contre une
     attaque sérieuse — il faudrait un pare-feu devant — mais contre la
     boucle d'un client mal réglé, qui coûte le même argent. */
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  /** Qui parle ? `null` si personne. */
  const quiEst = async (req: FastifyRequest) => {
    const secret = req.cookies[COOKIE];
    if (!secret) return null;
    return depot.personneDeSession(base, secret);
  };

  /** Les routes qui exigent un compte passent par ici. */
  const exigerUnCompte = async (req: FastifyRequest) => {
    const personne = await quiEst(req);
    if (!personne) {
      const e = new Error("il faut être connecté") as Error & { statusCode?: number };
      e.statusCode = 401;
      throw e;
    }
    return personne;
  };

  /* ------------------------------------------------------------
     S'INSCRIRE — première clé d'accès
     ------------------------------------------------------------ */

  app.post("/auth/inscription/options", async (req, reply) => {
    const { pseudo } = (req.body ?? {}) as { pseudo?: string };
    const nom = (pseudo || "").trim().toLowerCase();
    if (!PSEUDO_OK.test(nom)) {
      return reply.code(400).send({
        erreur: "Un pseudonyme de 3 à 30 caractères : lettres sans accent, chiffres, tirets.",
      });
    }
    if (await depot.trouverParPseudo(base, nom)) {
      return reply.code(409).send({ erreur: "Ce pseudonyme est déjà pris." });
    }

    const options = await generateRegistrationOptions({
      rpName: "Ciné Hub",
      rpID: domaine,
      userName: nom,
      /* PAS DE CLÉ RÉSIDENTE IMPOSÉE, mais préférée : c'est elle qui
         permet de se connecter sans taper son pseudonyme. « Preferred »
         plutôt que « required » pour ne pas fermer la porte aux
         authentificateurs qui n'en font pas. */
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      attestationType: "none",
    });

    const defi = await depot.poserDefi(base, options.challenge, { pseudo: nom });
    return { defi, options };
  });

  app.post("/auth/inscription/verification", async (req, reply) => {
    const { defi, reponse } = (req.body ?? {}) as { defi?: string; reponse?: unknown };
    const attendu = defi ? await depot.consommerDefi(base, defi) : null;
    if (!attendu?.pseudo) return reply.code(400).send({ erreur: "Défi inconnu ou expiré." });

    const v = await verifyRegistrationResponse({
      response: reponse as never,
      expectedChallenge: attendu.valeur,
      expectedOrigin: origine,
      expectedRPID: domaine,
    });
    if (!v.verified || !v.registrationInfo) {
      return reply.code(400).send({ erreur: "Cette clé n'a pas pu être vérifiée." });
    }

    /* La course entre deux inscriptions du même pseudonyme se joue ici :
       c'est la contrainte d'unicité de la base qui tranche, pas notre
       vérification d'il y a trois lignes. */
    let personne;
    try {
      personne = await depot.creerPersonne(base, attendu.pseudo);
    } catch {
      return reply.code(409).send({ erreur: "Ce pseudonyme est déjà pris." });
    }

    const { credential } = v.registrationInfo;
    await depot.ajouterCle(base, {
      id: credential.id,
      personneId: personne.id,
      clePublique: credential.publicKey,
      compteur: credential.counter,
      transports: credential.transports ?? [],
    });

    await poserLeCookie(reply, await depot.ouvrirSession(base, personne.id));
    return { personne };
  });

  /* ------------------------------------------------------------
     SE CONNECTER
     ------------------------------------------------------------ */

  app.post("/auth/connexion/options", async (req) => {
    const { pseudo } = (req.body ?? {}) as { pseudo?: string };
    const nom = (pseudo || "").trim().toLowerCase();
    const personne = nom ? await depot.trouverParPseudo(base, nom) : null;

    /* UN PSEUDONYME INCONNU REÇOIT LA MÊME RÉPONSE QU'UN CONNU. Répondre
       « ce compte n'existe pas » ferait de cette route un annuaire :
       n'importe qui pourrait savoir qui est inscrit. On propose donc la
       cérémonie dans tous les cas, et c'est la signature qui échouera. */
    const cles = personne ? await depot.clesDe(base, personne.id) : [];
    const options = await generateAuthenticationOptions({
      rpID: domaine,
      allowCredentials: cles.map((c) => ({ id: c.id, transports: c.transports as never })),
      userVerification: "preferred",
    });

    const defi = await depot.poserDefi(base, options.challenge, {
      personneId: personne?.id,
    });
    return { defi, options };
  });

  app.post("/auth/connexion/verification", async (req, reply) => {
    const { defi, reponse } = (req.body ?? {}) as { defi?: string; reponse?: { id?: string } };
    const attendu = defi ? await depot.consommerDefi(base, defi) : null;
    if (!attendu) return reply.code(400).send({ erreur: "Défi inconnu ou expiré." });

    const cle = reponse?.id ? await depot.cleParId(base, reponse.id) : null;
    if (!cle) return reply.code(401).send({ erreur: "Clé inconnue." });

    const v = await verifyAuthenticationResponse({
      response: reponse as never,
      expectedChallenge: attendu.valeur,
      expectedOrigin: origine,
      expectedRPID: domaine,
      credential: {
        id: cle.id,
        publicKey: new Uint8Array(cle.cle_publique),
        counter: Number(cle.compteur),
        transports: cle.transports as never,
      },
    });
    if (!v.verified) return reply.code(401).send({ erreur: "Signature refusée." });

    await depot.noterUsage(base, cle.id, v.authenticationInfo.newCounter);
    const personne = await depot.trouverParId(base, cle.personne_id);
    if (!personne) return reply.code(401).send({ erreur: "Compte introuvable." });

    await poserLeCookie(reply, await depot.ouvrirSession(base, personne.id));
    return { personne };
  });

  /* ------------------------------------------------------------
     LA SESSION
     ------------------------------------------------------------ */

  app.get("/moi", async (req, reply) => {
    const personne = await quiEst(req);
    if (!personne) return reply.code(401).send({ erreur: "Personne." });
    return { personne, fiches: await depot.compterFiches(base, personne.id) };
  });

  app.post("/deconnexion", async (req, reply) => {
    const secret = req.cookies[COOKIE];
    if (secret) await depot.fermerSession(base, secret);
    reply.clearCookie(COOKIE, { path: "/" });
    return { fait: true };
  });

  /* ------------------------------------------------------------
     LA COLLECTION — la chaîne, prouvée de bout en bout
     ------------------------------------------------------------
     Ce n'est pas encore la synchronisation : c'est le couple de routes
     sur lequel elle s'écrira. Pousser ce qui a changé, tirer ce qui a
     changé depuis une date — le reste (file d'attente, fusion des
     journaux) est du travail de client. */

  app.get("/collection", async (req, reply) => {
    const personne = await exigerUnCompte(req);
    const { depuis } = req.query as { depuis?: string };
    const date = depuis ? new Date(Number(depuis) || Date.parse(depuis)) : new Date(0);
    if (Number.isNaN(date.getTime())) {
      return reply.code(400).send({ erreur: "Date de départ illisible." });
    }
    const fiches = await depot.fichesDepuis(base, personne.id, date);
    return {
      /* L'horloge du SERVEUR, et non celle du client : c'est elle qui
         ordonne les versions, et deux téléphones ne sont jamais à
         l'heure ensemble. */
      jusqua: Date.now(),
      fiches: fiches.map((f) => ({
        id: f.id,
        tmdbId: f.tmdb_id,
        visibilite: f.visibilite,
        supprimee: f.supprimee,
        majLe: new Date(f.maj_le).getTime(),
        donnees: f.donnees,
      })),
    };
  });

  app.put("/collection", async (req, reply) => {
    const personne = await exigerUnCompte(req);
    const { fiches } = (req.body ?? {}) as { fiches?: unknown };
    if (!Array.isArray(fiches)) {
      return reply.code(400).send({ erreur: "Il faut un tableau de fiches." });
    }
    /* UN PLAFOND, PARCE QU'UN CORPS SANS PLAFOND EST UNE PANNE QUI
       ATTEND. Une collection entière se pousse en plusieurs paquets. */
    if (fiches.length > 500) {
      return reply.code(413).send({ erreur: "Cinq cents fiches par envoi au plus." });
    }

    /* TROIS COMPTES ET NON UN SEUL, PARCE QUE « RANGÉES » MENTAIT.
       La réponse annonçait le nombre de fiches REÇUES, alors que la
       base en refuse silencieusement une partie — celles qu'un appareil
       en retard pousse par-dessus une version plus fraîche. Un client
       qui vide sa file d'attente sur la foi de ce compte croirait avoir
       envoyé ce qui a été écarté. La distinction ne coûte rien
       aujourd'hui et sera tout demain, quand la synchronisation lira
       cette réponse pour décider quoi oublier. */
    let rangees = 0;
    let perimees = 0;
    let illisibles = 0;
    for (const f of fiches as Record<string, unknown>[]) {
      const id = typeof f.id === "string" ? f.id : null;
      const majLe = Number(f.majLe);
      if (!id || !Number.isFinite(majLe)) {
        illisibles += 1;
        continue;
      }
      const ecrite = await depot.rangerFiche(base, personne.id, {
        id,
        tmdbId: f.tmdbId == null ? null : String(f.tmdbId),
        visibilite: typeof f.visibilite === "string" ? f.visibilite : "privee",
        donnees: f.donnees ?? {},
        majLe: new Date(majLe),
        supprimee: f.supprimee === true,
      });
      if (ecrite) rangees += 1;
      else perimees += 1;
    }
    return { rangees, perimees, illisibles, jusqua: Date.now() };
  });

  /* ------------------------------------------------------------
     CE QUI EST À SOI, ET LE DROIT DE PARTIR
     ------------------------------------------------------------ */

  app.get("/mes-donnees", async (req) => {
    const personne = await exigerUnCompte(req);
    /* Tout ce que le serveur détient de quelqu'un, dans un seul objet :
       c'est ce que le règlement appelle la portabilité, et c'est surtout
       la moindre des choses. */
    return {
      personne,
      fiches: await depot.fichesDepuis(base, personne.id, new Date(0)),
    };
  });

  app.delete("/mon-compte", async (req, reply) => {
    const personne = await exigerUnCompte(req);
    await depot.effacerPersonne(base, personne.id);
    reply.clearCookie(COOKIE, { path: "/" });
    return { efface: true };
  });

  app.get("/sante", async () => ({ debout: true }));

  /* ------------------------------------------------------------
     LES RELAIS — la clé TMDB quitte le bundle
     ------------------------------------------------------------ */
  poserLesRelais(app, { cleTmdb: reglages.cleTmdb, exigerUnCompte });

  /* ------------------------------------------------------------
     LE BALAYAGE
     ------------------------------------------------------------
     Un défi expiré ne sert plus à rien et ne se consomme jamais : sans
     balayage, la table grossit d'une ligne morte par cérémonie
     abandonnée, indéfiniment. Toutes les heures suffit largement — la
     validité d'un défi ne dépend pas de ce ménage, elle est vérifiée à
     l'usage (`expire_le > now()`). Ceci n'est qu'une question de place.

     `unref()` : ce minuteur ne doit pas retenir le processus en vie au
     moment de s'arrêter, sinon `npm run dev` refuse de rendre la main. */
  const balai = setInterval(
    () => {
      depot.balayerDefis(base).catch(() => {});
    },
    60 * 60 * 1000
  );
  balai.unref();
  app.addHook("onClose", async () => clearInterval(balai));

  function poserLeCookie(reply: FastifyReply, secret: string) {
    reply.setCookie(COOKIE, secret, {
      path: "/",
      httpOnly: true,
      /* `lax` et non `strict` : le classeur reviendra d'un lien de
         partage, et `strict` couperait la session à ce moment-là. */
      sameSite: "lax",
      secure: reglages.securise ?? false,
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return app;
}
