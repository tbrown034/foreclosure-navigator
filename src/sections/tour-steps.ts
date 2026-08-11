/** The TX-Tax-style step tracker: five steps mirroring the five labeled
 * sections, as a scrollspy — the highlighted step is the section currently
 * on screen (its top past the upper 40% of the viewport), in either
 * direction. Steps above it show as done. Clicking a step jumps to its
 * section. */

const REFRESH_EVENTS = ["fn:scenario", "fn:stage", "fn:paperwork"] as const;

const sectionFor = (step: number): HTMLElement | null =>
  document.querySelector<HTMLElement>(`section[data-tour="${step}"]`);

export function initTourSteps(): void {
  const items = [...document.querySelectorAll<HTMLLIElement>(".steps .step-item")];
  if (items.length === 0) return;

  const stepByScroll = (): number => {
    // At the bottom of the document the last section is "current" even if
    // it is too short to ever cross the 40% line.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 8) return items.length;
    const threshold = window.scrollY + window.innerHeight * 0.4;
    let step = 1;
    for (let n = 2; n <= items.length; n++) {
      const el = sectionFor(n);
      if (el && el.getBoundingClientRect().top + window.scrollY <= threshold) step = n;
    }
    return step;
  };

  const update = (): void => {
    const current = stepByScroll();
    items.forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle("is-done", n < current);
      li.classList.toggle("is-current", n === current);
      if (n === current) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
  };

  // Section heights change when a chain or panel renders — refresh then too.
  REFRESH_EVENTS.forEach((event) => document.addEventListener(event, update));

  // Plain time-throttle, not requestAnimationFrame: rAF stops firing in
  // background tabs, which would jam a ticking latch permanently.
  let lastRun = 0;
  window.addEventListener(
    "scroll",
    () => {
      const now = Date.now();
      if (now - lastRun < 120) return;
      lastRun = now;
      update();
    },
    { passive: true },
  );

  items.forEach((li) => {
    li.querySelector("button")?.addEventListener("click", () => {
      sectionFor(Number(li.dataset.step))?.scrollIntoView({ block: "start" });
      update();
    });
  });

  update();
}
