import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hallSeenAt, markHallSeen, unseenNews } from "./hallNews";

/* Ce qui se teste ici, c'est QUAND la pastille reste éteinte. Un repère
   qui s'allume trop souvent est un repère qu'on apprend à ignorer, et il
   ne se rallume plus jamais utilement après ça. */

const item = (at: number, pseudo = "varda") => ({ at, pseudo });

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("le repère du hall", () => {
  /* PREMIÈRE VISITE : sans marqueur, tout le fil serait « neuf », et le
     chiffre ne voudrait rien dire pour quelqu'un qui vient d'arriver. */
  it("ne réclame rien tant qu'on n'a jamais regardé", () => {
    expect(hallSeenAt()).toBe(0);
    expect(unseenNews([item(1000), item(2000)])).toBe(0);
  });

  it("compte ce qui est arrivé depuis la dernière visite", () => {
    markHallSeen(1000);
    expect(unseenNews([item(500), item(1500), item(2000)])).toBe(2);
  });

  it("ne compte plus rien une fois qu'on a regardé", () => {
    markHallSeen(1000);
    expect(unseenNews([item(1500)])).toBe(1);
    markHallSeen(2000);
    expect(unseenNews([item(1500)])).toBe(0);
  });

  /* Sans ce filtre, la pastille s'allumerait à chaque film qu'on range —
     c'est-à-dire tout le temps, donc jamais utilement. */
  it("ne compte pas ses propres fiches", () => {
    markHallSeen(1000);
    const news = [item(1500, "moi"), item(1600, "varda"), item(1700, "moi")];
    expect(unseenNews(news, "moi")).toBe(1);
    /* Et sans pseudonyme connu, on ne filtre rien : mieux vaut compter
       une fiche de trop que taire les nouvelles des autres. */
    expect(unseenNews(news)).toBe(3);
  });

  it("repart de zéro sur un marqueur illisible", () => {
    localStorage.setItem("hall-seen", '"hier"');
    expect(hallSeenAt()).toBe(0);
    localStorage.setItem("hall-seen", "-5");
    expect(hallSeenAt()).toBe(0);
  });
});
