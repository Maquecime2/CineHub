import { describe, it, expect, beforeEach } from "vitest";
import { loadSkinKey, saveSkinKey, SKIN_KEY } from "./applySkin";
import { HAND_KEY, readHand, refreshHand, setHand } from "./handwriting";
import { store } from "../services/storage";
import {
  documentsToSend,
  fileIncomingDocument,
  isSyncable,
  SYNCABLE_VERSION,
} from "../services/documents";

/* ============================================================
   L'ASPECT DU CLASSEUR SUIT LA PERSONNE, PAS L'APPAREIL
   ============================================================

   UNE RÈGLE ÉCRITE A ÉTÉ RENVERSÉE. `documents.ts` donnait la peau en
   exemple de ce qui reste sur l'appareil — « on n'impose pas l'humeur du
   moment à notre autre écran ». Ce n'est plus vrai : ce qu'on choisit
   dans ce panneau est l'aspect de son classeur, et le retrouver autre en
   changeant d'ordinateur se lit comme un réglage perdu.

   CE FICHIER GARDE LES TROIS CHOSES QUI PEUVENT CASSER EN SILENCE, et
   aucune ne se verrait à l'écran avant d'avoir coûté quelque chose :

   — l'ancienne forme, écrite EN CLAIR, illisible par `store` : tout le
     monde serait revenu au kraft, et l'autre appareil aurait reçu la
     pierre tombale d'un `null` ;
   — le numéro de version, sans lequel les classeurs DÉJÀ connectés
     n'enverraient jamais ces deux clés — la pire perte, celle qu'on ne
     découvre qu'en changeant d'ordinateur ;
   — le retour : un document qui arrive doit CHANGER ce qu'on lit, sans
     quoi la synchro écrit sur un disque que personne ne relit. */

beforeEach(() => {
  localStorage.clear();
});

/* LA DATATION EST ASYNCHRONE, ET C'EST VOULU : `store` charge
   `documents` à la volée pour ne pas lier les deux modules au
   chargement, et « dater un document ne doit jamais retarder son
   écriture ». Un test qui n'attend pas ce tour lit un registre vide. */
const settle = () => new Promise((r) => setTimeout(r, 0));

describe("what the binder looks like, and where it is written", () => {
  it("declares both keys as travelling", () => {
    expect(isSyncable(SKIN_KEY)).toBe(true);
    expect(isSyncable(HAND_KEY)).toBe(true);
  });

  /* LE NUMÉRO MONTE À CHAQUE FOIS QU'ON TOUCHE À LA LISTE. Sans lui,
     `catchUpDocuments` ne rejoue pas le rattrapage, et un classeur déjà
     connecté n'enverra JAMAIS ces deux clés. */
  it("has had its catch-up number raised past the version that ignored them", () => {
    expect(SYNCABLE_VERSION).toBeGreaterThanOrEqual(5);
  });

  it("sends the skin with its VALUE, and never a tombstone", async () => {
    saveSkinKey("herbier");
    await settle();
    const out = documentsToSend().find((d) => d.key === SKIN_KEY);
    expect(out).toBeDefined();
    expect(out!.deleted).toBe(false);
    expect(out!.content).toBe("herbier");
  });

  /* C'EST LE CAS QUI COÛTAIT UNE PEAU. Écrite en clair, elle est
     illisible par `store` : le document partait à `null`, donc en pierre
     tombale, donc il EFFAÇAIT la peau de l'autre appareil. */
  it("does not send a tombstone for a skin written before it travelled", () => {
    localStorage.setItem(SKIN_KEY, "herbier");
    /* La lecture convertit sur place — c'est elle qui a lieu au
       démarrage, avant toute synchro. */
    expect(loadSkinKey()).toBe("herbier");

    store.set("documents-a-envoyer", [SKIN_KEY]);
    const out = documentsToSend().find((d) => d.key === SKIN_KEY);
    expect(out!.content).toBe("herbier");
    expect(out!.deleted).toBe(false);
  });

  it("does the same for a hand written before it travelled", async () => {
    localStorage.setItem(HAND_KEY, "plain");
    /* Le module a lu au chargement : on le fait relire. */
    refreshHand();
    expect(readHand()).toBe("plain");
    expect(localStorage.getItem(HAND_KEY)).toBe('"plain"');
  });
});

describe("what arrives from the other computer", () => {
  it("changes the skin one reads, once the document is filed", async () => {
    saveSkinKey("herbier");
    await settle();
    fileIncomingDocument({
      key: SKIN_KEY,
      updatedAt: Date.now() + 10_000,
      content: "nitrate",
    });
    expect(loadSkinKey()).toBe("nitrate");
  });

  /* `fileIncomingDocument` écrit et ne prévient personne : sans
     `refreshHand`, le mot en mémoire resterait celui d'avant et
     `--f-hand` avec lui, jusqu'au prochain rechargement de la page. */
  it("changes the hand, but only once somebody re-reads it", async () => {
    setHand("plume");
    await settle();
    fileIncomingDocument({
      key: HAND_KEY,
      updatedAt: Date.now() + 10_000,
      content: "plain",
    });
    expect(readHand()).toBe("plume");
    refreshHand();
    expect(readHand()).toBe("plain");
  });

  /* LE DERNIER QUI ÉCRIT GAGNE, et une arrivée plus ancienne ne défait
     pas un choix qu'on vient de faire ici. */
  it("refuses a skin older than the one chosen here", async () => {
    saveSkinKey("herbier");
    await settle();
    fileIncomingDocument({ key: SKIN_KEY, updatedAt: 1, content: "nitrate" });
    expect(loadSkinKey()).toBe("herbier");
  });
});
