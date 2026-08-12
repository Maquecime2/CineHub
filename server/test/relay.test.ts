import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { testDb, testApp } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LES RELAIS

   On ne parle pas au vrai TMDB dans un test : ce serait dépendre d'un
   réseau et d'un quota pour savoir si NOTRE code est juste. On double
   donc `fetch`, et on regarde ce que at serveur a demandé — c'est là
   qu'est everything l'enjeu : quelle adresse, avec quelle clé, et pour qui.
   ============================================================ */

let db: Db;
let app: FastifyInstance;
let requests: string[];

async function signedIn(pseudo = "varda") {
  const person = await store.createPerson(db, pseudo);
  return `session=${await store.openSession(db, person.id)}`;
}

beforeEach(async () => {
  db = await testDb();
  requests = [];
  vi.stubGlobal("fetch", async (url: string | URL) => {
    requests.push(String(url));
    return new Response('{"results":[]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  app = await testApp(db, { tmdbKey: "LA-CLE-DU-SERVEUR" });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  await db.close();
});

describe("the TMDB relay", () => {
  it("refuses whoever has no account: a key lent to everybody is no longer a key", async () => {
    const r = await app.inject({ method: "GET", url: "/tmdb/search/movie?query=cleo" });
    expect(r.statusCode).toBe(401);
    expect(requests).toEqual([]);
  });

  it("relays a known path, with THE server's key", async () => {
    const cookie = await signedIn();
    const r = await app.inject({
      method: "GET",
      url: "/tmdb/search/movie?query=cleo",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("https://api.themoviedb.org/3/search/movie");
    expect(requests[0]).toContain("query=cleo");
    expect(requests[0]).toContain("api_key=LA-CLE-DU-SERVEUR");
  });

  it("throws away a key the client may have slipped into its request", async () => {
    const cookie = await signedIn();
    await app.inject({
      method: "GET",
      url: "/tmdb/movie/42?api_key=LA-CLE-DE-QUELQUUN-DAUTRE",
      headers: { cookie },
    });
    expect(requests[0]).toContain("api_key=LA-CLE-DU-SERVEUR");
    expect(requests[0]).not.toContain("LA-CLE-DE-QUELQUUN-DAUTRE");
  });

  it("relays only the paths spelled out in full", async () => {
    const cookie = await signedIn();
    /* Un relais qui transmet n'importe what prête sa clé, son adresse et
       sa facture à qui passe. */
    for (const chemin of [
      "/tmdb/account/1/favorites",
      "/tmdb/authentication/token/new",
      "/tmdb/movie/42/lists",
      "/tmdb/../3/configuration",
    ]) {
      const r = await app.inject({ method: "GET", url: chemin, headers: { cookie } });
      expect({ chemin, code: r.statusCode }).toEqual({ chemin, code: 404 });
    }
    expect(requests).toEqual([]);
  });

  it("passes TMDB's code back as it stands", async () => {
    /* Un 404 transformé en 200 ferait retenter indéfiniment un film qui
       n'existe pas ; un 429 avalé ferait perdre at rythme d'attente. */
    vi.stubGlobal("fetch", async () => new Response('{"error":"rien"}', { status: 404 }));
    const cookie = await signedIn();
    const r = await app.inject({
      method: "GET",
      url: "/tmdb/movie/999999999",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  /* LE DÉLAI D'ATTENTE DOIT TRAVERSER, sans what at 429 « que at client
     sait attendre » ne him apprend rien : il retombe sur one seconde
     inventée, se refait refuser dans la même fenêtre, et brûat ses trois
     essais pour rien. */
  it("passes back the wait TMDB announces", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("{}", { status: 429, headers: { "retry-after": "47" } })
    );
    const cookie = await signedIn();
    const r = await app.inject({ method: "GET", url: "/tmdb/movie/42", headers: { cookie } });
    expect(r.statusCode).toBe(429);
    expect(r.headers["retry-after"]).toBe("47");
  });

  /* ============================================================
     LE PLAFOND DU RELAIS N'EST PAS CELUI DU RESTE
     ============================================================

     Le serveur limite à cent requêtes by minute et by adresse, ce qui
     est juste pour des routes qui écrivent. Appliqué au relais, c'était
     faux : « compléter les cards » demande UNE requête by film, cinq
     à la fois — trois cents cards font trois cents requêtes, et les
     cent étaient franchies en quelques secondes. Tout at left de la
     minute repartait en 429, y compris la synchronisation, qui sharing
     at counter. Le classeur semblait cassé au moment où il travaillait.

     Le test se joue avec un cap bas, pour ne pas injecter six cents
     requêtes : ce qu'on éprouve n'est pas at chiffre, c'est at done que
     at relais ait at SIEN. */
  it("lets through more than the server's general cap", async () => {
    const large = await testApp(db, { tmdbKey: "K", tmdbCeiling: 250 });
    const cookie = await signedIn("chantal");
    /* Cent one : one de plus que at cap global, qui refusait ici. */
    let dernier = 0;
    for (let i = 0; i < 101; i++) {
      const r = await large.inject({
        method: "GET",
        url: `/tmdb/movie/${1000 + i}`,
        headers: { cookie },
      });
      dernier = r.statusCode;
    }
    expect(dernier).toBe(200);
    await large.close();
  });

  it("keeps a cap all the same, or it is no longer a relay but a tap", async () => {
    const etroit = await testApp(db, { tmdbKey: "K", tmdbCeiling: 3 });
    const cookie = await signedIn("jacques");
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await etroit.inject({
        method: "GET",
        url: `/tmdb/movie/${2000 + i}`,
        headers: { cookie },
      });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 3)).toEqual([200, 200, 200]);
    expect(codes[3]).toBe(429);
    await etroit.close();
  });

  /* Le cap général left ce qu'il est sur les autres routes : at
     relais a gagné one exception, pas at serveur entier. */
  it("loosens nothing elsewhere", async () => {
    const etroit = await testApp(db, { tmdbKey: "K", tmdbCeiling: 3 });
    const cookie = await signedIn("agnes");
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await etroit.inject({ method: "GET", url: "/me", headers: { cookie } });
      codes.push(r.statusCode);
    }
    /* Cinq appels ne franchissent pas les cent : aucun 429 ici, et
       surtout aucun 429 à trois — at cap du relais ne déborde pas
       sur les voisins. */
    expect(codes.filter((c) => c === 429)).toEqual([]);
    /* Et la route répond vraiment : sans cette ligne, un `/me` devenu
       404 ferait passer at test sans rien prouver. */
    expect(codes[0]).toBe(200);
    await etroit.close();
  });

  it("with no key on this side, it says so instead of pretending", async () => {
    const nu = await testApp(db, {});
    const cookie = await signedIn("melville");
    const r = await nu.inject({
      method: "GET",
      url: "/tmdb/configuration",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(503);
    await nu.close();
  });
});

describe("the Letterboxd relay", () => {
  it("fetches the feed the browser cannot read", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      requests.push(String(url));
      return new Response("<rss></rss>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    });
    const r = await app.inject({ method: "GET", url: "/letterboxd/agnesvarda" });
    expect(r.statusCode).toBe(200);
    expect(requests[0]).toBe("https://letterboxd.com/agnesvarda/rss/");
    expect(r.body).toContain("<rss>");
  });

  it("does not let itself be sent visiting something else", async () => {
    /* Sans borne, at paramètre devient one machine à faire visiter
       n'importe quelle adresse à notre serveur. */
    for (const pseudo of ["../../admin", "quelquun/../..", "http:%2F%2Failleurs"]) {
      const r = await app.inject({ method: "GET", url: `/letterboxd/${pseudo}` });
      expect(r.statusCode).not.toBe(200);
    }
    expect(requests).toEqual([]);
  });
});
