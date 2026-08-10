/** Shared "draw the eye to the result" behavior: scroll to the urgency card
 * and briefly highlight it. Under prefers-reduced-motion there is no smooth
 * scroll and no flash — focus still moves so the destination is announced. */

import { byId } from "../format";

export function focusUrgency(): void {
  const urgency = byId<HTMLDivElement>("urgency");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  urgency.setAttribute("tabindex", "-1");
  urgency.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  urgency.focus({ preventScroll: true });
  if (!reduced) {
    urgency.classList.remove("urgency-flash");
    // Restart the animation if triggered twice.
    void urgency.offsetWidth;
    urgency.classList.add("urgency-flash");
  }
}
