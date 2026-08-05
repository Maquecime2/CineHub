/* ============================================================
   LE FLUX LETTERBOXD — relever ses dernières séances sans fichier
   ============================================================

   L'import CSV demande d'aller sur Letterboxd, de réclamer un export, de
   télécharger un ZIP et de déposer un fichier. C'est la bonne façon
   d'AMORCER une vidéothèque, et une corvée pour y ajouter les six films
   vus depuis la dernière fois. Le flux public d'un membre suffit à ce
   second geste, et il porte plus que le CSV : la note, la date de
   séance, et surtout l'IDENTIFIANT TMDB du film.

   CE QUE LE FLUX NE FAIT PAS, et qu'il faut dire à l'écran plutôt que
   laisser découvrir :

     - il rend CENT entrées, dont la moitié sont des listes ; il reste
       donc une cinquantaine de séances, pas la vidéothèque entière ;
     - il n'existe pas de flux de watchlist (`/watchlist/rss/` répond
       403) : ce chemin ne rapporte que des films VUS.

   Le CSV n'est donc pas remplacé, il est complété.

   POURQUOI UN RELAIS. Letterboxd ne renvoie aucun en-tête
   `Access-Control-Allow-Origin` sur son flux : le navigateur refuse de
   lire la réponse, quoi qu'on fasse côté appli. Il faut un intermédiaire
   qui, lui, autorise la lecture. Il y en a deux ici, et le reste de
   l'appli n'a pas à savoir lequel sert :

     - EN DÉVELOPPEMENT, le serveur Vite relaie lui-même (voir
       `server.proxy` dans `vite.config.ts`). Aucun tiers, rien à régler.
     - EN LIGNE, le site est un GitHub Pages STATIQUE : il n'y a pas de
       serveur à nous pour relayer. On passe donc par un relais public,
       et l'adresse est un réglage — celui qui déploie le sien (voir
       `docs/relais-letterboxd.md`) le colle et ne dépend plus de
       personne. */
import { store } from "./storage";
import { filmKey, parseRating } from "../domain/importing";
import { mergeWatches } from "../domain/film";
import type { ImportRow, ParsedCsv } from "../types";

export const USER_KEY = "letterboxd-user";
export const RELAY_KEY = "letterboxd-relay";

/* Le relais par défaut. Un tiers voit passer la requête : c'est
   acceptable ICI parce que le flux est déjà public et qu'aucun secret ne
   transite — mais c'est aussi pourquoi l'adresse reste modifiable. */
export const DEFAULT_RELAY = "https://corsproxy.io/?url={url}";

const feedOf = (user: string) => `https://letterboxd.com/${encodeURIComponent(user)}/rss/`;

/** L'adresse à appeler pour lire le flux de `user`, relais compris. */
export function feedUrl(user: string, relay?: string): string {
  const clean = user.trim().replace(/^@/, "");
  /* En dev, le serveur Vite relaie : on lui parle en relatif, et le
     gabarit de relais ne sert pas. */
  if (import.meta.env.DEV) return `/lb-rss/${encodeURIComponent(clean)}/rss/`;
  const tpl = (relay ?? store.get(RELAY_KEY, DEFAULT_RELAY)).trim() || DEFAULT_RELAY;
  return tpl.replace("{url}", encodeURIComponent(feedOf(clean)));
}

/* Un champ d'espace de noms se lit par son nom COMPLET, préfixe compris :
   `querySelector("letterboxd:filmTitle")` ne le trouverait pas — les
   deux-points y sont un opérateur de pseudo-classe, pas une lettre. */
const tagOf = (item: Element, name: string): string =>
  item.getElementsByTagName(name)[0]?.textContent?.trim() || "";

/** Relève le flux et le rend sous la forme que l'import CSV produit déjà. */
export function parseLetterboxdRss(xml: string): ParsedCsv {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  /* Un relais en panne ne rend pas une erreur : il rend une page HTML,
     que le lecteur XML refuse. Sans ce test, on lirait « zéro film » et
     on chercherait longtemps du côté du pseudo. */
  if (doc.querySelector("parsererror") || !doc.querySelector("rss, channel"))
    throw new Error(
      "La réponse n'est pas un flux Letterboxd. Vérifiez le pseudo, ou le relais si vous en avez réglé un."
    );

  const items = [...doc.getElementsByTagName("item")];
  /* Le flux mélange les séances et les listes publiées. Seul le
     préfixe du `guid` les distingue — le reste de l'entrée se ressemble
     assez pour qu'une liste passe pour un film. */
  const watches = items.filter((it) => tagOf(it, "guid").startsWith("letterboxd-watch-"));

  let skippedNoTitle = 0;
  let extraWatches = 0;
  const byKey = new Map<string, ImportRow>();

  for (const it of watches) {
    const title = tagOf(it, "letterboxd:filmTitle");
    if (!title) {
      skippedNoTitle++;
      continue;
    }
    const yearRaw = tagOf(it, "letterboxd:filmYear");
    const tmdbId = tagOf(it, "tmdb:movieId");
    /* Un film peut être vu sans être noté : l'entrée n'a alors PAS de
       `memberRating`, et `parseRating` rend null — ce qui ne veut pas
       dire zéro, et n'écrasera donc aucune note existante. */
    const rating = parseRating(tagOf(it, "letterboxd:memberRating") || null);
    const date = tagOf(it, "letterboxd:watchedDate") || null;
    const rewatch = /^yes$/i.test(tagOf(it, "letterboxd:rewatch"));
    const row: ImportRow = {
      title,
      year: yearRaw ? Number(yearRaw) || "" : "",
      rating,
      watchedAt: date,
      uri: tagOf(it, "link") || null,
      // une entrée du flux EST une séance, avec la note de ce jour-là
      watches: date ? [{ date, rating, ...(rewatch && { rewatch }) }] : [],
      /* Le vrai cadeau du flux : plus rien à deviner par recherche de
         titre, ni pour TMDB ni pour l'appariement (`diffImport` teste
         l'identifiant AVANT le titre). */
      tmdbId: tmdbId ? Number(tmdbId) || tmdbId : null,
    };
    /* Un revisionnage occupe deux entrées, et le flux donne la note de
       CHACUNE — c'est de quoi voir un avis bouger sur dix ans. On les
       empile donc, comme le diary du CSV : la fiche reste unique, c'est
       le journal qui s'allonge. */
    const k = filmKey(row);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, row);
      continue;
    }
    const watches = mergeWatches(prev.watches, row.watches);
    extraWatches += Math.max(0, watches.length - (prev.watches?.length || 0));
    const recent = (row.watchedAt || "") >= (prev.watchedAt || "");
    byKey.set(k, {
      ...prev,
      ...(recent ? row : null),
      rating: (recent ? row.rating : prev.rating) ?? prev.rating ?? row.rating,
      watches,
    });
  }

  const rows = [...byKey.values()];
  return {
    rows,
    // il n'existe pas de flux de watchlist : ce chemin ne rend que du vu
    kind: "watched",
    stats: {
      lines: watches.length,
      total: rows.length,
      // une revoyure est une séance de plus, pas un rebut
      duplicatesInFile: watches.length - skippedNoTitle - rows.length - extraWatches,
      withRating: rows.filter((r) => r.rating != null).length,
      withoutRating: rows.filter((r) => r.rating == null).length,
      skippedNoTitle,
    },
  };
}

/** Relève le flux d'un membre. Rejette avec un message affichable tel quel. */
export async function fetchLetterboxdFeed(user: string, relay?: string): Promise<ParsedCsv> {
  if (!user.trim()) throw new Error("Indiquez d'abord votre pseudo Letterboxd.");
  let res: Response;
  try {
    res = await fetch(feedUrl(user, relay));
  } catch {
    /* Un échec de `fetch` ne dit jamais pourquoi — CORS, réseau, relais
       mort se ressemblent tous. On nomme la cause la plus probable au
       lieu de rendre « Failed to fetch ». */
    throw new Error("Le relais n'a pas répondu. Il est peut-être hors service — voyez « relais ».");
  }
  if (!res.ok) throw new Error(`Le flux a répondu ${res.status}. Le pseudo est-il le bon ?`);
  return parseLetterboxdRss(await res.text());
}
