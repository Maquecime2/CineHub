/* ============================================================
   LE MONTREUR, À L'ÉPREUVE

   On ne vérifie pas la mise en page — jsdom ne mesure rien et tous les
   rectangles y valent zéro. On vérifie ce qui ne se voit pas à l'œil et
   qui casse en silence : la marche des étapes, l'abandon, le voyage
   entre les vues, et l'échappatoire quand la cible n'existe pas.
   ============================================================ */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourOverlay } from "./TourOverlay";
import { TOURS } from "./steps";
import { loadOnboarding } from "../../services/onboarding";

/* jsdom ne connaît ni `ResizeObserver` ni `scrollIntoView`, dont le
   suivi de cible se sert : sans eux la recherche lève au premier nœud
   trouvé, et l'on testerait un moteur qui ne tourne pas. */
class FauxResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", FauxResizeObserver);
  Element.prototype.scrollIntoView = vi.fn();
});

/** Une cible pour chaque ancre citée par la visite demandée. */
function poserLesCibles(tourId: string) {
  for (const s of TOURS[tourId]!.steps) {
    const m = s.target?.match(/^\[data-tour="(.+)"\]$/);
    if (!m) continue;
    const n = document.createElement("div");
    n.setAttribute("data-tour", m[1]!);
    document.body.appendChild(n);
  }
}

describe("la visite se déroule", () => {
  it("ouvre la première étape et compte les suivantes", async () => {
    poserLesCibles("notebook");
    render(<TourOverlay tourId="notebook" onClose={vi.fn()} onView={vi.fn()} />);

    const étape = TOURS.notebook!.steps[0]!;
    expect(await screen.findByText(étape.title)).toBeInTheDocument();
    expect(screen.getByText(`1 / ${TOURS.notebook!.steps.length}`)).toBeInTheDocument();
  });

  it("avance, revient, et n'offre pas de retour à la première étape", async () => {
    poserLesCibles("import");
    render(<TourOverlay tourId="import" onClose={vi.fn()} onView={vi.fn()} />);
    const [un, deux] = TOURS.import!.steps;

    expect(await screen.findByText(un!.title)).toBeInTheDocument();
    expect(screen.queryByText("retour")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("SUIVANT"));
    expect(await screen.findByText(deux!.title)).toBeInTheDocument();

    await userEvent.click(screen.getByText("retour"));
    expect(await screen.findByText(un!.title)).toBeInTheDocument();
  });

  /* Terminer et abandonner n'écrivent PAS la même chose : c'est là-dessus
     que se décide si le rappel paraîtra. */
  it("terminer inscrit la visite comme faite", async () => {
    poserLesCibles("notebook");
    const onClose = vi.fn();
    render(<TourOverlay tourId="notebook" onClose={onClose} onView={vi.fn()} />);

    await userEvent.click(await screen.findByText("TERMINER"));
    expect(onClose).toHaveBeenCalled();
    expect(loadOnboarding().done).toContain("notebook");
    expect(loadOnboarding().skipped).toBe(false);
  });

  it("passer marque l'abandon sans inscrire la visite", async () => {
    poserLesCibles("import");
    const onClose = vi.fn();
    render(<TourOverlay tourId="import" onClose={onClose} onView={vi.fn()} />);

    await userEvent.click(await screen.findByText("passer"));
    expect(onClose).toHaveBeenCalled();
    expect(loadOnboarding()).toMatchObject({ done: [], skipped: true });
  });

  it("Échap écarte la visite", async () => {
    poserLesCibles("import");
    const onClose = vi.fn();
    render(<TourOverlay tourId="import" onClose={onClose} onView={vi.fn()} />);
    await screen.findByText(TOURS.import!.steps[0]!.title);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(loadOnboarding().skipped).toBe(true);
  });

  it("ne montre rien quand aucune visite n'est demandée", () => {
    const { container } = render(<TourOverlay tourId={null} onClose={vi.fn()} onView={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("la visite globale voyage", () => {
  it("demande la vue de sa première étape", async () => {
    const onView = vi.fn();
    poserLesCibles("global");
    render(<TourOverlay tourId="global" onClose={vi.fn()} onView={onView} />);

    await screen.findByText(TOURS.global!.steps[0]!.title);
    expect(onView).toHaveBeenCalledWith(TOURS.global!.steps[0]!.view);
  });
});

describe("une cible absente ne bloque pas", () => {
  /* Le cas du classeur neuf : la moitié des étapes visent du contenu
     qui n'existe pas encore. Sans cette échappatoire, la toute première
     visite resterait plantée sur un voile opaque. */
  it("saute l'étape facultative dont la cible manque", async () => {
    /* On ne pose QUE la seconde ancre : la première étape de la visite
       de l'almanach est facultative et doit s'effacer. */
    const n = document.createElement("div");
    n.setAttribute("data-tour", "almanac-plates");
    document.body.appendChild(n);

    render(<TourOverlay tourId="almanac" onClose={vi.fn()} onView={vi.fn()} />);

    expect(
      await screen.findByText("Trois planches", undefined, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  /* L'ENVERS DU DÉCOR, ET C'EST LUI QUI A CASSÉ. Le montreur reste monté
     en permanence : hors visite il suit une cible nulle, donc « absente ».
     Quand une visite s'ouvrait, sa première étape se rendait une fois avec
     cet état-là encore en mémoire — et si elle était facultative, elle se
     faisait escamoter avant qu'on ait seulement cherché sa cible. La
     visite d'une fiche s'ouvrait sur son étape 2.

     D'où le passage par `tourId={null}` : sans lui le montreur naît avec
     la bonne visite, l'état vicié n'existe jamais, et le test passerait
     même avec le bug. */
  it("n'escamote pas la première étape quand sa cible est là", async () => {
    poserLesCibles("detail");
    const { rerender } = render(
      <TourOverlay tourId={null} onClose={vi.fn()} onView={vi.fn()} />
    );
    rerender(<TourOverlay tourId="detail" onClose={vi.fn()} onView={vi.fn()} />);

    const première = TOURS.detail!.steps[0]!;
    expect(première.optional, "le test ne vaut que si l'étape est facultative").toBe(true);
    expect(await screen.findByText(première.title)).toBeInTheDocument();
    expect(screen.getByText(`1 / ${TOURS.detail!.steps.length}`)).toBeInTheDocument();
  });
});
