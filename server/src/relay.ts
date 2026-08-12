/* ============================================================
   THE RELAYS — what the browser cannot go and fetch on its own
   ============================================================

   Two needs with nothing to do with each other, and two different
   answers.

   TMDB: the client carries a key, and a key in a JavaScript bundle is a
   published key. Anybody can extract it and use it until it is revoked —
   on the account of whoever put it there. The relay keeps it on the
   server side, where nobody can read it.

   LETTERBOXD: nothing secret, only an RSS feed that carries no
   cross-origin authorisation header. So the browser refuses to read the
   response. The server is not a browser: that rule does not concern it.
   Until now the client went through a third-party public relay, which saw
   every username asked for go past.
   ============================================================ */
import type { FastifyInstance } from "fastify";

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

export interface RelayOptions {
  /** The TMDB key. Missing, the relay answers "no service here". */
  tmdbKey?: string;
  /** Who is speaking — the TMDB relay is open to accounts only. */
  requireAccount: (req: never) => Promise<unknown>;
  /** TMDB requests per minute per address. Default: 600. */
  tmdbCeiling?: number;
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
        return reply.code(404).send({ erreur: "Ce chemin n'est pas relayé." });
      }

      if (!options.tmdbKey) {
        return reply.code(503).send({ erreur: "Aucune clé TMDB de ce côté-ci." });
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
     LETTERBOXD
     ------------------------------------------------------------ */
  app.get("/letterboxd/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    /* A Letterboxd username, and nothing that could build another
       address: without this bound, the parameter becomes a machine for
       making our server visit anything at all. */
    if (!/^[A-Za-z0-9_]{1,32}$/.test(pseudo)) {
      return reply.code(400).send({ erreur: "Pseudonyme Letterboxd improbable." });
    }

    const res = await fetch(`https://letterboxd.com/${pseudo}/rss/`, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) {
      return reply.code(res.status === 404 ? 404 : 502).send({
        erreur:
          res.status === 404 ? "Pas de flux pour ce pseudonyme." : "Letterboxd n'a pas répondu.",
      });
    }
    return reply.type("application/xml; charset=utf-8").send(await res.text());
  });
}
