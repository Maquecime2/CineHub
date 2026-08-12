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
   LE RELAIS A SON PROPRE PLAFOND, ET IL LE FAUT
   ============================================================

   Le serveur limite à cent requêtes par minute et par adresse, ce qui
   est juste pour des routes qui écrivent : personne ne range son
   étagère cent fois par minute. Appliqué au relais, c'était faux, et
   d'une façon qui ne se voit qu'à l'usage.

   « Compléter les fiches » demande à TMDB UNE requête par film — deux
   quand il faut d'abord le chercher — cinq à la fois. Sur une
   collection de quelques centaines de fiches, les cent sont franchies
   en quelques secondes, et TOUT le reste de la minute repart en 429 :
   le remplissage, mais aussi la synchronisation et les documents, qui
   partagent le compteur. Le classeur semblait alors cassé au moment
   précis où il travaillait le mieux.

   Le plafond ci-dessous ne protège donc pas des mêmes choses. Il ne
   défend pas une base contre l'écriture en boucle, il défend une
   FACTURE et un quota chez TMDB — dont la limite à lui se compte en
   dizaines de requêtes par SECONDE. Dix par seconde laisse passer un
   remplissage entier sans le hacher, et arrête encore net un client qui
   tourne en rond.

   Réglable, parce que c'est la facture de celui qui héberge : voir
   `TMDB_PAR_MINUTE` dans `index.ts`. */
const DEFAULT_TMDB_CEILING = 600;

export interface RelayOptions {
  /** La clé TMDB. Absente, le relais répond « pas de service ici ». */
  tmdbKey?: string;
  /** Qui parle — le relais TMDB n'est ouvert qu'aux comptes. */
  requireAccount: (req: never) => Promise<unknown>;
  /** Requêtes TMDB par minute et par adresse. Défaut : 600. */
  tmdbCeiling?: number;
}

export function registerRelays(app: FastifyInstance, options: RelayOptions): void {
  /* ------------------------------------------------------------
     TMDB
     ------------------------------------------------------------ */
  app.get(
    "/tmdb/*",
    /* Surcharge le plafond global pour cette route seule — voir
       `PLAFOND_TMDB_DEFAUT` ci-dessus pour ce qui la distingue des
       autres. Le reste du serveur garde ses cent par minute. */
    {
      config: {
        rateLimit: { max: options.tmdbCeiling ?? DEFAULT_TMDB_CEILING, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      /* IL FAUT UN COMPTE, ET C'EST LE PRIX DE LA CLÉ. Sans cette ligne,
       le relais est un accès TMDB gratuit et anonyme pour la Terre
       entière, sur notre quota. Un classeur sans compte garde donc sa
       propre clé — c'est ce qu'il fait déjà, et il marche très bien. */
      await options.requireAccount(req as never);

      /* LA LISTE D'ABORD, LA CLÉ ENSUITE, et l'ordre est une question de
       franchise : un chemin qu'on ne relaiera jamais doit s'entendre
       dire ça, et non « il n'y a pas de clé ici » — qui laisserait
       croire qu'avec une clé, ça passerait. */
      const chemin = "/" + ((req.params as { "*"?: string })["*"] ?? "");
      if (!TMDB_PATHS.some((r) => r.test(chemin))) {
        return reply.code(404).send({ erreur: "Ce chemin n'est pas relayé." });
      }

      if (!options.tmdbKey) {
        return reply.code(503).send({ erreur: "Aucune clé TMDB de ce côté-ci." });
      }

      /* LA CLÉ DU CLIENT EST JETÉE, PAS TRANSMISE. Il n'a rien à envoyer,
       et s'il envoie quelque chose, ce n'est pas ce qui servira. */
      const params = new URLSearchParams(req.query as Record<string, string>);
      params.delete("api_key");
      params.set("api_key", options.tmdbKey);

      const rep = await fetch(`${TMDB}${chemin}?${params}`);
      const texte = await rep.text();
      /* On repasse le corps ET le code : un 404 de TMDB doit rester un 404
         pour le client, sinon il retente indéfiniment un film qui n'existe
         pas. Le 429 aussi, que le client sait déjà attendre.

         ET SON DÉLAI AVEC, ce qui manquait pour que la phrase ci-dessus
         soit vraie. Un 429 sans `retry-after` n'apprend rien : le client
         retombe sur une attente inventée — une seconde, deux, trois — qui
         n'a aucun rapport avec le temps qu'il faut réellement patienter.
         TMDB dit ce délai ; le taire au passage revenait à le perdre. */
      const delai = rep.headers.get("retry-after");
      if (delai) reply.header("retry-after", delai);
      return reply
        .code(rep.status)
        .header("content-type", rep.headers.get("content-type") ?? "application/json")
        .send(texte);
    }
  );

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
