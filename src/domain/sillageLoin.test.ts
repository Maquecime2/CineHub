import { describe, it, expect } from "vitest";
import { fusionnerLoin, déjàDansLeClasseur, VOTES_MINIMUM } from "./sillageLoin";
import type { CandidatLoin, Récolte } from "./sillageLoin";

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
    const r = [récolte("reco", "Pivot", [cand(1, "Déjà vu"), cand(2, "Neuf")])];
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
    expect(fusionnerLoin([récolte("reco", "P", bancal)])).toEqual([]);
  });

  it("ne rend rien sans récolte", () => {
    expect(fusionnerLoin([])).toEqual([]);
  });
});

describe("la fusion des provenances", () => {
  it("additionne les chemins d'un film qui arrive plusieurs fois", () => {
    const r = [
      récolte("reco", "Pivot", [cand(1, "Croisé")]),
      récolte("image", "Deakins", [cand(1, "Croisé")]),
      récolte("musique", "Zimmer", [cand(2, "Simple")]),
    ];
    const premier = fusionnerLoin(r)[0]!;
    expect(premier.title).toBe("Croisé");
    expect(premier.par).toHaveLength(2);
  });

  it("nomme le chemin le plus fort et compte le reste", () => {
    const r = [
      récolte("reco", "Pivot", [cand(1, "Croisé")]),
      récolte("image", "Roger Deakins", [cand(1, "Croisé")]),
    ];
    expect(fusionnerLoin(r)[0]!.raison).toBe("du même chef op Roger Deakins, + 1 lien");
  });

  it("dit simplement d'où il vient quand il n'y a qu'un chemin", () => {
    const r = [récolte("musique", "Zbigniew Preisner", [cand(1, "Seul")])];
    expect(fusionnerLoin(r)[0]!.raison).toBe("du même compositeur Zbigniew Preisner");
  });

  it("fait passer un chef op partagé devant une simple recommandation", () => {
    const r = [
      récolte("reco", "Pivot", [cand(1, "Foule")]),
      récolte("image", "Deakins", [cand(2, "Même œil")]),
    ];
    expect(fusionnerLoin(r).map((v) => v.title)).toEqual(["Même œil", "Foule"]);
  });
});

describe("le classement est stable", () => {
  it("ne dépend pas de l'ordre d'arrivée des requêtes", () => {
    const a = récolte("reco", "P", [cand(1, "Alpha"), cand(2, "Bravo")]);
    const b = récolte("musique", "M", [cand(3, "Charlie")]);
    const gauche = fusionnerLoin([a, b]).map((v) => v.title);
    const droite = fusionnerLoin([b, a]).map((v) => v.title);
    expect(gauche).toEqual(droite);
  });

  it("s'arrête au nombre demandé", () => {
    const beaucoup = Array.from({ length: 30 }, (_, i) => cand(i + 1, `F${i}`));
    expect(fusionnerLoin([récolte("reco", "P", beaucoup)], { combien: 4 })).toHaveLength(4);
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
    const out = fusionnerLoin([récolte("reco", "P", [cand(1, "Déjà là"), cand(2, "Neuf")])], {
      déjàLà,
    });
    expect(out.map((v) => v.title)).toEqual(["Neuf"]);
  });
});
