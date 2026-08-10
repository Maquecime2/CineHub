import { describe, it, expect } from "vitest";

/* CE TEST EXISTE PARCE QUE `cmd` M'A EU.

   `set VITE_SERVEUR=http://localhost:8787 && npm run build` range dans
   la variable tout ce qui précède le `&&`, espace comprise. L'adresse
   compilée portait donc une espace finale, chaque requête partait vers
   une URL invalide, et l'écran annonçait un serveur injoignable qui
   tournait très bien. Rien dans le code n'était faux — seulement
   confiant. */

const nettoyer = (brut: string): string => brut.trim().replace(/\/+$/, "");

describe("l'adresse du serveur", () => {
  it("survit à une espace laissée par le shell", () => {
    expect(nettoyer("http://localhost:8787 ")).toBe("http://localhost:8787");
    expect(nettoyer("  http://localhost:8787\t")).toBe("http://localhost:8787");
  });

  it("survit à une barre finale, qui doublerait celle des chemins", () => {
    expect(nettoyer("http://localhost:8787/")).toBe("http://localhost:8787");
    expect(nettoyer("https://api.exemple.fr//")).toBe("https://api.exemple.fr");
  });

  it("laisse une adresse propre intacte, et le vide vide", () => {
    expect(nettoyer("https://api.exemple.fr")).toBe("https://api.exemple.fr");
    expect(nettoyer("")).toBe("");
  });
});
