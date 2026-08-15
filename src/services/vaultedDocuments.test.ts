import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ============================================================
   LE CARNET DESCEND AU COFFRE, ET LA SYNCHRO NE L'EFFACE PAS
   ============================================================

   Ce fichier existe pour UNE panne, et elle ne se serait vue nulle part
   avant d'avoir détruit quelque chose.

   `documentsToSend` lisait `localStorage.getItem` en direct et traitait
   `null` comme « ce document a été effacé ». Le jour où `notebook-notes`
   descend dans IndexedDB, cette lecture rend `null` pour un carnet bien
   vivant : la synchro envoie une PIERRE TOMBALE, et le carnet disparaît
   sur l'autre appareil. Rien à l'écran, aucune erreur, aucun test rouge.

   Les cas ci-dessous sont donc écrits contre le mécanisme, pas contre
   l'interface : ils vérifient qu'un document du coffre est vu, envoyé
   avec son contenu, rattrapé, et effacé des deux endroits.
   ============================================================ */

/* Un coffre en mémoire. `db` importe `customDecor`, qui importe
   `server` : on le remplace en entier plutôt que d'entraîner la moitié
   de l'application dans un test de magasin. */
const docs = new Map<string, unknown>();
let vaultBroken = false;

vi.mock("../db", () => ({
  putDoc: async (k: string, v: unknown) => {
    if (vaultBroken) throw new Error("coffre fermé");
    docs.set(k, v);
  },
  getDoc: async (k: string) => {
    if (vaultBroken) throw new Error("coffre fermé");
    return docs.get(k);
  },
  deleteDoc: async (k: string) => {
    if (vaultBroken) throw new Error("coffre fermé");
    docs.delete(k);
  },
  allDocKeys: async () => {
    if (vaultBroken) throw new Error("coffre fermé");
    return [...docs.keys()];
  },
}));

const NOTES = "notebook-notes";
const VIEW = "shelf-view:v_abc";

/* L'ÉCRITURE AU COFFRE EST HORS DU CHEMIN DU GESTE, et c'est une
   propriété qu'on tient : le miroir prend la valeur tout de suite, la
   transaction suit sans qu'on l'attende. Un test qui regarde le coffre
   doit donc laisser passer un tour — celui-ci a d'abord échoué pour
   cette raison, et il a eu raison de le faire. */
const settle = () => new Promise((r) => setTimeout(r, 0));

const load = async () => {
  vi.resetModules();
  const storage = await import("./storage");
  const documents = await import("./documents");
  return { ...storage, ...documents };
};

beforeEach(() => {
  docs.clear();
  vaultBroken = false;
  localStorage.clear();
});

afterEach(() => {
  docs.clear();
  localStorage.clear();
});

describe("l'hydratation", () => {
  it("fait descendre au coffre ce qui traînait en vitrine, et retire la copie", async () => {
    localStorage.setItem(NOTES, JSON.stringify([{ id: "n1", body: "une page" }]));
    const { hydrateVault, store } = await load();

    await hydrateVault();

    expect(docs.get(NOTES)).toEqual([{ id: "n1", body: "une page" }]);
    /* LA COPIE PART, sinon les deux divergent et on ne sait plus
       laquelle fait foi. */
    expect(localStorage.getItem(NOTES)).toBeNull();
    /* Et la lecture reste synchrone pour tout le monde. */
    expect(store.get(NOTES, [])).toEqual([{ id: "n1", body: "une page" }]);
  });

  it("laisse en vitrine ce qui n'a rien à faire au coffre", async () => {
    localStorage.setItem("onboarding", JSON.stringify({ hints: 1 }));
    const { hydrateVault } = await load();
    await hydrateVault();
    expect(localStorage.getItem("onboarding")).not.toBeNull();
    expect(docs.has("onboarding")).toBe(false);
  });

  /* LE REPLI. Un autre onglet tient un verrou de version : la base
     n'ouvre pas, et le classeur doit marcher entier quand même. */
  it("retombe en vitrine quand le coffre ne répond pas", async () => {
    vaultBroken = true;
    localStorage.setItem(NOTES, JSON.stringify([{ id: "n1" }]));
    const { hydrateVault, store, vaultReady } = await load();

    await hydrateVault();

    expect(vaultReady()).toBe(false);
    expect(store.get(NOTES, [])).toEqual([{ id: "n1" }]);
    store.set(NOTES, [{ id: "n2" }]);
    expect(JSON.parse(localStorage.getItem(NOTES)!)).toEqual([{ id: "n2" }]);
  });
});

describe("ce que la synchro voit", () => {
  /* ---- LE CAS QUI A MOTIVÉ TOUT LE CHANTIER ---- */
  it("n'envoie PAS de pierre tombale pour un document qui vit au coffre", async () => {
    const { hydrateVault, store, noteDocument, documentsToSend } = await load();
    await hydrateVault();

    store.set(NOTES, [{ id: "n1", body: "vivante" }]);
    noteDocument(NOTES);

    /* Le document n'est PAS dans `localStorage` — c'est tout le sujet. */
    expect(localStorage.getItem(NOTES)).toBeNull();

    const out = documentsToSend().find((d) => d.key === NOTES);
    expect(out).toBeDefined();
    expect(out!.deleted).toBe(false);
    expect(out!.content).toEqual([{ id: "n1", body: "vivante" }]);
  });

  it("envoie bien une pierre tombale quand le document a vraiment disparu", async () => {
    const { hydrateVault, store, noteDocument, documentsToSend } = await load();
    await hydrateVault();

    store.set(NOTES, [{ id: "n1" }]);
    store.remove(NOTES);
    noteDocument(NOTES);

    const out = documentsToSend().find((d) => d.key === NOTES);
    expect(out!.deleted).toBe(true);
    expect(out!.content).toBeNull();
  });

  /* Les deux énumérations parcouraient `localStorage` par index. Un
     document au coffre leur serait resté invisible : jamais rattrapé,
     jamais envoyé, et découvert seulement en changeant d'ordinateur. */
  it("ramasse les documents du coffre au premier branchement d'un compte", async () => {
    const { hydrateVault, store, sendAllDocuments, documentsToSend } = await load();
    await hydrateVault();

    store.set(NOTES, [{ id: "n1" }]);
    store.set(VIEW, { id: "v_abc" });
    store.set("shelf-dividers", []); // resté en vitrine, doit venir aussi

    sendAllDocuments();

    const keys = documentsToSend().map((d) => d.key);
    expect(keys).toContain(NOTES);
    expect(keys).toContain(VIEW);
    expect(keys).toContain("shelf-dividers");
    expect(documentsToSend().every((d) => d.deleted === false)).toBe(true);
  });

  it("rattrape un orphelin du coffre", async () => {
    const { hydrateVault, store, catchUpDocuments, documentsToSend } = await load();
    await hydrateVault();

    /* Écrit au coffre SANS passer par le registre : c'est exactement la
       trace que laisse une liste élargie après coup. */
    docs.set(VIEW, { id: "v_abc" });
    await hydrateVault(); // déjà hydraté : on force la relecture par le miroir
    store.set(VIEW, { id: "v_abc" });
    store.set("documents-maj", {});
    store.set("documents-a-envoyer", []);
    store.set("documents-liste-version", 0);

    expect(catchUpDocuments()).toBe(true);
    expect(documentsToSend().map((d) => d.key)).toContain(VIEW);
  });
});

describe("un document reçu du serveur", () => {
  it("s'écrit au coffre, pas en vitrine", async () => {
    const { hydrateVault, fileIncomingDocument, store } = await load();
    await hydrateVault();

    fileIncomingDocument({ key: NOTES, updatedAt: 5000, content: [{ id: "venu" }] });
    await settle();

    expect(docs.get(NOTES)).toEqual([{ id: "venu" }]);
    expect(localStorage.getItem(NOTES)).toBeNull();
    expect(store.get(NOTES, [])).toEqual([{ id: "venu" }]);
  });

  /* N'EFFACER QU'UN DES DEUX ENDROITS le ferait revenir d'entre les
     morts à la prochaine hydratation. */
  it("s'efface des deux endroits sur une pierre tombale", async () => {
    const { hydrateVault, fileIncomingDocument, store } = await load();
    await hydrateVault();

    store.set(NOTES, [{ id: "n1" }]);
    localStorage.setItem(NOTES, JSON.stringify([{ id: "reste" }])); // copie parasite

    await settle();
    expect(docs.get(NOTES)).toEqual([{ id: "n1" }]); // bien arrivé avant qu'on l'efface

    /* PLUS RÉCENT QUE L'ÉCRITURE LOCALE, sinon l'arbitrage refuse — et
       il a raison : c'est lui qui empêche un serveur en retard d'écraser
       du travail. La première version de ce test datait la pierre
       tombale de 9000 et croyait avoir trouvé une fuite. */
    fileIncomingDocument({
      key: NOTES,
      updatedAt: Date.now() + 10_000,
      content: null,
      deleted: true,
    });
    await settle();

    expect(docs.has(NOTES)).toBe(false);
    expect(localStorage.getItem(NOTES)).toBeNull();
    expect(store.get(NOTES, "rien")).toBe("rien");
  });
});
