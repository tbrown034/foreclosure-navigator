/** The TX-Tax-style step tracker: a read-only progress readout of the
 * guided tour. It listens; it never drives. */

const STEP_EVENTS: Record<string, number> = {
  "fn:scenario": 2, // a notice is loaded and the chain computed
  "fn:stage": 3, // the deterministic where-you-stand panel rendered
  "fn:paperwork": 4, // the draft-and-call beat
};

export function initTourSteps(): void {
  const items = [...document.querySelectorAll<HTMLLIElement>(".steps .step-item")];
  if (items.length === 0) return;

  const setStep = (current: number): void => {
    items.forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle("is-done", n < current);
      li.classList.toggle("is-current", n === current);
    });
  };

  Object.entries(STEP_EVENTS).forEach(([event, step]) =>
    document.addEventListener(event, () => {
      if (event === "fn:scenario" || event === "fn:stage") {
        // Both fire during a chain rebuild, in either order — so the step
        // is derived from what's actually on screen, not event order:
        // stage panel visible → 3, bare chain → 2, cleared inputs → 1.
        const hasChain = document.querySelectorAll("#chain li").length > 0;
        const hasStage = !(document.getElementById("stagePanel")?.hidden ?? true);
        setStep(hasChain ? (hasStage ? 3 : 2) : 1);
        return;
      }
      setStep(step);
    }),
  );
}
