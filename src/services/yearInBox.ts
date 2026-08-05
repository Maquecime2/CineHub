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

   Trois provenances, et la troisième est un piège : une image d'un autre
   domaine SOUILLE le canevas, et `toBlob` refuse alors de rendre quoi que
   ce soit — sans erreur au dessin, seulement au moment de l'export.
   `crossOrigin = "anonymous"` demande la permission avant de peindre ;
   TMDB l'accorde. Une image qui la refuserait échoue au chargement, donc
   ici, où on la remplace par un carton vide — plutôt qu'à la fin, où
   elle emporterait l'image entière. */
async function chargerAffiche(poster: string): Promise<HTMLImageElement | null> {
  if (!poster) return null;
  let src = poster;
  let objectUrl: string | null = null;

  if (isIdbPoster(poster)) {
    const blob = await getImage(idbKeyOf(poster)).catch(() => null);
    if (!blob) return null;
    objectUrl = URL.createObjectURL(blob);
    src = objectUrl;
  }

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (!objectUrl && /^https?:/.test(src)) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("affiche illisible"));
      img.src = src;
    });
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
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
      // pas d'affiche : le titre s'écrit à la place, dans un carton nu
      ctx.fillStyle = p.paper;
      ctx.fillRect(0, 0, largeur, hauteur);
      ctx.fillStyle = p.inkFaded;
      ctx.font = `italic 24px ${p.title}`;
      ctx.textAlign = "center";
      const mots = entrée.film.title.split(" ");
      let ligne = "";
      let y = hauteur / 2 - 12;
      for (const mot of mots) {
        const essai = ligne ? `${ligne} ${mot}` : mot;
        if (ctx.measureText(essai).width > largeur - 24 && ligne) {
          ctx.fillText(ligne, largeur / 2, y);
          y += 28;
          ligne = mot;
        } else ligne = essai;
      }
      if (ligne) ctx.fillText(ligne, largeur / 2, y);
      ctx.textAlign = "left";
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
