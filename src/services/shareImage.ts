/* ============================================================
   LA CARTE EN IMAGE — une fiche qui sort du classeur
   ============================================================

   Ce qu'on partage n'est pas une capture d'écran : c'est une carte
   dessinée pour être lue ailleurs, dans une conversation où personne n'a
   l'application. Elle porte donc le papier et l'encre du classeur, et
   son nom en bas — c'est le seul canal d'acquisition gratuit du produit.

   ------------------------------------------------------------
   LES COULEURS SONT RÉSOLUES, ET C'EST OBLIGATOIRE
   ------------------------------------------------------------

   `CLAUDE.md` le dit pour les SVG embarqués, et un canevas est le même
   cas : `ctx.fillStyle = "var(--c-ink)"` ne teint rien du tout, en
   silence — on obtient du noir par défaut et une carte qui ne ressemble
   à aucune peau. On lit donc les jetons SUR LE DOCUMENT, une fois, au
   moment de dessiner : la carte sort ainsi dans la peau que la personne
   porte, ce qui est la moitié de l'intérêt de la partager.

   ------------------------------------------------------------
   PARTAGER, SINON ENREGISTRER
   ------------------------------------------------------------

   Sur un téléphone, `navigator.share` ouvre la feuille du système et
   c'est de loin le meilleur chemin. Ailleurs, il n'existe pas ou refuse
   les fichiers : on retombe sur un téléchargement. Les deux sont dans la
   même fonction pour que l'appelant n'ait pas à savoir sur quoi il
   tourne.
   ============================================================ */
import { cardFacts } from "../domain/shareCard";
import type { Film } from "../types";

/* Deux fois la taille affichée : une carte relue sur un écran dense ne
   doit pas être floue, et c'est le seul endroit du produit qui finit
   dans la galerie de quelqu'un. */
const W = 1080;
const H = 1350;

/** Lit un jeton du thème, RÉSOLU — voir l'en-tête. */
const inkOf = (name: string, fallback: string): string => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

/** Coupe un paragraphe en lignes qui tiennent dans la largeur donnée. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Dessine la carte et rend le PNG.
 *
 * `signature` est la ligne du bas — le nom du site. Elle vient de
 * l'appelant plutôt que d'ici : ce module ne connaît pas la langue, et
 * le catalogue est le seul endroit où une phrase se traduit.
 */
export async function drawCard(film: Film, signature: string): Promise<Blob | null> {
  const facts = cardFacts(film);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const paper = inkOf("--c-paper", "#EEE3CC");
  const card = inkOf("--c-card", "#F6EEDC");
  const ink = inkOf("--c-ink", "#2A211A");
  const faded = inkOf("--c-ink-faded", "#6E6153");
  const line = inkOf("--c-line", "#C9B99A");
  const accent = inkOf("--c-burgundy", "#7B2D3B");

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  /* La carte, posée sur le papier avec sa marge — c'est ce léger retrait
     qui la fait lire comme un objet et non comme un fond. */
  const m = 60;
  ctx.fillStyle = card;
  ctx.fillRect(m, m, W - m * 2, H - m * 2);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.strokeRect(m, m, W - m * 2, H - m * 2);

  const left = m + 64;
  const width = W - m * 2 - 128;
  let y = m + 190;

  ctx.textBaseline = "alphabetic";

  /* LE TITRE, et il peut être long : on le coupe en lignes plutôt que de
     le rétrécir jusqu'à l'illisible. */
  ctx.fillStyle = ink;
  ctx.font = `italic 700 78px Georgia, "Times New Roman", serif`;
  for (const l of wrap(ctx, facts.title, width).slice(0, 3)) {
    ctx.fillText(l, left, y);
    y += 92;
  }

  if (facts.line) {
    ctx.fillStyle = faded;
    ctx.font = `36px Georgia, "Times New Roman", serif`;
    ctx.fillText(facts.line, left, y + 14);
    y += 70;
  }

  /* LA NOTE EN ÉTOILES PLEINES ET VIDES, jamais en couleur : la
     direction artistique le dit pour les verdicts, et cinq des peaux
     avalent le rouge et le vert. */
  if (facts.rating !== null) {
    const full = Math.round(facts.rating);
    ctx.fillStyle = accent;
    ctx.font = `44px Georgia, serif`;
    ctx.fillText("★".repeat(full) + "☆".repeat(Math.max(0, 5 - full)), left, y + 30);
    y += 90;
  }

  if (facts.excerpt) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y + 6);
    ctx.lineTo(left + 120, y + 6);
    ctx.stroke();
    y += 66;

    ctx.fillStyle = ink;
    ctx.font = `40px Georgia, "Times New Roman", serif`;
    for (const l of wrap(ctx, `« ${facts.excerpt} »`, width).slice(0, 8)) {
      ctx.fillText(l, left, y);
      y += 56;
    }
  }

  ctx.fillStyle = faded;
  ctx.font = `28px "Courier New", monospace`;
  ctx.fillText(signature, left, H - m - 56);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Partage la carte, ou l'enregistre.
 *
 * Rend ce qui a été fait, pour que l'écran puisse le dire — « partagé »
 * et « enregistré » ne sont pas la même nouvelle, et un silence après un
 * clic est ce qui fait recliquer.
 */
export async function shareCard(
  film: Film,
  signature: string
): Promise<"shared" | "saved" | "failed"> {
  const blob = await drawCard(film, signature);
  if (!blob) return "failed";

  const name = `${(film.title || "fiche").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40)}.png`;
  const file = new File([blob], name, { type: "image/png" });

  /* `canShare` AVANT `share`, et avec le fichier : certains navigateurs
     ont `share` mais refusent les fichiers, et l'appeler quand même
     lève une exception au lieu de retomber proprement. */
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return "shared";
    }
  } catch {
    /* Refus de la feuille de partage : ce n'est pas une panne, c'est
       quelqu'un qui a changé d'avis. On n'enchaîne pas sur un
       téléchargement qu'il n'a pas demandé. */
    return "failed";
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return "saved";
}
