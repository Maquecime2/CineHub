import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { policy, DIRECTIVES } from "../csp.mjs";

/* ============================================================
   LA POLITIQUE EST ÉCRITE DEUX FOIS, DONC ON LES COMPARE

   Elle vit dans le `Caddyfile` pour la production, et dans `csp.mjs`
   pour la répétition sur `npm run preview`. Deux copies d'une liste
   blanche, c'est deux copies qui divergent — et la divergence ne se voit
   NULLE PART : chez soi tout marche puisque la copie locale est
   complète, et en production une fonctionnalité tombe en silence, avec
   un message dans la console que personne ne lit.

   Ce test ne compare pas les ADRESSES : elles varient d'une machine à
   l'autre, c'est leur raison d'être. Il compare les DIRECTIVES, qui
   sont la structure de la politique — en ajouter une d'un côté seulement
   est exactement la faute qu'on veut attraper.
   Il vit dans `src/` parce que c'est là que vitest regarde, alors que
   `csp.mjs` reste à la racine : ce module n'est pas du code
   d'application — il n'est jamais empaqueté, il sert à la construction
   et au déploiement.
   ============================================================ */

/* `import.meta.url` n'est pas une adresse de FICHIER sous vitest — le
   module est servi par le serveur de développement — donc on part de la
   racine du projet, que le lanceur de tests connaît. */
const caddyfile = readFileSync(resolve(process.cwd(), "Caddyfile"), "utf8");

/** La politique telle qu'elle est écrite dans le `Caddyfile`. */
const inCaddyfile = () => {
  const m = caddyfile.match(/Content-Security-Policy "([^"]+)"/);
  if (!m) throw new Error("aucune Content-Security-Policy dans le Caddyfile");
  return m[1];
};

describe("les deux copies de la politique", () => {
  it("nomment les mêmes directives", () => {
    const chez_caddy = inCaddyfile()
      .split(";")
      .map((d) => d.trim().split(" ")[0])
      .filter(Boolean)
      .sort();
    expect(chez_caddy).toEqual([...DIRECTIVES].sort());
  });

  /* Les origines fixes — celles qui ne dépendent pas de la machine —
     doivent figurer des deux côtés. Une seule oubliée dans le Caddyfile,
     et la fonctionnalité correspondante tombe en production. */
  it("autorisent les mêmes origines fixes", () => {
    const caddy = inCaddyfile();
    for (const origine of [
      "https://image.tmdb.org",
      "https://api.themoviedb.org",
      "https://corsproxy.io",
      "data:",
      "blob:",
      "'unsafe-inline'",
    ]) {
      expect(caddy, `${origine} manque au Caddyfile`).toContain(origine);
      expect(policy(), `${origine} manque à csp.mjs`).toContain(origine);
    }
  });
});

describe("ce que la politique refuse", () => {
  it("n'ouvre jamais les scripts à n'importe qui", () => {
    /* `'unsafe-inline'` ou `'unsafe-eval'` sur `script-src` rendrait la
       politique décorative : c'est précisément le code injecté qu'on
       cherche à empêcher de s'exécuter. Le `style-src`, lui, en a besoin
       et l'assume — d'où le test par directive et non sur la chaîne. */
    const scriptSrc = policy({ mesure: "https://m.exemple.fr" })
      .split(";")
      .find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(scriptSrc).not.toContain("*");
  });

  it("ferme ce qui n'a jamais servi", () => {
    expect(policy()).toContain("object-src 'none'");
    expect(policy()).toContain("frame-ancestors 'self'");
  });

  /* UNE ORIGINE VIDE NE DOIT PAS DEVENIR UNE ORIGINE. Sans le filtre,
     une variable non réglée écrirait « undefined » dans la liste
     blanche — une origine qui s'appelle littéralement ainsi, et une
     politique qui a l'air plus large qu'elle ne l'est. */
  it("ne fabrique rien à partir d'une adresse absente", () => {
    const nue = policy();
    expect(nue).not.toContain("undefined");
    expect(nue).not.toMatch(/\s{2,}/);
    expect(nue).not.toMatch(/;\s*;/);
  });
});
