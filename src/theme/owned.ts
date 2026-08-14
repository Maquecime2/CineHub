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

/** Ce que la bourse vient d'apprendre du serveur. */
export function rememberOwned(items: string[], skin: string | null): void {
  const store = readable();
  if (!store) return;
  try {
    store.setItem(OWNED, JSON.stringify(items));
    if (skin) store.setItem(WORN, skin);
    else store.removeItem(WORN);
  } catch {
    /* Un quota plein n'est pas une raison de faire échouer un écran. */
  }
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
    rememberOwned(held.items, held.worn.skin);
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
  } catch {
    /* rien */
  }
}
