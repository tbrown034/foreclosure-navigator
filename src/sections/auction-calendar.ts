/** Auction calendar: the next three allowed sale days, computed live. */

import { upcomingAuctionDays } from "../../lib/deadlines";
import { byId, daysFromNow, fmtShort } from "../format";

export function initAuctionCalendar(): void {
  const cal = byId<HTMLDivElement>("auctionCal");
  upcomingAuctionDays(new Date(), 3).forEach((t) => {
    const box = document.createElement("div");
    box.style.cssText =
      "border:1px solid var(--line);border-radius:8px;padding:8px 12px;background:var(--ground);font-size:13px";
    box.innerHTML = `<span class="date" style="font-family:ui-monospace,Menlo,monospace;font-weight:650">${fmtShort(t)}</span><br><span style="color:var(--ink-3)">${daysFromNow(t)} days out</span>`;
    cal.appendChild(box);
  });
}
