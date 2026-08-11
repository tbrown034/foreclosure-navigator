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
      if (event === "fn:scenario") {
        // Fires on every input change: step 2 while a chain is on screen,
        // back to step 1 when the inputs are cleared.
        setStep(document.querySelectorAll("#chain li").length > 0 ? 2 : 1);
        return;
      }
      setStep(step);
    }),
  );
}
