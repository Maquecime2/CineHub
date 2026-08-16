import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  dropSoon,
  flushSaves,
  noteWritten,
  onWritten,
  saveSoon,
  saveState,
  watchSaving,
} from "./saving";

/* ============================================================
   CE QUI S'ENREGISTRE, ET CE QUI NE DOIT PAS S'ÉCRASER

   Deux défauts vivent dans ce module, et aucun des deux ne se voit à
   l'écran avant qu'il ne soit trop tard.

   UNE SEULE PLACE D'ATTENTE POUR TOUT LE CLASSEUR : une note prise dans
   le carnet chassait une critique en attente. Deux écrans qui n'ont rien
   à voir, et la perte silencieuse de l'un par l'autre.

   UNE ÉCRITURE IMMÉDIATE QUI NE RÉVOQUE PAS CELLE QUI ATTEND : insérer
   une capture dans une critique écrit tout de suite, et la frappe d'avant
   partait trois cents millisecondes plus tard avec le texte SANS le
   jeton. Elle l'écrasait, et son retour le retirait de l'écran. C'est le
   « laoume s s », remonté d'un étage.
   ============================================================ */

beforeEach(async () => {
  vi.useRealTimers();
  await flushSaves();
});

describe("ce qui attend", () => {
  it("ne part pas tout de suite", async () => {
    const wrote = vi.fn();
    saveSoon("a", wrote);
    expect(wrote).not.toHaveBeenCalled();
    expect(saveState()).toBe("pending");
    await flushSaves();
    expect(wrote).toHaveBeenCalledTimes(1);
  });

  it("garde le dernier geste d'une clé, et lui seul", async () => {
    const vieux = vi.fn();
    const neuf = vi.fn();
    saveSoon("a", vieux);
    saveSoon("a", neuf);
    await flushSaves();
    expect(vieux).not.toHaveBeenCalled();
    expect(neuf).toHaveBeenCalledTimes(1);
  });

  /* LE PREMIER DES DEUX DÉFAUTS. */
  it("ne laisse pas une clé en chasser une autre", async () => {
    const critique = vi.fn();
    const note = vi.fn();
    saveSoon("films", critique);
    saveSoon("notes", note);
    await flushSaves();
    expect(critique).toHaveBeenCalledTimes(1);
    expect(note).toHaveBeenCalledTimes(1);
  });

  it("ne vide qu'une clé quand on le lui demande", async () => {
    const films = vi.fn();
    const notes = vi.fn();
    saveSoon("films", films);
    saveSoon("notes", notes);
    await flushSaves("films");
    expect(films).toHaveBeenCalledTimes(1);
    expect(notes).not.toHaveBeenCalled();
    await flushSaves();
    expect(notes).toHaveBeenCalledTimes(1);
  });
});

describe("ce qu'une écriture immédiate révoque", () => {
  /* LE SECOND DÉFAUT, ET LE PLUS COÛTEUX : il se voyait comme une
     fonctionnalité disparue. */
  it("abandonne ce qui attendait sur la même clé", async () => {
    const frappe = vi.fn();
    saveSoon("films", frappe);
    dropSoon("films");
    await flushSaves();
    expect(frappe).not.toHaveBeenCalled();
  });

  it("laisse les autres clés tranquilles", async () => {
    const note = vi.fn();
    saveSoon("notes", note);
    dropSoon("films");
    await flushSaves();
    expect(note).toHaveBeenCalledTimes(1);
  });

  it("ne dit plus « en cours » quand il ne reste rien", () => {
    saveSoon("films", vi.fn());
    expect(saveState()).toBe("pending");
    dropSoon("films");
    expect(saveState()).toBe("clean");
  });
});

describe("ce qu'on annonce", () => {
  it("passe à « enregistré » puis se tait", async () => {
    const seen: string[] = [];
    const stop = watchSaving(() => seen.push(saveState()));
    saveSoon("a", vi.fn());
    await flushSaves();
    stop();
    expect(seen).toContain("pending");
    expect(seen).toContain("saved");
  });

  /* UNE ÉCRITURE QUI LÈVE RESTE UNE ÉCRITURE ANNONCÉE : le magasin
     retombe déjà sur son second emplacement quand le coffre refuse, et
     il a sa propre façon de le dire. Deux messages pour un incident,
     dont un que cette couche ne sait pas expliquer, serait pire. */
  it("ne reste pas bloqué si le geste lève", async () => {
    saveSoon("a", () => {
      throw new Error("le coffre refuse");
    });
    await expect(flushSaves()).rejects.toThrow();
    expect(saveState()).toBe("saved");
  });
});

describe("ce qui prévient la synchronisation", () => {
  it("prévient quand la file part", async () => {
    const seen = vi.fn();
    const stop = onWritten(seen);
    saveSoon("a", vi.fn());
    await flushSaves();
    stop();
    expect(seen).toHaveBeenCalled();
  });

  /* LE TROU QUE CE BLOC FERME : une note étoilée, un « je l'ai vu », un
     import s'écrivent IMMÉDIATEMENT et ne passent donc jamais par la
     file. Ils n'avançaient jamais la passe de synchronisation, et la
     promesse « une passe dix secondes après la dernière écriture »
     n'était vraie que pour ce qu'on tape. */
  it("prévient aussi pour une écriture immédiate", () => {
    const seen = vi.fn();
    const stop = onWritten(seen);
    noteWritten();
    stop();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("ne prévient plus après désabonnement", () => {
    const seen = vi.fn();
    onWritten(seen)();
    noteWritten();
    expect(seen).not.toHaveBeenCalled();
  });

  /* Un abonné maladroit ne prive pas les autres. */
  it("prévient tout le monde même si l'un tombe", () => {
    const second = vi.fn();
    const stopA = onWritten(() => {
      throw new Error("maladroit");
    });
    const stopB = onWritten(second);
    expect(() => noteWritten()).not.toThrow();
    stopA();
    stopB();
    expect(second).toHaveBeenCalled();
  });
});
