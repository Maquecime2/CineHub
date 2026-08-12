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
import { randomBytes } from "node:crypto";
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
import type { Db } from "./db.ts";
import * as store from "./store.ts";
import { registerRelays } from "./relay.ts";
import { publicKeyForPush, pushAvailable, remindChallenges } from "./push.ts";

export interface Settings {
  db: Db;
  /** Le domaine que les clés d'accès signeront. `localhost` en développement. */
  domain: string;
  /**
   * Les origines du client, séparées par des virgules.
   *
   * PLUSIEURS, PARCE QU'IL Y EN A PLUSIEURS EN VRAI : le serveur de
   * développement (5173) et l'aperçu de la version construite (4173)
   * ne sont pas la même origine, et l'on veut essayer la PWA contre le
   * même serveur. La PREMIÈRE sert de référence aux clés d'accès —
   * une clé signée pour une origine ne vaut rien sur une autre.
   */
  origin: string;
  /** Cookies `Secure` : faux en développement, où il n'y a pas de HTTPS. */
  secure?: boolean;
  /**
   * La clé TMDB, si l'on en a une de ce côté-ci.
   *
   * Absente, le relais répond « pas de service » et le classeur continue
   * d'utiliser celle que la personne a saisie chez elle. C'est
   * volontairement dégradable : le serveur est un confort, pas une
   * condition d'usage.
   */
  tmdbKey?: string;
  /**
   * Requêtes TMDB par minute et par adresse, pour le relais seul.
   *
   * Le plafond général du serveur — cent par minute — vise les routes
   * qui écrivent. Le relais, lui, sert un travail long et légitime :
   * remplir trois cents fiches en demande trois cents. Voir
   * `PLAFOND_TMDB_DEFAUT` dans `relais.ts`.
   */
  tmdbCeiling?: number;
  /**
   * Ouvre `POST /dev/session`, qui crée un compte et une session sans
   * clé d'accès. Jamais vrai en production — voir `index.ts`.
   */
  devDoor?: boolean;
}

const COOKIE = "session";

/* Le pseudonyme est une adresse publique autant qu'un nom : il vivra
   dans l'URL d'une collection partagée. On refuse donc ici ce que le
   schéma refuse aussi, pour répondre par une phrase plutôt que par une
   erreur de base de données. */
const PSEUDO_OK = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/* Les listes et les défis sont nommés par le SERVEUR, en UUID : une
   route qui passerait n'importe quel texte à une colonne `uuid` répond
   500 sur une adresse mal tapée, là où 404 est la vérité. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export async function buildApp(reglages: Settings): Promise<FastifyInstance> {
  const { db, domain, origin } = reglages;
  const app = Fastify({ logger: false });

  /* UN CORPS VIDE N'EST PAS UN CORPS ILLISIBLE.

     Par défaut, Fastify refuse en 400 toute requête annonçant du JSON
     sans rien envoyer. Or un client qui pose un `content-type` sur tous
     ses appels — ce qui est la chose normale à faire — envoie
     exactement cela quand la route ne demande aucune donnée. La
     déconnexion échouait donc en silence : le navigateur croyait avoir
     fermé la session, le serveur la gardait ouverte.

     Le défaut a survécu à quarante tests parce qu'`inject`, sans charge
     utile, n'annonce pas de `content-type` : la question qui échouait
     n'était jamais posée. */
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, corps, fait) => {
    try {
      fait(null, corps ? JSON.parse(corps as string) : {});
    } catch {
      fait(new Error("JSON illisible"), undefined);
    }
  });

  await app.register(cookie);
  const origins = origin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: origins,
    /* Sans cela le navigateur n'enverrait pas le cookie de session : une
       requête d'une origine à l'autre est anonyme par défaut. */
    credentials: true,
    /* LES MÉTHODES S'ÉNUMÈRENT, ET L'OUBLI NE SE VOIT PAS EN TEST.
       Par défaut, le préflet n'autorise que GET, HEAD et POST : le
       navigateur refusait donc le PUT de la collection AVANT de
       l'envoyer, et le serveur n'en voyait pas la trace. Les tests non
       plus — `inject` appelle la route directement, sans préflet, donc
       sans jamais poser la question qui échouait. */
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    /* UN EN-TÊTE QU'ON N'EXPOSE PAS EST UN EN-TÊTE QU'ON N'ENVOIE PAS.

       Sur une requête d'une origine à l'autre, le navigateur ne laisse
       lire au JavaScript qu'une poignée d'en-têtes ; tous les autres
       sont là, dans la réponse, et `headers.get()` rend `null`. Le
       serveur répondait donc « réessaie dans 47 secondes » à un client
       qui ne pouvait pas l'entendre, et qui retentait au bout d'une —
       trois fois, dans la même fenêtre, pour se faire refuser trois
       fois. Le rythme d'attente était écrit des deux côtés et ne
       traversait pas. */
    exposedHeaders: ["retry-after"],
  });
  /* CENT REQUÊTES PAR MINUTE ET PAR ADRESSE. Ce n'est pas contre une
     attaque sérieuse — il faudrait un pare-feu devant — mais contre la
     boucle d'un client mal réglé, qui coûte le même argent. */
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  /* ------------------------------------------------------------
     LA MESURE D'USAGE — ce qu'elle refuse de savoir la définit
     ------------------------------------------------------------
     Un compteur par JOUR et par GESTE. Pas d'identifiant de personne,
     pas d'adresse, pas de navigateur, pas d'heure : rien qui permette
     de recomposer la journée de quelqu'un.

     Le geste est la MÉTHODE et le CHEMIN DE ROUTE — `GET /listes/:id`
     et non `GET /listes/97703c16-…`. L'URL réelle porte des
     identifiants ; le chemin de route, non. Compter l'une pour l'autre
     aurait fabriqué exactement le registre qu'on refuse de tenir.

     Ce compteur est délibérément aveugle à « combien de personnes » :
     y répondre demanderait ce qu'on ne garde pas. C'est le prix, et il
     est payé sciemment. */
  app.addHook("onResponse", async (req, reply) => {
    const chemin = req.routeOptions?.url;
    if (!chemin) return;
    /* Une écriture par requête serait payer la mesure plus cher que le
       service. Les échecs ne comptent pas non plus : ce sont des
       incidents, et le journal du serveur est là pour eux. */
    if (reply.statusCode >= 400) return;
    store.countGesture(db, `${req.method} ${chemin}`).catch(() => {});
  });

  /** Qui parle ? `null` si personne. */
  const whoIs = async (req: FastifyRequest) => {
    const secret = req.cookies[COOKIE];
    if (!secret) return null;
    return store.personOfSession(db, secret);
  };

  /** Les routes qui exigent un compte passent par ici. */
  const requireAccount = async (req: FastifyRequest) => {
    const personne = await whoIs(req);
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
    if (await store.findByPseudo(db, nom)) {
      return reply.code(409).send({ erreur: "Ce pseudonyme est déjà pris." });
    }

    const options = await generateRegistrationOptions({
      rpName: "Ciné Hub",
      rpID: domain,
      userName: nom,
      /* PAS DE CLÉ RÉSIDENTE IMPOSÉE, mais préférée : c'est elle qui
         permet de se connecter sans taper son pseudonyme. « Preferred »
         plutôt que « required » pour ne pas fermer la porte aux
         authentificateurs qui n'en font pas. */
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      attestationType: "none",
    });

    const defi = await store.setChallenge(db, options.challenge, { pseudo: nom });
    return { defi, options };
  });

  app.post("/auth/inscription/verification", async (req, reply) => {
    const { defi, reponse } = (req.body ?? {}) as { defi?: string; reponse?: unknown };
    const attendu = defi ? await store.consumeChallenge(db, defi) : null;
    if (!attendu?.pseudo) return reply.code(400).send({ erreur: "Défi inconnu ou expiré." });

    const v = await verifyRegistrationResponse({
      response: reponse as never,
      expectedChallenge: attendu.valeur,
      expectedOrigin: origins,
      expectedRPID: domain,
    });
    if (!v.verified || !v.registrationInfo) {
      return reply.code(400).send({ erreur: "Cette clé n'a pas pu être vérifiée." });
    }

    /* La course entre deux inscriptions du même pseudonyme se joue ici :
       c'est la contrainte d'unicité de la base qui tranche, pas notre
       vérification d'il y a trois lignes. */
    let personne;
    try {
      personne = await store.createPerson(db, attendu.pseudo);
    } catch {
      return reply.code(409).send({ erreur: "Ce pseudonyme est déjà pris." });
    }

    const { credential } = v.registrationInfo;
    await store.addKey(db, {
      id: credential.id,
      personneId: personne.id,
      publicKey: credential.publicKey,
      compteur: credential.counter,
      transports: credential.transports ?? [],
    });

    await setCookie(reply, await store.openSession(db, personne.id));
    return { personne };
  });

  /* ------------------------------------------------------------
     SE CONNECTER
     ------------------------------------------------------------ */

  app.post("/auth/connexion/options", async (req) => {
    const { pseudo } = (req.body ?? {}) as { pseudo?: string };
    const nom = (pseudo || "").trim().toLowerCase();
    const personne = nom ? await store.findByPseudo(db, nom) : null;

    /* UN PSEUDONYME INCONNU REÇOIT LA MÊME RÉPONSE QU'UN CONNU. Répondre
       « ce compte n'existe pas » ferait de cette route un annuaire :
       n'importe qui pourrait savoir qui est inscrit. On propose donc la
       cérémonie dans tous les cas, et c'est la signature qui échouera. */
    const cles = personne ? await store.keysOf(db, personne.id) : [];
    const options = await generateAuthenticationOptions({
      rpID: domain,
      allowCredentials: cles.map((c) => ({ id: c.id, transports: c.transports as never })),
      userVerification: "preferred",
    });

    const defi = await store.setChallenge(db, options.challenge, {
      personneId: personne?.id,
    });
    return { defi, options };
  });

  app.post("/auth/connexion/verification", async (req, reply) => {
    const { defi, reponse } = (req.body ?? {}) as { defi?: string; reponse?: { id?: string } };
    const attendu = defi ? await store.consumeChallenge(db, defi) : null;
    if (!attendu) return reply.code(400).send({ erreur: "Défi inconnu ou expiré." });

    const cle = reponse?.id ? await store.keyById(db, reponse.id) : null;
    if (!cle) return reply.code(401).send({ erreur: "Clé inconnue." });

    const v = await verifyAuthenticationResponse({
      response: reponse as never,
      expectedChallenge: attendu.valeur,
      expectedOrigin: origins,
      expectedRPID: domain,
      credential: {
        id: cle.id,
        publicKey: new Uint8Array(cle.cle_publique),
        counter: Number(cle.compteur),
        transports: cle.transports as never,
      },
    });
    if (!v.verified) return reply.code(401).send({ erreur: "Signature refusée." });

    await store.recordUsage(db, cle.id, v.authenticationInfo.newCounter);
    const personne = await store.findById(db, cle.personne_id);
    if (!personne) return reply.code(401).send({ erreur: "Compte introuvable." });

    await setCookie(reply, await store.openSession(db, personne.id));
    return { personne };
  });

  /* ------------------------------------------------------------
     LA SESSION
     ------------------------------------------------------------ */

  app.get("/moi", async (req, reply) => {
    const personne = await whoIs(req);
    if (!personne) return reply.code(401).send({ erreur: "Personne." });
    return { personne, fiches: await store.countCards(db, personne.id) };
  });

  app.post("/deconnexion", async (req, reply) => {
    const secret = req.cookies[COOKIE];
    if (secret) await store.closeSession(db, secret);
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
    const personne = await requireAccount(req);
    const { depuis } = req.query as { depuis?: string };
    const rang = depuis ? Number(depuis) : 0;
    if (!Number.isFinite(rang) || rang < 0) {
      return reply.code(400).send({ erreur: "Rang de départ illisible." });
    }

    const fiches = await store.cardsSince(db, personne.id, rang);
    /* `jusqua` EST UN RANG, PAS UNE HEURE. C'est le numéro d'ordre de la
       dernière fiche rendue : le client le renvoie tel quel au prochain
       tirage, et n'a aucune horloge à comparer avec le serveur.

       Sans fiche, on rend le rang demandé — surtout pas zéro, qui
       ferait tout retélécharger au prochain passage. */
    const jusqua = fiches.length ? Number(fiches[fiches.length - 1]!.seq) : rang;
    return {
      jusqua,
      /* Il en reste : le client rappellera avec le nouveau rang plutôt
         que de croire qu'il a tout. */
      encore: fiches.length === 500,
      fiches: fiches.map((f) => ({
        id: f.id,
        tmdbId: f.tmdb_id,
        cachee: f.cachee,
        supprimee: f.supprimee,
        majLe: new Date(f.maj_le).getTime(),
        donnees: f.donnees,
      })),
    };
  });

  app.put("/collection", async (req, reply) => {
    const personne = await requireAccount(req);
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
      const ecrite = await store.storeCard(db, personne.id, {
        id,
        tmdbId: f.tmdbId == null ? null : String(f.tmdbId),
        cachee: f.cachee === true,
        donnees: f.donnees ?? {},
        majLe: new Date(majLe),
        supprimee: f.supprimee === true,
      });
      if (ecrite) rangees += 1;
      else perimees += 1;
    }
    /* PAS DE `jusqua` ICI : un envoi ne dit pas où en est la lecture.
       Le rang du client n'avance qu'au tirage, qui seul sait ce qu'il a
       vraiment reçu — et repasser par là fait entrer les fiches des
       autres appareils au passage. */
    return { rangees, perimees, illisibles };
  });

  /* ------------------------------------------------------------
     LE RESTE DU CLASSEUR
     ------------------------------------------------------------
     Agencements d'étagère, pages du carnet, fils, vocabulaire, décors.
     Mêmes règles que les fiches, et volontairement les mêmes formes :
     un `depuis` qui est un rang, un `jusqua` qu'on renvoie tel quel. */

  app.get("/documents", async (req, reply) => {
    const personne = await requireAccount(req);
    const rang = Number((req.query as { depuis?: string }).depuis ?? 0);
    if (!Number.isFinite(rang) || rang < 0) {
      return reply.code(400).send({ erreur: "Rang de départ illisible." });
    }
    const docs = await store.docsSince(db, personne.id, rang);
    return {
      jusqua: docs.length ? Number(docs[docs.length - 1]!.seq) : rang,
      encore: docs.length === 200,
      documents: docs.map((d) => ({
        cle: d.cle,
        supprime: d.supprime,
        majLe: new Date(d.maj_le).getTime(),
        contenu: d.contenu,
      })),
    };
  });

  app.put("/documents", async (req, reply) => {
    const personne = await requireAccount(req);
    const { documents } = (req.body ?? {}) as { documents?: unknown };
    if (!Array.isArray(documents)) {
      return reply.code(400).send({ erreur: "Il faut un tableau de documents." });
    }
    if (documents.length > 200) {
      return reply.code(413).send({ erreur: "Deux cents documents par envoi au plus." });
    }

    let ranges = 0;
    let perimes = 0;
    let illisibles = 0;
    for (const d of documents as Record<string, unknown>[]) {
      const cle = typeof d.cle === "string" ? d.cle : null;
      const majLe = Number(d.majLe);
      if (!cle || !Number.isFinite(majLe)) {
        illisibles += 1;
        continue;
      }
      const ecrit = await store.storeDoc(db, personne.id, {
        cle,
        contenu: d.contenu ?? null,
        majLe: new Date(majLe),
        supprime: d.supprime === true,
      });
      if (ecrit) ranges += 1;
      else perimes += 1;
    }
    return { ranges, perimes, illisibles };
  });

  /* ------------------------------------------------------------
     PARTAGER SA COLLECTION
     ------------------------------------------------------------
     La seule route de tout ce serveur qui réponde à quelqu'un qui n'a
     pas de compte. Elle est donc écrite en se demandant, à chaque
     ligne, ce qu'un inconnu pourrait en tirer. */

  /* LIRE SON PROPRE RÉGLAGE DE PARTAGE — ce qui manquait pour le
     dessiner. La route d'écriture existait seule, de sorte que le tiroir
     du compte ouvrait sur trois boutons dont AUCUN n'était marqué : il
     n'apprenait votre mode qu'au moment où vous en changiez, c'est-à-dire
     trop tard pour vous aider à décider. La fiche, elle, ne pouvait pas
     dire « les autres la voient » sans savoir si quelqu'un voit quoi que
     ce soit.

     La personne de session porte déjà les deux valeurs : il n'y a rien à
     aller chercher, seulement à répondre. */
  app.get("/partage", async (req) => {
    const personne = await requireAccount(req);
    return { partage: personne.partage ?? "privee", jeton: personne.jeton ?? null };
  });

  app.put("/partage", async (req, reply) => {
    const personne = await requireAccount(req);
    const { partage } = (req.body ?? {}) as { partage?: string };
    if (!["privee", "lien", "publique"].includes(partage || "")) {
      return reply.code(400).send({ erreur: "Partage inconnu." });
    }

    /* UN JETON NEUF À CHAQUE PASSAGE PAR « LIEN ». Reprendre l'ancien
       ferait revivre tous les liens distribués la fois d'avant — y
       compris celui qu'on avait justement voulu couper en repassant en
       privé. Se raviser doit vouloir dire quelque chose. */
    const jeton = partage === "lien" ? randomBytes(16).toString("base64url") : null;
    await store.setSharing(db, personne.id, partage!, jeton);
    return { partage, jeton };
  });

  /* CE QUI EST ÉCARTÉ DU PARTAGE, ET RIEN D'AUTRE.

     La route d'à côté sait écarter une fiche depuis le premier jour ;
     aucune ne savait dire lesquelles l'étaient. Le classeur ne pouvait
     donc pas dessiner l'état d'un bouton qu'il n'avait aucun moyen de
     lire — c'est pour cela que le bouton n'existait pas, alors que la
     visite le promettait.

     On rend des IDENTIFIANTS et rien de plus : c'est tout ce qu'il faut
     pour cocher une case, et une liste de titres ferait voyager la
     collection pour rien. */
  app.get("/fiches-cachees", async (req) => {
    const personne = await requireAccount(req);
    return { ids: await store.hiddenCards(db, personne.id) };
  });

  app.put("/fiche/:id/cachee", async (req, reply) => {
    const personne = await requireAccount(req);
    const { id } = req.params as { id: string };
    const { cachee } = (req.body ?? {}) as { cachee?: boolean };
    const fait = await store.hideCard(db, personne.id, id, cachee === true);
    if (!fait) return reply.code(404).send({ erreur: "Fiche inconnue." });
    return { id, cachee: cachee === true };
  });

  app.get("/chez/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    const { jeton } = req.query as { jeton?: string };
    if (!PSEUDO_OK.test(pseudo || "")) {
      return reply.code(404).send({ erreur: "Pas de collection à cette adresse." });
    }

    const vue = await store.publicCollectionOf(db, pseudo.toLowerCase(), jeton ?? null);
    /* LE MÊME 404 DANS LES TROIS CAS : compte inexistant, compte qui ne
       partage pas, jeton faux. Distinguer renseignerait un inconnu sur
       qui est inscrit et sur qui garde une collection secrète — deux
       choses qui ne le regardent pas. */
    if (!vue) return reply.code(404).send({ erreur: "Pas de collection à cette adresse." });

    return {
      pseudo: vue.pseudo,
      films: vue.films.map((f) => ({ id: f.id, tmdbId: f.tmdb_id, ...f.donnees })),
    };
  });

  /* ------------------------------------------------------------
     SUIVRE QUELQU'UN, ET LIRE SON FIL
     ------------------------------------------------------------ */

  app.get("/profils/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    if (!PSEUDO_OK.test(pseudo || "")) return reply.code(404).send({ erreur: "Personne." });

    /* On lit la session sans l'exiger : connecté, on saura si l'on suit
       déjà ; sinon le profil se consulte quand même. */
    const moi = await whoIs(req);
    const profil = await store.publicProfileOf(db, pseudo.toLowerCase(), moi?.id);
    /* MÊME RÉPONSE POUR « N'EXISTE PAS » ET « NE SE MONTRE PAS ». On ne
       peut trouver que des gens qui ont choisi d'être trouvables. */
    if (!profil) return reply.code(404).send({ erreur: "Personne." });
    return profil;
  });

  app.get("/abonnements", async (req) => {
    const personne = await requireAccount(req);
    return { subscriptions: await store.subscriptionsOf(db, personne.id) };
  });

  app.put("/abonnements/:pseudo", async (req, reply) => {
    const personne = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const cible = await store.publicProfileOf(db, (pseudo || "").toLowerCase(), personne.id);
    /* On ne peut suivre que ce qui se montre : suivre une collection
       fermée serait s'abonner à un silence, et dirait au passage
       qu'elle existe. Un blocage referme de la même façon — c'est le
       profil qui n'existe plus, et non une interdiction annoncée. */
    if (!cible) return reply.code(404).send({ erreur: "Personne." });

    const vise = await store.findByPseudo(db, cible.pseudo);
    if (!vise || vise.id === personne.id) {
      return reply.code(400).send({ erreur: "On ne se suit pas soi-même." });
    }
    await store.follow(db, personne.id, vise.id);
    return { pseudo: cible.pseudo, suivi: true };
  });

  app.delete("/abonnements/:pseudo", async (req, reply) => {
    const personne = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const vise = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    /* Se désabonner de quelqu'un qui s'est refermé doit RESTER possible :
       on ne passe donc pas par le profil public, qui n'existerait plus. */
    if (vise) await store.unfollow(db, personne.id, vise.id);
    return reply.send({ pseudo, suivi: false });
  });

  app.get("/fil", async (req, reply) => {
    const personne = await requireAccount(req);
    const { avant } = req.query as { avant?: string };
    const borne = avant ? Number(avant) : null;
    if (borne !== null && !Number.isFinite(borne)) {
      return reply.code(400).send({ erreur: "Borne illisible." });
    }

    const nouvelles = await store.feedOf(db, personne.id, borne);
    return {
      /* Le rang de la dernière nouvelle rendue : le client le renvoie
         pour lire la suite, sans se demander l'heure qu'il est. */
      jusqua: nouvelles.length ? Number(nouvelles[nouvelles.length - 1]!.seq) : null,
      nouvelles: nouvelles.map((n) => ({
        pseudo: n.pseudo,
        id: n.id,
        tmdbId: n.tmdb_id,
        le: new Date(n.maj_le).getTime(),
        film: n.donnees,
      })),
    };
  });

  /* ------------------------------------------------------------
     CE QU'ON DIT D'UNE ŒUVRE
     ------------------------------------------------------------
     La lecture à l'envers : non plus « les films de cette personne »,
     mais « les gens qui ont vu ce film ». Rien n'est publié pour cela —
     les critiques lues ici sont celles des fiches, chez leurs auteurs,
     dans les collections qu'ils ont choisi de rendre publiques. */

  app.get("/oeuvres/:tmdbId", async (req, reply) => {
    /* UN COMPTE EST EXIGÉ, alors que la collection partagée n'en demande
       pas. La différence : là-bas on ouvre la porte de quelqu'un qui
       vous a donné son adresse ; ici on interroge tout le monde à la
       fois. Ouvrir cela aux inconnus ferait de ce serveur un moissonneur
       d'avis, et de chaque critique une donnée publiquement aspirable. */
    const personne = await requireAccount(req);
    const { tmdbId } = req.params as { tmdbId: string };
    if (!/^[0-9]{1,12}$/.test(tmdbId || "")) {
      return reply.code(400).send({ erreur: "Identifiant d'œuvre illisible." });
    }
    return store.echoOfWork(db, tmdbId, personne.id);
  });

  /* ------------------------------------------------------------
     SE PROTÉGER
     ------------------------------------------------------------
     Elles arrivent avec la première chose que ce classeur publie, et
     non « quand il y aura un problème » : le jour où il y en a un, ce
     n'est plus le moment de développer. */

  app.get("/blocages", async (req) => {
    const personne = await requireAccount(req);
    return { blocages: await store.myBlocks(db, personne.id) };
  });

  app.put("/blocages/:pseudo", async (req, reply) => {
    const personne = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    /* On bloque par le compte, PAS par le profil public : quelqu'un qui
       s'est refermé après coup doit rester blocable, sans quoi il
       suffirait de passer en privé pour redevenir inbloquable puis
       ressortir. */
    const vise = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!vise) return reply.code(404).send({ erreur: "Personne." });
    if (vise.id === personne.id) {
      return reply.code(400).send({ erreur: "On ne se bloque pas soi-même." });
    }
    await store.block(db, personne.id, vise.id);
    return { pseudo: vise.pseudo, bloque: true };
  });

  app.delete("/blocages/:pseudo", async (req, reply) => {
    const personne = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const vise = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (vise) await store.unblock(db, personne.id, vise.id);
    /* Débloquer ne réabonne à personne : le lien a été défait, il se
       refait à la main. Reconstituer un abonnement qu'on a coupé serait
       décider à la place de quelqu'un. */
    return reply.send({ pseudo, bloque: false });
  });

  app.post("/signalements", async (req, reply) => {
    const personne = await requireAccount(req);
    const { pseudo, fiche, motif } = (req.body ?? {}) as {
      pseudo?: string;
      fiche?: string;
      motif?: string;
    };
    const text = (motif || "").trim();
    if (!text || text.length > 500) {
      return reply.code(400).send({ erreur: "Dites en une phrase ce qui ne va pas." });
    }
    const vise = pseudo ? await store.findByPseudo(db, pseudo.toLowerCase()) : null;
    if (!vise) return reply.code(404).send({ erreur: "Personne." });

    const neuf = await store.report(db, personne.id, {
      cibleType: "fiche",
      cibleId: String(fiche || ""),
      viseId: vise.id,
      motif: text,
    });
    /* LA MÊME RÉPONSE QUE CE SOIT LE PREMIER SIGNALEMENT OU LE
       DIXIÈME : « c'est noté » est vrai dans les deux cas, et savoir
       qu'on avait déjà signalé n'apporte rien à qui vient de le faire. */
    return { note: true, neuf };
  });

  /* ------------------------------------------------------------
     LES LISTES
     ------------------------------------------------------------
     Une liste contient des ŒUVRES et non des fiches : une liste de
     fiches serait la liste des exemplaires de quelqu'un, elle ne
     voudrait rien dire chez un autre et se viderait le jour où son
     auteur efface une fiche. */

  /** Les droits sur une liste, ou la réponse déjà prête pour un refus. */
  const droitsOu404 = async (req: FastifyRequest, reply: FastifyReply, personneId: string) => {
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) {
      reply.code(404).send({ erreur: "Liste inconnue." });
      return null;
    }
    const droits = await store.rightsOnList(db, id, personneId);
    /* PAS DE 403 : une liste qu'on n'a pas le droit de lire répond
       comme une liste qui n'existe pas. Distinguer dirait à un inconnu
       que tel identifiant désigne quelque chose. */
    if (!droits?.lire) {
      reply.code(404).send({ erreur: "Liste inconnue." });
      return null;
    }
    return droits;
  };

  app.get("/listes", async (req) => {
    const personne = await requireAccount(req);
    return { listes: await store.myLists(db, personne.id) };
  });

  app.post("/listes", async (req, reply) => {
    const personne = await requireAccount(req);
    const { titre, intention, publique } = (req.body ?? {}) as {
      titre?: string;
      intention?: string;
      publique?: boolean;
    };
    const nom = (titre || "").trim();
    if (!nom || nom.length > 120) {
      return reply.code(400).send({ erreur: "Il faut un titre, de 1 à 120 caractères." });
    }
    const id = await store.createList(db, personne.id, {
      titre: nom,
      intention: (intention || "").trim(),
      publique: publique === true,
    });
    return { id };
  });

  app.get("/listes/:id", async (req, reply) => {
    const personne = await requireAccount(req);
    const droits = await droitsOu404(req, reply, personne.id);
    if (!droits) return reply;

    const liste = await store.listById(db, droits.liste_id);
    return {
      liste: { ...liste, mienne: droits.administrer, membre: droits.ecrire },
      oeuvres: await store.worksOf(db, droits.liste_id),
      /* Les co-constructeurs ne se montrent qu'à ceux qui écrivent
         dedans : un visiteur d'une liste publique lit des films, pas la
         liste des gens qui la tiennent. */
      membres: droits.ecrire ? await store.membersOf(db, droits.liste_id) : [],
    };
  });

  app.put("/listes/:id", async (req, reply) => {
    const personne = await requireAccount(req);
    const droits = await droitsOu404(req, reply, personne.id);
    if (!droits) return reply;
    /* RENOMMER, PUBLIER, EFFACER : le propriétaire seul. Co-construire
       est un droit d'écriture, pas une propriété partagée — sans cette
       asymétrie, une liste à six mains n'a plus personne pour en
       répondre. */
    if (!droits.administrer)
      return reply.code(403).send({ erreur: "Cette liste n'est pas vôtre." });

    const { titre, intention, publique } = (req.body ?? {}) as {
      titre?: string;
      intention?: string;
      publique?: boolean;
    };
    if (titre !== undefined && !(titre.trim() && titre.trim().length <= 120)) {
      return reply.code(400).send({ erreur: "Il faut un titre, de 1 à 120 caractères." });
    }
    await store.editList(db, droits.liste_id, {
      titre: titre?.trim(),
      intention: intention?.trim(),
      publique,
    });
    return { fait: true };
  });

  app.delete("/listes/:id", async (req, reply) => {
    const personne = await requireAccount(req);
    const droits = await droitsOu404(req, reply, personne.id);
    if (!droits) return reply;
    if (!droits.administrer)
      return reply.code(403).send({ erreur: "Cette liste n'est pas vôtre." });
    await store.deleteList(db, droits.liste_id);
    return { efface: true };
  });

  app.post("/listes/:id/oeuvres", async (req, reply) => {
    const personne = await requireAccount(req);
    const droits = await droitsOu404(req, reply, personne.id);
    if (!droits) return reply;
    if (!droits.ecrire) return reply.code(403).send({ erreur: "On ne vous a rien demandé ici." });

    const { tmdbId, titre, annee } = (req.body ?? {}) as {
      tmdbId?: string | number;
      titre?: string;
      annee?: string;
    };
    if (!/^[0-9]{1,12}$/.test(String(tmdbId ?? ""))) {
      return reply.code(400).send({ erreur: "Une œuvre se désigne par son identifiant TMDB." });
    }
    const neuf = await store.addToList(db, droits.liste_id, personne.id, {
      tmdbId: String(tmdbId),
      titre: (titre || "").slice(0, 200),
      annee: annee ? String(annee).slice(0, 8) : null,
    });
    return { ajoute: true, neuf };
  });

  app.delete("/listes/:id/oeuvres/:tmdbId", async (req, reply) => {
    const personne = await requireAccount(req);
    const droits = await droitsOu404(req, reply, personne.id);
    if (!droits) return reply;
    if (!droits.ecrire) return reply.code(403).send({ erreur: "On ne vous a rien demandé ici." });
    const { tmdbId } = req.params as { tmdbId: string };
    await store.removeFromList(db, droits.liste_id, tmdbId);
    return { retire: true };
  });

  app.put("/listes/:id/membres/:pseudo", async (req, reply) => {
    const personne = await requireAccount(req);
    const droits = await droitsOu404(req, reply, personne.id);
    if (!droits) return reply;
    if (!droits.administrer)
      return reply.code(403).send({ erreur: "Cette liste n'est pas vôtre." });

    const { pseudo } = req.params as { pseudo: string };
    const invite = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!invite) return reply.code(404).send({ erreur: "Personne." });
    if (invite.id === personne.id) {
      return reply.code(400).send({ erreur: "Vous y écrivez déjà." });
    }
    /* On n'invite pas quelqu'un qu'on a fait taire, ni quelqu'un qui
       nous a fait taire : ce serait rouvrir par une porte de côté ce
       qu'un blocage vient de fermer. */
    if (await store.blockedIds(db, personne.id, invite.id)) {
      return reply.code(404).send({ erreur: "Personne." });
    }
    await store.inviteToList(db, droits.liste_id, invite.id);
    return { pseudo: invite.pseudo, membre: true };
  });

  app.delete("/listes/:id/membres/:pseudo", async (req, reply) => {
    const personne = await requireAccount(req);
    const droits = await droitsOu404(req, reply, personne.id);
    if (!droits) return reply;
    const { pseudo } = req.params as { pseudo: string };
    const vise = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!vise) return reply.code(404).send({ erreur: "Personne." });
    /* Le propriétaire renvoie qui il veut ; un membre ne peut renvoyer
       que lui-même. Partir d'une liste ne demande la permission de
       personne. */
    if (!droits.administrer && vise.id !== personne.id) {
      return reply.code(403).send({ erreur: "Cette liste n'est pas vôtre." });
    }
    await store.removeMemberFromList(db, droits.liste_id, vise.id);
    return { pseudo: vise.pseudo, membre: false };
  });

  /* ------------------------------------------------------------
     LES DÉFIS
     ------------------------------------------------------------
     Une liste plus une période. L'avancement se CALCULE — personne ne
     coche « vu », le classeur le sait déjà. */

  app.get("/defis", async (req) => {
    const personne = await requireAccount(req);
    return { defis: await store.myChallenges(db, personne.id) };
  });

  app.post("/defis", async (req, reply) => {
    const personne = await requireAccount(req);
    const { listeId, titre, debut, fin } = (req.body ?? {}) as {
      listeId?: string;
      titre?: string;
      debut?: string;
      fin?: string;
    };
    const nom = (titre || "").trim();
    if (!nom || nom.length > 120) {
      return reply.code(400).send({ erreur: "Il faut un titre, de 1 à 120 caractères." });
    }
    if (!JOUR.test(debut || "") || !JOUR.test(fin || "") || fin! < debut!) {
      return reply.code(400).send({ erreur: "Deux dates, et la fin après le début." });
    }
    /* On ne bâtit un défi que sur une liste où l'on écrit : sinon
       n'importe qui lance un défi sur la liste publique d'un inconnu,
       qui le verrait apparaître sans l'avoir voulu. */
    const droits = UUID.test(listeId || "")
      ? await store.rightsOnList(db, listeId!, personne.id)
      : null;
    if (!droits?.ecrire) return reply.code(404).send({ erreur: "Liste inconnue." });

    const id = await store.createChallenge(db, personne.id, {
      listeId: droits.liste_id,
      titre: nom,
      debut: debut!,
      fin: fin!,
    });
    return { id };
  });

  app.get("/defis/:id", async (req, reply) => {
    const personne = await requireAccount(req);
    const { id } = req.params as { id: string };
    const defi = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!defi) return reply.code(404).send({ erreur: "Défi inconnu." });
    /* Le droit de voir un défi est celui de voir sa liste : il n'y a
       pas deux confidentialités à tenir d'accord. */
    const droits = await store.rightsOnList(db, defi.liste_id, personne.id);
    if (!droits?.lire) return reply.code(404).send({ erreur: "Défi inconnu." });

    return {
      defi,
      oeuvres: await store.worksOf(db, defi.liste_id),
      /* L'AVANCEMENT NE SORT DU JOURNAL QU'EN NOMBRE. Le journal des
         séances ne quitte jamais une collection ; ici il ne quitte rien
         non plus — on compte, on ne recopie pas. Et l'on ne compte que
         des gens qui ont demandé à participer. */
      avancement: await store.progressOf(db, defi.id),
    };
  });

  app.delete("/defis/:id", async (req, reply) => {
    const personne = await requireAccount(req);
    const { id } = req.params as { id: string };
    const defi = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!defi) return reply.code(404).send({ erreur: "Défi inconnu." });
    const droits = await store.rightsOnList(db, defi.liste_id, personne.id);
    if (!droits?.administrer) return reply.code(403).send({ erreur: "Ce défi n'est pas vôtre." });
    await store.deleteChallenge(db, defi.id);
    return { efface: true };
  });

  app.put("/defis/:id/participation", async (req, reply) => {
    const personne = await requireAccount(req);
    const { id } = req.params as { id: string };
    const defi = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!defi) return reply.code(404).send({ erreur: "Défi inconnu." });
    const droits = await store.rightsOnList(db, defi.liste_id, personne.id);
    if (!droits?.lire) return reply.code(404).send({ erreur: "Défi inconnu." });
    await store.joinChallenge(db, defi.id, personne.id);
    return { dedans: true };
  });

  app.delete("/defis/:id/participation", async (req, reply) => {
    const personne = await requireAccount(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) return reply.code(404).send({ erreur: "Défi inconnu." });
    /* Partir se fait TOUJOURS, sans vérifier qu'on avait le droit
       d'entrer : quelqu'un dont la liste s'est refermée doit pouvoir
       sortir d'un décompte qui le mesure encore. */
    await store.leaveChallenge(db, id, personne.id);
    return { dedans: false };
  });

  /* ------------------------------------------------------------
     CE QUI EST À SOI, ET LE DROIT DE PARTIR
     ------------------------------------------------------------ */

  app.get("/mes-donnees", async (req) => {
    const personne = await requireAccount(req);
    /* Tout ce que le serveur détient de quelqu'un, dans un seul objet :
       c'est ce que le règlement appelle la portabilité, et c'est surtout
       la moindre des choses. */
    return {
      personne,
      fiches: await store.cardsSince(db, personne.id, 0, 100000),
      documents: await store.docsSince(db, personne.id, 0, 100000),
    };
  });

  app.delete("/mon-compte", async (req, reply) => {
    const personne = await requireAccount(req);
    await store.deletePerson(db, personne.id);
    reply.clearCookie(COOKIE, { path: "/" });
    return { efface: true };
  });

  /* ------------------------------------------------------------
     LES NOTIFICATIONS POUSSÉES
     ------------------------------------------------------------
     Une seule raison de sonner dans tout ce serveur : un défi qui
     commence, un défi qui s'achève. Sans clés VAPID, ces routes
     répondent « pas de service » et le classeur n'en montre pas le
     réglage. */

  app.get("/poussees", async () => ({ possible: pushAvailable(), cle: publicKeyForPush() }));

  app.put("/poussees", async (req, reply) => {
    const personne = await requireAccount(req);
    if (!pushAvailable()) {
      return reply.code(503).send({ erreur: "Ce serveur n'envoie pas de notifications." });
    }
    const { point, p256dh, secret } = (req.body ?? {}) as {
      point?: string;
      p256dh?: string;
      secret?: string;
    };
    /* L'abonnement vient du NAVIGATEUR et le serveur ne peut pas le
       vérifier : tout ce qu'il peut faire est refuser ce qui n'a pas la
       forme d'une adresse, pour ne pas ranger n'importe quoi. */
    if (!point || !/^https:\/\//.test(point) || !p256dh || !secret) {
      return reply.code(400).send({ erreur: "Abonnement illisible." });
    }
    await store.storePush(db, personne.id, { point, p256dh, secret });
    return { abonne: true };
  });

  app.delete("/poussees", async (req, reply) => {
    await requireAccount(req);
    const { point } = (req.body ?? {}) as { point?: string };
    /* On efface par le POINT et non par le compte : un ordinateur
       partagé ne doit pas faire taire le téléphone de la même
       personne. */
    if (point) await store.forgetPush(db, point);
    return reply.send({ abonne: false });
  });

  app.get("/sante", async () => ({ debout: true }));

  /* ------------------------------------------------------------
     LA PORTE DE SERVICE — fermée à double tour, et pour de bonnes
     raisons
     ------------------------------------------------------------

     Une clé d'accès se signe avec une empreinte, un visage ou une clé
     physique. Rien de tout cela n'existe dans un navigateur piloté, ce
     qui rendait la synchronisation invérifiable de bout en bout : on
     pouvait éprouver le serveur seul, le client seul, et jamais les
     deux ensemble.

     Cette route ouvre une session sans cérémonie — exactement ce que la
     cérémonie aurait produit. C'est une porte dérobée, et elle est
     traitée comme telle : il faut ET ne pas être en production, ET
     avoir posé `PORTE_DEV=1` à la main. Les deux conditions sont lues
     au démarrage, pas à la requête : une variable d'environnement
     changée en douce ne la rouvre pas.

     Si vous lisez ceci en vous demandant si elle peut être active en
     ligne : non, `index.ts` ne la propose jamais quand
     `NODE_ENV=production`. */
  if (reglages.devDoor) {
    app.post("/dev/session", async (req, reply) => {
      const { pseudo } = (req.body ?? {}) as { pseudo?: string };
      const nom = (pseudo || `dev-${Date.now().toString(36)}`).toLowerCase();
      const personne = (await store.findByPseudo(db, nom)) ?? (await store.createPerson(db, nom));
      setCookie(reply, await store.openSession(db, personne.id));
      return { personne, avertissement: "porte de développement" };
    });
  }

  /* ------------------------------------------------------------
     LES RELAIS — la clé TMDB quitte le bundle
     ------------------------------------------------------------ */
  registerRelays(app, {
    tmdbKey: reglages.tmdbKey,
    requireAccount,
    tmdbCeiling: reglages.tmdbCeiling,
  });

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
      store.sweepChallenges(db).catch(() => {});
      /* LES RAPPELS PASSENT PAR LE MÊME BALAI, à l'heure : un défi qui
         commence aujourd'hui est annoncé aujourd'hui, et la table des
         rappels déjà dits empêche les vingt-trois autres passages de le
         redire. Un vrai ordonnanceur serait une dépendance de plus pour
         un serveur qui tourne sur une machine de bureau. */
      remindChallenges(db)
        .then(({ told }) => told && console.log(`  ${told} rappel(s) de défi envoyé(s)`))
        .catch((e) => console.error("rappels :", e));
    },
    60 * 60 * 1000
  );
  balai.unref();
  app.addHook("onClose", async () => clearInterval(balai));

  function setCookie(reply: FastifyReply, secret: string) {
    reply.setCookie(COOKIE, secret, {
      path: "/",
      httpOnly: true,
      /* EN DÉVELOPPEMENT, `lax` SUFFIT ET EN LIGNE IL CASSE TOUT.

         Le client et le serveur partagent `localhost` en local : deux
         ports d'un même hôte sont le même « site », et le cookie voyage.
         En ligne, le classeur vit sur un domaine de pages statiques et
         l'API sur un autre : la requête devient inter-sites, et `lax`
         retient le cookie — la session existe et n'est jamais envoyée.

         `none` l'autorise, et n'a de sens qu'avec `Secure` : les deux
         vont donc ensemble, et se règlent d'un seul interrupteur. */
      sameSite: reglages.secure ? "none" : "lax",
      secure: reglages.secure ?? false,
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return app;
}
