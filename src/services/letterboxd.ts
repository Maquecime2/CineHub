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

   LA WATCHLIST, ALORS. Faute de flux, on lit les pages publiques
   `/{pseudo}/watchlist/page/N/` — du HTML, pas du XML, avec ce que ça
   suppose de fragilité : Letterboxd peut remanier son gabarit sans
   prévenir. D'où deux précautions ici, et une seule règle à retenir en
   les lisant : MIEUX VAUT UNE ERREUR QU'UNE LISTE VIDE. Une page mal lue
   qui rendrait « zéro film » se raconterait comme une watchlist vidée,
   et l'écran signalerait toute la collection comme retirée.

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
import type { ImportRow, ParsedCsv, Year } from "../types";

export const USER_KEY = "letterboxd-user";
export const RELAY_KEY = "letterboxd-relay";

/* Le relais par défaut. Un tiers voit passer la requête : c'est
   acceptable ICI parce que le flux est déjà public et qu'aucun secret ne
   transite — mais c'est aussi pourquoi l'adresse reste modifiable. */
export const DEFAULT_RELAY = "https://corsproxy.io/?url={url}";

const cleanUser = (user: string) => user.trim().replace(/^@/, "");

/* Le chemin, une fois pour toutes : les deux adresses ci-dessous ne
   diffèrent que par lui, et c'est la seule chose qui change entre le
   serveur de dev, qui relaie lui-même, et le relais public. */
const lbUrl = (path: string, relay?: string): string => {
  if (import.meta.env.DEV) return `/lb-rss/${path}`;
  const tpl = (relay ?? store.get(RELAY_KEY, DEFAULT_RELAY)).trim() || DEFAULT_RELAY;
  return tpl.replace("{url}", encodeURIComponent(`https://letterboxd.com/${path}`));
};

/** L'adresse à appeler pour lire le flux de `user`, relais compris. */
export function feedUrl(user: string, relay?: string): string {
  return lbUrl(`${encodeURIComponent(cleanUser(user))}/rss/`, relay);
}

/** L'adresse d'une page de watchlist. Letterboxd les numérote à partir de 1. */
export function watchlistUrl(user: string, page = 1, relay?: string): string {
  return lbUrl(`${encodeURIComponent(cleanUser(user))}/watchlist/page/${page}/`, relay);
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

/* ============================================================
   LA WATCHLIST — lue dans les pages, faute de flux
   ============================================================ */

/* Un film n'est pas décrit deux fois de la même façon selon l'âge du
   gabarit : l'ancien pose les attributs sur `.film-poster`, le récent sur
   un composant React, et le titre se cache tantôt dans un attribut,
   tantôt dans l'`alt` de l'affiche. On lit donc la première valeur qui
   se présente au lieu de parier sur une seule. */
const attrOf = (el: Element, names: string[]): string => {
  for (const n of names) {
    const v = el.getAttribute(n)?.trim();
    if (v) return v;
  }
  return "";
};

/* Le gabarit actuel ne donne pas l'année à part : elle est collée au
   titre, « Rachel, Rachel (1968) ». On la détache — sinon elle entrerait
   dans la clé d'appariement par le mauvais bout et un film déjà en
   collection serait recréé au lieu d'être reconnu. */
const splitYear = (name: string): { title: string; year: Year } => {
  const m = name.match(/^(.*?)\s*\((\d{4})\)$/);
  return m ? { title: m[1]!.trim(), year: Number(m[2]) } : { title: name, year: "" };
};

/** Ce qu'une page de watchlist apprend : ses films, et combien il y en a. */
export interface WatchlistPage {
  rows: ImportRow[];
  lastPage: number;
  skippedNoTitle: number;
}

/** Lit une page de watchlist. Lève plutôt que de rendre une liste vide douteuse. */
export function parseWatchlistPage(html: string): WatchlistPage {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const posters = [...doc.querySelectorAll("[data-film-slug], [data-item-slug]")];

  /* Le garde-fou. Une watchlist réellement vide le DIT — Letterboxd pose
     un « No films yet » dans `.empty-text` ; un relais en panne, un
     profil privé ou un pseudo erroné rendent tout autre chose. Sans cette
     distinction, les deux cas se ressembleraient, et le second se
     raconterait comme le premier. */
  if (!posters.length && !doc.querySelector(".empty-text, .empty-watchlist, ul.poster-list"))
    throw new Error(
      "Cette page n'a pas la forme d'une watchlist Letterboxd. Vérifiez le pseudo, que le profil est public, ou le relais si vous en avez réglé un."
    );

  let skippedNoTitle = 0;
  const rows: ImportRow[] = [];
  for (const el of posters) {
    const name =
      attrOf(el, ["data-item-name", "data-film-name", "data-film-title"]) ||
      el.querySelector("img")?.getAttribute("alt")?.trim() ||
      "";
    if (!name) {
      skippedNoTitle++;
      continue;
    }
    /* L'année vient de l'attribut quand il existe (ancien gabarit), du
       titre sinon (gabarit actuel). */
    const yearRaw = attrOf(el, ["data-film-release-year", "data-item-release-year"]);
    const named = splitYear(name);
    const slug = attrOf(el, ["data-item-slug", "data-film-slug"]);
    rows.push({
      title: named.title,
      year: yearRaw ? Number(yearRaw) || "" : named.year,
      /* Une envie n'est ni notée ni vue. `null` et le journal vide ne
         sont pas des trous à combler : ce sont les seules valeurs qui
         empêchent `diffImport` d'écraser une note ou une séance déjà
         inscrite sur une fiche du même film. */
      rating: null,
      watchedAt: null,
      uri: slug ? `https://letterboxd.com/film/${slug}/` : null,
      watches: [],
    });
  }

  /* La pagination donne le nombre de pages d'un coup : mieux vaut le lire
     que tâtonner jusqu'à la première page vide. Une watchlist courte n'a
     pas de pagination du tout — c'est alors une page, et une seule. */
  const pages = [...doc.querySelectorAll(".paginate-pages li")]
    .map((li) => Number(li.textContent?.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  return { rows, lastPage: Math.max(1, ...pages), skippedNoTitle };
}

/* Letterboxd sert 28 films par page : une watchlist de mille films en
   ferait trente-six. Le plafond n'est pas une limite de goût, c'est une
   assurance contre une pagination mal lue qui ferait tourner la boucle. */
const MAX_PAGES = 40;

interface WatchlistOptions {
  /** Appelé après chaque page, pour que l'écran montre l'avancée. */
  onProgress?: (done: number, total: number) => void;
}

async function fetchPage(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Le relais n'a pas répondu. Il est peut-être hors service — voyez « relais ».");
  }
  if (!res.ok)
    throw new Error(
      `La watchlist a répondu ${res.status}. Le pseudo est-il le bon, et le profil public ?`
    );
  return res.text();
}

/** Relève la watchlist d'un membre, page après page. Message affichable tel quel. */
export async function fetchLetterboxdWatchlist(
  user: string,
  relay?: string,
  { onProgress }: WatchlistOptions = {}
): Promise<ParsedCsv> {
  if (!user.trim()) throw new Error("Indiquez d'abord votre pseudo Letterboxd.");

  const first = parseWatchlistPage(await fetchPage(watchlistUrl(user, 1, relay)));
  const total = Math.min(first.lastPage, MAX_PAGES);
  onProgress?.(1, total);

  let lines = first.rows.length + first.skippedNoTitle;
  let skippedNoTitle = first.skippedNoTitle;
  const byKey = new Map<string, ImportRow>();
  const keep = (rows: ImportRow[]) => rows.forEach((r) => byKey.set(filmKey(r), r));
  keep(first.rows);

  /* Les pages se lisent l'une APRÈS l'autre. En parallèle, on gagnerait
     quelques secondes et on offrirait à un relais public une rafale de
     trente requêtes — c'est le meilleur moyen de se faire refuser la
     suivante. */
  for (let p = 2; p <= total; p++) {
    const page = parseWatchlistPage(await fetchPage(watchlistUrl(user, p, relay)));
    keep(page.rows);
    lines += page.rows.length + page.skippedNoTitle;
    skippedNoTitle += page.skippedNoTitle;
    onProgress?.(p, total);
  }

  /* L'ORDRE EST UNE DONNÉE. La page ne date aucune envie, mais elle les
     sert dans l'ordre où elles ont été mises de côté, la plus récente
     d'abord — c'est le tri « When Added / Newest First » que Letterboxd
     applique par défaut à une watchlist. Sans ce report, les cinq cents
     fiches d'un même relevé naîtraient à la même milliseconde et le tri
     « par ajout » de l'étagère rendrait un ordre arbitraire. On espace
     donc d'une minute, en remontant le temps depuis maintenant. */
  const base = Date.now();
  const rows = [...byKey.values()].map((r, i) => ({ ...r, addedAt: base - i * 60_000 }));
  return {
    rows,
    kind: "watchlist",
    stats: {
      lines,
      total: rows.length,
      duplicatesInFile: lines - skippedNoTitle - rows.length,
      // une envie n'est jamais notée : ces deux comptes sont là pour la forme
      withRating: 0,
      withoutRating: rows.length,
      skippedNoTitle,
    },
  };
}
