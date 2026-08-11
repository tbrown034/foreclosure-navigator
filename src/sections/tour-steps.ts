/** The TX-Tax-style step tracker: a read-only progress readout of the
 * guided tour. It listens; it never drives.
 *
 * Progress comes from two signals, and the rail shows the furthest of
 * them: what the reader has DONE (events — a chain computed, a draft
 * opened) and where they have SCROLLED (each step's section reaching the
 * upper part of the viewport). Scrolling back up never rewinds progress;
 * clearing the inputs resets it. */

const STEP_EVENTS = ["fn:scenario", "fn:stage", "fn:paperwork"] as const;

export function initTourSteps(): void {
  const items = [...document.querySelectorAll<HTMLLIElement>(".steps .step-item")];
  if (items.length === 0) return;

  let eventStep = 1;
  let scrollStep = 1;

  const render = (): void => {
    const current = Math.max(eventStep, scrollStep);
    items.forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle("is-done", n < current);
      li.classList.toggle("is-current", n === current);
    });
  };

  /** The furthest step whose section has reached the upper 40% of the
   * viewport. Hidden sections (no stage yet) don't count. */
  const stepByScroll = (): number => {
    const threshold = window.scrollY + window.innerHeight * 0.4;
    const anchors: Array<[number, HTMLElement | null]> = [
      [2, document.querySelectorAll("#chain li").length > 0 ? document.getElementById("urgency") : null],
      [3, (document.getElementById("stagePanel")?.hidden ?? true) ? null : document.getElementById("stagePanel")],
      [4, document.getElementById("docH")?.closest("section") ?? null],
    ];
    let step = 1;
    for (const [n, el] of anchors) {
      if (el && el.getBoundingClientRect().top + window.scrollY <= threshold) step = n;
    }
    return step;
  };

  const onEvent = (event: string): void => {
    if (event === "fn:scenario" || event === "fn:stage") {
      // Both fire during a chain rebuild, in either order — derive from
      // what's actually on screen, not event order: stage panel visible
      // → 3, bare chain → 2, cleared inputs → full reset to 1.
      const hasChain = document.querySelectorAll("#chain li").length > 0;
      const hasStage = !(document.getElementById("stagePanel")?.hidden ?? true);
      eventStep = hasChain ? (hasStage ? 3 : 2) : 1;
      if (!hasChain) scrollStep = 1;
    } else {
      eventStep = 4;
    }
    render();
  };

  STEP_EVENTS.forEach((event) => document.addEventListener(event, () => onEvent(event)));

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        scrollStep = Math.max(scrollStep, stepByScroll());
        render();
      });
    },
    { passive: true },
  );

  render();
}
