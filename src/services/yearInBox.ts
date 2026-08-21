/* ============================================================
   THE YEAR IN A BOX — an image to take away
   ============================================================

   With no router, no card has an address: one cannot send anybody a link
   to their film library. This image is therefore the ONLY path by which
   something of the collection leaves the browser, which justifies its
   being composed for itself rather than photographed in haste.

   WHY DRAW, AND NOT CAPTURE THE PAGE. Nothing in the browser knows how
   to render DOM into an image: the libraries that claim to rebuild the
   page inside an SVG and stumble on everything that makes the look of
   this place — remote fonts, `mix-blend-mode`, `clip-path`, filters. A
   drawn composition is shorter to write than a capture is to repair, and
   it can aim at a format the screen does not have: a portrait, made to
   be seen on a phone.

   THE COLOURS ARE GIVEN TO IT. This module does not read the tokens: the
   CSS variables live on the document, and a service does not look at it.
   It is the view that resolves them and passes them on — so the image
   comes out in the skin that was laid on, which is the least one can
   expect. */
import { getImage, isIdbPoster, idbKeyOf } from "../db";
import { POSTER_BASE, POSTER_THUMB } from "../tmdb";
import { initialsOf } from "../domain/film";
import { hueOf } from "../theme/ink";
import type { FilmOfYear, PlateShot } from "../domain/almanac";

export interface BoxPalette {
  paper: string;
  card: string;
  ink: string;
  inkFaded: string;
  accent: string;
  line: string;
  /** The families as the skin declares them. */
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
  /* WHAT FITS IN A THREE-SECOND GLANCE, and nothing more. The image
     remains a grid of posters: we enrich the banner and the foot, never
     the centre. Whatever asks to be read twice belongs to the
     almanac. */
  minutes: number;
  /** The most visited decade — `null` if no card is dated. */
  decade: number | null;
  /** The most watched country, already translated by the view. */
  country: string | null;
  ageMean: number | null;
}

/* LOAD A POSTER, WHEREVER IT COMES FROM.

   THE UNDERLYING PROBLEM, AND IT DOES NOT COME FROM TMDB. An image from
   another domain TAINTS the canvas, and `toBlob` then refuses to render
   anything at all — with no error while drawing, only at export time. So
   the poster must be obtained through a CORS request, which TMDB honours
   willingly (`access-control-allow-origin: *`).

   ONLY HERE IS THE THING: THE WALL CAME FIRST. `PosterArt` displays
   those same addresses through an ordinary `<img>`, WITHOUT
   `crossOrigin`. The HTTP cache keeps a response obtained in "no-cors"
   mode, and the browser REFUSES to reuse it for a CORS request. Measured
   here, on an address first loaded the way the wall loads it:

     <img crossOrigin>          → failure
     fetch                      → failure
     fetch { cache: "reload" }  → ok
     <img crossOrigin> + ?cors  → ok

   So it is neither the CDN nor the protocol that is missing: it is A
   CACHE ENTRY of our own making. The two paths below are therefore
   written never to meet it.

   `fetch` first, with `cache: "reload"` which forces revalidation: it
   returns a status and a type, so it can set aside what is not an image
   — TMDB serves its errors in HTML, sometimes under a 200.

   The tag next, with a URL parameter that gives it its own entry: it
   catches the environments where a CORS `fetch` towards an image CDN is
   barred while an image gets through (privacy extensions, embedded
   panels).

   `canvasAccepts` settles it for the tag: rather than guessing whether
   the canvas is tainted, we ASK it — one pixel painted, one pixel read
   back. It is the only check that assumes nothing of the browser, and it
   avoids composing one thousand three hundred and fifty pixels of height
   only to discover the failure at the very end.

   Should both fail, the cell gets the fallback emulsion — the same as on
   the wall. */
async function loadPoster(poster: string): Promise<HTMLImageElement | null> {
  if (!poster) return null;

  /* What comes from IndexedDB or from a `data:` does not leave the
     domain: none of these precautions concern it. */
  if (isIdbPoster(poster)) {
    const blob = await getImage(idbKeyOf(poster)).catch(() => null);
    if (!blob) return null;
    return await fromBlob(blob);
  }
  if (!/^https?:/.test(poster)) return await asImage(poster);

  /* The shelf asks for thumbnails in w185 so as not to decode a 342 in a
     96 px case. Here we compose an image a thousand pixels wide: it is
     the large one we need, whichever one the card settled on. */
  const url = poster.replace(POSTER_THUMB, POSTER_BASE);

  const blob = await fetch(url, { cache: "reload" })
    .then((r) => (r.ok ? r.blob() : null))
    .catch(() => null);
  // an error from TMDB is an HTML page, sometimes served with a 200
  if (blob?.type.startsWith("image/")) {
    const img = await fromBlob(blob);
    if (img) return img;
  }

  /* The safety net: a cache entry all of its own, which the wall could
     not have dirtied. The separator takes account of an address that
     would already carry a query — a poster pasted by hand may have
     one. */
  const apart = `${url}${url.includes("?") ? "&" : "?"}cors=1`;
  const byTag = await asImage(apart, "anonymous");
  return byTag && canvasAccepts(byTag) ? byTag : null;
}

async function fromBlob(blob: Blob): Promise<HTMLImageElement | null> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await asImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** An address, decoded into an image — or `null` if it will not be read. */
function asImage(src: string, crossOrigin?: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* CAN THIS IMAGE BE EXPORTED?

   We do not guess it, we ask: a one-pixel canvas, the image on it, and
   an attempt to read it back. If the image has tainted the canvas,
   `getImageData` throws — and we know BEFORE having composed one
   thousand three hundred and fifty pixels of height, rather than at the
   very end, when the failure would carry off the whole image. */
function canvasAccepts(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

/** Cuts a text that is too long, to the letter for the given width. */
function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

const W = 1080;
const H = 1350;
/* Twelve at most: that is what fits in portrait without the titles
   becoming illegible, and a year tells itself well in twelve images,
   even when it counts two hundred. */
const MAX = 12;

/* THE GRID ADJUSTS, AND TWICE RATHER THAN ONCE.

   In columns, because a year of two films must not be drawn in four
   columns of which two are empty. In cell size, because deducing the
   height from the width alone does not look at the bottom of the frame:
   a grid of three rows computed that way overflowed a hundred and sixty
   pixels below the image, and the last row simply did not exist. So the
   cell takes the smaller of the two measures — the one the width allows,
   the one the remaining height permits — and the grid centres itself in
   what is left. */
interface Grid {
  cols: number;
  width: number;
  height: number;
  left: number;
  gap: number;
  /** Height of one row, caption included. */
  step: number;
}

const MARGIN = 68;
const GAP = 22;
const TOP = 300;
/** What the sentence at the bottom reserves for itself. */
const FOOT = 130;
/** Title and rating, under each case. */
const CAPTION = 52;

/* LE RAPPORT EST UN ARGUMENT, ET IL EST ARRIVÉ AVEC LA PLANCHE. Une
   affiche est en 2:3 et un photogramme en 16:9 : la même grille ne peut
   pas les tenir tous les deux, et la dupliquer aurait dédoublé le calcul
   qui, lui, ne change pas — la cellule prend la plus petite des deux
   mesures, celle que la largeur permet et celle que la hauteur restante
   permet. C'est ce calcul-là qui est délicat, pas le rapport. */
function gridFor(n: number, ratio = 1.5, caption = CAPTION): Grid {
  const cols = n <= 2 ? Math.max(n, 1) : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);

  const byWidth = (W - MARGIN * 2 - (cols - 1) * GAP) / cols;
  const room = H - FOOT - TOP - rows * (GAP + caption);
  const byHeight = room / rows / ratio;

  const width = Math.max(60, Math.min(byWidth, byHeight));
  const height = width * ratio;
  const total = cols * width + (cols - 1) * GAP;

  return {
    cols,
    width,
    height,
    left: (W - total) / 2,
    gap: GAP,
    step: height + GAP + caption,
  };
}
/* THE IMAGE SPEAKS THE READER'S LANGUAGE TOO, and it is the one thing
   here that leaves the browser — an English reader showing "3 séances" to
   a friend would be showing a bug. The service draws on a canvas, where
   there is no component to hang a hook on, so `t` is passed in, exactly
   as `domain/wording` does. */
export type Say = (key: string, values?: Record<string, string | number>) => string;

export async function drawYearInBox(data: BoxData, p: BoxPalette, t: Say): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("le canevas n'a pas de contexte 2d");

  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, W, H);

  /* The grain of the paper, in sown dots — not the site's SVG texture,
     which is a filter the canvas knows nothing about. Two thousand dots
     at three per cent opacity are enough for the background not to be a
     flat tint. */
  ctx.fillStyle = p.ink;
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 2000; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  ctx.globalAlpha = 1;

  /* ---- THE HEADER ---- */
  ctx.fillStyle = p.ink;
  ctx.textBaseline = "alphabetic";
  ctx.font = `28px ${p.mono}`;
  ctx.fillStyle = p.inkFaded;
  ctx.fillText(t("yearInBox.title"), 72, 96);

  ctx.fillStyle = p.accent;
  ctx.font = `bold 150px ${p.title}`;
  ctx.fillText(String(data.year), 68, 218);

  // the freehand stroke under the year
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(72, 238);
  ctx.bezierCurveTo(180, 231, 300, 245, 400, 236);
  ctx.stroke();

  /* The counts, to the right of the year: it is the only thing a
     three-second glance will retain. */
  const lines: [string, string][] = [
    [String(data.count), t("yearInBox.viewings", { count: data.count })],
    [String(data.titles), t("yearInBox.films", { count: data.titles })],
    [String(data.rewatches), t("yearInBox.rewatches", { count: data.rewatches })],
  ];
  if (data.ratingAvg != null) lines.push([data.ratingAvg.toFixed(1), t("yearInBox.onAverage")]);
  /* The hours of cinema, when we know them. It is the most telling
     statistic of the lot, and the only one that asks for completed
     cards — a collection that has not done it sees nothing missing. */
  if (data.minutes > 0) lines.push([`${Math.round(data.minutes / 60)} h`, t("yearInBox.ofCinema")]);

  /* THE BANNER MEASURES ITSELF BEFORE WRITING ITSELF, AND THAT IS THE
     WHOLE FIX.

     It advanced by a fixed step — the width of the word, or a hundred
     and eighteen pixels, whichever was greater — without ever looking at
     where the frame ends. Four columns fitted; the fifth, "x h de
     cinéma", which only appears on a collection with completed cards,
     went past the right edge and came out of the image truncated. In
     other words: the better filled in the collection, the more damaged
     the image.

     So we measure the five columns first, and deduce from them the scale
     that makes them fit between the year and the margin. The widths of a
     text being proportional to its size, a single reading is enough to
     compute it — no trial and error.

     Shrink rather than set aside: each of these mentions was judged
     worthy of the three-second glance, and an image that shrinks its
     figures by fifteen per cent stays legible where an image that
     conjures one away lies about the year. */
  const X0 = 470;
  const SPACING = 26;
  const room = W - MARGIN - X0;

  ctx.font = `bold 56px ${p.title}`;
  const widthsN = lines.map(([n]) => ctx.measureText(n).width);
  ctx.font = `21px ${p.mono}`;
  const widthsW = lines.map(([, word]) => ctx.measureText(word).width);
  const columns = lines.map((_, i) => Math.max(widthsN[i]!, widthsW[i]!));
  const wanted = columns.reduce((a, b) => a + b, 0) + SPACING * (lines.length - 1);
  // never any enlargement: the composition was tuned at scale 1
  const scale = Math.min(1, room / wanted);

  let x = X0;
  lines.forEach(([n, word], i) => {
    ctx.fillStyle = p.ink;
    ctx.font = `bold ${Math.round(56 * scale)}px ${p.title}`;
    ctx.fillText(n, x, 196);
    ctx.fillStyle = p.inkFaded;
    ctx.font = `${Math.round(21 * scale)}px ${p.mono}`;
    ctx.fillText(word, x, 196 + Math.round(30 * scale));
    x += columns[i]! * scale + SPACING * scale;
  });

  /* ---- THE GRID OF POSTERS ---- */
  const twelve = data.films.slice(0, MAX);
  const { cols, width, height, left, gap, step } = gridFor(twelve.length);
  const posters = await Promise.all(twelve.map((f) => loadPoster(f.film.poster)));

  twelve.forEach((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const gx = left + col * (width + gap);
    const gy = TOP + row * step;

    ctx.save();
    /* Each case leans by a hair, always to the same side for the same
       cell: laid by hand, not aligned with a ruler. */
    ctx.translate(gx + width / 2, gy + height / 2);
    ctx.rotate((((i * 37) % 11) - 5) * 0.0022);
    ctx.translate(-width / 2, -height / 2);

    ctx.shadowColor = "rgba(30,20,10,0.35)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = p.card;
    ctx.fillRect(-6, -6, width + 12, height + 12);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const img = posters[i];
    if (img) {
      /* The poster fills its cell without distorting itself: we crop the
         overflow rather than stretch a face. */
      const ratio = Math.max(width / img.width, height / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      /* THE FALLBACK EMULSION — the same as on the wall.

         A film without a poster is not a hole: `PosterArt` has always
         built it a toned emulsion, its tint drawn from its identifier,
         with its initials on top. It held for the screen and not for the
         image, so that a year of films without posters came out in white
         cards — whereas it has a look, and it is recognisable.

         `hueOf` is the source of truth for that tint (`theme/ink.ts`):
         we read it here rather than redefining it, so that the two
         cannot diverge. It returns a hexadecimal and not a token — that
         is what lets a service use it without looking at the
         document. */
      const tint = hueOf(entry.film.id);
      const back = ctx.createLinearGradient(0, 0, width * 0.5, height);
      back.addColorStop(0, tint);
      back.addColorStop(0.6, tint);
      back.addColorStop(1, "#1c1712");
      ctx.fillStyle = back;
      ctx.fillRect(0, 0, width, height);

      // the light falling at the top left, as on the wall
      const glow = ctx.createRadialGradient(
        width * 0.3,
        height * 0.22,
        0,
        width * 0.3,
        height * 0.22,
        height * 0.62
      );
      glow.addColorStop(0, "rgba(255,240,210,0.28)");
      glow.addColorStop(1, "rgba(255,240,210,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(243,234,216,0.8)";
      ctx.font = `italic ${Math.round(width * 0.32)}px ${p.title}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initialsOf(entry.film.title), width / 2, height / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    ctx.strokeStyle = p.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    // title and rating under the case
    ctx.fillStyle = p.ink;
    ctx.font = `20px ${p.body}`;
    ctx.fillText(truncate(ctx, entry.film.title, width), 0, height + 27);
    ctx.fillStyle = p.inkFaded;
    ctx.font = `17px ${p.mono}`;
    const mention = [
      entry.rating != null ? `${entry.rating}★` : null,
      entry.n > 1 ? `×${entry.n}` : null,
    ]
      .filter(Boolean)
      .join("  ");
    if (mention) ctx.fillText(mention, 0, height + 49);

    ctx.restore();
  });

  /* ---- THE FOOT ---- */
  const sentence = data.topDirector
    ? t("yearInBox.mostWatched", { name: data.topDirector })
    : t("yearInBox.aYearOfViewings");
  ctx.fillStyle = p.inkFaded;
  ctx.font = `italic 27px ${p.body}`;
  ctx.fillText(truncate(ctx, sentence, W - MARGIN * 2), MARGIN, H - 82);

  /* The portrait banner: the decade, the country, the age. Each mention
     appears only if we know it — a "—" in place of a country would say
     only that the cards have not been filled in, which interests nobody
     on an image one shows around. */
  const mentions = [
    data.decade != null ? t("yearInBox.decade", { decade: String(data.decade).slice(2) }) : null,
    data.country,
    data.ageMean != null ? t("yearInBox.averageAge", { years: Math.round(data.ageMean) }) : null,
  ].filter(Boolean) as string[];
  if (mentions.length) {
    ctx.font = `21px ${p.mono}`;
    ctx.fillText(truncate(ctx, mentions.join("  ·  "), W - MARGIN * 2), MARGIN, H - 50);
  }

  ctx.font = `19px ${p.mono}`;
  ctx.fillText(t("yearInBox.signature"), MARGIN, H - 22);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(t("yearInBox.couldNotDraw")))),
      "image/png"
    )
  );
}

/** Lays the image in the downloads, under a name one can find again. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoking straight away would cut the download short in some
     browsers: we let one frame go by. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   LA PLANCHE DE L'ANNÉE — les images, et non les affiches
   ============================================================

   UNE SŒUR ET NON UN MODE. La boîte est un BILAN : un millésime de cent
   cinquante pixels, dix chiffres, une phrase de bas de page. La planche
   est une IMAGE, et rien d'autre. Les fondre derrière un drapeau aurait
   obligé chaque moitié à contourner l'autre à chaque paragraphe, pour
   une seule chose vraiment partagée — la grille, et elle l'est déjà.

   POURQUOI ELLE EXISTE. La boîte dessine des AFFICHES : hébergées par
   TMDB, gratuites pour nous, et les mêmes pour tout le monde. Deux
   personnes ayant vu les mêmes films en sortent la même image. Celle-ci
   dessine ce qu'on a CAPTURÉ soi-même — la seule matière de ce produit
   qui soit à vous, et la seule qui consomme la place qu'on héberge.

   ELLE EMPRUNTE QUAND ON N'A RIEN, et ce n'est pas un pis-aller : sans
   les `frames` de TMDB elle serait vide le jour de sa sortie, pour tout
   le monde. Le choix des images vit dans `domain/almanac.plateShots`,
   qui est pur et éprouvé ; ici on ne fait que dessiner.
   ============================================================ */

/** Combien de cases. Moins que la boîte, et plus grandes : on regarde
    une image, on ne compte pas des vignettes. Exporté parce que la vue
    doit savoir, AVANT de dessiner, s'il y aura quelque chose à voir. */
export const PLATE_MAX = 8;
/** Le titre sous la case, seul — pas de note, pas de compte de séances. */
const PLATE_CAPTION = 34;

export interface PlateData {
  year: number;
  shots: PlateShot[];
  /** Combien des cases sont de vous, pour la phrase du bas. */
  mine: number;
}

export async function drawYearPlate(data: PlateData, p: BoxPalette, t: Say): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("le canevas n'a pas de contexte 2d");

  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = p.ink;
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 2000; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  ctx.globalAlpha = 1;

  /* ---- LE BANDEAU ---- */
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.inkFaded;
  ctx.font = `28px ${p.mono}`;
  ctx.fillText(t("plate.title"), 72, 96);

  ctx.fillStyle = p.accent;
  ctx.font = `bold 150px ${p.title}`;
  ctx.fillText(String(data.year), 68, 218);

  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(72, 238);
  ctx.bezierCurveTo(180, 231, 300, 245, 400, 236);
  ctx.stroke();

  /* ---- LES CASES ---- */
  const shots = data.shots.slice(0, PLATE_MAX);
  const { cols, width, height, left, gap, step } = gridFor(shots.length, 9 / 16, PLATE_CAPTION);
  const images = await Promise.all(shots.map((s) => loadPoster(s.src)));

  shots.forEach((shot, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const gx = left + col * (width + gap);
    const gy = TOP + row * step;

    ctx.save();
    ctx.translate(gx + width / 2, gy + height / 2);
    ctx.rotate((((i * 37) % 11) - 5) * 0.0022);
    ctx.translate(-width / 2, -height / 2);

    ctx.shadowColor = "rgba(30,20,10,0.35)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = p.card;
    ctx.fillRect(-6, -6, width + 12, height + 12);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const img = images[i];
    if (img) {
      const ratio = Math.max(width / img.width, height / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      /* L'ÉMULSION DE REMPLACEMENT, la même que sur le mur : `hueOf` est
         la source de vérité de cette teinte, et on la lit plutôt que de
         la redéfinir. Une image qui n'a pas pu être chargée reste une
         case, jamais un trou. */
      ctx.fillStyle = hueOf(shot.filmId);
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(243,234,216,0.8)";
      ctx.font = `italic ${Math.round(height * 0.34)}px ${p.title}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initialsOf(shot.title), width / 2, height / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    ctx.strokeStyle = p.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    /* CE QUI EST DE VOUS SE VOIT, et se dit par un TRAIT et non par une
       couleur — la règle du verdict, et ici elle vaut deux fois : sur une
       image qu'on exporte, la peau du lecteur n'existe plus. Un coin
       relevé à l'encre d'accent, comme une photo collée. */
    if (shot.mine) {
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width - 26, 2);
      ctx.lineTo(width - 2, 2);
      ctx.lineTo(width - 2, 26);
      ctx.stroke();
    }

    ctx.fillStyle = p.ink;
    ctx.font = `20px ${p.body}`;
    ctx.fillText(truncate(ctx, shot.title, width), 0, height + 26);

    ctx.restore();
  });

  /* ---- LE PIED ---- */
  /* LA PHRASE DIT D'OÙ VIENNENT LES IMAGES, et c'est ce qui rend la
     planche honnête : montrer des photogrammes de TMDB sans le dire
     laisserait croire qu'on a capturé ce qu'on n'a pas. Quand tout est
     de vous, elle le dit aussi — c'est le seul cas où elle félicite. */
  ctx.fillStyle = p.inkFaded;
  ctx.font = `italic 27px ${p.body}`;
  const sentence =
    data.mine === 0
      ? t("plate.allBorrowed")
      : data.mine >= shots.length
        ? t("plate.allMine")
        : t("plate.someMine", { count: data.mine });
  ctx.fillText(truncate(ctx, sentence, W - MARGIN * 2), MARGIN, H - 82);

  ctx.font = `19px ${p.mono}`;
  ctx.fillText(t("yearInBox.signature"), MARGIN, H - 22);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(t("yearInBox.couldNotDraw")))),
      "image/png"
    )
  );
}
