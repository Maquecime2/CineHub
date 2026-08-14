import { describe, it, expect, beforeEach } from "vitest";
import fr from "../i18n/fr";
import en from "../i18n/en";
import { SKINS, DEFAULT_SKIN, skinOf } from "./skins";
import { applySkin, loadSkinKey, saveSkinKey, SKIN_KEY } from "./applySkin";
import { C, F } from "./tokens";

const TOKENS = Object.keys(C);

describe("the catalogue of skins", () => {
  it("offers a good dozen of them, all distinct", () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SKINS.map((s) => s.key)).size).toBe(SKINS.length);
    /* The names live in the catalogue now: every skin must have one
       there, in both languages, or the picker would offer a blank. */
    for (const s of SKINS) {
      expect(fr.skins, s.key).toHaveProperty(s.key);
      expect(en.skins, s.key).toHaveProperty(s.key);
    }
  });

  /* THIS TEST HAS ALREADY EARNED ITS KEEP. Three colours in that file
     were mush — a `#9E9versa` and two of the same water. Written into a
     CSS variable, they would have thrown nothing: the browser ignores a
     declaration it does not understand, and the skin would simply have
     had one token that never changes. */
  it("has nothing but well-formed hex codes", () => {
    for (const skin of SKINS)
      for (const [token, color] of Object.entries(skin.c))
        expect(`${skin.key}.${token} = ${color}`).toMatch(/= #[0-9A-Fa-f]{6}$/);
  });

  /* A forgotten token is not caught by the default skin: the variables
     are written on the root and STAY there from one skin to the next. It
     would therefore keep the previous skin's value. */
  it("gives the fourteen tokens, without inventing one more", () => {
    for (const skin of SKINS) expect(Object.keys(skin.c).sort()).toEqual([...TOKENS].sort());
  });

  it("gives the four font roles, and the means to load them", () => {
    for (const skin of SKINS) {
      expect(Object.keys(skin.fonts).sort()).toEqual(["body", "hand", "mono", "title"]);
      expect(skin.google.length).toBeGreaterThan(0);
      /* Every family named in a role must be asked of Google, otherwise
         the skin falls back on the fallback typeface without a word. */
      const asked = skin.google.join("&").replace(/\+/g, " ").toLowerCase();
      for (const stack of Object.values(skin.fonts)) {
        const first = stack.split(",")[0]!.replace(/'/g, "").trim().toLowerCase();
        expect(`${skin.key} : ${first}`).toBe(
          `${skin.key} : ${asked.includes(first) ? first : "ABSENTE"}`
        );
      }
    }
  });

  it("has a page ground and a tab shape", () => {
    for (const skin of SKINS) {
      expect(skin.page.trim().length).toBeGreaterThan(0);
      expect(skin.tag.radius).toMatch(/px$/);
      for (const v of Object.values(skin.atm)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  /* ---------- what the browser draws itself ---------- */

  /* WCAG contrast, in plain terms: two relative luminances, the lighter
     one on top. 1 for two identical colours, 21 for black on white. */
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => channel(c / 255));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string): number => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light! + 0.05) / (dark! + 0.05);
  };

  /* An open drop-down list is painted by the browser, outside the
     document: no rule will come and fix two colours too close together
     after the fact. So we check them here, at the source, on the two
     tokens the `select option` rule uses. */
  it("keeps the drop-downs readable, across the fourteen skins", () => {
    for (const skin of SKINS)
      expect(
        contrast(skin.c.ink!, skin.c.card!),
        `${skin.key} : encre sur carton, c'est le fond d'une liste ouverte`
      ).toBeGreaterThanOrEqual(4.5);
  });

  /* THE FLAG MUST TELL THE TRUTH, and that is all `color-scheme` rests
     on. A dark skin announcing itself light keeps the checkboxes and the
     lists light on its black background — the flaw is invisible to a
     render test, since those pieces are not in the document. */
  it("does not get its own ground colour wrong", () => {
    for (const skin of SKINS) {
      const isDark = contrast(skin.c.card!, "#FFFFFF") > contrast(skin.c.card!, "#000000");
      expect(!!skin.dark, `${skin.key} : carton ${skin.c.card}`).toBe(isDark);
    }
  });

  it("falls back on the notebook for an unknown key", () => {
    expect(skinOf("n'existe step").key).toBe(DEFAULT_SKIN);
    expect(skinOf(undefined).key).toBe(DEFAULT_SKIN);
    expect(SKINS[0]!.key).toBe(DEFAULT_SKIN);
  });
});

describe("laying a skin down", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.getElementById("skin-fonts")?.remove();
    localStorage.clear();
  });

  it("writes each token where the reference will come looking for it", () => {
    const skin = applySkin("kodachrome");
    const root = document.documentElement.style;
    for (const [token, color] of Object.entries(skin.c)) {
      // the reference as `tokens` writes it, and the variable as we lay it
      const name = C[token as keyof typeof C].slice(4, -1);
      expect(root.getPropertyValue(name)).toBe(color);
    }
    for (const role of Object.keys(F))
      expect(root.getPropertyValue(F[role as keyof typeof F].slice(4, -1))).toBeTruthy();
  });

  it("lays the ground, the shape and the atmosphere", () => {
    applySkin("bauhaus");
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--page-bg")).toContain("#F2F0EB");
    expect(root.getPropertyValue("--tag-radius")).toBe("0px");
    // the Bauhaus has neither grain nor stain: three colours and nothing on top
    expect(root.getPropertyValue("--atm-grain")).toBe("0");
    expect(root.getPropertyValue("--atm-stain")).toBe("0");
    expect(document.documentElement.dataset.skin).toBe("bauhaus");
  });

  /* A single link element, reused: creating one per attempt would leave
     behind as many stylesheets as skins tried, and the last one DECLARED
     would win — not the last one chosen. */
  it("leaves a single font link, whatever one tries", () => {
    applySkin("japon");
    const premier = document.getElementById("skin-fonts") as HTMLLinkElement;
    applySkin("pastel");
    expect(document.querySelectorAll("link[id='skin-fonts']")).toHaveLength(1);
    expect(document.getElementById("skin-fonts")).toBe(premier);
    expect(premier.href).toContain("Quicksand");
  });

  it("keeps the choice from one time to the next", () => {
    expect(loadSkinKey()).toBe(DEFAULT_SKIN);
    saveSkinKey("herbier");
    expect(localStorage.getItem(SKIN_KEY)).toBe("herbier");
    expect(loadSkinKey()).toBe("herbier");
  });
});

/* ============================================================
   CE QUI S'ACHÈTE, ET CE QUI RESTE DÛ À TOUT LE MONDE

   Le classeur marche entier sans serveur, sans compte et sans réseau.
   Ces trois tests disent la seule façon d'ajouter des peaux payantes
   sans y toucher — et le premier est celui qui compte, parce qu'il
   attraperait une régression qu'aucun écran ne montrerait : une peau
   libre passée par mégarde derrière un prix ne se voit que chez ceux
   qui ne l'ont pas.
   ============================================================ */
describe("les peaux du comptoir", () => {
  /* LA RÈGLE A CHANGÉ, ET LE GARDE-FOU AVEC. Il disait « les quatorze
     premières restent libres à jamais » ; elles sont devenues payantes,
     et le « à jamais » n'était pas de mon ressort. Ce qui reste vrai,
     et qui est maintenant ce qu'on garde :

     UNE PEAU EST DONNÉE, et c'est celle avec laquelle le classeur a
     toujours été dessiné. Un catalogue où même le carnet s'achèterait
     serait un classeur qui ne sait pas de quoi il a l'air au premier
     lancement.

     Et sans serveur, `SkinPicker` les rend toutes libres : verrouiller
     sur une économie qui n'existe pas serait une porte sur un mur. C'est
     testé là-bas, avec le composant. */
  it("donne le carnet, et lui seul", () => {
    const free = SKINS.filter((s) => !s.locked).map((s) => s.key);
    expect(free).toEqual([DEFAULT_SKIN]);
  });

  it("met un prix sur chaque peau verrouillée, et rien qu'un entier positif", () => {
    for (const skin of SKINS.filter((s) => s.locked)) {
      expect(`${skin.key} = ${skin.price}`).toMatch(/= [1-9][0-9]*$/);
      expect(Number.isInteger(skin.price)).toBe(true);
    }
    /* Et l'inverse : un prix sans verrou serait un prix que personne ne
       paie, sur une peau que tout le monde a. */
    for (const skin of SKINS.filter((s) => !s.locked)) expect(skin.price).toBeUndefined();
  });

  it("nomme un article de boutique pour chaque peau verrouillée", () => {
    /* L'identifiant est écrit dans `owned` côté serveur : une clé qui ne
       correspond à rien serait une peau que personne ne peut ouvrir. */
    for (const skin of SKINS.filter((s) => s.locked)) {
      expect(skin.locked).toBe(`skin-${skin.key}`);
    }
  });

  it("dit le même prix que le serveur", async () => {
    /* LE SEUL GARDE-FOU DU DOUBLON. Le catalogue du serveur est
       l'original — c'est lui qui débite. Celui-ci n'existe que pour
       afficher « il vous faut 180 jetons » dans le sélecteur, sans
       aller-retour. Une divergence ne casserait rien : elle afficherait
       un prix, en prélèverait un autre, et personne ne s'en apercevrait
       avant de compter. */
    const { SHOP } = await import("../../server/src/shop");
    for (const skin of SKINS.filter((s) => s.locked)) {
      const sold = SHOP.find((i) => i.id === skin.locked);
      expect(sold, `« ${skin.key} » est verrouillée mais ne se vend nulle part`).toBeDefined();
      expect(sold!.price, `le prix de « ${skin.key} »`).toBe(skin.price);
      expect(sold!.grants).toBe(skin.key);
    }
  });

  it("s'applique quand on la demande, verrouillée ou non", () => {
    /* LE VERROU EST AU CHOIX, PAS À L'APPLICATION. Si `applySkin`
       consultait ce champ, un rechargement hors ligne retomberait sur
       « carnet » et le classeur se déguiserait tout seul. */
    const locked = SKINS.find((s) => s.locked);
    expect(locked).toBeDefined();
    applySkin(locked!.key);
    expect(document.documentElement.dataset.skin).toBe(locked!.key);
    expect(skinOf(locked!.key).key).toBe(locked!.key);
  });
});
