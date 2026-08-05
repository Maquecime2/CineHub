/* ============================================================
   L'ANNÉE EN BOÎTE — une image à emporter
   ============================================================

   Sans routeur, aucune fiche n'a d'adresse : on ne peut envoyer à
   personne un lien vers sa vidéothèque. Cette image est donc le SEUL
   chemin par lequel quelque chose de la collection sort du navigateur,
   ce qui justifie qu'elle soit composée pour elle-même et non
   photographiée à la va-vite.

   POURQUOI DESSINER, ET NON CAPTURER LA PAGE. Rien dans le navigateur ne
   sait rendre du DOM en image : les bibliothèques qui le prétendent
   reconstruisent la page dans un SVG et trébuchent sur tout ce qui fait
   justement l'allure d'ici — polices distantes, `mix-blend-mode`,
   `clip-path`, filtres. Une composition dessinée est plus courte à
   écrire qu'une capture à réparer, et elle peut viser un format que
   l'écran n'a pas : un portrait, fait pour être vu sur un téléphone.

   LES COULEURS LUI SONT DONNÉES. Ce module ne lit pas les jetons : les
   variables CSS vivent sur le document, et un service ne le regarde pas.
   C'est la vue qui les résout et les passe — l'image sort donc dans la
   peau qu'on avait posée, ce qui est la moindre des choses. */
import { getImage, isIdbPoster, idbKeyOf } from "../db";
import { POSTER_BASE, POSTER_THUMB } from "../tmdb";
import { initialsOf } from "../domain/film";
import { hueOf } from "../theme/ink";
import type { FilmOfYear } from "../domain/almanac";

export interface BoxPalette {
  paper: string;
  card: string;
  ink: string;
  inkFaded: string;
  accent: string;
  line: string;
  /** Les familles telles que la peau les déclare. */
  title: string;
  body: string;
  mono: string;
}

export interface BoxData {
  year: number;
  films: FilmOfYear[];
  count: number;
  titles: number;
  rewatches: number;
  ratingAvg: number | null;
  topDirector: string | null;
}

/* CHARGER UNE AFFICHE, D'OÙ QU'ELLE VIENNE.

   TOUT PASSE PAR UN BLOB, Y COMPRIS CE QUI VIENT DU RÉSEAU. Une image
   d'un autre domaine SOUILLE le canevas et `toBlob` refuse alors de
   rendre quoi que ce soit — sans erreur au dessin, seulement à l'export.

   La version précédente s'en remettait à `crossOrigin = "anonymous"` sur
   un `<img>`, ce qui demande la permission avant de peindre. C'est
   correct et TMDB l'accorde. On lui préfère `fetch` pour une raison plus
   terre à terre : un `<img>` ne dit RIEN de la raison de son échec — pas
   de code de statut, pas de message, un `onerror` nu. Une affiche qui ne
   vient pas devient alors indistinguable d'une affiche absente, et
   c'est exactement le genre de panne qu'on ne diagnostique qu'en
   remontant tout le chemin à la main.

   `fetch` rend un statut et un type. On peut donc écarter ce qui n'est
   pas une image — TMDB sert ses erreurs en HTML, parfois sous un 200 —
   au lieu de laisser le décodeur échouer sans un mot. Le blob devient
   une URL d'objet, donc SAME-ORIGIN : le canevas n'a plus rien à
   refuser, et il n'y a plus de `crossOrigin` nulle part.

   Un échec (hors ligne, 404, adresse morte) rend `null`, et la case
   reçoit l'émulsion de secours — la même que sur le mur. */
async function chargerAffiche(poster: string): Promise<HTMLImageElement | null> {
  if (!poster) return null;

  let blob: Blob | null;
  if (isIdbPoster(poster)) {
    blob = (await getImage(idbKeyOf(poster)).catch(() => null)) ?? null;
  } else if (/^https?:/.test(poster)) {
    /* L'étagère demande les vignettes en w185 pour ne pas décoder du
       342 dans un boîtier de 96 px. Ici on compose une image de mille
       pixels de large : c'est la grande qu'il faut, quelle que soit
       celle que la fiche a retenue. */
    const url = poster.replace(POSTER_THUMB, POSTER_BASE);
    blob = await fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null);
    // une erreur de TMDB est une page HTML, servie avec un 200 parfois
    if (blob && !blob.type.startsWith("image/")) blob = null;
  } else {
    /* Une adresse collée à la main, ou une image réduite en `data:` —
       elles ne souillent pas le canevas et se chargent telles quelles. */
    return await enImage(poster);
  }

  if (!blob) return null;
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await enImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Une adresse, décodée en image — ou `null` si elle ne se laisse pas lire. */
function enImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Coupe un texte trop long, à la lettre près pour la largeur donnée. */
function tronquer(ctx: CanvasRenderingContext2D, texte: string, max: number): string {
  if (ctx.measureText(texte).width <= max) return texte;
  let t = texte;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

const W = 1080;
const H = 1350;
/* Douze au plus : c'est ce qui tient en portrait sans que les titres
   deviennent illisibles, et une année se raconte bien en douze images,
   même quand elle en compte deux cents. */
const MAX = 12;

/* LA GRILLE S'AJUSTE, ET DEUX FOIS PLUTÔT QU'UNE.

   En colonnes, parce qu'une année de deux films ne doit pas être
   dessinée en quatre colonnes dont deux vides. En taille de case, parce
   que déduire la hauteur de la largeur seule ne regarde pas le bas du
   cadre : une grille de trois rangées calculée ainsi débordait de cent
   soixante pixels sous l'image, et la dernière rangée n'existait tout
   simplement pas. La case prend donc la plus petite des deux mesures —
   celle que la largeur autorise, celle que la hauteur restante permet —
   et la grille se centre dans ce qui reste. */
interface Grille {
  cols: number;
  largeur: number;
  hauteur: number;
  gauche: number;
  espace: number;
  /** Hauteur d'une rangée, légende comprise. */
  pas: number;
}

const MARGE = 68;
const ESPACE = 22;
const HAUT = 300;
/** Ce que la phrase du bas se réserve. */
const PIED = 130;
/** Titre et note, sous chaque boîtier. */
const LEGENDE = 52;

function grilleDe(n: number): Grille {
  const cols = n <= 2 ? Math.max(n, 1) : n <= 6 ? 3 : 4;
  const rangs = Math.ceil(n / cols);

  const parLargeur = (W - MARGE * 2 - (cols - 1) * ESPACE) / cols;
  const dispo = H - PIED - HAUT - rangs * (ESPACE + LEGENDE);
  const parHauteur = dispo / rangs / 1.5;

  const largeur = Math.max(60, Math.min(parLargeur, parHauteur));
  const hauteur = largeur * 1.5;
  const total = cols * largeur + (cols - 1) * ESPACE;

  return {
    cols,
    largeur,
    hauteur,
    gauche: (W - total) / 2,
    espace: ESPACE,
    pas: hauteur + ESPACE + LEGENDE,
  };
}
export async function drawYearInBox(data: BoxData, p: BoxPalette): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("le canevas n'a pas de contexte 2d");

  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, W, H);

  /* Le grain du papier, en points semés — pas la texture SVG du site,
     qui est un filtre que le canevas ne connaît pas. Deux mille points à
     trois pour cent d'opacité suffisent à ce que le fond ne soit pas un
     aplat. */
  ctx.fillStyle = p.ink;
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 2000; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  ctx.globalAlpha = 1;

  /* ---- L'EN-TÊTE ---- */
  ctx.fillStyle = p.ink;
  ctx.textBaseline = "alphabetic";
  ctx.font = `28px ${p.mono}`;
  ctx.fillStyle = p.inkFaded;
  ctx.fillText("L'ANNÉE EN BOÎTE", 72, 96);

  ctx.fillStyle = p.accent;
  ctx.font = `bold 150px ${p.title}`;
  ctx.fillText(String(data.year), 68, 218);

  // le trait à main levée sous l'année
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(72, 238);
  ctx.bezierCurveTo(180, 231, 300, 245, 400, 236);
  ctx.stroke();

  /* Les comptes, à droite de l'année : c'est la seule chose qu'un
     regard de trois secondes retiendra. */
  const lignes: [string, string][] = [
    [String(data.count), data.count > 1 ? "séances" : "séance"],
    [String(data.titles), data.titles > 1 ? "films" : "film"],
    [String(data.rewatches), data.rewatches > 1 ? "revoyures" : "revoyure"],
  ];
  if (data.ratingAvg != null) lignes.push([data.ratingAvg.toFixed(1), "de moyenne"]);

  let x = 560;
  for (const [n, mot] of lignes) {
    ctx.fillStyle = p.ink;
    ctx.font = `bold 56px ${p.title}`;
    ctx.fillText(n, x, 196);
    ctx.fillStyle = p.inkFaded;
    ctx.font = `21px ${p.mono}`;
    ctx.fillText(mot, x, 226);
    x += Math.max(ctx.measureText(mot).width + 34, 118);
  }

  /* ---- LA GRILLE D'AFFICHES ---- */
  const douze = data.films.slice(0, MAX);
  const { cols, largeur, hauteur, gauche, espace, pas } = grilleDe(douze.length);
  const affiches = await Promise.all(douze.map((f) => chargerAffiche(f.film.poster)));

  douze.forEach((entrée, i) => {
    const col = i % cols;
    const rang = Math.floor(i / cols);
    const gx = gauche + col * (largeur + espace);
    const gy = HAUT + rang * pas;

    ctx.save();
    /* Chaque boîtier penche d'un cheveu, toujours du même côté pour la
       même case : posé à la main, pas aligné à la règle. */
    ctx.translate(gx + largeur / 2, gy + hauteur / 2);
    ctx.rotate((((i * 37) % 11) - 5) * 0.0022);
    ctx.translate(-largeur / 2, -hauteur / 2);

    ctx.shadowColor = "rgba(30,20,10,0.35)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = p.card;
    ctx.fillRect(-6, -6, largeur + 12, hauteur + 12);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const img = affiches[i];
    if (img) {
      /* L'affiche remplit sa case sans se déformer : on rogne le
         débord plutôt que d'étirer un visage. */
      const rapport = Math.max(largeur / img.width, hauteur / img.height);
      const dw = img.width * rapport;
      const dh = img.height * rapport;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, largeur, hauteur);
      ctx.clip();
      ctx.drawImage(img, (largeur - dw) / 2, (hauteur - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      /* L'ÉMULSION DE SECOURS — la même que sur le mur.

         Un film sans affiche n'est pas un trou : `PosterArt` lui fabrique
         depuis toujours une émulsion virée, teinte tirée de son
         identifiant, avec ses initiales dessus. Elle valait pour l'écran
         et pas pour l'image, si bien qu'une année de films sans affiche
         sortait en cartons blancs — alors qu'elle a une allure, et
         qu'elle est reconnaissable.

         `hueOf` est la source de vérité de cette teinte
         (`theme/ink.ts`) : on la lit ici plutôt que de la redéfinir,
         pour que les deux ne puissent pas diverger. Elle rend un
         hexadécimal et non un jeton — c'est ce qui permet à un service
         de s'en servir sans regarder le document. */
      const teinte = hueOf(entrée.film.id);
      const fond = ctx.createLinearGradient(0, 0, largeur * 0.5, hauteur);
      fond.addColorStop(0, teinte);
      fond.addColorStop(0.6, teinte);
      fond.addColorStop(1, "#1c1712");
      ctx.fillStyle = fond;
      ctx.fillRect(0, 0, largeur, hauteur);

      // la lumière qui tombe en haut à gauche, comme sur le mur
      const lueur = ctx.createRadialGradient(
        largeur * 0.3,
        hauteur * 0.22,
        0,
        largeur * 0.3,
        hauteur * 0.22,
        hauteur * 0.62
      );
      lueur.addColorStop(0, "rgba(255,240,210,0.28)");
      lueur.addColorStop(1, "rgba(255,240,210,0)");
      ctx.fillStyle = lueur;
      ctx.fillRect(0, 0, largeur, hauteur);

      ctx.fillStyle = "rgba(243,234,216,0.8)";
      ctx.font = `italic ${Math.round(largeur * 0.32)}px ${p.title}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initialsOf(entrée.film.title), largeur / 2, hauteur / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    ctx.strokeStyle = p.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, largeur - 1, hauteur - 1);

    // titre et note sous le boîtier
    ctx.fillStyle = p.ink;
    ctx.font = `20px ${p.body}`;
    ctx.fillText(tronquer(ctx, entrée.film.title, largeur), 0, hauteur + 27);
    ctx.fillStyle = p.inkFaded;
    ctx.font = `17px ${p.mono}`;
    const mention = [
      entrée.rating != null ? `${entrée.rating}★` : null,
      entrée.n > 1 ? `×${entrée.n}` : null,
    ]
      .filter(Boolean)
      .join("  ");
    if (mention) ctx.fillText(mention, 0, hauteur + 49);

    ctx.restore();
  });

  /* ---- LA PHRASE DU BAS ---- */
  const phrase = data.topDirector
    ? `Le plus revu cette année : ${data.topDirector}.`
    : "Une année de séances, tenue à la main.";
  ctx.fillStyle = p.inkFaded;
  ctx.font = `italic 27px ${p.body}`;
  ctx.fillText(tronquer(ctx, phrase, W - MARGE * 2), MARGE, H - 74);

  ctx.font = `19px ${p.mono}`;
  ctx.fillText("CINÉ HUB · archive personnelle", MARGE, H - 40);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("l'image n'a pas pu être close"))),
      "image/png"
    )
  );
}

/** Poser l'image dans les téléchargements, sous un nom qui se retrouve. */
export function telecharger(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Révoquer tout de suite couperait le téléchargement dans certains
     navigateurs : on laisse passer une frame. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
