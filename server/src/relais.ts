/* ============================================================
   LES RELAIS — ce que le navigateur ne peut pas aller chercher seul
   ============================================================

   Deux besoins qui n'ont rien à voir l'un avec l'autre, et deux
   réponses différentes.

   TMDB : le client porte une clé, et une clé dans un bundle JavaScript
   est une clé publiée. N'importe qui peut l'extraire et s'en servir
   jusqu'à ce qu'elle soit révoquée — au compte de celui qui l'a mise là.
   Le relais la garde côté serveur, où elle n'est lisible par personne.

   LETTERBOXD : rien de secret, seulement un flux RSS qui ne porte aucun
   en-tête d'autorisation d'origine. Le navigateur refuse donc de lire
   la réponse. Le serveur, lui, n'est pas un navigateur : cette règle ne
   le concerne pas. Jusqu'ici le client passait par un relais public
   tiers, qui voyait passer chaque pseudonyme demandé.
   ============================================================ */
import type { FastifyInstance } from "fastify";

/* CE QU'ON ACCEPTE DE RELAYER, ÉCRIT EN TOUTES LETTRES.

   Un relais qui transmet n'importe quel chemin est un relais ouvert :
   on prête sa clé, son adresse IP et sa facture à qui passe. La liste
   ci-dessous est exactement celle des appels que le client fait — onze
   chemins, pas un de plus. Un chemin absent d'ici n'est pas relayé,
   même s'il existe chez TMDB. */
const CHEMINS_TMDB: RegExp[] = [
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

export interface OptionsRelais {
  /** La clé TMDB. Absente, le relais répond « pas de service ici ». */
  cleTmdb?: string;
  /** Qui parle — le relais TMDB n'est ouvert qu'aux comptes. */
  exigerUnCompte: (req: never) => Promise<unknown>;
}

export function poserLesRelais(app: FastifyInstance, options: OptionsRelais): void {
  /* ------------------------------------------------------------
     TMDB
     ------------------------------------------------------------ */
  app.get("/tmdb/*", async (req, reply) => {
    /* IL FAUT UN COMPTE, ET C'EST LE PRIX DE LA CLÉ. Sans cette ligne,
       le relais est un accès TMDB gratuit et anonyme pour la Terre
       entière, sur notre quota. Un classeur sans compte garde donc sa
       propre clé — c'est ce qu'il fait déjà, et il marche très bien. */
    await options.exigerUnCompte(req as never);

    /* LA LISTE D'ABORD, LA CLÉ ENSUITE, et l'ordre est une question de
       franchise : un chemin qu'on ne relaiera jamais doit s'entendre
       dire ça, et non « il n'y a pas de clé ici » — qui laisserait
       croire qu'avec une clé, ça passerait. */
    const chemin = "/" + ((req.params as { "*"?: string })["*"] ?? "");
    if (!CHEMINS_TMDB.some((r) => r.test(chemin))) {
      return reply.code(404).send({ erreur: "Ce chemin n'est pas relayé." });
    }

    if (!options.cleTmdb) {
      return reply.code(503).send({ erreur: "Aucune clé TMDB de ce côté-ci." });
    }

    /* LA CLÉ DU CLIENT EST JETÉE, PAS TRANSMISE. Il n'a rien à envoyer,
       et s'il envoie quelque chose, ce n'est pas ce qui servira. */
    const params = new URLSearchParams(req.query as Record<string, string>);
    params.delete("api_key");
    params.set("api_key", options.cleTmdb);

    const rep = await fetch(`${TMDB}${chemin}?${params}`);
    const texte = await rep.text();
    /* On repasse le corps ET le code : un 404 de TMDB doit rester un 404
       pour le client, sinon il retente indéfiniment un film qui n'existe
       pas. Le 429 aussi, que le client sait déjà attendre. */
    return reply
      .code(rep.status)
      .header("content-type", rep.headers.get("content-type") ?? "application/json")
      .send(texte);
  });

  /* ------------------------------------------------------------
     LETTERBOXD
     ------------------------------------------------------------ */
  app.get("/letterboxd/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    /* Un pseudonyme Letterboxd, et rien qui puisse fabriquer une autre
       adresse : sans cette borne, le paramètre devient une machine à
       faire visiter n'importe quoi à notre serveur. */
    if (!/^[A-Za-z0-9_]{1,32}$/.test(pseudo)) {
      return reply.code(400).send({ erreur: "Pseudonyme Letterboxd improbable." });
    }

    const rep = await fetch(`https://letterboxd.com/${pseudo}/rss/`, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!rep.ok) {
      return reply.code(rep.status === 404 ? 404 : 502).send({
        erreur:
          rep.status === 404 ? "Pas de flux pour ce pseudonyme." : "Letterboxd n'a pas répondu.",
      });
    }
    return reply.type("application/xml; charset=utf-8").send(await rep.text());
  });
}
