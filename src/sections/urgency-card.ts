/** Urgency card: the day count until the sale date — always labeled as
 * printed-on-your-notice vs projected statutory minimum. */

import { daysFromNow, fmt } from "../format";

export function renderUrgency(el: HTMLElement, saleDate: Date, verified: boolean): void {
  const daysLeft = daysFromNow(saleDate);
  el.innerHTML =
    '<div class="takeaway">' +
    '<p class="big">If this were your notice, you would have <span class="num">' +
    daysLeft +
    " days</span> — the " +
    (verified ? "sale date printed on it" : "earliest possible sale (projected, not scheduled)") +
    " is " +
    fmt(saleDate) +
    ".</p>" +
    '<p class="fine"><span class="chip ' +
    (verified ? "deadline" : "window") +
    '">' +
    (verified ? "From the notice" : "Projected minimum") +
    "</span>&nbsp; One generally useful option: contacting free legal aid (numbers at the bottom of this page) and requesting the servicer’s requirements in writing — a lawyer can advise what should come first in a specific situation. General legal information, not legal advice; verify every date against the recorded notice.</p>" +
    "</div>";
}

export function renderUrgencyEmpty(el: HTMLElement): void {
  el.innerHTML =
    '<div style="border-left:3px solid var(--line);padding:2px 0 2px 16px">' +
    '<p style="margin:0;font-size:15px;color:var(--ink)">Nothing to compute yet.</p>' +
    '<p style="margin:6px 0 0;font-size:13.5px;color:var(--ink-2)">Click the button above, or enter the date from your notice — the deadline chain appears here.</p>' +
    "</div>";
}
