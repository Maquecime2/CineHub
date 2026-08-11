import { describe, it, expect } from "vitest";
import {
  fusionnerLoin,
  renfortDuDehors,
  déjàDansLeClasseur,
  parIdTmdb,
  VOTES_MINIMUM,
} from "./sillageLoin";
import type { CandidatLoin, Récolte } from "./sillageLoin";
import { familleDe } from "./sillage";
import { makeFilm } from "./film";
import type { Film } from "../types";

const cand = (tmdbId: number, title: string, extra: Partial<CandidatLoin> = {}): CandidatLoin => ({
  tmdbId,
  title,
  year: 2000,
  poster: null,
  voteAverage: 7,
  voteCount: 500,
  ...extra,
});

const récolte = (par: Récolte["par"], valeur: string, candidats: CandidatLoin[]): Récolte => ({
  par,
  valeur,
  candidats,
});

describe("ce que la colonne « dehors » tait", () => {
  it("écarte ce qui est déjà dans le classeur", () => {
    const r = [récolte("foule", "", [cand(1, "Déjà vu"), cand(2, "Neuf")])];
    const out = fusionnerLoin(r, { déjàLà: new Set([1]) });
    expect(out.map((v) => v.title)).toEqual(["Neuf"]);
  });

  it("écarte ce que presque personne n'a vu", () => {
    const r = [
      récolte("image", "Deakins", [
        cand(1, "Court d'école", { voteCount: VOTES_MINIMUM - 1 }),
        cand(2, "Un vrai film", { voteCount: VOTES_MINIMUM }),
      ]),
    ];
    expect(fusionnerLoin(r).map((v) => v.title)).toEqual(["Un vrai film"]);
  });

  it("ignore un candidat sans identifiant ou sans titre", () => {
    const bancal = [{ ...cand(0, ""), tmdbId: 0 }] as CandidatLoin[];
    expect(fusionnerLoin([récolte("foule", "", bancal)])).toEqual([]);
  });

  it("ne rend rien sans récolte", () => {
    expect(fusionnerLoin([])).toEqual([]);
  });
});

describe("la fusion des provenances", () => {
  it("additionne les chemins d'un film qui arrive plusieurs fois", () => {
    const r = [
      récolte("foule", "", [cand(1, "Croisé")]),
      récolte("image", "Deakins", [cand(1, "Croisé")]),
      récolte("musique", "Zimmer", [cand(2, "Simple")]),
    ];
    const premier = fusionnerLoin(r)[0]!;
    expect(premier.title).toBe("Croisé");
    expect(premier.par).toHaveLength(2);
  });

  /* « + 1 lien » n'apprenait rien : on savait qu'il existait une seconde
     raison, jamais laquelle — c'est-à-dire précisément ce qu'on venait
     chercher. Les deux premiers chemins se nomment. */
  it("nomme les deux chemins plutôt que de compter le second", () => {
    const r = [
      récolte("foule", "", [cand(1, "Croisé")]),
      récolte("image", "Roger Deakins", [cand(1, "Croisé")]),
    ];
    expect(fusionnerLoin(r)[0]!.raison).toBe(
      "du même chef op Roger Deakins · vu par les mêmes gens"
    );
  });

  it("ne compte qu'au-delà de deux chemins", () => {
    const r = [
      récolte("image", "Deakins", [cand(1, "Croisé")]),
      récolte("musique", "Zimmer", [cand(1, "Croisé")]),
      récolte("foule", "", [cand(1, "Croisé")]),
      récolte("acteur", "Vedette", [cand(1, "Croisé")]),
    ];
    expect(fusionnerLoin(r)[0]!.raison).toBe(
      "du même chef op Deakins · du même compositeur Zimmer, + 2"
    );
  });

  it("dit simplement d'où il vient quand il n'y a qu'un chemin", () => {
    const r = [récolte("musique", "Zbigniew Preisner", [cand(1, "Seul")])];
    expect(fusionnerLoin(r)[0]!.raison).toBe("du même compositeur Zbigniew Preisner");
  });

  it("fait passer un chef op partagé devant une simple recommandation", () => {
    const r = [
      récolte("foule", "", [cand(1, "Foule")]),
      récolte("image", "Deakins", [cand(2, "Même œil")]),
    ];
    expect(fusionnerLoin(r).map((v) => v.title)).toEqual(["Même œil", "Foule"]);
  });
});

describe("le classement est stable", () => {
  it("ne dépend pas de l'ordre d'arrivée des requêtes", () => {
    const a = récolte("foule", "", [cand(1, "Alpha"), cand(2, "Bravo")]);
    const b = récolte("musique", "M", [cand(3, "Charlie")]);
    const gauche = fusionnerLoin([a, b]).map((v) => v.title);
    const droite = fusionnerLoin([b, a]).map((v) => v.title);
    expect(gauche).toEqual(droite);
  });

  it("s'arrête au nombre demandé", () => {
    const beaucoup = Array.from({ length: 30 }, (_, i) => cand(i + 1, `F${i}`));
    expect(
      fusionnerLoin([récolte("foule", "", beaucoup)], {
        quotas: { gens: 2, sujets: 2, foule: 2 },
      })
    ).toHaveLength(6);
  });
});

describe("les quotas côté TMDB", () => {
  /* Les quatre chemins « personne » raflaient toute la colonne : leurs
     poids sont plus lourds, et il n'existait même aucune voie
     thématique. Le quota garantit une place au sujet. */
  it("réserve des places aux sujets face aux filmographies", () => {
    const parGens = Array.from({ length: 10 }, (_, i) => cand(i + 1, `Gens${i}`));
    const parSujet = Array.from({ length: 10 }, (_, i) => cand(100 + i, `Sujet${i}`));
    const rendu = fusionnerLoin(
      [récolte("image", "Deakins", parGens), récolte("mot-clé", "neo-noir", parSujet)],
      { quotas: { gens: 3, sujets: 3, foule: 0 } }
    );
    expect(rendu.filter((v) => v.title.startsWith("Gens"))).toHaveLength(3);
    expect(rendu.filter((v) => v.title.startsWith("Sujet"))).toHaveLength(3);
  });

  it("reverse aux autres familles quand une voie ne rapporte rien", () => {
    const parGens = Array.from({ length: 10 }, (_, i) => cand(i + 1, `Gens${i}`));
    const rendu = fusionnerLoin([récolte("image", "Deakins", parGens)], {
      quotas: { gens: 3, sujets: 3, foule: 0 },
    });
    expect(rendu).toHaveLength(6);
  });

  /* ▲ LE TEST QUI AURAIT ATTRAPÉ LE DÉFAUT.

     « Recommandé » pesait 2,2 et vivait dans la famille « sujets », où un
     mot-clé plafonne à 1,4 + 0,4 = 1,8. Les vingt recommandations que
     TMDB rend à chaque appel saturaient donc la pile entière, et le
     résultat de la requête par mots-clés — lancée, payée — était jeté à
     cent pour cent. Aucun sillage n'a jamais montré un seul « même
     sujet » venu du dehors. */
  it("laisse passer les sujets malgré vingt recommandations", () => {
    const recos = Array.from({ length: 20 }, (_, i) => cand(i + 1, `Reco${i}`));
    const sujets = Array.from({ length: 8 }, (_, i) => cand(100 + i, `Sujet${i}`));
    const rendu = fusionnerLoin(
      [récolte("foule", "", recos), récolte("mot-clé", "time loop", sujets)],
      { quotas: { gens: 4, sujets: 4, foule: 2 } }
    );
    /* Le point qui compte : il y en a, là où il n'y en avait JAMAIS.
       Le compte exact dépend du report — la famille « gens » est vide
       ici, et ses quatre places reviennent aux autres. */
    expect(rendu.filter((v) => v.title.startsWith("Sujet")).length).toBeGreaterThanOrEqual(4);
  });

  /* Le même défaut vu à l'envers : sans quota propre, la foule ne
     laissait pas UNE place. On vérifie donc les deux bornes. */
  it("ne laisse pas la foule rafler la part des sujets", () => {
    const recos = Array.from({ length: 20 }, (_, i) => cand(i + 1, `Reco${i}`));
    const sujets = Array.from({ length: 8 }, (_, i) => cand(100 + i, `Sujet${i}`));
    const gens = Array.from({ length: 8 }, (_, i) => cand(200 + i, `Gens${i}`));
    const rendu = fusionnerLoin(
      [
        récolte("foule", "", recos),
        récolte("mot-clé", "time loop", sujets),
        récolte("image", "Deakins", gens),
      ],
      { quotas: { gens: 4, sujets: 4, foule: 2 } }
    );
    expect(rendu.filter((v) => v.title.startsWith("Gens"))).toHaveLength(4);
    expect(rendu.filter((v) => v.title.startsWith("Sujet"))).toHaveLength(4);
    expect(rendu.filter((v) => v.title.startsWith("Reco"))).toHaveLength(2);
  });

  it("donne à la foule sa propre part, ni celle des gens ni celle des sujets", () => {
    const rendu = fusionnerLoin(
      [
        récolte("foule", "", [cand(1, "Foule")]),
        récolte("image", "D", [cand(2, "A"), cand(3, "B")]),
      ],
      { quotas: { gens: 1, sujets: 0, foule: 1 } }
    );
    expect(rendu.map((v) => v.title).sort()).toEqual(["A", "Foule"]);
  });
});

describe("déjàDansLeClasseur", () => {
  it("ne retient que les fiches qui portent un identifiant TMDB", () => {
    const set = déjàDansLeClasseur([{ tmdbId: 12 }, { tmdbId: null }, {}, { tmdbId: 34 }]);
    expect([...set].sort((a, b) => a - b)).toEqual([12, 34]);
  });

  /* Les fiches écrites à la main et certains imports anciens posent
     `tmdbId` en TEXTE. Sans conversion, « 27205 » n'est jamais 27205 et
     le film qu'on possède revient se proposer comme une découverte. */
  it("reconnaît un identifiant écrit en toutes lettres", () => {
    expect(déjàDansLeClasseur([{ tmdbId: "27205" }]).has(27205)).toBe(true);
  });

  it("ne prend pas une chaîne vide pour un identifiant", () => {
    expect(déjàDansLeClasseur([{ tmdbId: "" }]).size).toBe(0);
  });

  it("écarte bien un film déjà possédé sous un identifiant en texte", () => {
    const déjàLà = déjàDansLeClasseur([{ tmdbId: "1" }]);
    const out = fusionnerLoin([récolte("foule", "", [cand(1, "Déjà là"), cand(2, "Neuf")])], {
      déjàLà,
    });
    expect(out.map((v) => v.title)).toEqual(["Neuf"]);
  });
});

/* ============================================================
   LE RENFORT — TMDB au service de la colonne « chez vous »
   ============================================================

   Le sillage maison ne rapproche par sujet que si les DEUX fiches
   portent motifs ou mots-clés. Sur une collection importée, elles n'en
   ont aucun, et la colonne ne parlait que d'équipes. Aller chercher les
   mots-clés des cinq cents fiches coûterait cinq cents appels ; la
   réponse était déjà dans la récolte, qu'on jetait. */
describe("renfortDuDehors", () => {
  const fiche = (id: string, tmdbId: number | string, extra: Partial<Film> = {}): Film =>
    makeFilm({ id, title: `Film ${id}`, tmdbId, ...extra });

  it("reconnaît une de vos fiches dans ce que TMDB rapporte", () => {
    const à_moi = fiche("a", 42);
    const out = renfortDuDehors(
      [récolte("mot-clé", "time loop", [cand(42, "Chez moi")])],
      parIdTmdb([à_moi]),
      "pivot"
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.film.id).toBe("a");
    expect(out[0]!.liens[0]!.type).toBe("mot-clé");
  });

  it("ignore ce que vous ne possédez pas — c'est l'affaire de l'autre colonne", () => {
    const out = renfortDuDehors(
      [récolte("mot-clé", "time loop", [cand(99, "Dehors")])],
      parIdTmdb([fiche("a", 42)]),
      "pivot"
    );
    expect(out).toEqual([]);
  });

  /* Le pivot se retrouve évidemment dans sa propre filmographie et sous
     ses propres mots-clés. */
  it("ne se propose pas lui-même", () => {
    const pivot = fiche("pivot", 42);
    const out = renfortDuDehors(
      [récolte("image", "Deakins", [cand(42, "Le pivot")])],
      parIdTmdb([pivot]),
      "pivot"
    );
    expect(out).toEqual([]);
  });

  it("écarte les fiches rangées", () => {
    const out = renfortDuDehors(
      [récolte("mot-clé", "x", [cand(42, "Rangé")])],
      parIdTmdb([fiche("a", 42, { archived: true })]),
      "pivot"
    );
    expect(out).toEqual([]);
  });

  /* Les identifiants écrits en texte : sinon « 42 » n'est jamais 42 et
     le renfort ne reconnaît aucune de vos fiches. */
  it("reconnaît un identifiant écrit en toutes lettres", () => {
    const out = renfortDuDehors(
      [récolte("mot-clé", "x", [cand(42, "Chez moi")])],
      parIdTmdb([fiche("a", "42")]),
      "pivot"
    );
    expect(out).toHaveLength(1);
  });

  it("additionne les chemins d'une fiche remontée plusieurs fois", () => {
    const out = renfortDuDehors(
      [
        récolte("mot-clé", "time loop", [cand(42, "Chez moi")]),
        récolte("image", "Deakins", [cand(42, "Chez moi")]),
      ],
      parIdTmdb([fiche("a", 42)]),
      "pivot"
    );
    expect(out[0]!.liens).toHaveLength(2);
    // le plus rare d'abord, comme partout
    expect(out[0]!.liens[0]!.type).toBe("image");
  });

  /* « Recommandé » n'a pas d'équivalent dans le vocabulaire du sillage
     maison : il devient un sujet, ce qui le range du bon côté des
     quotas. */
  /* ▲ L'AUTRE MOITIÉ DU DÉFAUT. Le renfort convertissait une
     recommandation en `mot-clé` : une proposition venue de la foule se
     faisait passer pour un rapprochement par sujet, et la raison
     affichée mentait. */
  it("ne déguise pas une recommandation en rapprochement par sujet", () => {
    const out = renfortDuDehors(
      [récolte("foule", "", [cand(42, "Chez moi")])],
      parIdTmdb([fiche("a", 42)]),
      "pivot"
    );
    expect(out[0]!.liens[0]!.type).toBe("foule");
    expect(familleDe(out[0]!.liens)).toBe("foule");
  });

  it("ne rend rien sans récolte", () => {
    expect(renfortDuDehors([], parIdTmdb([fiche("a", 42)]), "pivot")).toEqual([]);
  });
});
