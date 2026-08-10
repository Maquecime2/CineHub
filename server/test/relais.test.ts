import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { baseDEssai, appDEssai } from "./aide.ts";
import * as depot from "../src/depot.ts";
import type { Base } from "../src/base.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LES RELAIS

   On ne parle pas au vrai TMDB dans un test : ce serait dépendre d'un
   réseau et d'un quota pour savoir si NOTRE code est juste. On double
   donc `fetch`, et on regarde ce que le serveur a demandé — c'est là
   qu'est tout l'enjeu : quelle adresse, avec quelle clé, et pour qui.
   ============================================================ */

let base: Base;
let app: FastifyInstance;
let demandes: string[];

async function connecte(pseudo = "varda") {
  const personne = await depot.creerPersonne(base, pseudo);
  return `session=${await depot.ouvrirSession(base, personne.id)}`;
}

beforeEach(async () => {
  base = await baseDEssai();
  demandes = [];
  vi.stubGlobal("fetch", async (url: string | URL) => {
    demandes.push(String(url));
    return new Response('{"results":[]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  app = await appDEssai(base, { cleTmdb: "LA-CLE-DU-SERVEUR" });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  await base.fermer();
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

  it("sans clé de ce côté-ci, il le dit au lieu de faire semblant", async () => {
    const nu = await appDEssai(base, {});
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
