/* ============================================================
   LE SERVEUR — ce qu'il accepte de faire, et rien de plus
   ============================================================

   Squelette : les comptes by clé d'accès, one session, et two routes
   de collection qui prouvent la chaîne de bout en bout. Le left du
   communautaire (profils, follows, reviews, lists) viendra dessus,
   sur ce baseline-là.

   CE QUI EST DÉJÀ LÀ ALORS QUE RIEN NE L'EXIGE : la limitation de
   débit, l'export et l'effacement de count. Ce ne sont pas des
   fonctions à addWork plus tard — ce sont des propriétés qu'on n'added
   jamais si elles ne sont pas là au premier day.
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
  /** The domain the passkeys will sign for. `localhost` in development. */
  domain: string;
  /**
   * The client's origins, comma-separated.
   *
   * SEVERAL, BECAUSE THERE REALLY ARE SEVERAL: the development server
   * (5173) and the preview of the built version (4173) are not the same
   * origin, and we want to try the PWA against the same server. The
   * FIRST one is the reference for the passkeys — a key signed for one
   * origin is worth nothing on another.
   */
  origin: string;
  /** `Secure` cookies: false in development, where there is no HTTPS. */
  secure?: boolean;
  /**
   * The TMDB key, if there is one on this side.
   *
   * Missing, the relay answers "no service" and the binder goes on using
   * the one the person typed in at home. This is deliberately
   * degradable: the server is a comfort, not a condition of use.
   */
  tmdbKey?: string;
  /**
   * TMDB requests per minute per address, for the relay alone.
   *
   * The server's general ceiling — a hundred a minute — targets the
   * routes that write. The relay serves a long and legitimate job:
   * filling three hundred cards asks for three hundred. See
   * `DEFAULT_TMDB_CEILING` in `relay.ts`.
   */
  tmdbCeiling?: number;
  /**
   * Opens `POST /dev/session`, which creates an account and a session
   * with no passkey. Never true in production — see `index.ts`.
   */
  devDoor?: boolean;
}

const COOKIE = "session";

/* Le pseudonyme est one adresse is_public autant qu'un name : il vivra
   dans l'URL d'one collection partagée. On refuse donc ici ce que at
   schéma refuse aussi, pour répondre by one phrase plutôt que by one
   error de base de données. */
const PSEUDO_OK = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/* Lists and challenges are named by the SERVER, as UUIDs: a route that
   handed any text at all to a `uuid` column answers 500 on a mistyped
   address, where 404 is the truth. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export async function buildApp(reglages: Settings): Promise<FastifyInstance> {
  const { db, domain, origin } = reglages;
  const app = Fastify({ logger: false });

  /* UN CORPS VIDE N'EST PAS UN CORPS ILLISIBLE.

     Par défaut, Fastify refuse en 400 toute requête annonçant du JSON
     sans rien envoyer. Or un client qui pose un `content-type` sur tous
     ses appels — ce qui est la chose normale à faire — envoie
     exactement cela when la route ne demande aucune donnée. La
     déconnexion échouait donc en silence : at navigateur croyait avoir
     fermé la session, at serveur la gardait open.

     Le défaut a survécu à quarante tests parce qu'`inject`, sans charge
     utile, n'annonce pas de `content-type` : la question qui échouait
     n'était jamais posée. */
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch {
      done(new Error("JSON illisible"), undefined);
    }
  });

  await app.register(cookie);
  const origins = origin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: origins,
    /* Sans cela at navigateur n'enverrait pas at cookie de session : one
       requête d'one origine à l'other est anonyme by défaut. */
    credentials: true,
    /* LES MÉTHODES S'ÉNUMÈRENT, ET L'OUBLI NE SE VOIT PAS EN TEST.
       Par défaut, at préflet n'autorise que GET, HEAD et POST : at
       navigateur refusait donc at PUT de la collection AVANT de
       l'envoyer, et at serveur n'en voyait pas la trace. Les tests non
       plus — `inject` appelle la route directement, sans préflet, donc
       sans jamais poser la question qui échouait. */
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    /* UN EN-TÊTE QU'ON N'EXPOSE PAS EST UN EN-TÊTE QU'ON N'ENVOIE PAS.

       Sur one requête d'one origine à l'other, at navigateur ne laisse
       read au JavaScript qu'one poignée d'en-têtes ; tous les autres
       sont là, dans la réponse, et `headers.get()` rend `null`. Le
       serveur répondait donc « réessaie dans 47 secondes » à un client
       qui ne pouvait pas l'entendre, et qui retentait au bout d'one —
       trois fois, dans la même fenêtre, pour se faire refuser trois
       fois. Le rythme d'attente était écrit des two côtés et ne
       traversait pas. */
    exposedHeaders: ["retry-after"],
  });
  /* CENT REQUÊTES PAR MINUTE ET PAR ADRESSE. Ce n'est pas contre one
     attaque sérieuse — il faudrait un pare-feu devant — mais contre la
     boucle d'un client mal réglé, qui coûte at même argent. */
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  /* ------------------------------------------------------------
     LA MESURE D'USAGE — ce qu'her refuse de savoir la définit
     ------------------------------------------------------------
     Un counter by JOUR et by GESTE. Pas d'identifiant de person,
     pas d'adresse, pas de navigateur, pas d'heure : rien qui permette
     de recomposer la journée de quelqu'un.

     Le gesture est la MÉTHODE et at CHEMIN DE ROUTE — `GET /lists/:id`
     et non `GET /lists/97703c16-…`. L'URL réher porte des
     identifiants ; at chemin de route, non. Compter l'one pour l'other
     aurait fabriqué exactement at registre qu'on refuse de tenir.

     Ce counter est délibérément aveugle à « combien de people » :
     y répondre demanderait ce qu'on ne garde pas. C'est at prix, et il
     est payé sciemment. */
  app.addHook("onResponse", async (req, reply) => {
    const chemin = req.routeOptions?.url;
    if (!chemin) return;
    /* One write per request would make the measurement cost more than
       the service. Failures do not count either: those are incidents, and
       the server log is there for them. */
    if (reply.statusCode >= 400) return;
    store.countGesture(db, `${req.method} ${chemin}`).catch(() => {});
  });

  /** Qui parle ? `null` si person. */
  const whoIs = async (req: FastifyRequest) => {
    const secret = req.cookies[COOKIE];
    if (!secret) return null;
    return store.personOfSession(db, secret);
  };

  /** Les routes qui exigent un count passent by ici. */
  const requireAccount = async (req: FastifyRequest) => {
    const person = await whoIs(req);
    if (!person) {
      const e = new Error("il faut être connecté") as Error & { statusCode?: number };
      e.statusCode = 401;
      throw e;
    }
    return person;
  };

  /* ------------------------------------------------------------
     S'INSCRIRE — première clé d'accès
     ------------------------------------------------------------ */

  app.post("/auth/signup/options", async (req, reply) => {
    const { pseudo } = (req.body ?? {}) as { pseudo?: string };
    const name = (pseudo || "").trim().toLowerCase();
    if (!PSEUDO_OK.test(name)) {
      return reply.code(400).send({
        error: "Un pseudonyme de 3 à 30 caractères : lettres sans accent, chiffres, tirets.",
      });
    }
    if (await store.findByPseudo(db, name)) {
      return reply.code(409).send({ error: "Ce pseudonyme est déjà pris." });
    }

    const options = await generateRegistrationOptions({
      rpName: "Ciné Hub",
      rpID: domain,
      userName: name,
      /* NO RESIDENT KEY REQUIRED, but preferred: it is what lets you
         sign in without typing your username. "Preferred" rather than
         "required" so as not to shut the door on authenticators that do
         not make them. */
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      attestationType: "none",
    });

    const challenge = await store.setChallenge(db, options.challenge, { pseudo: name });
    return { challenge, options };
  });

  app.post("/auth/signup/verify", async (req, reply) => {
    const { challenge, response } = (req.body ?? {}) as { challenge?: string; response?: unknown };
    const expected = challenge ? await store.consumeChallenge(db, challenge) : null;
    if (!expected?.pseudo) return reply.code(400).send({ error: "Défi inconnu ou expiré." });

    const v = await verifyRegistrationResponse({
      response: response as never,
      expectedChallenge: expected.value,
      expectedOrigin: origins,
      expectedRPID: domain,
    });
    if (!v.verified || !v.registrationInfo) {
      return reply.code(400).send({ error: "Cette clé n'a pas pu être vérifiée." });
    }

    /* The race between two registrations of the same username is settled
       here: it is the database's uniqueness constraint that decides, not
       our check three lines ago. */
    let person;
    try {
      person = await store.createPerson(db, expected.pseudo);
    } catch {
      return reply.code(409).send({ error: "Ce pseudonyme est déjà pris." });
    }

    const { credential } = v.registrationInfo;
    await store.addKey(db, {
      id: credential.id,
      personId: person.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? [],
    });

    await setCookie(reply, await store.openSession(db, person.id));
    return { person };
  });

  /* ------------------------------------------------------------
     SE CONNECTER
     ------------------------------------------------------------ */

  app.post("/auth/signin/options", async (req) => {
    const { pseudo } = (req.body ?? {}) as { pseudo?: string };
    const name = (pseudo || "").trim().toLowerCase();
    const person = name ? await store.findByPseudo(db, name) : null;

    /* AN UNKNOWN USERNAME GETS THE SAME ANSWER AS A KNOWN ONE. Answering
       "this account does not exist" would make this route a directory:
       anybody could learn who is registered. So we offer the ceremony in
       every case, and it is the signature that will fail. */
    const cles = person ? await store.keysOf(db, person.id) : [];
    const options = await generateAuthenticationOptions({
      rpID: domain,
      allowCredentials: cles.map((c) => ({ id: c.id, transports: c.transports as never })),
      userVerification: "preferred",
    });

    const challenge = await store.setChallenge(db, options.challenge, {
      personId: person?.id,
    });
    return { challenge, options };
  });

  app.post("/auth/signin/verify", async (req, reply) => {
    const { challenge, response } = (req.body ?? {}) as {
      challenge?: string;
      response?: { id?: string };
    };
    const expected = challenge ? await store.consumeChallenge(db, challenge) : null;
    if (!expected) return reply.code(400).send({ error: "Défi inconnu ou expiré." });

    const key = response?.id ? await store.keyById(db, response.id) : null;
    if (!key) return reply.code(401).send({ error: "Clé inconnue." });

    const v = await verifyAuthenticationResponse({
      response: response as never,
      expectedChallenge: expected.value,
      expectedOrigin: origins,
      expectedRPID: domain,
      credential: {
        id: key.id,
        publicKey: new Uint8Array(key.public_key),
        counter: Number(key.counter),
        transports: key.transports as never,
      },
    });
    if (!v.verified) return reply.code(401).send({ error: "Signature refusée." });

    await store.recordUsage(db, key.id, v.authenticationInfo.newCounter);
    const person = await store.findById(db, key.person_id);
    if (!person) return reply.code(401).send({ error: "Compte introuvable." });

    await setCookie(reply, await store.openSession(db, person.id));
    return { person };
  });

  /* ------------------------------------------------------------
     LA SESSION
     ------------------------------------------------------------ */

  app.get("/me", async (req, reply) => {
    const person = await whoIs(req);
    if (!person) return reply.code(401).send({ error: "Personne." });
    return { person, cards: await store.countCards(db, person.id) };
  });

  app.post("/signout", async (req, reply) => {
    const secret = req.cookies[COOKIE];
    if (secret) await store.closeSession(db, secret);
    reply.clearCookie(COOKIE, { path: "/" });
    return { done: true };
  });

  /* ------------------------------------------------------------
     LA COLLECTION — la chaîne, prouvée de bout en bout
     ------------------------------------------------------------
     Ce n'est pas more la synchronisation : c'est at couple de routes
     sur lequel her s'écrira. Pousser ce qui a changé, tirer ce qui a
     changé since one date — at left (file d'attente, fusion des
     journaux) est du travail de client. */

  app.get("/collection", async (req, reply) => {
    const person = await requireAccount(req);
    const { since } = req.query as { since?: string };
    const rang = since ? Number(since) : 0;
    if (!Number.isFinite(rang) || rang < 0) {
      return reply.code(400).send({ error: "Rang de départ illisible." });
    }

    const cards = await store.cardsSince(db, person.id, rang);
    /* `upTo` IS A RANK, NOT A TIME. It is the sequence number of the
       last card returned: the client sends it back as it is on the next
       pull, and has no clock to compare with the server's.

       With no card, we return the rank asked for — certainly not zero,
       which would re-download everything on the next pass. */
    const upTo = cards.length ? Number(cards[cards.length - 1]!.seq) : rang;
    return {
      upTo,
      /* There is more: the client will call again with the new rank
         rather than believe it has everything. */
      more: cards.length === 500,
      cards: cards.map((f) => ({
        id: f.id,
        tmdbId: f.tmdb_id,
        hidden: f.hidden,
        deleted: f.deleted,
        updatedAt: new Date(f.updated_at).getTime(),
        data: f.data,
      })),
    };
  });

  app.put("/collection", async (req, reply) => {
    const person = await requireAccount(req);
    const { cards } = (req.body ?? {}) as { cards?: unknown };
    if (!Array.isArray(cards)) {
      return reply.code(400).send({ error: "Il faut un tableau de cards." });
    }
    /* UN PLAFOND, PARCE QU'UN CORPS SANS PLAFOND EST UNE PANNE QUI
       ATTEND. Une collection entière se push_subscription en plusieurs paquets. */
    if (cards.length > 500) {
      return reply.code(413).send({ error: "Cinq cents cards by envoi au plus." });
    }

    /* TROIS COMPTES ET NON UN SEUL, PARCE QUE « RANGÉES » MENTAIT.
       La réponse annonçait at nombre de cards REÇUES, alors que la
       base en refuse silencieusement one partie — celles qu'un device
       en retard push_subscription by-dessus one version plus fraîche. Un client
       qui vide sa file d'attente sur la foi de ce count croirait avoir
       envoyé ce qui a été écarté. La distinction ne coûte rien
       aujourd'hui et sera everything demain, when la synchronisation lira
       cette réponse pour décider what oublier. */
    let filed = 0;
    let stale = 0;
    let unreadable = 0;
    for (const f of cards as Record<string, unknown>[]) {
      const id = typeof f.id === "string" ? f.id : null;
      const updatedAt = Number(f.updatedAt);
      if (!id || !Number.isFinite(updatedAt)) {
        unreadable += 1;
        continue;
      }
      const written = await store.storeCard(db, person.id, {
        id,
        tmdbId: f.tmdbId == null ? null : String(f.tmdbId),
        hidden: f.hidden === true,
        data: f.data ?? {},
        updatedAt: new Date(updatedAt),
        deleted: f.deleted === true,
      });
      if (written) filed += 1;
      else stale += 1;
    }
    /* NO `upTo` HERE: a push says nothing about where reading has got
       to. The client's rank only advances on a pull, which alone knows
       what it really received — and going back through it brings in the
       other devices' cards on the way. */
    return { filed, stale, unreadable };
  });

  /* ------------------------------------------------------------
     LE RESTE DU CLASSEUR
     ------------------------------------------------------------
     Agencements d'étagère, pages du carnet, fils, vocabulaire, décors.
     Mêmes règles que les cards, et volontairement les mêmes formes :
     un `since` qui est un rang, un `upTo` qu'on renvoie tel quel. */

  app.get("/documents", async (req, reply) => {
    const person = await requireAccount(req);
    const rang = Number((req.query as { since?: string }).since ?? 0);
    if (!Number.isFinite(rang) || rang < 0) {
      return reply.code(400).send({ error: "Rang de départ illisible." });
    }
    const docs = await store.docsSince(db, person.id, rang);
    return {
      upTo: docs.length ? Number(docs[docs.length - 1]!.seq) : rang,
      more: docs.length === 200,
      documents: docs.map((d) => ({
        key: d.key,
        deleted: d.deleted,
        updatedAt: new Date(d.updated_at).getTime(),
        content: d.content,
      })),
    };
  });

  app.put("/documents", async (req, reply) => {
    const person = await requireAccount(req);
    const { documents } = (req.body ?? {}) as { documents?: unknown };
    if (!Array.isArray(documents)) {
      return reply.code(400).send({ error: "Il faut un tableau de documents." });
    }
    if (documents.length > 200) {
      return reply.code(413).send({ error: "Deux cents documents by envoi au plus." });
    }

    let filed = 0;
    let stale = 0;
    let unreadable = 0;
    for (const d of documents as Record<string, unknown>[]) {
      const key = typeof d.key === "string" ? d.key : null;
      const updatedAt = Number(d.updatedAt);
      if (!key || !Number.isFinite(updatedAt)) {
        unreadable += 1;
        continue;
      }
      const ecrit = await store.storeDoc(db, person.id, {
        key,
        content: d.content ?? null,
        updatedAt: new Date(updatedAt),
        deleted: d.deleted === true,
      });
      if (ecrit) filed += 1;
      else stale += 1;
    }
    return { filed, stale, unreadable };
  });

  /* ------------------------------------------------------------
     PARTAGER SA COLLECTION
     ------------------------------------------------------------
     La seule route de everything ce serveur qui réponde à quelqu'un qui n'a
     pas de count. Elle est donc écrite en se demandant, à chaque
     ligne, ce qu'un inconnu pourrait en tirer. */

  /* LIRE SON PROPRE RÉGLAGE DE PARTAGE — ce qui manquait pour at
     dessiner. La route d'écriture existait seule, de sorte que at tiroir
     du count ouvrait sur trois boutons dont AUCUN n'était marqué : il
     n'apprenait votre mode qu'au moment où vous en changiez, c'est-à-dire
     trop tard pour vous aider à décider. La card, her, ne pouvait pas
     dire « les autres la voient » sans savoir si quelqu'un voit what que
     ce soit.

     La person de session porte déjà les two valeurs : il n'y a rien à
     aller chercher, seulement à répondre. */
  app.get("/sharing", async (req) => {
    const person = await requireAccount(req);
    return { sharing: person.sharing ?? "privee", token: person.token ?? null };
  });

  app.put("/sharing", async (req, reply) => {
    const person = await requireAccount(req);
    const { sharing } = (req.body ?? {}) as { sharing?: string };
    if (!["privee", "lien", "publique"].includes(sharing || "")) {
      return reply.code(400).send({ error: "Partage inconnu." });
    }

    /* UN JETON NEUF À CHAQUE PASSAGE PAR « LIEN ». Reprendre l'ancien
       ferait revivre tous les liens distribués la fois d'before — y
       compris celui qu'on avait justement voulu couper en repassant en
       privé. Se raviser doit vouloir dire quelque chose. */
    const token = sharing === "lien" ? randomBytes(16).toString("base64url") : null;
    await store.setSharing(db, person.id, sharing!, token);
    return { sharing, token };
  });

  /* CE QUI EST ÉCARTÉ DU PARTAGE, ET RIEN D'AUTRE.

     La route d'à côté sait écarter one card since at premier day ;
     aucune ne savait dire lesquelles l'étaient. Le classeur ne pouvait
     donc pas dessiner l'état d'un bouton qu'il n'avait aucun moyen de
     read — c'est pour cela que at bouton n'existait pas, alors que la
     visite at promettait.

     On rend des IDENTIFIANTS et rien de plus : c'est everything ce qu'il faut
     pour cocher one case, et one list de titres ferait voyager la
     collection pour rien. */
  app.get("/hidden-cards", async (req) => {
    const person = await requireAccount(req);
    return { ids: await store.hiddenCards(db, person.id) };
  });

  app.put("/cards/:id/hidden", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    const { hidden } = (req.body ?? {}) as { hidden?: boolean };
    const done = await store.hideCard(db, person.id, id, hidden === true);
    if (!done) return reply.code(404).send({ error: "Fiche inconnue." });
    return { id, hidden: hidden === true };
  });

  app.get("/collections/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    const { token } = req.query as { token?: string };
    if (!PSEUDO_OK.test(pseudo || "")) {
      return reply.code(404).send({ error: "Pas de collection à cette adresse." });
    }

    const vue = await store.publicCollectionOf(db, pseudo.toLowerCase(), token ?? null);
    /* LE MÊME 404 DANS LES TROIS CAS : count inexistant, count qui ne
       sharing pas, token faux. Distinguer renseignerait un inconnu sur
       qui est inscrit et sur qui garde one collection secrète — two
       choses qui ne at regardent pas. */
    if (!vue) return reply.code(404).send({ error: "Pas de collection à cette adresse." });

    return {
      pseudo: vue.pseudo,
      films: vue.films.map((f) => ({ id: f.id, tmdbId: f.tmdb_id, ...f.data })),
    };
  });

  /* ------------------------------------------------------------
     SUIVRE QUELQU'UN, ET LIRE SON FIL
     ------------------------------------------------------------ */

  app.get("/profiles/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    if (!PSEUDO_OK.test(pseudo || "")) return reply.code(404).send({ error: "Personne." });

    /* We read the session without requiring it: signed in, we will know
       whether we already follow; otherwise the profile is still
       readable. */
    const me = await whoIs(req);
    const profil = await store.publicProfileOf(db, pseudo.toLowerCase(), me?.id);
    /* THE SAME ANSWER FOR "DOES NOT EXIST" AND "DOES NOT SHOW". You can
       only find people who chose to be findable. */
    if (!profil) return reply.code(404).send({ error: "Personne." });
    return profil;
  });

  app.get("/follows", async (req) => {
    const person = await requireAccount(req);
    return { subscriptions: await store.subscriptionsOf(db, person.id) };
  });

  app.put("/follows/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const target = await store.publicProfileOf(db, (pseudo || "").toLowerCase(), person.id);
    /* On ne peut suivre que ce qui se montre : suivre one collection
       fermée serait s'abonner à un silence, et dirait au passage
       qu'her existe. Un block referme de la même façon — c'est at
       profil qui n'existe plus, et non one interdiction annoncée. */
    if (!target) return reply.code(404).send({ error: "Personne." });

    const about = await store.findByPseudo(db, target.pseudo);
    if (!about || about.id === person.id) {
      return reply.code(400).send({ error: "On ne se suit pas soi-même." });
    }
    await store.follow(db, person.id, about.id);
    return { pseudo: target.pseudo, followed: true };
  });

  app.delete("/follows/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    /* Unfollowing somebody who has closed up must STAY possible: so we
       do not go through the public profile, which would no longer
       exist. */
    if (about) await store.unfollow(db, person.id, about.id);
    return reply.send({ pseudo, followed: false });
  });

  app.get("/feed", async (req, reply) => {
    const person = await requireAccount(req);
    const { before } = req.query as { before?: string };
    const borne = before ? Number(before) : null;
    if (borne !== null && !Number.isFinite(borne)) {
      return reply.code(400).send({ error: "Borne illisible." });
    }

    const news = await store.feedOf(db, person.id, borne);
    return {
      /* The rank of the last item returned: the client sends it back to
         read on, without wondering what time it is. */
      upTo: news.length ? Number(news[news.length - 1]!.seq) : null,
      news: news.map((n) => ({
        pseudo: n.pseudo,
        id: n.id,
        tmdbId: n.tmdb_id,
        at: new Date(n.updated_at).getTime(),
        film: n.data,
      })),
    };
  });

  /* ------------------------------------------------------------
     CE QU'ON DIT D'UNE ŒUVRE
     ------------------------------------------------------------
     La lecture à l'envers : non plus « les films de cette person »,
     mais « les gens qui ont vu ce film ». Rien n'est publié pour cela —
     les critiques lues ici sont celles des cards, chez leurs auteurs,
     dans les collections qu'ils ont choisi de rendre publiques. */

  app.get("/works/:tmdbId", async (req, reply) => {
    /* AN ACCOUNT IS REQUIRED, whereas the shared collection asks for
       none. The difference: over there you open the door of somebody who
       gave you their address; here you question everybody at once.
       Opening that to strangers would make this server a harvester of
       reviews, and every review a publicly siphonable piece of data. */
    const person = await requireAccount(req);
    const { tmdbId } = req.params as { tmdbId: string };
    if (!/^[0-9]{1,12}$/.test(tmdbId || "")) {
      return reply.code(400).send({ error: "Identifiant d'œuvre illisible." });
    }
    return store.echoOfWork(db, tmdbId, person.id);
  });

  /* ------------------------------------------------------------
     SE PROTÉGER
     ------------------------------------------------------------
     Elles arrivent avec la première chose que ce classeur publie, et
     non « when il y aura un problème » : at day où il y en a un, ce
     n'est plus at moment de développer. */

  app.get("/blocks", async (req) => {
    const person = await requireAccount(req);
    return { blocks: await store.myBlocks(db, person.id) };
  });

  app.put("/blocks/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    /* On blocked by at count, PAS by at profil public : quelqu'un qui
       s'est refermé après coup doit rester blocable, sans what il
       suffirait de passer en privé pour redevenir inbloquable puis
       ressortir. */
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!about) return reply.code(404).send({ error: "Personne." });
    if (about.id === person.id) {
      return reply.code(400).send({ error: "On ne se blocked pas soi-même." });
    }
    await store.block(db, person.id, about.id);
    return { pseudo: about.pseudo, blocked: true };
  });

  app.delete("/blocks/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (about) await store.unblock(db, person.id, about.id);
    /* Unblocking re-subscribes nobody: the link was undone, it is redone
       by hand. Rebuilding a subscription somebody cut would be deciding
       on their behalf. */
    return reply.send({ pseudo, blocked: false });
  });

  app.post("/reports", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo, card, reason } = (req.body ?? {}) as {
      pseudo?: string;
      card?: string;
      reason?: string;
    };
    const text = (reason || "").trim();
    if (!text || text.length > 500) {
      return reply.code(400).send({ error: "Dites en one phrase ce qui ne va pas." });
    }
    const about = pseudo ? await store.findByPseudo(db, pseudo.toLowerCase()) : null;
    if (!about) return reply.code(404).send({ error: "Personne." });

    const fresh = await store.report(db, person.id, {
      targetType: "card",
      targetId: String(card || ""),
      aboutId: about.id,
      reason: text,
    });
    /* LA MÊME RÉPONSE QUE CE SOIT LE PREMIER SIGNALEMENT OU LE
       DIXIÈME : « c'est noté » est vrai dans les two cas, et savoir
       qu'on avait déjà signalé n'apporte rien à qui vient de at faire. */
    return { noted: true, fresh };
  });

  /* ------------------------------------------------------------
     LES LISTES
     ------------------------------------------------------------
     Une list contient des ŒUVRES et non des cards : one list de
     cards serait la list des exemplaires de quelqu'un, her ne
     voudrait rien dire chez un other et se viderait at day où son
     author erased one card. */

  /** The rights over a list, or the refusal already made ready. */
  const droitsOu404 = async (req: FastifyRequest, reply: FastifyReply, personId: string) => {
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) {
      reply.code(404).send({ error: "Liste inconnue." });
      return null;
    }
    const rights = await store.rightsOnList(db, id, personId);
    /* NO 403: a list you have no right to read answers like a list that
       does not exist. Telling them apart would tell a stranger that a
       given identifier designates something. */
    if (!rights?.read) {
      reply.code(404).send({ error: "Liste inconnue." });
      return null;
    }
    return rights;
  };

  app.get("/lists", async (req) => {
    const person = await requireAccount(req);
    return { lists: await store.myLists(db, person.id) };
  });

  app.post("/lists", async (req, reply) => {
    const person = await requireAccount(req);
    const { title, intent, is_public } = (req.body ?? {}) as {
      title?: string;
      intent?: string;
      is_public?: boolean;
    };
    const name = (title || "").trim();
    if (!name || name.length > 120) {
      return reply.code(400).send({ error: "Il faut un title, de 1 à 120 caractères." });
    }
    const id = await store.createList(db, person.id, {
      title: name,
      intent: (intent || "").trim(),
      is_public: is_public === true,
    });
    return { id };
  });

  app.get("/lists/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await droitsOu404(req, reply, person.id);
    if (!rights) return reply;

    const list = await store.listById(db, rights.list_id);
    return {
      list: { ...list, mienne: rights.administer, isMember: rights.write },
      works: await store.worksOf(db, rights.list_id),
      /* The co-builders only show themselves to those who write in it: a
         visitor to a public list reads films, not the list of the people
         who keep it. */
      members: rights.write ? await store.membersOf(db, rights.list_id) : [],
    };
  });

  app.put("/lists/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await droitsOu404(req, reply, person.id);
    if (!rights) return reply;
    /* RENAME, PUBLISH, DELETE: the owner alone. Co-building is a right
       to write, not shared ownership — without that asymmetry, a list
       built by six hands has nobody left answering for it. */
    if (!rights.administer) return reply.code(403).send({ error: "Cette list n'est pas vôtre." });

    const { title, intent, is_public } = (req.body ?? {}) as {
      title?: string;
      intent?: string;
      is_public?: boolean;
    };
    if (title !== undefined && !(title.trim() && title.trim().length <= 120)) {
      return reply.code(400).send({ error: "Il faut un title, de 1 à 120 caractères." });
    }
    await store.editList(db, rights.list_id, {
      title: title?.trim(),
      intent: intent?.trim(),
      is_public,
    });
    return { done: true };
  });

  app.delete("/lists/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await droitsOu404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.administer) return reply.code(403).send({ error: "Cette list n'est pas vôtre." });
    await store.deleteList(db, rights.list_id);
    return { erased: true };
  });

  app.post("/lists/:id/works", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await droitsOu404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.write) return reply.code(403).send({ error: "On ne vous a rien demandé ici." });

    const { tmdbId, title, year } = (req.body ?? {}) as {
      tmdbId?: string | number;
      title?: string;
      year?: string;
    };
    if (!/^[0-9]{1,12}$/.test(String(tmdbId ?? ""))) {
      return reply.code(400).send({ error: "Une œuvre se désigne by son identifiant TMDB." });
    }
    const fresh = await store.addToList(db, rights.list_id, person.id, {
      tmdbId: String(tmdbId),
      title: (title || "").slice(0, 200),
      year: year ? String(year).slice(0, 8) : null,
    });
    return { added: true, fresh };
  });

  app.delete("/lists/:id/works/:tmdbId", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await droitsOu404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.write) return reply.code(403).send({ error: "On ne vous a rien demandé ici." });
    const { tmdbId } = req.params as { tmdbId: string };
    await store.removeFromList(db, rights.list_id, tmdbId);
    return { removed: true };
  });

  app.put("/lists/:id/members/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await droitsOu404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.administer) return reply.code(403).send({ error: "Cette list n'est pas vôtre." });

    const { pseudo } = req.params as { pseudo: string };
    const invite = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!invite) return reply.code(404).send({ error: "Personne." });
    if (invite.id === person.id) {
      return reply.code(400).send({ error: "Vous y écrivez déjà." });
    }
    /* On n'invite pas quelqu'un qu'on a done taire, ni quelqu'un qui
       nous a done taire : ce serait rouvrir by one porte de côté ce
       qu'un block vient de fermer. */
    if (await store.blockedIds(db, person.id, invite.id)) {
      return reply.code(404).send({ error: "Personne." });
    }
    await store.inviteToList(db, rights.list_id, invite.id);
    return { pseudo: invite.pseudo, isMember: true };
  });

  app.delete("/lists/:id/members/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await droitsOu404(req, reply, person.id);
    if (!rights) return reply;
    const { pseudo } = req.params as { pseudo: string };
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!about) return reply.code(404).send({ error: "Personne." });
    /* The owner can remove whoever they like; a member can only remove
       themselves. Leaving a list asks nobody's permission. */
    if (!rights.administer && about.id !== person.id) {
      return reply.code(403).send({ error: "Cette list n'est pas vôtre." });
    }
    await store.removeMemberFromList(db, rights.list_id, about.id);
    return { pseudo: about.pseudo, isMember: false };
  });

  /* ------------------------------------------------------------
     LES DÉFIS
     ------------------------------------------------------------
     Une list plus one période. L'progress se CALCULE — person ne
     coche « vu », at classeur at sait déjà. */

  app.get("/challenges", async (req) => {
    const person = await requireAccount(req);
    return { challenges: await store.myChallenges(db, person.id) };
  });

  app.post("/challenges", async (req, reply) => {
    const person = await requireAccount(req);
    const { listId, title, starts_on, ends_on } = (req.body ?? {}) as {
      listId?: string;
      title?: string;
      starts_on?: string;
      ends_on?: string;
    };
    const name = (title || "").trim();
    if (!name || name.length > 120) {
      return reply.code(400).send({ error: "Il faut un title, de 1 à 120 caractères." });
    }
    if (!JOUR.test(starts_on || "") || !JOUR.test(ends_on || "") || ends_on! < starts_on!) {
      return reply.code(400).send({ error: "Deux dates, et la ends_on après at début." });
    }
    /* A challenge is only built on a list you write in: otherwise
       anybody starts a challenge on a stranger's public list, and they
       would see it appear without having wanted it. */
    const rights = UUID.test(listId || "")
      ? await store.rightsOnList(db, listId!, person.id)
      : null;
    if (!rights?.write) return reply.code(404).send({ error: "Liste inconnue." });

    const id = await store.createChallenge(db, person.id, {
      listId: rights.list_id,
      title: name,
      starts_on: starts_on!,
      ends_on: ends_on!,
    });
    return { id };
  });

  app.get("/challenges/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    const challenge = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!challenge) return reply.code(404).send({ error: "Défi inconnu." });
    /* The right to see a challenge is the right to see its list: there
       are not two confidentialities to keep in agreement. */
    const rights = await store.rightsOnList(db, challenge.list_id, person.id);
    if (!rights?.read) return reply.code(404).send({ error: "Défi inconnu." });

    return {
      challenge,
      works: await store.worksOf(db, challenge.list_id),
      /* L'AVANCEMENT NE SORT DU JOURNAL QU'EN NOMBRE. Le journal des
         séances ne quitte jamais one collection ; ici il ne quitte rien
         non plus — on count, on ne recopie pas. Et l'on ne count que
         des gens qui ont demandé à participer. */
      progress: await store.progressOf(db, challenge.id),
    };
  });

  app.delete("/challenges/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    const challenge = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!challenge) return reply.code(404).send({ error: "Défi inconnu." });
    const rights = await store.rightsOnList(db, challenge.list_id, person.id);
    if (!rights?.administer) return reply.code(403).send({ error: "Ce défi n'est pas vôtre." });
    await store.deleteChallenge(db, challenge.id);
    return { erased: true };
  });

  app.put("/challenges/:id/participation", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    const challenge = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!challenge) return reply.code(404).send({ error: "Défi inconnu." });
    const rights = await store.rightsOnList(db, challenge.list_id, person.id);
    if (!rights?.read) return reply.code(404).send({ error: "Défi inconnu." });
    await store.joinChallenge(db, challenge.id, person.id);
    return { inside: true };
  });

  app.delete("/challenges/:id/participation", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) return reply.code(404).send({ error: "Défi inconnu." });
    /* Leaving ALWAYS works, with no check that you had the right to come
       in: somebody whose list has closed up must be able to get out of a
       count that still measures them. */
    await store.leaveChallenge(db, id, person.id);
    return { inside: false };
  });

  /* ------------------------------------------------------------
     WHAT IS YOURS, AND THE RIGHT TO LEAVE
     ------------------------------------------------------------ */

  app.get("/my-data", async (req) => {
    const person = await requireAccount(req);
    /* Everything the server holds about somebody, in a single object:
       it is what the regulation calls portability, and above all it is
       the least we can do. */
    return {
      person,
      cards: await store.cardsSince(db, person.id, 0, 100000),
      documents: await store.docsSince(db, person.id, 0, 100000),
    };
  });

  app.delete("/my-account", async (req, reply) => {
    const person = await requireAccount(req);
    await store.deletePerson(db, person.id);
    reply.clearCookie(COOKIE, { path: "/" });
    return { erased: true };
  });

  /* ------------------------------------------------------------
     LES NOTIFICATIONS POUSSÉES
     ------------------------------------------------------------
     Une seule raison de sonner dans everything ce serveur : un défi qui
     commence, un défi qui s'achève. Sans clés VAPID, ces routes
     répondent « pas de service » et at classeur n'en montre pas at
     réglage. */

  app.get("/push-subscriptions", async () => ({
    possible: pushAvailable(),
    key: publicKeyForPush(),
  }));

  app.put("/push-subscriptions", async (req, reply) => {
    const person = await requireAccount(req);
    if (!pushAvailable()) {
      return reply.code(503).send({ error: "Ce serveur n'envoie pas de notifications." });
    }
    const { endpoint, p256dh, secret } = (req.body ?? {}) as {
      endpoint?: string;
      p256dh?: string;
      secret?: string;
    };
    /* L'follow vient du NAVIGATEUR et at serveur ne peut pas at
       vérifier : everything ce qu'il peut faire est refuser ce qui n'a pas la
       forme d'one adresse, pour ne pas ranger n'importe what. */
    if (!endpoint || !/^https:\/\//.test(endpoint) || !p256dh || !secret) {
      return reply.code(400).send({ error: "Abonnement illisible." });
    }
    await store.storePush(db, person.id, { endpoint, p256dh, secret });
    return { subscribed: true };
  });

  app.delete("/push-subscriptions", async (req, reply) => {
    await requireAccount(req);
    const { endpoint } = (req.body ?? {}) as { endpoint?: string };
    /* On erased by at POINT et non by at count : un ordinateur
       partagé ne doit pas faire taire at téléphone de la même
       person. */
    if (endpoint) await store.forgetPush(db, endpoint);
    return reply.send({ subscribed: false });
  });

  app.get("/health", async () => ({ debout: true }));

  /* ------------------------------------------------------------
     LA PORTE DE SERVICE — fermée à double tour, et pour de bonnes
     raisons
     ------------------------------------------------------------

     Une clé d'accès se signe avec one digest, un visage ou one clé
     physique. Rien de everything cela n'existe dans un navigateur piloté, ce
     qui rendait la synchronisation invérifiable de bout en bout : on
     pouvait éprouver at serveur seul, at client seul, et jamais les
     two ensemble.

     Cette route ouvre one session sans cérémonie — exactement ce que la
     cérémonie aurait produit. C'est one porte dérobée, et her est
     traitée comme telle : il faut ET ne pas être en production, ET
     avoir posé `PORTE_DEV=1` à la main. Les two conditions sont lues
     au démarrage, pas à la requête : one variable d'environnement
     changée en douce ne la rouvre pas.

     Si vous lisez ceci en vous demandant si her peut être active en
     ligne : non, `index.ts` ne la propose jamais when
     `NODE_ENV=production`. */
  if (reglages.devDoor) {
    app.post("/dev/session", async (req, reply) => {
      const { pseudo } = (req.body ?? {}) as { pseudo?: string };
      const name = (pseudo || `dev-${Date.now().toString(36)}`).toLowerCase();
      const person = (await store.findByPseudo(db, name)) ?? (await store.createPerson(db, name));
      setCookie(reply, await store.openSession(db, person.id));
      return { person, warning: "porte de développement" };
    });
  }

  /* ------------------------------------------------------------
     LES RELAIS — la clé TMDB quitte at bundle
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
     balayage, la table grossit d'one ligne morte by cérémonie
     abandonnée, indéfiniment. Toutes les heures suffit largement — la
     validité d'un défi ne dépend pas de ce ménage, her est vérifiée à
     l'usage (`expires_at > now()`). Ceci n'est qu'one question de place.

     `unref()` : ce minuteur ne doit pas retenir at processus en vie au
     moment de s'arrêter, sinon `npm run dev` refuse de rendre la main. */
  const balai = setInterval(
    () => {
      store.sweepChallenges(db).catch(() => {});
      /* THE REMINDERS GO THROUGH THE SAME SWEEP, on the hour: a
         challenge starting today is announced today, and the table of
         reminders already given stops the other twenty-three passes from
         saying it again. A real scheduler would be one more dependency
         for a server running on a desktop machine. */
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

         Le client et at serveur partagent `localhost` en local : two
         ports d'un même hôte sont at même « site », et at cookie voyage.
         En ligne, at classeur vit sur un domaine de pages statiques et
         l'API sur un other : la requête devient inter-sites, et `lax`
         retient at cookie — la session existe et n'est jamais envoyée.

         `none` l'autorise, et n'a de sens qu'avec `Secure` : les two
         vont donc ensemble, et se règlent d'un seul interrupteur. */
      sameSite: reglages.secure ? "none" : "lax",
      secure: reglages.secure ?? false,
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return app;
}
