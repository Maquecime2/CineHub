/* ============================================================
   PERSISTANCE LOCALE — remplace le window.storage du runtime artefact.
   ============================================================ */

/** Les clés du localStorage, réunies pour qu'aucune ne se perde en chemin. */
export const KEYS = {
  films: "films",
  notes: "notebook-notes",
  dividers: "shelf-dividers",
  onboarding: "onboarding",
  tmdbKey: "tmdb-key",
} as const;

/* Le registre des dates vit dans `documents`, qui écrit lui-même par ce
   magasin : on le charge à la volée pour ne pas nouer les deux modules
   l'un à l'autre au chargement. La promesse n'est pas attendue — dater
   un document ne doit jamais retarder son écriture. */
const noterSiSynchronisable = async (clé: string): Promise<void> => {
  const { estSynchronisable, noterDocument } = await import("./documents");
  if (estSynchronisable(clé)) noterDocument(clé);
};

/* ------------------------------------------------------------
   LE QUOTA SE VOIT VENIR, IL NE SE DÉCOUVRE PAS
   ------------------------------------------------------------

   L'alerte n'arrivait qu'APRÈS l'échec de l'écriture. À ce moment-là le
   mal est fait : la modification est à l'écran, elle n'est pas sur le
   disque, et rien ne le dit — on ferme l'onglet en croyant avoir
   enregistré, et l'on rouvre une collection d'hier.

   On mesure donc AVANT. `JSON.stringify` est de toute façon appelé pour
   écrire ; sa longueur ne coûte rien de plus, et elle permet de prévenir
   pendant qu'il reste de la place pour agir — exporter une sauvegarde,
   alléger des affiches.

   Le seuil est en UTF-16 : `localStorage` compte des unités de code, pas
   des octets, et la plupart des navigateurs plafonnent autour de cinq
   millions. On prévient aux quatre cinquièmes. */
const SEUIL_ALERTE = 4_000_000;

const CONSEIL =
  "Les affiches importées depuis votre disque sont les plus lourdes : préférez une adresse d'image (clic droit → copier l'adresse de l'image) ou l'enrichissement TMDB, qui ne stockent qu'un lien.";

/* Une fois par session, et pas une de plus. Une alerte qui se répète à
   chaque frappe est une alerte qu'on apprend à cliquer sans lire. */
let prévenu = false;

const prévenirSiGros = (taille: number): void => {
  if (prévenu || taille < SEUIL_ALERTE) return;
  prévenu = true;
  alert(
    `L'espace de stockage se remplit (${Math.round(taille / 100_000) / 10} Mo sur environ 5).\n\n${CONSEIL}\n\nPensez à exporter une sauvegarde depuis l'onglet Import.`
  );
};

/* ------------------------------------------------------------
   ÉCRIRE PLUS TARD, ET UNE SEULE FOIS
   ------------------------------------------------------------

   `saveFilms` re-sérialise la collection ENTIÈRE à chaque édition, et il
   est appelé depuis une dizaine d'endroits — ranger un rayon, cocher une
   séance, poser un motif. Sur cinq cents fiches, chaque frappe dans une
   critique écrivait tout le classeur.

   On garde la dernière valeur par clé et on écrit une fois, un peu plus
   tard. Ce qui rend la chose sûre est le VIDAGE : quitter la page,
   changer d'onglet ou masquer la fenêtre écrit tout de suite. Sans lui,
   différer reviendrait à parier sur la patience de l'utilisateur. */
const DÉLAI = 400;

const enAttente = new Map<string, unknown>();
let minuteur: ReturnType<typeof setTimeout> | null = null;

/** Écrit tout ce qui attend. Sans effet quand rien n'attend. */
export function flush(): void {
  if (minuteur != null) {
    clearTimeout(minuteur);
    minuteur = null;
  }
  if (enAttente.size === 0) return;
  const lot = [...enAttente];
  enAttente.clear();
  for (const [k, v] of lot) store.set(k, v);
}

export const store = {
  get: <T>(k: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  /* L'écriture immédiate. Elle reste le chemin par défaut : la plupart
     des clés sont minuscules et écrites une fois de loin en loin. */
  set: (k: string, v: unknown): boolean => {
    try {
      /* MESURER AVANT D'ÉCRIRE, DATER APRÈS AVOIR ÉCRIT : les deux
         moitiés de cette ligne viennent de deux chantiers différents et
         se composent sans se gêner. */
      const texte = JSON.stringify(v);
      prévenirSiGros(texte.length);
      localStorage.setItem(k, texte);
      /* LA DATE SE POSE ICI, ET C'EST TOUT L'INTÉRÊT DE LA POSER ICI.

         Six services écrivent des documents — l'étagère, le carnet, les
         fils, le vocabulaire, les décors, les préférences du mur — et
         aucun ne date ce qu'il écrit. Demander à chacun d'y penser,
         c'est se garantir qu'un l'oubliera, et qu'un pan du classeur ne
         se synchronisera jamais sans que rien ne le signale.

         L'import est différé pour une raison bête et réelle : le
         registre des dates s'écrit lui-même par ce magasin, et un import
         direct fabriquerait une boucle entre les deux modules. */
      void noterSiSynchronisable(k);
      return true;
    } catch (e) {
      console.error(e);
      if (String((e as Error)?.name || "").includes("Quota")) {
        alert(`Espace de stockage plein.\n\n${CONSEIL}`);
      }
      return false;
    }
  },

  /**
   * L'écriture différée, pour ce qui est gros et souvent retouché.
   *
   * Les appels successifs sur une même clé se remplacent : dix éditions
   * d'affilée font une écriture. L'appelant met son état à l'écran comme
   * avant — seul le disque attend.
   */
  setSoon: (k: string, v: unknown): void => {
    enAttente.set(k, v);
    if (minuteur != null) clearTimeout(minuteur);
    minuteur = setTimeout(flush, DÉLAI);
  },

  /** Ce qui attend encore d'être écrit — pour les tests, et pour le doute. */
  enAttente: (): number => enAttente.size,
};

/* LES DEUX ÉVÉNEMENTS QUI COMPTENT, ET POURQUOI LES DEUX.

   `pagehide` couvre la fermeture et la navigation. `visibilitychange`
   couvre le reste — changer d'onglet, verrouiller l'écran, poser le
   téléphone — et c'est le seul sur lequel les navigateurs mobiles soient
   fiables : un onglet mobile peut être supprimé de la mémoire sans que
   `pagehide` ne parte jamais.

   `window` peut manquer (tests hors DOM), d'où la garde. */
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
