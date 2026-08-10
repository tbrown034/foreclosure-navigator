/** Stage stepper: four stages of the process. Selecting a stage swaps the
 * guidance note and drives the calculator's notice type, not just the prose. */

import { byId } from "../format";

const STAGE_NOTES = [
  "Behind on payments but no formal letter yet? This is the widest window you will ever have. Contact your servicer about loss-mitigation now — federal rules generally require a foreclosure hold while a complete application is under review.",
  "The notice of default starts a 20-day clock to catch up (“cure”). Curing means paying the missed amount — not the whole loan. The exact figure must be in writing from your servicer.",
  "The notice of trustee sale must be filed with the county clerk, posted and mailed at least 21 days before the sale. The sale can only happen on the first Tuesday of the month. Until then you can still reinstate, sell, or seek a court order.",
  "Sales run 10 a.m. to 4 p.m. at the county's designated site. Texas has no post-sale redemption for mortgage foreclosure — this is the last day to act. Tax and HOA foreclosures have different rules.",
];

export function initStepper(): void {
  const steps = document.querySelectorAll<HTMLButtonElement>(".step");
  const stageNote = byId<HTMLParagraphElement>("stageNote");
  const noticeType = byId<HTMLSelectElement>("noticeType");

  steps.forEach((btn) =>
    btn.addEventListener("click", () => {
      steps.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      const stage = Number(btn.dataset.stage);
      stageNote.textContent = STAGE_NOTES[stage] ?? "";
      // Stage drives the calculator, not just the prose.
      if (stage === 1 && noticeType.value !== "default") {
        noticeType.value = "default";
        noticeType.dispatchEvent(new Event("change"));
      }
      if ((stage === 2 || stage === 3) && noticeType.value !== "sale") {
        noticeType.value = "sale";
        noticeType.dispatchEvent(new Event("change"));
      }
    }),
  );
}
