import { describe, it, expect } from "vitest";
import { demoFilms, DEMO_PREFIX } from "./demo";
import { DEMO_FILMS } from "../../server/src/demo";

/* ============================================================
   LES DOUZE FICHES SONT ÉCRITES DES DEUX CÔTÉS

   Le classeur tient les siennes avec leurs textes traduits ; le serveur
   ne tient que ce qu'il faut pour chercher une affiche — un titre
   d'origine et une année. Les deux listes doivent nommer les MÊMES
   douze fiches.

   C'est le genre d'accord qui se défait en silence : on ajoute une
   treizième fiche d'exemple côté classeur, elle n'a pas d'affiche, et
   rien ne le dit — juste un rectangle dessiné au milieu de onze photos,
   sur la seule page que voient les gens qui n'ont pas encore de compte.

   Le même garde-fou existe déjà entre les peaux et la boutique
   (`src/theme/skins.test.ts`), et pour la même raison.
   ============================================================ */

/* Les textes viennent du catalogue ; ici on ne regarde que les
   identifiants, donc une fonction qui rend la clé suffit. */
const say = (key: string) => key;

describe("les douze de la vitrine", () => {
  it("portent les mêmes identifiants des deux côtés", () => {
    const binder = demoFilms(say)
      .map((f) => f.id)
      .sort();
    const server = DEMO_FILMS.map((f) => f.id).sort();
    expect(server).toEqual(binder);
  });

  it("sont toutes préfixées, chez le serveur aussi", () => {
    for (const f of DEMO_FILMS) expect(f.id.startsWith(DEMO_PREFIX)).toBe(true);
  });

  /* Une année manquante ou fantaisiste ferait chercher le mauvais film,
     et le résultat serait rangé en base sans que personne le relise. */
  it("portent une année et un titre cherchables", () => {
    for (const f of DEMO_FILMS) {
      expect(f.title.trim(), f.id).not.toBe("");
      expect(f.year, f.id).toBeGreaterThan(1900);
      expect(f.year, f.id).toBeLessThan(2100);
    }
  });

  it("ne nomment pas deux fois la même fiche", () => {
    expect(new Set(DEMO_FILMS.map((f) => f.id)).size).toBe(DEMO_FILMS.length);
  });
});
