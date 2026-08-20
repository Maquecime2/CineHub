/* ============================================================
   LES PEAUX QU'ON A ACHETÉES
   ============================================================

   LE VERROU EST AU CHOIX, PAS À L'APPLICATION, et c'est la décision qui
   tient tout le reste.

   `applySkin` ne change pas d'une ligne : il sert la peau qu'on lui
   demande, sans poser de question, hors ligne comme ailleurs. S'il
   fallait lui demander l'avis du serveur, un rechargement dans le métro
   retomberait sur « carnet » — le classeur se déguiserait tout seul,
   ce qui est exactement ce que la règle du projet interdit.

   Ce module ne répond donc qu'à une question, et elle est posée par le
   SÉLECTEUR : quelles peaux montrer dans la grille. Sans compte, il n'en
   montre aucune de verrouillée — invisibles, jamais grisées, comme tout
   ce qui dépend du dehors. Avec un compte, celles qu'on possède
   s'ajoutent aux quatorze.

   ET LES QUATORZE RESTENT LIBRES. Aucune n'est touchée : ce qui s'achète
   est en plus. Verrouiller une peau qui marchait déjà hors ligne aurait
   été reprendre quelque chose à quelqu'un.

   LA MÉMOIRE LOCALE EST UN CACHE, DONC ELLE A TORT PARFOIS. Une peau
   achetée sur un autre appareil apparaît à la première lecture de la
   bourse, pas à l'instant. Le prix est petit ; l'inverse — interroger le
   serveur avant de dessiner une grille de couleurs — l'était moins.
   ============================================================ */

const OWNED = "cinehub.skins.owned";
const WORN = "cinehub.skins.worn";

/* LE PAPIER ET LE TITRE SUIVENT LA PEAU, ET POUR LA MÊME RAISON. Ils se
   portent, donc ils vivent au serveur ; ils se DESSINENT, donc ils
   doivent être là au premier rendu, hors ligne compris. Une page qui
   attend le réseau pour savoir sur quel papier elle est écrite est une
   page qui clignote à chaque ouverture.

   Deux clés de plus plutôt qu'un objet dans une seule : ce qui est déjà
   écrit chez les gens reste lisible tel quel, et une clé neuve absente
   se lit « rien porté », qui est le bon défaut. */
const WORN_PAPER = "cinehub.counter.paper";
const WORN_TITLE = "cinehub.counter.title";

/* Le stockage local n'est pas toujours là : navigation privée, réglage
   restrictif, page dans un cadre. Il n'y a rien à réparer dans ces
   cas-là — on répond « rien de possédé », et la grille montre les
   quatorze. */
const readable = (): Storage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/** Les identifiants d'articles possédés — « skin-nitrate » et consorts. */
export function ownedItems(): string[] {
  const store = readable();
  if (!store) return [];
  try {
    const raw = store.getItem(OWNED);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * La peau choisie sur un autre appareil.
 *
 * Elle ne s'applique jamais d'elle-même : c'est un dernier recours,
 * derrière le choix local, pour retrouver son décor sur une machine
 * neuve. Une peau qui changerait toute seule au retour du réseau serait
 * une peau qu'on n'a pas choisie.
 */
export function wornSkin(): string | null {
  return readable()?.getItem(WORN) ?? null;
}

/** Le papier de fond choisi, s'il y en a un. Voir `theme/surfaces`. */
export function wornPaper(): string | null {
  return readable()?.getItem(WORN_PAPER) ?? null;
}

/** La mention portée à côté du pseudonyme, s'il y en a une. */
export function wornTitle(): string | null {
  return readable()?.getItem(WORN_TITLE) ?? null;
}

/* ------------------------------------------------------------
   CE QUI PRÉVIENT QUAND ON CHANGE DE TENUE
   ------------------------------------------------------------

   IL FALLAIT RECHARGER LA PAGE POUR VOIR SON PAPIER, et c'était le
   défaut classique de ce montage : le stockage local n'a pas
   d'événement pour l'onglet QUI ÉCRIT — `storage` ne se déclenche que
   dans les AUTRES onglets. `App` lisait donc la valeur une fois, au
   montage, et ne la relisait qu'au retour de focus de la fenêtre. Or on
   porte un papier depuis le comptoir, sans jamais quitter l'onglet.

   Un abonnement plutôt qu'un rappel passé de composant en composant :
   c'est déjà la forme des ressources en cache (`hooks/cachedResource`),
   et elle vaut ici pour la même raison — celui qui écrit (la bourse, le
   comptoir) n'a aucune raison de connaître celui qui dessine.

   `useSyncExternalStore` s'en sert directement, d'où la SIGNATURE :
   `subscribe` rend sa propre annulation, et l'instantané doit être une
   valeur stable — une chaîne ou `null`, jamais un objet reconstruit,
   sinon React boucle. */

type Listener = () => void;
const listeners = new Set<Listener>();

export function watchWorn(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const tellWatchers = () => {
  /* UNE COPIE, ET CHAQUE APPEL ISOLÉ. La copie parce qu'un abonné peut
     se désabonner en réagissant — modifier l'ensemble pendant qu'on le
     parcourt sauterait le suivant.

     L'isolement parce qu'un abonné qui lève ne doit pas priver les
     autres : sans le `try`, une exception dans le premier laissait la
     page figée sur l'ancien papier, c'est-à-dire exactement le défaut
     qu'on vient de réparer, mais rendu intermittent et donc bien plus
     difficile à retrouver. */
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (e) {
      console.error("[cinehub] un abonné de la tenue a levé", e);
    }
  }
};

/** Ce que la bourse vient d'apprendre du serveur. */
export function rememberOwned(
  items: string[],
  worn: { skin?: string | null; paper?: string | null; title?: string | null } | string | null
): void {
  const store = readable();
  if (!store) return;
  /* L'ancienne signature prenait la peau seule, et quelques appelants la
     passent encore ainsi. Les accepter toutes les deux ici coûte une
     ligne et évite d'aller corriger des endroits qui n'ont rien à voir
     avec les papiers. */
  const w = typeof worn === "string" || worn === null ? { skin: worn } : worn;
  const put = (key: string, value: string | null | undefined) => {
    if (value) store.setItem(key, value);
    else store.removeItem(key);
  };
  try {
    store.setItem(OWNED, JSON.stringify(items));
    put(WORN, w.skin);
    put(WORN_PAPER, w.paper);
    put(WORN_TITLE, w.title);
  } catch {
    /* Un quota plein n'est pas une raison de faire échouer un écran. */
  }
  /* HORS DU `try`, ET C'EST VOULU : même si l'écriture a échoué, ce
     qu'on vient d'apprendre du serveur est vrai, et l'écran doit le
     montrer. Un quota plein ne doit pas figer la page sur l'ancien
     papier. */
  tellWatchers();
}

/**
 * Relire au serveur ce qu'on possède, tout de suite.
 *
 * La bourse le fait au démarrage ; ceci sert au moment précis où l'on
 * vient d'acheter une peau et où la grille doit se redessiner
 * déverrouillée. Sans lui, il faudrait recharger la page pour porter ce
 * qu'on vient de payer — ce qui se lit comme un achat qui n'a pas pris.
 */
export async function refreshOwned(): Promise<string[]> {
  const { myHoldings } = await import("../services/server");
  try {
    const held = await myHoldings();
    rememberOwned(held.items, held.worn);
    return held.items;
  } catch {
    return ownedItems();
  }
}

/** À la fermeture d'un compte : ce qui appartenait à quelqu'un s'en va. */
export function forgetOwned(): void {
  const store = readable();
  try {
    store?.removeItem(OWNED);
    store?.removeItem(WORN);
    store?.removeItem(WORN_PAPER);
    store?.removeItem(WORN_TITLE);
    tellWatchers();
  } catch {
    /* rien */
  }
}
