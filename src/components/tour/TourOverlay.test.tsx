/* ============================================================
   THE GUIDE, PUT TO THE TEST

   We do not check the layout — jsdom measures nothing and every
   rectangle in it is zero. We check what the eye cannot see and what
   breaks in silence: the march of the steps, abandoning, travelling
   between views, and the escape hatch when the target does not exist.
   ============================================================ */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourOverlay } from "./TourOverlay";
import { TOURS } from "./steps";
import { loadOnboarding } from "../../services/onboarding";
import i18n from "../../i18n";

/* The steps hold catalogue KEYS; the screen shows sentences. `setupTests`
   pins the suite to French, so this is what the bubble really reads. */
const said = (key: string) => i18n.t(key);

/* jsdom knows neither `ResizeObserver` nor `scrollIntoView`, which the
   target tracking uses: without them the search throws on the first node
   found, and we would be testing an engine that is not running. */
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  Element.prototype.scrollIntoView = vi.fn();
});

/** One target for every anchor the requested tour names. */
function layTargets(tourId: string) {
  for (const s of TOURS[tourId]!.steps) {
    const m = s.target?.match(/^\[data-tour="(.+)"\]$/);
    if (!m) continue;
    const n = document.createElement("div");
    n.setAttribute("data-tour", m[1]!);
    document.body.appendChild(n);
  }
}

describe("the tour unrolls", () => {
  it("opens the first step and counts the ones after", async () => {
    layTargets("notebook");
    render(<TourOverlay tourId="notebook" onClose={vi.fn()} onView={vi.fn()} />);

    const step = TOURS.notebook!.steps[0]!;
    expect(await screen.findByText(said(step.title))).toBeInTheDocument();
    expect(screen.getByText(`1 / ${TOURS.notebook!.steps.length}`)).toBeInTheDocument();
  });

  it("goes forward, comes back, and offers no way back from the first step", async () => {
    layTargets("import");
    render(<TourOverlay tourId="import" onClose={vi.fn()} onView={vi.fn()} />);
    const [un, two] = TOURS.import!.steps;

    expect(await screen.findByText(said(un!.title))).toBeInTheDocument();
    expect(screen.queryByText("retour")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("SUIVANT"));
    expect(await screen.findByText(said(two!.title))).toBeInTheDocument();

    await userEvent.click(screen.getByText("retour"));
    expect(await screen.findByText(said(un!.title))).toBeInTheDocument();
  });

  /* Finishing and abandoning do NOT write the same thing: that is what
     decides whether the reminder will appear. */
  it("finishing records the tour as taken", async () => {
    layTargets("notebook");
    const onClose = vi.fn();
    render(<TourOverlay tourId="notebook" onClose={onClose} onView={vi.fn()} />);

    await userEvent.click(await screen.findByText("TERMINER"));
    expect(onClose).toHaveBeenCalled();
    expect(loadOnboarding().done).toContain("notebook");
    expect(loadOnboarding().skipped).toBe(false);
  });

  it("skipping marks the walk-out without recording the tour", async () => {
    layTargets("import");
    const onClose = vi.fn();
    render(<TourOverlay tourId="import" onClose={onClose} onView={vi.fn()} />);

    await userEvent.click(await screen.findByText("passer"));
    expect(onClose).toHaveBeenCalled();
    expect(loadOnboarding()).toMatchObject({ done: [], skipped: true });
  });

  it("Escape dismisses the tour", async () => {
    layTargets("import");
    const onClose = vi.fn();
    render(<TourOverlay tourId="import" onClose={onClose} onView={vi.fn()} />);
    await screen.findByText(said(TOURS.import!.steps[0]!.title));

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(loadOnboarding().skipped).toBe(true);
  });

  it("shows nothing when no tour is asked for", () => {
    const { container } = render(<TourOverlay tourId={null} onClose={vi.fn()} onView={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the global tour travels", () => {
  it("asks for the view of its first step", async () => {
    const onView = vi.fn();
    layTargets("global");
    render(<TourOverlay tourId="global" onClose={vi.fn()} onView={onView} />);

    await screen.findByText(said(TOURS.global!.steps[0]!.title));
    expect(onView).toHaveBeenCalledWith(TOURS.global!.steps[0]!.view);
  });
});

describe("a missing target does not block", () => {
  /* The new binder's case: half the steps aim at content that does not
     exist yet. Without this escape hatch, the very first tour would stay
     stuck on an opaque veil. */
  it("skips the optional step whose target is missing", async () => {
    /* We lay down ONLY the second anchor: the almanac tour's first step
       is optional and must fade away. */
    const n = document.createElement("div");
    n.setAttribute("data-tour", "almanac-plates");
    document.body.appendChild(n);

    render(<TourOverlay tourId="almanac" onClose={vi.fn()} onView={vi.fn()} />);

    /* The title is READ from the tour rather than copied here: this test
       is about the step being skipped, not about the second one's text,
       and a rewording of the product must not make it fail. */
    const second = TOURS.almanac!.steps.find((s) => s.target?.includes("almanac-plates"))!;
    expect(
      await screen.findByText(said(second.title), undefined, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  /* THE OTHER SIDE OF THE SET, AND IT IS WHAT BROKE. The guide stays
     mounted permanently: outside a tour it tracks a null target, hence
     "missing". When a tour opened, its first step rendered once with
     that state still in memory — and if it was optional, it got whisked
     away before its target had even been looked for. A card's tour
     opened on its step 2.

     Hence going through `tourId={null}`: without it the guide is born
     with the right tour, the tainted state never exists, and the test
     would pass even with the bug. */
  it("does not spirit away the first step when its target is there", async () => {
    layTargets("detail");
    const { rerender } = render(<TourOverlay tourId={null} onClose={vi.fn()} onView={vi.fn()} />);
    rerender(<TourOverlay tourId="detail" onClose={vi.fn()} onView={vi.fn()} />);

    const firstOne = TOURS.detail!.steps[0]!;
    expect(firstOne.optional, "the test only means something if the step is optional").toBe(true);
    expect(await screen.findByText(said(firstOne.title))).toBeInTheDocument();
    expect(screen.getByText(`1 / ${TOURS.detail!.steps.length}`)).toBeInTheDocument();
  });
});

/* ============================================================
   THE ESCAPE HATCH, THE OTHER WAY ROUND

   A test already made sure an optional step whose target IS there does
   not get whisked away. Nothing checked the reverse promise, which
   `steps.ts` nonetheless writes in black and white: "target absent ⇒
   step skipped without a sound".

   Until now it was only a convenience for empty binders. It became a
   rule of the product the day "the year in a box" stopped appearing on
   the "always" period — the picture is built around a vintage, and there
   is none. Without that skip, the almanac's tour would stop on a bubble
   pointing at nothing.
   ============================================================ */
describe("a missing target does not block the tour", () => {
  /** The same targets, minus one — the one we want to see missing. */
  function poserSauf(tourId: string, absente: string) {
    for (const s of TOURS[tourId]!.steps) {
      const m = s.target?.match(/^\[data-tour="(.+)"\]$/);
      if (!m || m[1] === absente) continue;
      const n = document.createElement("div");
      n.setAttribute("data-tour", m[1]!);
      document.body.appendChild(n);
    }
  }

  it("skips the optional step whose target is missing", async () => {
    const steps = TOURS.almanac!.steps;
    const box = steps.find((s) => s.target === '[data-tour="almanac-export"]')!;
    expect(box.optional, "the test only means something if the step is optional").toBe(true);

    poserSauf("almanac", "almanac-export");
    const onClose = vi.fn();
    render(<TourOverlay tourId="almanac" onClose={onClose} onView={vi.fn()} />);

    // we do reach the second to last…
    const before = steps[steps.length - 2]!;
    expect(await screen.findByText(said(before.title))).toBeInTheDocument();
    await userEvent.click(screen.getByText(/suivant|terminer/i));

    /* …and the last, deprived of a target, does not hold the tour up: it
       ends in its place.

       We check the CALL and not the bubble disappearing: here `onClose`
       is a mock, and in real life it is the caller that unmounts the
       guide. Requiring the text to vanish would test the double, not the
       component. */
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
