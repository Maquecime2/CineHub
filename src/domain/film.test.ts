import { describe, it, expect } from "vitest";
import { makeFilm, migrate, uid } from "./film";

describe("uid", () => {
  it("ne se répète pas", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid()));
    expect(ids.size).toBe(500);
  });
});

describe("makeFilm", () => {
  it("donne une fiche complète même sans rien fournir", () => {
    const f = makeFilm();
    expect(f.id).toBeTruthy();
    expect(f.status).toBe("watched");
    expect(f.genres).toEqual([]);
    expect(f.order).toBeNull();
  });

  it("laisse le contenu fourni l'emporter sur les valeurs par défaut", () => {
    expect(makeFilm({ title: "Stalker", status: "watchlist" })).toMatchObject({
      title: "Stalker",
      status: "watchlist",
    });
  });

  it("ne partage pas ses tableaux entre deux fiches", () => {
    // un tableau par défaut partagé ferait apparaître un genre dans toute la collection
    const a = makeFilm();
    const b = makeFilm();
    a.genres.push("Drame");
    expect(b.genres).toEqual([]);
  });
});

describe("migrate", () => {
  it("complète les fiches d'avant les champs récents", () => {
    const vieille = { id: "x", title: "Stalker", rating: 4 };
    const [f] = migrate([vieille]);
    expect(f).toMatchObject({
      id: "x",
      title: "Stalker",
      rating: 4,
      status: "watched",
      chevet: false,
      archived: false,
      order: null,
    });
    expect(f!.stills).toEqual([]);
    expect(f!.linkedWorks).toEqual([]);
  });

  it("ramène l'année à un nombre", () => {
    // le tri par année faisait de l'arithmétique sur des chaînes venues du CSV
    expect(migrate([{ title: "a", year: "1979" as unknown as number }])[0]!.year).toBe(1979);
  });

  it("garde l'année vide quand elle est inconnue", () => {
    expect(migrate([{ title: "a", year: "" }])[0]!.year).toBe("");
    expect(migrate([{ title: "a", year: null as unknown as number }])[0]!.year).toBe("");
    // une année illisible ne doit pas devenir NaN
    expect(migrate([{ title: "a", year: "s.d." as unknown as number }])[0]!.year).toBe("");
  });

  it("ne connaît que deux statuts", () => {
    expect(migrate([{ title: "a", status: "watchlist" }])[0]!.status).toBe("watchlist");
    expect(
      migrate([{ title: "a", status: "n'importe quoi" as unknown as "watched" }])[0]!.status
    ).toBe("watched");
  });

  it("préserve un rangement manuel déjà effectué", () => {
    expect(migrate([{ title: "a", order: 0 }])[0]!.order).toBe(0);
    expect(migrate([{ title: "a", order: 7 }])[0]!.order).toBe(7);
  });

  it("accepte une collection absente", () => {
    expect(migrate(null)).toEqual([]);
    expect(migrate(undefined)).toEqual([]);
  });
});
