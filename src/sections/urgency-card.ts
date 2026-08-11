/** Urgency card: the day count until the sale date — always labeled as
 * printed-on-your-notice vs projected statutory minimum. */

import { daysFromNow, fmt } from "../format";

export function renderUrgency(el: HTMLElement, saleDate: Date, verified: boolean): void {
  const daysLeft = daysFromNow(saleDate);
  const tone = verified ? "alarm" : "stamp";
  el.innerHTML =
    '<div style="border-left:3px solid var(--' +
    tone +
    ');padding:2px 0 2px 16px">' +
    '<div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap">' +
    '<span style="font-family:var(--serif);font-size:56px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums;color:var(--' +
    tone +
    ')">' +
    daysLeft +
    "</span>" +
    '<span style="font-size:14.5px;color:var(--ink)"><strong>days until the ' +
    (verified ? "sale date printed on your notice" : "earliest possible sale (projected)") +
    "</strong> — " +
    fmt(saleDate) +
    "</span>" +
    '<span class="chip ' +
    (verified ? "deadline" : "window") +
    '">' +
    (verified ? "From your notice" : "Projected minimum") +
    "</span></div>" +
    '<p style="margin:4px 0 0;font-size:12.5px;color:var(--ink-2)">A free first step many take: calling legal aid (the numbers are at the bottom of this page) and requesting the servicer’s requirements in writing.</p>' +
    "</div>";
}

export function renderUrgencyEmpty(el: HTMLElement): void {
  el.innerHTML =
    '<div style="border-left:3px solid var(--line);padding:2px 0 2px 16px">' +
    '<p style="margin:0;font-size:15px;color:var(--ink)">Nothing to compute yet.</p>' +
    '<p style="margin:6px 0 0;font-size:13.5px;color:var(--ink-2)">Click the button above, or enter the date from your notice — the deadline chain appears here.</p>' +
    "</div>";
}
