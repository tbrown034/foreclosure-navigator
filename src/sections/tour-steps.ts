/** The TX-Tax-style step tracker: five steps mirroring the five labeled
 * sections. Progress is the furthest of two signals — what the reader has
 * DONE (events) and where they have SCROLLED (a section reaching the upper
 * 40% of the viewport). Scrolling back up never rewinds; clearing the
 * inputs resets the action signal. Each step is clickable and jumps to
 * its section. */

const STEP_EVENTS = ["fn:scenario", "fn:stage", "fn:paperwork"] as const;

const sectionFor = (step: number): HTMLElement | null =>
  document.querySelector<HTMLElement>(`section[data-tour="${step}"]`);

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

  const stepByScroll = (): number => {
    const threshold = window.scrollY + window.innerHeight * 0.4;
    let step = 1;
    for (let n = 2; n <= items.length; n++) {
      const el = sectionFor(n);
      if (el && el.getBoundingClientRect().top + window.scrollY <= threshold) step = n;
    }
    return step;
  };

  const onEvent = (event: string): void => {
    if (event === "fn:scenario" || event === "fn:stage") {
      const hasChain = document.querySelectorAll("#chain li").length > 0;
      eventStep = hasChain ? 3 : 1;
      if (!hasChain) scrollStep = 1;
    } else {
      eventStep = 4;
    }
    render();
  };

  STEP_EVENTS.forEach((event) => document.addEventListener(event, () => onEvent(event)));

  // Plain time-throttle, not requestAnimationFrame: rAF stops firing in
  // background tabs, which would jam a ticking latch permanently.
  let lastRun = 0;
  window.addEventListener(
    "scroll",
    () => {
      const now = Date.now();
      if (now - lastRun < 120) return;
      lastRun = now;
      scrollStep = Math.max(scrollStep, stepByScroll());
      render();
    },
    { passive: true },
  );

  // Clicking a step jumps to its section; the scroll handler follows.
  items.forEach((li) => {
    li.style.cursor = "pointer";
    li.addEventListener("click", () => {
      const n = Number(li.dataset.step);
      sectionFor(n)?.scrollIntoView({ block: "start" });
      scrollStep = Math.max(scrollStep, n);
      render();
    });
  });

  render();
}
