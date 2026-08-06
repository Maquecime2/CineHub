import { describe, it, expect, beforeEach } from "vitest";
import { SKINS, DEFAULT_SKIN, skinOf } from "./skins";
import { applySkin, loadSkinKey, saveSkinKey, SKIN_KEY } from "./applySkin";
import { C, F } from "./tokens";

const TOKENS = Object.keys(C);

describe("le catalogue de peaux", () => {
  it("en offre une bonne dizaine, toutes distinctes", () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SKINS.map((s) => s.key)).size).toBe(SKINS.length);
    expect(new Set(SKINS.map((s) => s.label)).size).toBe(SKINS.length);
  });

  /* CE TEST A DÉJÀ SERVI. Trois couleurs de ce fichier étaient de la
     bouillie — un `#9E9versa` et deux de la même eau. Écrites dans une
     variable CSS, elles n'auraient rien jeté : le navigateur ignore une
     déclaration qu'il ne comprend pas, et la peau se serait contentée
     d'avoir un jeton qui ne change pas. */
  it("n'a que des hexadécimaux bien formés", () => {
    for (const skin of SKINS)
      for (const [token, color] of Object.entries(skin.c))
        expect(`${skin.key}.${token} = ${color}`).toMatch(/= #[0-9A-Fa-f]{6}$/);
  });

  /* Un jeton oublié n'est pas rattrapé par la peau par défaut : les
     variables sont écrites sur la racine et y RESTENT d'une peau à
     l'autre. Il garderait donc la valeur de la peau précédente. */
  it("donne les quatorze jetons, sans en inventer un de plus", () => {
    for (const skin of SKINS) expect(Object.keys(skin.c).sort()).toEqual([...TOKENS].sort());
  });

  it("donne les quatre rôles de police, et de quoi les charger", () => {
    for (const skin of SKINS) {
      expect(Object.keys(skin.fonts).sort()).toEqual(["body", "hand", "mono", "title"]);
      expect(skin.google.length).toBeGreaterThan(0);
      /* Chaque famille nommée dans un rôle doit être demandée à Google,
         sinon la peau retombe sur la police de secours sans un mot. */
      const asked = skin.google.join("&").replace(/\+/g, " ").toLowerCase();
      for (const stack of Object.values(skin.fonts)) {
        const first = stack.split(",")[0]!.replace(/'/g, "").trim().toLowerCase();
        expect(`${skin.key} : ${first}`).toBe(
          `${skin.key} : ${asked.includes(first) ? first : "ABSENTE"}`
        );
      }
    }
  });

  it("a un fond de page et une forme d'onglet", () => {
    for (const skin of SKINS) {
      expect(skin.page.trim().length).toBeGreaterThan(0);
      expect(skin.tag.radius).toMatch(/px$/);
      for (const v of Object.values(skin.atm)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  /* ---------- ce que le navigateur dessine lui-même ---------- */

  /* Le contraste WCAG, en clair : deux luminances relatives, la plus
     claire au numérateur. 1 pour deux couleurs identiques, 21 pour le
     noir sur le blanc. */
  const canal = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const [r, v, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => canal(c / 255));
    return 0.2126 * r! + 0.7152 * v! + 0.0722 * b!;
  };
  const contraste = (a: string, b: string): number => {
    const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (clair! + 0.05) / (sombre! + 0.05);
  };

  /* Une liste déroulante ouverte est peinte par le navigateur, hors du
     document : aucune règle ne viendra rattraper après coup deux
     couleurs trop proches. On les vérifie donc ici, à la source, sur les
     deux jetons que la règle `select option` emploie. */
  it("garde les listes déroulantes lisibles, sur les quatorze peaux", () => {
    for (const skin of SKINS)
      expect(
        contraste(skin.c.ink!, skin.c.card!),
        `${skin.key} : encre sur carton, c'est le fond d'une liste ouverte`
      ).toBeGreaterThanOrEqual(4.5);
  });

  /* LE DRAPEAU DOIT DIRE VRAI, et c'est tout ce qui tient `color-scheme`.
     Une peau sombre qui s'annonce claire garde les cases à cocher et les
     listes en clair sur son fond noir — le défaut est invisible au test
     de rendu, puisque ces morceaux-là ne sont pas dans le document. */
  it("ne se trompe pas sur la couleur de son propre fond", () => {
    for (const skin of SKINS) {
      const sombre = contraste(skin.c.card!, "#FFFFFF") > contraste(skin.c.card!, "#000000");
      expect(!!skin.dark, `${skin.key} : carton ${skin.c.card}`).toBe(sombre);
    }
  });

  it("retombe sur le carnet pour une clé inconnue", () => {
    expect(skinOf("n'existe pas").key).toBe(DEFAULT_SKIN);
    expect(skinOf(undefined).key).toBe(DEFAULT_SKIN);
    expect(SKINS[0]!.key).toBe(DEFAULT_SKIN);
  });
});

describe("poser une peau", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.getElementById("skin-fonts")?.remove();
    localStorage.clear();
  });

  it("écrit chaque jeton là où le renvoi ira le chercher", () => {
    const skin = applySkin("kodachrome");
    const root = document.documentElement.style;
    for (const [token, color] of Object.entries(skin.c)) {
      // le renvoi tel que `tokens` l'écrit, et la variable telle qu'on la pose
      const name = C[token as keyof typeof C].slice(4, -1);
      expect(root.getPropertyValue(name)).toBe(color);
    }
    for (const role of Object.keys(F))
      expect(root.getPropertyValue(F[role as keyof typeof F].slice(4, -1))).toBeTruthy();
  });

  it("pose le fond, la forme et l'atmosphère", () => {
    applySkin("bauhaus");
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--page-bg")).toContain("#F2F0EB");
    expect(root.getPropertyValue("--tag-radius")).toBe("0px");
    // le Bauhaus n'a ni grain ni tache : trois couleurs et rien dessus
    expect(root.getPropertyValue("--atm-grain")).toBe("0");
    expect(root.getPropertyValue("--atm-stain")).toBe("0");
    expect(document.documentElement.dataset.skin).toBe("bauhaus");
  });

  /* Un seul élément de lien, réutilisé : en créer un par essai
     laisserait derrière soi autant de feuilles de styles que de peaux
     essayées, et la dernière DÉCLARÉE gagnerait — pas la dernière
     choisie. */
  it("ne laisse qu'un seul lien de polices, quoi qu'on essaie", () => {
    applySkin("japon");
    const premier = document.getElementById("skin-fonts") as HTMLLinkElement;
    applySkin("pastel");
    expect(document.querySelectorAll("link[id='skin-fonts']")).toHaveLength(1);
    expect(document.getElementById("skin-fonts")).toBe(premier);
    expect(premier.href).toContain("Quicksand");
  });

  it("garde le choix d'une fois sur l'autre", () => {
    expect(loadSkinKey()).toBe(DEFAULT_SKIN);
    saveSkinKey("herbier");
    expect(localStorage.getItem(SKIN_KEY)).toBe("herbier");
    expect(loadSkinKey()).toBe("herbier");
  });
});
