import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackProvider } from "../../components/ui/Feedback";
import { makeFilm } from "../../domain/film";
import { makeBond } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import type { Hint } from "../../domain/hints";

/* ============================================================
   UNE PISTE REMPLIT LE FORMULAIRE, ELLE NE L'OUTREPASSE PAS
   ============================================================

   Le domaine est éprouvé à côté (`domain/hints`) et le service aussi
   (`services/lineageHints`). Ce qui ne se voit que d'ici est le CÂBLAGE,
   et trois choses y seraient des pannes muettes :

   — le sens. Une piste posée à l'envers dessine une carte où les élèves
     ont formé leurs maîtres, et aucun écran ne le dirait ;
   — le fait que RIEN ne s'écrive sans un geste. C'est la décision de tout
     le chantier, et une suggestion qui s'enregistrerait seule serait
     indistinguable de ce que quelqu'un sait ;
   — la moisson en masse qui repasse par la porte, et qui DIT ce qu'elle a
     refusé. Un bouton annonçant huit liens et en posant six sans un mot
     est le clic avalé que ce projet a déjà payé une fois.
   ============================================================ */

const hintsFor = vi.fn();
vi.mock("../../services/lineageHints", () => ({
  hintsFor: (...args: unknown[]) => hintsFor(...args),
  forgetHints: () => {},
}));
/* LA TROISIÈME SOURCE SE BOUCHE AUSSI, et ce n'est pas une précaution :
   sans ce double, `crossHintsFor` appelait le VRAI `searchPerson`, donc
   une requête réseau depuis la suite de tests — huit secondes et un 401
   dans la sortie, pour une moitié dont ce fichier ne parle même pas.
   Un test qui touche le dehors n'est plus un test. */
const crossHintsFor = vi.fn(async (..._args: unknown[]) => [] as unknown[]);
vi.mock("../../services/tmdbHints", () => ({
  crossHintsFor: (...args: unknown[]) => crossHintsFor(...args),
}));
/* Une clé est présente : sans elle la moitié « pistes » ne se dessine
   pas du tout, et c'est le bon comportement — testé plus bas. */
const key = vi.fn(() => "UNE-CLE");
vi.mock("../../services/tmdbKey", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTmdbKey: () => key(),
}));

const { ProgramView } = await import("../ProgramView");

const OZU = makeFilm({ id: "a", title: "Voyage à Tokyo", director: "Yasujirō Ozu" });
const HOU = makeFilm({ id: "b", title: "Les Fleurs de Shanghai", director: "Hou Hsiao-hsien" });

const hint = (from: string, to: string, kind: "master" | "influence" = "master"): Hint => ({
  kind,
  fromName: from,
  toName: to,
  note: "Wikidata P1066",
  source: "wikidata",
});

const build = (bonds: Bond[] = []) => {
  const onBonds = vi.fn();
  render(
    <FeedbackProvider>
      <ProgramView
        films={[OZU, HOU]}
        courses={[]}
        bonds={bonds}
        onCourses={vi.fn()}
        onCoursesSoon={vi.fn()}
        onBonds={onBonds}
        onAddFilm={vi.fn()}
        onUpdateFilm={vi.fn()}
        onOpen={vi.fn()}
        onOpenPerson={vi.fn()}
      />
    </FeedbackProvider>
  );
  return { onBonds };
};

beforeEach(() => {
  hintsFor.mockReset();
  key.mockReset();
  key.mockReturnValue("UNE-CLE");
  /* Un défaut, sinon un écran qui ne parle pas de pistes ferait quand
     même appeler le service et lirait `undefined`. */
  hintsFor.mockResolvedValue([]);
});

/* LA CARTE EST DERRIÈRE UNE PORTE, et tout ce qui la concerne aussi :
   poser un lien, moissonner, reprendre ce qui a été proposé. Les deux
   feuilles s'empilent alors, d'où le cadrage par NOM — un
   `getByRole("dialog")` nu désignerait deux choses. */
const openMap = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /La carte des cinéastes/ }));
  return within(screen.getByRole("dialog", { name: "La carte des cinéastes" }));
};

describe("la moisson", () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    const map = await openMap(user);
    await user.click(map.getByRole("button", { name: "Chercher des filiations" }));
    return within(screen.getByRole("dialog", { name: "Chercher des filiations" }));
  };

  type Sheet = ReturnType<typeof within>;
  /* Le geste par DÉFAUT : on nomme quelqu'un. Le balayage est à côté. */
  const searchOne = async (user: ReturnType<typeof userEvent.setup>, sheet: Sheet, who: string) => {
    await user.type(sheet.getByRole("combobox"), who);
    await user.click(sheet.getByRole("button", { name: "Chercher pour lui" }));
  };
  const sweep = async (user: ReturnType<typeof userEvent.setup>, sheet: Sheet) =>
    user.click(sheet.getByRole("button", { name: /Balayer/ }));

  it("ne demande rien à l'ouverture, et rien sans un nom", async () => {
    /* Chercher est une requête par nom : le faire parce que quelqu'un a
       ouvert une feuille pour voir ce qu'elle contient serait la
       dépenser sans qu'on l'ait demandé. */
    hintsFor.mockResolvedValue([]);
    const user = userEvent.setup();
    build();
    const sheet = await open(user);
    expect(hintsFor).not.toHaveBeenCalled();
    /* Le bouton du cas par défaut est mort tant que le champ est vide. */
    expect(sheet.getByRole("button", { name: "Chercher pour lui" })).toBeDisabled();
  });

  it("cherche pour UN cinéaste, et c'est le geste par défaut", async () => {
    /* Le premier jet n'offrait que le balayage : un clic, et la carte se
       couvrait de dizaines de liens qu'on n'avait pas demandés. */
    hintsFor.mockResolvedValue([]);
    const user = userEvent.setup();
    build();
    const sheet = await open(user);
    await searchOne(user, sheet, "Yasujirō Ozu");
    expect(hintsFor).toHaveBeenCalledWith(["Yasujirō Ozu"], "UNE-CLE", expect.anything());
  });

  it("dit combien de cinéastes un balayage va coûter", async () => {
    /* Le compte est sur le bouton : c'est la seule chose qui dise ce
       qu'on s'apprête à dépenser. */
    hintsFor.mockResolvedValue([]);
    const user = userEvent.setup();
    build();
    const sheet = await open(user);
    expect(sheet.getByRole("button", { name: /Balayer .*2 cinéastes/ })).toBeInTheDocument();
    await sweep(user, sheet);
    expect(hintsFor.mock.calls[0]![0]).toHaveLength(2);
  });

  it("pose les liens cochés, et rien avant", async () => {
    hintsFor.mockResolvedValue([hint("Shigehiko Hasumi", "Kiyoshi Kurosawa")]);
    const user = userEvent.setup();
    const { onBonds } = build();
    const sheet = await open(user);
    await searchOne(user, sheet, "Kiyoshi Kurosawa");
    expect(await sheet.findByText(/Une filiation trouvée/)).toBeInTheDocument();
    /* Trouvée n'est pas posée. */
    expect(onBonds).not.toHaveBeenCalled();

    await user.click(sheet.getByRole("button", { name: "Poser ce lien" }));
    expect(onBonds).toHaveBeenCalledOnce();
    const laid = onBonds.mock.calls[0]![0] as Bond[];
    expect(laid).toHaveLength(1);
    /* LE SENS : P1066 dit « Kurosawa est l'élève de Hasumi », donc c'est
       Hasumi qui a formé. */
    expect(laid[0]).toMatchObject({
      kind: "master",
      fromName: "Shigehiko Hasumi",
      toName: "Kiyoshi Kurosawa",
    });
  });

  it("ne pose pas ce qu'on a décoché", async () => {
    hintsFor.mockResolvedValue([hint("Hasumi", "Kurosawa"), hint("Renoir", "Ray")]);
    const user = userEvent.setup();
    const { onBonds } = build();
    const sheet = await open(user);
    await sweep(user, sheet);
    const boxes = await sheet.findAllByRole("checkbox");
    await user.click(boxes[0]!);
    await user.click(sheet.getByRole("button", { name: "Poser ce lien" }));
    const laid = onBonds.mock.calls[0]![0] as Bond[];
    expect(laid).toHaveLength(1);
    expect(laid[0]!.fromName).toBe("Renoir");
  });

  it("ne propose pas ce qui est déjà sur la carte", async () => {
    /* Le filtre est celui du formulaire, joué en avance : offrir un clic
       auquel le formulaire répondrait par un refus est le défaut exact
       que les motifs ont mis un chantier à perdre. */
    const already = makeBond({ kind: "master", fromName: "Hasumi", toName: "Kurosawa" })!;
    hintsFor.mockResolvedValue([hint("Hasumi", "Kurosawa")]);
    const user = userEvent.setup();
    build([already]);
    const sheet = await open(user);
    await searchOne(user, sheet, "Kurosawa");
    expect(await sheet.findByText(/déjà sur la carte/)).toBeInTheDocument();
  });

  it("dit « on n'a pas pu demander », et non « il n'y a rien »", async () => {
    hintsFor.mockRejectedValue(new Error("502"));
    const user = userEvent.setup();
    build();
    const sheet = await open(user);
    await searchOne(user, sheet, "Kurosawa");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("On n'a pas pu aller demander.");
    /* Et il y a un rattrapage : un échec sans porte de sortie est une
       impasse. */
    expect(sheet.getByRole("button", { name: "Redemander" })).toBeInTheDocument();
  });

  it("annonce ce qu'elle a refusé, et ne l'annonce que là", async () => {
    /* Deux pistes cochées qui se contredisent ne peuvent pas entrer
       ensemble : comparées au seul état de départ, elles passaient toutes
       les deux et la relecture suivante en jetait une. */
    hintsFor.mockResolvedValue([hint("Ozu", "Hou"), hint("Hou", "Ozu")]);
    const user = userEvent.setup();
    const { onBonds } = build();
    const sheet = await open(user);
    await sweep(user, sheet);
    await user.click(await sheet.findByRole("button", { name: /Poser ces 2 liens/ }));
    const laid = onBonds.mock.calls[0]![0] as Bond[];
    expect(laid).toHaveLength(1);
    expect(await screen.findByText(/1 refusés par la carte/)).toBeInTheDocument();
  });

  it("sans clé ni compte, elle le dit au lieu de chercher", async () => {
    key.mockReturnValue("");
    const user = userEvent.setup();
    build();
    const sheet = await open(user);
    expect(sheet.queryByRole("button", { name: "Chercher pour lui" })).toBeNull();
    expect(hintsFor).not.toHaveBeenCalled();
  });
});

/* ============================================================
   L'AUTRE PORTE : LE PANNEAU D'UN NŒUD
   ============================================================

   Cliquer un cinéaste sur la carte, c'est déjà demander « qu'est-ce
   qu'on sait de lui » : c'est donc là que « on sait que quelqu'un l'a
   formé » a sa place. Le nœud n'existe que s'il porte un lien ou un film
   du parcours, d'où le lien de départ ci-dessous.
   ============================================================ */
describe("les pistes dans le panneau d'un cinéaste", () => {
  const seed = () => makeBond({ kind: "master", fromName: "Yasujirō Ozu", toName: "Autre" })!;

  /* LA CARTE EST REPLIÉE PAR DÉFAUT — elle explique l'ordre, elle ne le
     remplace pas — donc il faut l'ouvrir avant qu'un nœud existe. */
  const pickOzu = async (user: ReturnType<typeof userEvent.setup>) => {
    await openMap(user);
    await user.click(screen.getByRole("button", { name: /^Yasujirō Ozu, / }));
  };

  it("remplit le formulaire au clic, dans le bon sens, et n'écrit rien", async () => {
    hintsFor.mockResolvedValue([hint("Kenji Mizoguchi", "Yasujirō Ozu")]);
    const user = userEvent.setup();
    const { onBonds } = build([seed()]);
    await pickOzu(user);

    /* Lu DEPUIS Ozu, le même lien se dit « a pour maître » et non « a
       pour élève » : c'est `bondLabel` qui le retourne, et rien dans la
       vue. */
    /* Le libellé porte aussi SUR QUOI la piste se fonde — c'est ce qui
       décide si on la croit. */
    const lead = await screen.findByRole("button", { name: /Kenji Mizoguchi/ });
    /* La ligne porte aussi SUR QUOI la piste se fonde — c'est ce qui
       décide si on la croit. */
    expect(lead).toHaveTextContent("a pour maître Kenji Mizoguchi");
    expect(lead).toHaveTextContent("d'après Wikidata");
    await user.click(lead);
    expect(onBonds).not.toHaveBeenCalled();

    const form = screen.getByRole("dialog", { name: "Relier deux cinéastes" });
    const fields = within(form).getAllByRole("combobox");
    expect(fields[0]).toHaveValue("Kenji Mizoguchi");
    expect(fields[1]).toHaveValue("Yasujirō Ozu");
    /* La nature arrive posée, et le bouton correspondant est enfoncé. */
    expect(within(form).getByRole("button", { name: /a pour élève/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("dit qu'il n'y a rien, plutôt que de ne rien dire", async () => {
    hintsFor.mockResolvedValue([]);
    const user = userEvent.setup();
    build([seed()]);
    await pickOzu(user);
    expect(await screen.findByText(/Rien de connu sur ce cinéaste/)).toBeInTheDocument();
  });

  it("ne propose pas les pistes qui ne le concernent pas", async () => {
    /* Wikidata rend aussi les liens des voisins d'une personne : les
       laisser passer mettrait sous Ozu une filiation entre deux tiers. */
    hintsFor.mockResolvedValue([hint("Jean Renoir", "Satyajit Ray")]);
    const user = userEvent.setup();
    build([seed()]);
    await pickOzu(user);
    expect(await screen.findByText(/Rien de connu sur ce cinéaste/)).toBeInTheDocument();
  });

  it("garde la section sans clé, et n'appelle personne", async () => {
    /* LA MOITIÉ « CLASSEUR » NE DEMANDE RIEN À PERSONNE et répond hors
       ligne : c'est elle qui répond le plus souvent, Wikidata ne
       couvrant qu'un centième des réalisateurs. */
    key.mockReturnValue("");
    const user = userEvent.setup();
    build([seed()]);
    await pickOzu(user);
    expect(screen.getByText(/Ce qu'on en sait ailleurs/)).toBeInTheDocument();
    expect(hintsFor).not.toHaveBeenCalled();
  });

  it("propose ce que les fiches savent, sans clé ni réseau", async () => {
    key.mockReturnValue("");
    const user = userEvent.setup();
    /* Ozu au générique d'un film de Hou : le fait est déjà rangé. */
    render(<div />);
    cleanup();
    const onBonds = vi.fn();
    render(
      <FeedbackProvider>
        <ProgramView
          films={[
            OZU,
            makeFilm({
              id: "c",
              title: "Un film",
              director: "Hou Hsiao-hsien",
              crew: { image: ["Yasujirō Ozu"] },
            }),
          ]}
          courses={[]}
          bonds={[seed()]}
          onCourses={vi.fn()}
          onCoursesSoon={vi.fn()}
          onBonds={onBonds}
          onAddFilm={vi.fn()}
          onUpdateFilm={vi.fn()}
          onOpen={vi.fn()}
          onOpenPerson={vi.fn()}
        />
      </FeedbackProvider>
    );
    await pickOzu(user);
    const lead = await screen.findByRole("button", { name: /Hou Hsiao-hsien/ });
    expect(lead).toHaveTextContent("image, sur un de ses films");
    expect(hintsFor).not.toHaveBeenCalled();
  });
});

/* ============================================================
   REPRENDRE CE QU'UNE MOISSON A SEMÉ

   Un balayage peut couvrir la carte de liens qu'on ne voulait pas, et
   les retirer un par un serait le prix d'un seul clic mal placé. La
   NOTE porte la provenance : c'est elle qui distingue ce qu'on a écrit
   soi-même de ce qu'une machine a proposé.
   ============================================================ */
describe("la reprise en bloc", () => {
  const hinted = (from: string, to: string): Bond => ({
    ...makeBond({ kind: "master", fromName: from, toName: to, note: "Wikidata P1066" })!,
  });
  const mine = (from: string, to: string): Bond => ({
    ...makeBond({ kind: "master", fromName: from, toName: to, note: "de mémoire" })!,
  });

  it("ne s'offre pas quand il n'y a rien à reprendre", async () => {
    /* Un bouton de retrait sur une carte écrite à la main ne désigne
       rien. */
    const user = userEvent.setup();
    build([mine("Ozu", "Hou")]);
    const map = await openMap(user);
    expect(map.queryByRole("button", { name: /reprendre/i })).toBeNull();
  });

  it("retire les liens proposés et laisse les vôtres", async () => {
    const user = userEvent.setup();
    const { onBonds } = build([
      mine("Ozu", "Hou"),
      hinted("Hasumi", "Kurosawa"),
      hinted("Renoir", "Ray"),
    ]);
    const map = await openMap(user);
    await user.click(map.getByRole("button", { name: /reprendre les 2 liens proposés/i }));
    /* La confirmation dit ce qui SURVIT. */
    const box = screen.getByRole("dialog", { name: /Reprendre|reprendre/ });
    expect(within(box).getByText(/Ce que vous avez écrit vous-même ne bouge pas/)).toBeVisible();
    await user.click(within(box).getByRole("button", { name: /reprendre/i }));

    const left = onBonds.mock.calls[0]![0] as Bond[];
    expect(left).toHaveLength(1);
    expect(left[0]!.note).toBe("de mémoire");
  });

  it("ne reprend pas un lien dont on a récrit la note", async () => {
    /* Récrire la note, c'est reprendre le lien à son compte. */
    const user = userEvent.setup();
    const adopted: Bond = { ...hinted("Hasumi", "Kurosawa"), note: "d'après Wikidata, vérifié" };
    const { onBonds } = build([adopted, hinted("Renoir", "Ray")]);
    const map = await openMap(user);
    await user.click(map.getByRole("button", { name: /reprendre le lien proposé/i }));
    await user.click(
      within(screen.getByRole("dialog", { name: /Reprendre|reprendre/ })).getByRole("button", {
        name: /reprendre/i,
      })
    );
    const left = onBonds.mock.calls[0]![0] as Bond[];
    expect(left).toEqual([adopted]);
  });
});

/* ============================================================
   CE QU'UNE ARÊTE DIT QUAND ON LA CHOISIT

   Elle ne montrait que sa note — « Wikidata P1066 », une référence
   écrite pour la machine — au-dessus d'un bouton de retrait, sans les
   deux noms, sans la nature, sans le sens.
   ============================================================ */
describe("le détail d'un lien", () => {
  /* On ouvre la carte, on clique le cinéaste, puis SON lien dans le
     panneau : c'est le chemin qu'a un doigt, un trait de six pixels
     n'étant pas une cible. */
  const pick = async (user: ReturnType<typeof userEvent.setup>) => {
    await openMap(user);
    await user.click(screen.getByRole("button", { name: /^Hasumi, / }));
    await user.click(screen.getByRole("button", { name: /^a pour élève Kurosawa/ }));
  };

  it("énonce le lien dans les deux sens, et sa provenance en toutes lettres", async () => {
    const user = userEvent.setup();
    build([
      makeBond({ kind: "master", fromName: "Hasumi", toName: "Kurosawa", note: "Wikidata P1066" })!,
    ]);
    await pick(user);
    /* Le miroir en liste de la carte énonce les mêmes phrases : on lit
       DANS le panneau, ce qui est aussi la garantie qu'il porte un nom. */
    const detail = within(screen.getByRole("group", { name: "Le lien choisi" }));
    expect(detail.getByText(/a pour élève Kurosawa/)).toBeInTheDocument();
    expect(detail.getByText(/a pour maître Hasumi/)).toBeInTheDocument();
    /* La donnée reste une référence ; l'écran la traduit. */
    expect(detail.getByText("Proposé d'après Wikidata (P1066).")).toBeInTheDocument();
    expect(screen.queryByText("Wikidata P1066")).toBeNull();
  });

  it("rend une note écrite à la main telle quelle", async () => {
    const user = userEvent.setup();
    build([
      makeBond({ kind: "master", fromName: "Hasumi", toName: "Kurosawa", note: "à la Rikkyo" })!,
    ]);
    await pick(user);
    const detail = within(screen.getByRole("group", { name: "Le lien choisi" }));
    expect(detail.getByText("à la Rikkyo")).toBeInTheDocument();
  });
});
