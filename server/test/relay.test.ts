import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { testDb, testApp } from "./helpers.ts";
import * as depot from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LES RELAIS

   On ne parle pas au vrai TMDB dans un test : ce serait dépendre d'un
   réseau et d'un quota pour savoir si NOTRE code est juste. On double
   donc `fetch`, et on regarde ce que le serveur a demandé — c'est là
   qu'est tout l'enjeu : quelle adresse, avec quelle clé, et pour qui.
   ============================================================ */

let base: Db;
let app: FastifyInstance;
let demandes: string[];

async function connecte(pseudo = "varda") {
  const personne = await depot.createPerson(base, pseudo);
  return `session=${await depot.openSession(base, personne.id)}`;
}

beforeEach(async () => {
  base = await testDb();
  demandes = [];
  vi.stubGlobal("fetch", async (url: string | URL) => {
    demandes.push(String(url));
    return new Response('{"results":[]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  app = await testApp(base, { tmdbKey: "LA-CLE-DU-SERVEUR" });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  await base.close();
});

describe("le relais TMDB", () => {
  it("refuse qui n'a pas de compte : une clé prêtée à tous n'est plus une clé", async () => {
    const r = await app.inject({ method: "GET", url: "/tmdb/search/movie?query=cleo" });
    expect(r.statusCode).toBe(401);
    expect(demandes).toEqual([]);
  });

  it("relaie un chemin connu, avec LA clé du serveur", async () => {
    const cookie = await connecte();
    const r = await app.inject({
      method: "GET",
      url: "/tmdb/search/movie?query=cleo",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(demandes).toHaveLength(1);
    expect(demandes[0]).toContain("https://api.themoviedb.org/3/search/movie");
    expect(demandes[0]).toContain("query=cleo");
    expect(demandes[0]).toContain("api_key=LA-CLE-DU-SERVEUR");
  });

  it("jette la clé que le client aurait glissée dans sa requête", async () => {
    const cookie = await connecte();
    await app.inject({
      method: "GET",
      url: "/tmdb/movie/42?api_key=LA-CLE-DE-QUELQUUN-DAUTRE",
      headers: { cookie },
    });
    expect(demandes[0]).toContain("api_key=LA-CLE-DU-SERVEUR");
    expect(demandes[0]).not.toContain("LA-CLE-DE-QUELQUUN-DAUTRE");
  });

  it("ne relaie que les chemins écrits en toutes lettres", async () => {
    const cookie = await connecte();
    /* Un relais qui transmet n'importe quoi prête sa clé, son adresse et
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
    expect(demandes).toEqual([]);
  });

  it("repasse le code de TMDB tel quel", async () => {
    /* Un 404 transformé en 200 ferait retenter indéfiniment un film qui
       n'existe pas ; un 429 avalé ferait perdre le rythme d'attente. */
    vi.stubGlobal("fetch", async () => new Response('{"erreur":"rien"}', { status: 404 }));
    const cookie = await connecte();
    const r = await app.inject({
      method: "GET",
      url: "/tmdb/movie/999999999",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  /* LE DÉLAI D'ATTENTE DOIT TRAVERSER, sans quoi le 429 « que le client
     sait attendre » ne lui apprend rien : il retombe sur une seconde
     inventée, se refait refuser dans la même fenêtre, et brûle ses trois
     essais pour rien. */
  it("repasse le délai d'attente que TMDB annonce", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("{}", { status: 429, headers: { "retry-after": "47" } })
    );
    const cookie = await connecte();
    const r = await app.inject({ method: "GET", url: "/tmdb/movie/42", headers: { cookie } });
    expect(r.statusCode).toBe(429);
    expect(r.headers["retry-after"]).toBe("47");
  });

  /* ============================================================
     LE PLAFOND DU RELAIS N'EST PAS CELUI DU RESTE
     ============================================================

     Le serveur limite à cent requêtes par minute et par adresse, ce qui
     est juste pour des routes qui écrivent. Appliqué au relais, c'était
     faux : « compléter les fiches » demande UNE requête par film, cinq
     à la fois — trois cents fiches font trois cents requêtes, et les
     cent étaient franchies en quelques secondes. Tout le reste de la
     minute repartait en 429, y compris la synchronisation, qui partage
     le compteur. Le classeur semblait cassé au moment où il travaillait.

     Le test se joue avec un plafond bas, pour ne pas injecter six cents
     requêtes : ce qu'on éprouve n'est pas le chiffre, c'est le fait que
     le relais ait le SIEN. */
  it("laisse passer plus que le plafond général du serveur", async () => {
    const large = await testApp(base, { tmdbKey: "K", tmdbCeiling: 250 });
    const cookie = await connecte("chantal");
    /* Cent une : une de plus que le plafond global, qui refusait ici. */
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

  it("garde tout de même un plafond, sinon ce n'est plus un relais mais un robinet", async () => {
    const etroit = await testApp(base, { tmdbKey: "K", tmdbCeiling: 3 });
    const cookie = await connecte("jacques");
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

  /* Le plafond général reste ce qu'il est sur les autres routes : le
     relais a gagné une exception, pas le serveur entier. */
  it("ne desserre rien ailleurs", async () => {
    const etroit = await testApp(base, { tmdbKey: "K", tmdbCeiling: 3 });
    const cookie = await connecte("agnes");
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await etroit.inject({ method: "GET", url: "/moi", headers: { cookie } });
      codes.push(r.statusCode);
    }
    /* Cinq appels ne franchissent pas les cent : aucun 429 ici, et
       surtout aucun 429 à trois — le plafond du relais ne déborde pas
       sur les voisins. */
    expect(codes.filter((c) => c === 429)).toEqual([]);
    /* Et la route répond vraiment : sans cette ligne, un `/moi` devenu
       404 ferait passer le test sans rien prouver. */
    expect(codes[0]).toBe(200);
    await etroit.close();
  });

  it("sans clé de ce côté-ci, il le dit au lieu de faire semblant", async () => {
    const nu = await testApp(base, {});
    const cookie = await connecte("melville");
    const r = await nu.inject({
      method: "GET",
      url: "/tmdb/configuration",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(503);
    await nu.close();
  });
});

describe("le relais Letterboxd", () => {
  it("va chercher le flux que le navigateur ne peut pas lire", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      demandes.push(String(url));
      return new Response("<rss></rss>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    });
    const r = await app.inject({ method: "GET", url: "/letterboxd/agnesvarda" });
    expect(r.statusCode).toBe(200);
    expect(demandes[0]).toBe("https://letterboxd.com/agnesvarda/rss/");
    expect(r.body).toContain("<rss>");
  });

  it("n'accepte pas qu'on lui fasse visiter autre chose", async () => {
    /* Sans borne, le paramètre devient une machine à faire visiter
       n'importe quelle adresse à notre serveur. */
    for (const pseudo of ["../../admin", "quelquun/../..", "http:%2F%2Failleurs"]) {
      const r = await app.inject({ method: "GET", url: `/letterboxd/${pseudo}` });
      expect(r.statusCode).not.toBe(200);
    }
    expect(demandes).toEqual([]);
  });
});
