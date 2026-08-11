/** Stage readout: derived from the computed chain, never a control. It
 * follows the "fn:stage" events the deadline chain announces, so it can
 * never say "widest window you will ever have" beside a 22-day sale
 * clock. */

import { byId } from "../format";

const STAGE_TITLES = ["Missed payments", "Notice of default", "Notice of sale", "Auction day"];

const STAGE_NOTES = [
  "Behind on payments but no formal letter yet? This is the widest window you will ever have. Contact your servicer about loss-mitigation now — federal rules generally require a foreclosure hold while a complete application is under review.",
  "The notice of default starts a 20-day clock to catch up (“cure”). Curing means paying the missed amount — not the whole loan. The exact figure must be in writing from your servicer.",
  "The notice of trustee sale must be filed with the county clerk, posted and mailed at least 21 days before the sale. The sale can only happen on the first Tuesday of the month (or the first Wednesday, when that Tuesday is Jan 1 or July 4). Until then you can still reinstate, sell, or seek a court order.",
  "Sales run 10 a.m. to 4 p.m. at the county's designated site. Texas has no post-sale redemption for mortgage foreclosure — this is the last day to act. Tax and HOA foreclosures have different rules.",
];

export function initStepper(): void {
  const chip = byId<HTMLSpanElement>("stageChip");
  const title = byId<HTMLElement>("stageTitle");
  const note = byId<HTMLParagraphElement>("stageNote");

  const render = (stage: number): void => {
    chip.textContent = `Stage ${stage + 1} of 4`;
    chip.className = "chip " + (stage >= 2 ? "deadline" : "window");
    title.textContent = STAGE_TITLES[stage] ?? "";
    note.textContent = STAGE_NOTES[stage] ?? "";
  };

  document.addEventListener("fn:stage", (e) => {
    render((e as CustomEvent<{ stage: number }>).detail.stage);
  });
}
