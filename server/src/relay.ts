/* ============================================================
   THE RELAYS — what the browser cannot go and fetch on its own
   ============================================================

   Two needs with nothing to do with each other, and two different
   answers.

   TMDB: the client carries a key, and a key in a JavaScript bundle is a
   published key. Anybody can extract it and use it until it is revoked —
   on the account of whoever put it there. The relay keeps it on the
   server side, where nobody can read it.

   LETTERBOXD: nothing secret, only pages that carry no cross-origin
   authorisation header. So the browser refuses to read the response. The
   server is not a browser: that rule does not concern it. Until now the
   client went through a third-party public relay, which saw every
   username asked for go past.

   AND THERE ARE TWO PATHS NOW, NOT ONE. The feed carries the screenings;
   the watchlist has no feed at all (`/watchlist/rss/` answers 403) and is
   read from the profile's public pages. Both were needed the day the
   binder started relaying that account BY ITSELF, on a timer: a
   third-party relay seeing one username go past when somebody clicks
   "import" is not the same thing as seeing everybody's, every quarter of
   an hour, for ever.
   ============================================================ */
import type { FastifyInstance } from "fastify";
import { MAX_SEEDS, lineageLinks } from "./wikidata.ts";

/* WHAT WE AGREE TO RELAY, SPELLED OUT IN FULL.

   A relay that forwards any path at all is an open relay: you lend your
   key, your IP address and your bill to whoever comes along. The list
   below is exactly the set of calls the client makes — eleven paths, not
   one more. A path missing from here is not relayed, even if it exists at
   TMDB. */
const TMDB_PATHS: RegExp[] = [
  /^\/configuration$/,
  /^\/search\/movie$/,
  /^\/search\/person$/,
  /^\/discover\/movie$/,
  /^\/genre\/movie\/list$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/images$/,
  /^\/movie\/\d+\/keywords$/,
  /^\/movie\/\d+\/credits$/,
  /^\/movie\/\d+\/recommendations$/,
  /^\/person\/\d+\/movie_credits$/,
];

const TMDB = "https://api.themoviedb.org/3";

/* Un pseudonyme Letterboxd, et rien qui puisse construire une autre
   adresse : sans cette borne, le paramètre devient une machine à faire
   visiter n'importe quoi à notre serveur. Les deux routes Letterboxd la
   partagent — une garde recopiée est une garde qui finit par diverger. */
const okPseudo = (pseudo: string): boolean => /^[A-Za-z0-9_]{1,32}$/.test(pseudo);

/* La même borne que `MAX_PAGES` chez le client, et pour la même raison.
   Voir la route plus bas. */
const MAX_WATCHLIST_PAGES = 40;

/* ============================================================
   THE RELAY HAS ITS OWN CEILING, AND IT NEEDS ONE
   ============================================================

   The server limits to a hundred requests per minute per address, which
   is right for routes that write: nobody arranges their shelf a hundred
   times a minute. Applied to the relay it was wrong, and wrong in a way
   that only shows in use.

   "Complete the cards" asks TMDB for ONE request per film — two when it
   has to search for it first — five at a time. On a collection of a few
   hundred cards, the hundred are crossed in seconds, and ALL the rest of
   the minute comes back as 429: the filling in, but also the
   synchronisation and the documents, which share the counter. The binder
   then looked broken at the exact moment it was working best.

   So the ceiling below does not protect against the same things. It does
   not defend a database against writing in a loop, it defends a BILL and
   a quota at TMDB — whose own limit is counted in tens of requests per
   SECOND. Ten a second lets a whole filling-in through without chopping
   it up, and still stops dead a client going round in circles.

   Adjustable, because it is the bill of whoever hosts it: see
   `TMDB_PER_MINUTE` in `index.ts`. */
const DEFAULT_TMDB_CEILING = 600;

/* WIKIDATA IS FREE, WHICH IS PRECISELY WHY IT NEEDS A CEILING HERE.
   Nothing is billed, so nothing would ever complain: a client going
   round in circles would simply hammer a public, shared endpoint under
   our address until that address is turned away — and it would be turned
   away for everyone using this server, not for the one going round.

   Sixty a minute is wide for the only thing that calls: the harvest asks
   ONE request per fifty film-makers. */
const DEFAULT_HINTS_CEILING = 60;

export interface RelayOptions {
  /** The TMDB key. Missing, the relay answers "no service here". */
  tmdbKey?: string;
  /** Who is speaking — the TMDB relay is open to accounts only. */
  requireAccount: (req: never) => Promise<unknown>;
  /** TMDB requests per minute per address. Default: 600. */
  tmdbCeiling?: number;
  /** Wikidata requests per minute per address. Default: 60. */
  hintsCeiling?: number;
}

export function registerRelays(app: FastifyInstance, options: RelayOptions): void {
  /* ------------------------------------------------------------
     TMDB
     ------------------------------------------------------------ */
  app.get(
    "/tmdb/*",
    /* Overrides the global ceiling for this route alone — see
       `DEFAULT_TMDB_CEILING` above for what sets it apart from the
       others. The rest of the server keeps its hundred a minute. */
    {
      config: {
        rateLimit: { max: options.tmdbCeiling ?? DEFAULT_TMDB_CEILING, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      /* AN ACCOUNT IS REQUIRED, AND THAT IS THE PRICE OF THE KEY. Without
       this line, the relay is free anonymous TMDB access for the whole
       Earth, on our quota. A binder with no account therefore keeps its
       own key — which is what it already does, and it works very well. */
      await options.requireAccount(req as never);

      /* THE LIST FIRST, THE KEY SECOND, and the order is a matter of
       frankness: a path we will never relay must be told so, and not
       "there is no key here" — which would suggest that with a key, it
       would go through. */
      const path = "/" + ((req.params as { "*"?: string })["*"] ?? "");
      if (!TMDB_PATHS.some((r) => r.test(path))) {
        return reply.code(404).send({ error: "Ce chemin n'est pas relayé." });
      }

      if (!options.tmdbKey) {
        return reply.code(503).send({ error: "Aucune clé TMDB de ce côté-ci." });
      }

      /* THE CLIENT'S KEY IS THROWN AWAY, NOT FORWARDED. It has nothing to
       send, and if it sends something, that is not what will be used. */
      const params = new URLSearchParams(req.query as Record<string, string>);
      params.delete("api_key");
      params.set("api_key", options.tmdbKey);

      const res = await fetch(`${TMDB}${path}?${params}`);
      const text = await res.text();
      /* We pass the body back AND the code: a 404 from TMDB must stay a
         404 for the client, otherwise it retries a film that does not
         exist indefinitely. The 429 too, which the client already knows
         how to wait out.

         AND ITS DELAY WITH IT, which was what the sentence above needed
         to be true. A 429 with no `retry-after` teaches nothing: the
         client falls back on an invented wait — one second, two, three —
         that has no relation to how long it actually has to be patient.
         TMDB says that delay; saying nothing about it lost it. */
      const delay = res.headers.get("retry-after");
      if (delay) reply.header("retry-after", delay);
      return reply
        .code(res.status)
        .header("content-type", res.headers.get("content-type") ?? "application/json")
        .send(text);
    }
  );

  /* ------------------------------------------------------------
     WIKIDATA — the filiations the binder cannot invent
     ------------------------------------------------------------ */
  app.get(
    "/lineage/hints",
    {
      config: {
        rateLimit: { max: options.hintsCeiling ?? DEFAULT_HINTS_CEILING, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      /* AN ACCOUNT, LIKE THE OTHER RELAY. Not to protect a key — there
         is none — but an address: what goes out of here goes out under
         ours, and a public endpoint that turns it away turns away
         everybody on this server at once. */
      await options.requireAccount(req as never);

      /* DIGITS, COMMAS, AND FIFTY OF THEM. This is the Letterboxd bound
         and the same reason: unchecked, the parameter is a machine for
         writing somebody else's query with our User-Agent on it. */
      const raw = String((req.query as { tmdb?: string }).tmdb ?? "");
      if (!/^\d{1,9}(,\d{1,9})*$/.test(raw)) {
        return reply.code(400).send({ error: "Des identifiants TMDB, separes par des virgules." });
      }
      const ids = [...new Set(raw.split(","))];
      if (ids.length > MAX_SEEDS) {
        return reply
          .code(400)
          .send({ error: `Cinquante identifiants au plus, ${ids.length} demandes.` });
      }

      try {
        return { links: await lineageLinks(ids) };
      } catch {
        /* 502 AND A SENTENCE, never an empty body: the screen tells
           "we could not ask" apart from "there is nothing", and it can
           only do that if the failure reaches it. */
        return reply.code(502).send({ error: "Wikidata n'a pas repondu." });
      }
    }
  );

  /* ------------------------------------------------------------
     LETTERBOXD
     ------------------------------------------------------------ */
  app.get("/letterboxd/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    if (!okPseudo(pseudo)) {
      return reply.code(400).send({ error: "Pseudonyme Letterboxd improbable." });
    }

    const res = await fetch(`https://letterboxd.com/${pseudo}/rss/`, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) {
      return reply.code(res.status === 404 ? 404 : 502).send({
        error:
          res.status === 404 ? "Pas de flux pour ce pseudonyme." : "Letterboxd n'a pas répondu.",
      });
    }
    return reply.type("application/xml; charset=utf-8").send(await res.text());
  });

  /* ------------------------------------------------------------
     LETTERBOXD — LA WATCHLIST, QUI N'A PAS DE FLUX
     ------------------------------------------------------------

     `/{pseudo}/watchlist/rss/` répond 403 : il n'y a pas de flux de
     souhaits, et il n'y en a jamais eu. On relaie donc les pages
     publiques du profil, en HTML. Le client sait déjà les lire
     (`parseWatchlistPage`) et sait déjà qu'un gabarit peut changer sans
     prévenir ; ce qui se passe ici n'ajoute rien à cette fragilité.

     LA PAGE EST BORNÉE, ET C'EST LA MÊME BORNE QUE CHEZ LE CLIENT.
     Letterboxd sert 28 films par page : quarante pages sont mille cent
     films, au-delà desquels on ne relaie plus. Ce n'est pas une limite
     de goût, c'est ce qui empêche une pagination mal lue — ou un
     paramètre inventé — de faire tourner notre serveur en rond sur le
     leur. */
  app.get("/letterboxd/:pseudo/watchlist/:page", async (req, reply) => {
    const { pseudo, page } = req.params as { pseudo: string; page: string };
    if (!okPseudo(pseudo)) {
      return reply.code(400).send({ error: "Pseudonyme Letterboxd improbable." });
    }
    /* `Number` sur une chaîne vide rend 0 et non `NaN` : la comparaison
       aux bornes est donc la seule garde, et elle suffit. */
    const n = Number(page);
    if (!Number.isInteger(n) || n < 1 || n > MAX_WATCHLIST_PAGES) {
      return reply.code(400).send({ error: "Page de watchlist hors bornes." });
    }

    const res = await fetch(`https://letterboxd.com/${pseudo}/watchlist/page/${n}/`, {
      headers: { accept: "text/html" },
    });
    if (!res.ok) {
      return reply.code(res.status === 404 ? 404 : 502).send({
        error:
          res.status === 404
            ? "Pas de watchlist pour ce pseudonyme."
            : "Letterboxd n'a pas répondu.",
      });
    }
    return reply.type("text/html; charset=utf-8").send(await res.text());
  });

  /* ------------------------------------------------------------
     WIKIDATA — qui a formé qui
     ------------------------------------------------------------

     Le navigateur ne peut pas interroger le point SPARQL directement, et
     de toute façon on ne veut pas qu'il le fasse : voir
     `DEFAULT_HINTS_CEILING` ci-dessus, c'est notre adresse qui serait
     écartée, pour tout le monde à la fois.

     UN COMPTE EST REQUIS, comme pour TMDB et pour la même raison : sans
     cette ligne, c'est un accès anonyme à un service public sous notre
     nom.

     LES GRAINES SONT BORNÉES PAR `MAX_SEEDS`, et la borne est celle de
     la requête elle-même (`sparqlFor`) : cinquante identifiants par
     question. Au-delà on tronque plutôt que de refuser — la moisson
     rappelle, et une page de résultats vaut mieux qu'un 400. */
  app.get(
    "/hints/lineage",
    {
      config: {
        rateLimit: { max: options.hintsCeiling ?? DEFAULT_HINTS_CEILING, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      await options.requireAccount(req as never);

      const raw = (req.query as { ids?: string }).ids ?? "";
      const ids = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d+$/.test(s))
        .slice(0, MAX_SEEDS);
      /* `[]` EST UNE RÉPONSE, et pas la même chose qu'une erreur : on n'a
         rien demandé à Wikidata, donc il n'y a rien à en dire. */
      if (!ids.length) return reply.send({ links: [] });

      try {
        return reply.send({ links: await lineageLinks(ids) });
      } catch {
        /* Wikidata est un tiers gratuit : son silence n'est pas une
           panne de ce serveur. */
        return reply.code(502).send({ error: "Wikidata n'a pas répondu." });
      }
    }
  );
}
