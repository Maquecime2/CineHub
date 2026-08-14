import { describe, it, expect } from "vitest";
import {
  daysBetween,
  daysLeft,
  mayExtend,
  needsSettling,
  share,
  stateOf,
  today,
} from "./challenges";

/* ============================================================
   L'ÉTAT D'UN DÉFI

   Le piège de ce fichier est le fuseau horaire, et il est réel : un
   `new Date("2026-03-01")` se pose à minuit UTC, donc quiconque vit à
   l'ouest de Greenwich le lit comme le 28 février. Un défi qui commence
   demain pour la moitié de la planète et aujourd'hui pour l'autre n'est
   pas mesurable. D'où la comparaison de chaînes, et d'où ces tests.
   ============================================================ */

const defi = (starts_on: string, ends_on: string) => ({ starts_on, ends_on });

describe("où en est un défi", () => {
  it("distingue les quatre moments", () => {
    const mars = defi("2026-03-01", "2026-03-31");
    expect(stateOf(mars, "2026-02-20")).toBe("upcoming");
    expect(stateOf(mars, "2026-03-10")).toBe("running");
    expect(stateOf(mars, "2026-03-30")).toBe("last-days");
    expect(stateOf(mars, "2026-04-01")).toBe("finished");
  });

  it("compte le premier et le dernier jour comme dedans", () => {
    const mars = defi("2026-03-01", "2026-03-31");
    expect(stateOf(mars, "2026-03-01")).not.toBe("upcoming");
    expect(stateOf(mars, "2026-03-31")).not.toBe("finished");
  });

  it("tient sur un défi d'un seul jour", () => {
    const court = defi("2026-03-04", "2026-03-04");
    expect(stateOf(court, "2026-03-03")).toBe("upcoming");
    expect(stateOf(court, "2026-03-04")).toBe("last-days");
    expect(stateOf(court, "2026-03-05")).toBe("finished");
  });

  it("ne se laisse pas décaler d'un jour par un fuseau", () => {
    /* Le calcul ne construit aucune date locale à partir des chaînes :
       c'est ce qui fait que ce test dit la même chose à Paris, à Tokyo
       et à Los Angeles. */
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
    expect(daysBetween("2026-03-31", "2026-03-01")).toBe(-30);
    /* Et par-dessus un changement d'heure, qui rogne une journée de
       vingt-trois heures : l'écart reste un nombre entier de jours. */
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("dit ce qu'il reste, y compris en négatif", () => {
    expect(daysLeft({ ends_on: "2026-03-31" }, "2026-03-29")).toBe(2);
    expect(daysLeft({ ends_on: "2026-03-31" }, "2026-04-03")).toBe(-3);
  });

  it("appelle à solder une fois la période passée, et pas avant", () => {
    expect(needsSettling({ ends_on: "2026-03-31" }, "2026-03-31")).toBe(false);
    expect(needsSettling({ ends_on: "2026-03-31" }, "2026-04-01")).toBe(true);
  });

  it("écrit le jour d'aujourd'hui dans la forme qu'on compare", () => {
    expect(today(new Date(2026, 2, 4))).toBe("2026-03-04");
    /* Un chiffre seul se remplit d'un zéro, sans quoi « 2026-3-4 » se
       comparerait n'importe comment. */
    expect(today(new Date(2026, 10, 25))).toBe("2026-11-25");
  });
});

describe("la part faite", () => {
  it("ne dépasse pas cent pour cent", () => {
    expect(share(3, 4)).toBe(0.75);
    expect(share(9, 4)).toBe(1);
  });

  it("vaut zéro sur une liste vide plutôt que l'infini", () => {
    expect(share(0, 0)).toBe(0);
  });
});

describe("prolonger", () => {
  /* LES MÊMES CINQ BORNES QUE `store.extendChallenge`, dans le même
     ordre. Le jour où l'une des deux bouge sans l'autre, c'est ici que
     ça se voit — le serveur, lui, refuserait en silence un bouton qu'on
     aurait continué d'afficher. */
  const mien = {
    starts_on: "2026-03-01",
    ends_on: "2026-03-31",
    extensions: 0,
    by: "moi",
    settled: false,
  };

  it("appartient à qui l'a lancé", () => {
    expect(mayExtend(mien, "moi", "2026-04-01")).toBe(true);
    expect(mayExtend(mien, "quelquun", "2026-04-01")).toBe(false);
    expect(mayExtend(mien, null, "2026-04-01")).toBe(false);
  });

  it("s'arrête à deux fois", () => {
    expect(mayExtend({ ...mien, extensions: 1 }, "moi", "2026-04-01")).toBe(true);
    expect(mayExtend({ ...mien, extensions: 2 }, "moi", "2026-04-01")).toBe(false);
  });

  it("repousse, mais ne ressuscite pas", () => {
    expect(mayExtend(mien, "moi", "2026-04-07")).toBe(true);
    expect(mayExtend(mien, "moi", "2026-04-08")).toBe(false);
  });

  it("refuse une fois les comptes clos", () => {
    /* La limite qu'on oublie : le journal refuserait de repayer, mais le
       tableau décrirait une période sur laquelle personne n'a été
       mesuré. */
    expect(mayExtend({ ...mien, settled: true }, "moi", "2026-04-01")).toBe(false);
  });

  it("marche aussi pendant que le défi court", () => {
    expect(mayExtend(mien, "moi", "2026-03-15")).toBe(true);
  });
});
