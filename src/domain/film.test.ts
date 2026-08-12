import { describe, it, expect } from "vitest";
import {
  hasChanged,
  editLinkedWork,
  stamp,
  makeFilm,
  mergeWatches,
  migrate,
  publicPart,
  ratingDrift,
  uid,
  watchCount,
  withWatches,
} from "./film";
import type { Film, LinkedWork } from "../types";

describe("uid", () => {
  it("ne se répète pas", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid()));
    expect(ids.size).toBe(500);
  });

  it("se trie dans l'ordre des naissances, y compris dans la même milliseconde", () => {
    /* C'est la moitié de l'intérêt d'un UUID v7 : un index de base de
       données qui reçoit des clés croissantes ne se fragmente pas.

       Deux cents fiches d'un même import naissent dans la MÊME
       milliseconde : sans compteur, leur ordre retombe sur le hasard, et
       la promesse ne vaut plus là où elle sert le plus. */
    const ids = Array.from({ length: 200 }, () => uid());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(200);
  });

  it("annonce sa version, pour qui la lira de l'autre côté", () => {
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("sans générateur cryptographique, on écrit quand même la fiche", () => {
    const vrai = crypto.randomUUID;
    // @ts-expect-error — on simule un navigateur qui ne l'a pas
    crypto.randomUUID = undefined;
    try {
      expect(uid().length).toBeGreaterThan(8);
    } finally {
      crypto.randomUUID = vrai;
    }
  });
});

describe("dater ce qui a changé", () => {
  const base = (p: Partial<Film> = {}): Film => makeFilm({ id: "a", updatedAt: 1000, ...p });

  it("une recopie à l'identique n'est pas un changement", () => {
    const f = base();
    expect(hasChanged(f, { ...f })).toBe(false);
  });

  it("une valeur composée qui bouge en est un", () => {
    const f = base();
    expect(hasChanged(f, { ...f, motifs: ["pluie"] })).toBe(true);
    expect(hasChanged(f, { ...f, watches: [{ date: "2020-01-01", rating: 4 }] })).toBe(true);
  });

  it("la date de modification elle-même ne compte pas comme un changement", () => {
    /* Sinon toute écriture en provoquerait une autre, indéfiniment. */
    const f = base();
    expect(hasChanged(f, { ...f, updatedAt: 9999 })).toBe(false);
  });

  it("stamp ne touche que ce qui a bougé, et rend le reste intact", () => {
    const a = base({ id: "a" });
    const b = base({ id: "b" });
    const suite = stamp([a, b], [{ ...a, rating: 5 }, { ...b }], 5000);
    expect(suite[0]!.updatedAt).toBe(5000);
    expect(suite[1]).toBe(b);
  });

  it("rien n'a bougé : c'est le tableau reçu qui revient", () => {
    const a = base();
    const reçu = [a];
    expect(stamp([a], reçu, 5000)).toBe(reçu);
  });

  it("une fiche jamais vue est une fiche qui a changé", () => {
    const neuve = base({ id: "neuf" });
    expect(stamp([], [neuve], 5000)[0]!.updatedAt).toBe(5000);
  });
});

describe("ce qui se partage", () => {
  it("le carnet intime et le journal des séances ne sortent pas", () => {
    const f = makeFilm({
      title: "Beau travail",
      notes: "à revoir avec P.",
      watches: [{ date: "2021-03-02", rating: 5 }],
      review: "la danse de la fin",
      rating: 5,
    });
    const publié = publicPart(f) as Record<string, unknown>;
    expect("notes" in publié).toBe(false);
    expect("watches" in publié).toBe(false);
    /* Ce qu'on publie quand on publie : c'est le propos d'une
       vidéothèque partagée. */
    expect(publié.review).toBe("la danse de la fin");
    expect(publié.rating).toBe(5);
    expect(publié.title).toBe("Beau travail");
  });

  it("un champ ajouté demain part avec le reste, plutôt que d'être oublié", () => {
    /* C'est pour cela qu'on nomme ce qu'on ÉCARTE, et non ce qu'on garde. */
    const f = { ...makeFilm({ title: "Elephant" }), nouveauChamp: "présent" } as unknown as Film;
    expect((publicPart(f) as Record<string, unknown>).nouveauChamp).toBe("présent");
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
      bedside: false,
      archived: false,
      order: null,
    });
    expect(f!.stills).toEqual([]);
    expect(f!.linkedWorks).toEqual([]);
  });

  /* ============================================================
     LA TRADUCTION NE DOIT RIEN COÛTER À UN CLASSEUR DÉJÀ TENU

     Deux champs ont changé de nom en passant à l'anglais, et tous deux
     sont écrits sur le disque : `chevet` est devenu `bedside`, et les
     valeurs de `Relation` ont changé de vocabulaire. `migrate` est la
     seule porte par laquelle une fiche entre — c'est donc ici que la
     relecture des anciennes graphies se prouve, ou nulle part.
     ============================================================ */
  it("relit `chevet` sur une fiche d'avant la traduction", () => {
    const [f] = migrate([{ id: "x", title: "Stalker", chevet: true } as never]);
    expect(f!.bedside).toBe(true);
    // et l'ancienne graphie ne survit pas à la relecture
    expect(f as unknown as Record<string, unknown>).not.toHaveProperty("chevet");
  });

  it("ne prend pas l'absence de `chevet` pour un rayon du haut", () => {
    expect(migrate([{ id: "x", title: "Stalker" }])[0]!.bedside).toBe(false);
  });

  it("traduit les relations écrites avant la bascule, sans perdre le sens", () => {
    const [f] = migrate([
      {
        id: "a",
        title: "Stalker",
        linkedWorks: [
          { id: "w1", type: "film", filmId: "b", relation: "suite-de" },
          { id: "w2", type: "film", filmId: "c", relation: "écho" },
        ],
      } as never,
    ]);
    expect(f!.linkedWorks.map((w) => w.relation)).toEqual(["sequel-to", "echo"]);
  });

  it("laisse intacte une relation déjà traduite", () => {
    const [f] = migrate([
      {
        id: "a",
        title: "Stalker",
        linkedWorks: [{ id: "w1", type: "film", filmId: "b", relation: "precedes" }],
      } as never,
    ]);
    expect(f!.linkedWorks[0]!.relation).toBe("precedes");
  });

  /* Un lien sans relation est le cas ordinaire — la nature du fil est
     facultative. La migration ne doit pas lui en inventer une. */
  it("n'invente pas de relation là où il n'y en avait pas", () => {
    const [f] = migrate([
      {
        id: "a",
        title: "Stalker",
        linkedWorks: [{ id: "w1", type: "livre", title: "Roadside Picnic" }],
      } as never,
    ]);
    expect(f!.linkedWorks[0]!.relation).toBeUndefined();
  });

  /* D'une fiche d'avant le journal on ne sait qu'une chose : elle a été
     vue tel jour, et notée ainsi. L'écrire est plus juste que de laisser
     un compteur à zéro sous un film qui porte une date de séance. */
  it("bâtit une première séance à partir de la date déjà connue", () => {
    const [f] = migrate([{ id: "x", title: "Stalker", rating: 4, watchedAt: "2019-03-02" }]);
    expect(f!.watches).toEqual([{ date: "2019-03-02", rating: 4 }]);
  });

  it("n'invente aucune séance pour un film jamais daté", () => {
    expect(migrate([{ id: "x", title: "Stalker" }])[0]!.watches).toEqual([]);
  });

  /* LE TEST QUI PROTÈGE DE LA RÉSURRECTION. Un journal vidé à la main est
     un tableau VIDE, pas un champ absent : les confondre le remplirait à
     nouveau au chargement suivant — et `migrate` réécrit aussitôt dans le
     stockage, donc la séance reviendrait pour de bon. */
  it("laisse vide un journal que l'on a vidé, même si la date demeure", () => {
    const vidé = { id: "x", title: "Stalker", rating: 4, watchedAt: "2019-03-02", watches: [] };
    expect(migrate([vidé])[0]!.watches).toEqual([]);
    expect(migrate(migrate([vidé]))[0]!.watches).toEqual([]);
  });

  it("range le journal du plus récent au plus ancien", () => {
    const [f] = migrate([
      {
        id: "x",
        title: "Stalker",
        watches: [
          { date: "2019-03-02", rating: 4 },
          { date: "2024-01-01", rating: 5 },
        ],
      },
    ]);
    expect(f!.watches.map((w) => w.date)).toEqual(["2024-01-01", "2019-03-02"]);
  });
});

describe("les motifs, sur une fiche d'avant", () => {
  it("apparaissent vides sans rien effacer d'autre", () => {
    const [f] = migrate([{ title: "Playtime", themes: ["ville"] }]);
    expect(f?.motifs).toEqual([]);
    expect(f?.themes).toEqual(["ville"]);
  });

  it("ne réécrivent pas ceux déjà posés", () => {
    const [f] = migrate([{ title: "x", motifs: ["heros-meurt"] }]);
    expect(f?.motifs).toEqual(["heros-meurt"]);
  });
});

describe("le journal des séances", () => {
  const w = (date: string, rating: number | null = null) => ({ date, rating });

  /* La date est la clé, et c'est ce qui rend un réimport inoffensif :
     repasser trois fois le même diary.csv ne fait pas un film vu neuf
     fois. */
  it("ne compte qu'une séance par date", () => {
    expect(mergeWatches([w("2024-01-01", 4)], [w("2024-01-01", 4)])).toHaveLength(1);
  });

  it("complète une séance sans effacer une note déjà connue", () => {
    expect(mergeWatches([w("2024-01-01", 4)], [w("2024-01-01", null)])).toEqual([
      { date: "2024-01-01", rating: 4 },
    ]);
  });

  it("laisse une note plus récente corriger la précédente", () => {
    expect(mergeWatches([w("2024-01-01", 4)], [w("2024-01-01", 5)])).toEqual([
      { date: "2024-01-01", rating: 5 },
    ]);
  });

  /* `watchedAt` n'est plus la vérité mais le reflet du journal : les deux
     ne peuvent pas diverger puisqu'on ne les écrit qu'ensemble. */
  it("recale la date de dernière séance sur le journal", () => {
    const f = withWatches(makeFilm({ watchedAt: "1999-01-01" }), [
      w("2019-03-02", 4),
      w("2024-01-01", 5),
    ]);
    expect(f.watchedAt).toBe("2024-01-01");
    expect(watchCount(f)).toBe(2);
  });

  it("rend la date à null quand on retire la dernière séance", () => {
    expect(withWatches(makeFilm({ watchedAt: "2024-01-01" }), []).watchedAt).toBeNull();
  });

  it("écarte une séance sans date, qui n'est pas une séance", () => {
    expect(mergeWatches([{ date: "", rating: 4 }])).toEqual([]);
  });
});

describe("la variation de note d'une séance à l'autre", () => {
  it("mesure l'écart avec la fois d'avant", () => {
    expect(
      ratingDrift([
        { date: "2024-01-01", rating: 5 },
        { date: "2019-03-02", rating: 3.5 },
      ])
    ).toEqual([1.5, null]);
  });

  /* Une séance non notée n'a rien à dire : elle ne rompt pas la chaîne,
     on compare à la dernière fois où l'on s'est prononcé. */
  it("enjambe une séance qu'on n'a pas notée", () => {
    expect(
      ratingDrift([
        { date: "2024-01-01", rating: 5 },
        { date: "2022-01-01", rating: null },
        { date: "2019-03-02", rating: 4 },
      ])
    ).toEqual([1, null, null]);
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

describe("editLinkedWork", () => {
  const work = (over: Partial<LinkedWork> = {}): LinkedWork => ({
    id: "w1",
    type: "book",
    title: "Lol V. Stein",
    creator: "Duras",
    note: "le même vide",
    ...over,
  });

  /* Le premier fil d'une fiche. Le `!` est assumé : chaque cas d'essai
     en pose un, et une absence doit casser le test plutôt que d'être
     contournée par un point d'interrogation qui la rendrait muette. */
  const worksOf = (films: Film[], id: string) => films.find((f) => f.id === id)!.linkedWorks;
  const firstOf = (films: Film[], id: string) => worksOf(films, id)[0]!;

  /* Une mention libre : rien ne la contredit ailleurs, elle s'écrit donc
     entièrement à la main. */
  describe("une mention libre", () => {
    const base = () => [makeFilm({ id: "a", linkedWorks: [work()] })];

    it("réécrit tout ce qu'on lui donne", () => {
      const out = editLinkedWork(base(), "a", "w1", {
        type: "film",
        title: "Hiroshima mon amour",
        creator: "Resnais",
        note: "la mémoire trouée",
      });
      expect(firstOf(out, "a")).toMatchObject({
        id: "w1",
        type: "film",
        title: "Hiroshima mon amour",
        creator: "Resnais",
        note: "la mémoire trouée",
      });
    });

    it("garde ce que le correctif ne mentionne pas", () => {
      const out = editLinkedWork(base(), "a", "w1", { note: "autrement" });
      expect(firstOf(out, "a")).toMatchObject({
        title: "Lol V. Stein",
        creator: "Duras",
        type: "book",
        note: "autrement",
      });
    });

    it("émonde les blancs", () => {
      const out = editLinkedWork(base(), "a", "w1", { title: "  Le Vice-consul  ", note: "  x  " });
      expect(firstOf(out, "a")).toMatchObject({ title: "Le Vice-consul", note: "x" });
    });

    it("refuse de la vider de son titre — un fil sans titre n'a plus rien à dire", () => {
      const films = base();
      expect(editLinkedWork(films, "a", "w1", { title: "   " })).toBe(films);
    });
  });

  /* Un renvoi vers une fiche du mur : son titre appartient à la fiche
     d'en face, sa note appartient au lien. */
  describe("un renvoi réciproque", () => {
    const base = () => [
      makeFilm({
        id: "a",
        linkedWorks: [work({ id: "wa", type: "film", filmId: "b", pairId: "p", title: "B" })],
      }),
      makeFilm({
        id: "b",
        linkedWorks: [work({ id: "wb", type: "film", filmId: "a", pairId: "p", title: "A" })],
      }),
    ];

    it("porte la note aux deux bouts du fil", () => {
      const out = editLinkedWork(base(), "a", "wa", { note: "deux regards sur un musée" });
      expect(firstOf(out, "a").note).toBe("deux regards sur un musée");
      expect(firstOf(out, "b").note).toBe("deux regards sur un musée");
    });

    it("ignore titre, auteur et type : ils sont la fiche d'en face", () => {
      const out = editLinkedWork(base(), "a", "wa", {
        title: "MENSONGE",
        creator: "MENSONGE",
        type: "book",
        note: "n",
      });
      expect(firstOf(out, "a")).toMatchObject({ title: "B", creator: "Duras", type: "film" });
      // et la moitié d'en face garde le sien, qui n'a jamais été en cause
      expect(firstOf(out, "b")).toMatchObject({ title: "A", type: "film", note: "n" });
    });

    /* La relation appartient au lien, comme la note — mais elle se
       RENVERSE d'un bout à l'autre. Écrire la même des deux côtés ferait
       dire à chaque film qu'il est la suite de l'autre, ce qui ne se voit
       qu'en ouvrant la seconde fiche. */
    it("renverse la relation sur la moitié d'en face", () => {
      const out = editLinkedWork(base(), "a", "wa", { relation: "sequel-to", force: 3 });
      expect(firstOf(out, "a")).toMatchObject({ relation: "sequel-to", force: 3 });
      expect(firstOf(out, "b")).toMatchObject({ relation: "precedes", force: 3 });
    });

    it("garde une relation symétrique telle quelle", () => {
      const out = editLinkedWork(base(), "a", "wa", { relation: "diptych" });
      expect(firstOf(out, "b").relation).toBe("diptych");
    });

    it("ne touche pas aux fils des autres fiches", () => {
      const films = [...base(), makeFilm({ id: "c", linkedWorks: [work({ id: "wc" })] })];
      const out = editLinkedWork(films, "a", "wa", { note: "n" });
      expect(firstOf(out, "c").note).toBe("le même vide");
    });

    /* Une moitié orpheline — la fiche d'en face supprimée hors de ce
       chemin — ne doit pas empêcher d'annoter celle qui reste. */
    it("annote encore quand la fiche d'en face a disparu", () => {
      const seul = [
        makeFilm({
          id: "a",
          linkedWorks: [work({ id: "wa", type: "film", filmId: "disparu", pairId: "p" })],
        }),
      ];
      expect(firstOf(editLinkedWork(seul, "a", "wa", { note: "n" }), "a").note).toBe("n");
    });
  });

  it("laisse la collection intacte quand le fil n'existe pas", () => {
    const films = [makeFilm({ id: "a", linkedWorks: [work()] })];
    expect(editLinkedWork(films, "a", "inconnu", { note: "n" })).toBe(films);
    expect(editLinkedWork(films, "inconnu", "w1", { note: "n" })).toBe(films);
  });
});
