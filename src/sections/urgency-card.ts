/** Urgency card: the day count until the sale date — always labeled as
 * printed-on-your-notice vs projected statutory minimum. */

import { daysFromNow, fmt } from "../format";

export function renderUrgency(el: HTMLElement, saleDate: Date, verified: boolean): void {
  const daysLeft = daysFromNow(saleDate);
  const tone = verified ? "alarm" : "stamp";
  el.innerHTML =
    '<div style="display:flex;gap:14px;align-items:baseline;flex-wrap:wrap;border:1px solid var(--line);border-left:4px solid var(--' +
    tone +
    ');border-radius:8px;padding:12px 14px;background:var(--ground)">' +
    '<span style="font-family:ui-monospace,Menlo,monospace;font-size:30px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--' +
    tone +
    ')">' +
    daysLeft +
    "</span>" +
    '<span style="font-size:14px;color:var(--ink)"><strong>days until the ' +
    (verified ? "sale date printed on your notice" : "earliest possible sale (projected)") +
    "</strong> — " +
    fmt(saleDate) +
    '.<br><span style="font-size:12.5px;color:var(--ink-2)">Safest next step today: call free legal aid (first card below) and request your servicer’s requirements in writing.</span></span>' +
    '<span class="chip ' +
    (verified ? "deadline" : "window") +
    '">' +
    (verified ? "From your notice" : "Projected minimum") +
    "</span></div>";
}

export function renderUrgencyEmpty(el: HTMLElement): void {
  el.innerHTML =
    '<p style="margin:0;font-size:14px;color:var(--ink-2)">Enter the date(s) from your notice to compute the chain.</p>';
}
