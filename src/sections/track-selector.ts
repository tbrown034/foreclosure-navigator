/** Tax panel (lives on the /methodology page): the deterministic §34.21
 * redemption calculator. The HOA panel beside it is informational only.
 * On the main page, the track choices are plain links here — only the
 * mortgage / trustee-sale track has a live calculator. */

import { taxRedemption } from "../../lib/deadlines";
import { byId, fmt } from "../format";

function buildTax(): void {
  const raw = byId<HTMLInputElement>("taxSaleDate").value;
  if (!raw) {
    byId<HTMLDivElement>("taxOut").innerHTML =
      '<p style="margin:0;font-size:13.5px;color:var(--ink-3)">Enter the deed-recording date to compute the redemption window.</p>';
    return;
  }
  // §34.21: homestead, agricultural-use land and mineral interests share the
  // two-year window; everything else gets 180 days.
  const twoYearWindow = byId<HTMLSelectElement>("taxHomestead").value === "yes";
  const r = taxRedemption(raw, twoYearWindow);
  let html = `<p style="margin:0 0 6px"><strong style="color:var(--ink)">General statutory redemption-date estimate: ${fmt(r.deadline)}</strong> — ${twoYearWindow ? "two years (homestead, agricultural land or mineral interest)" : "180 days (other property)"} after the buyer's deed was recorded.</p>`;
  html += twoYearWindow
    ? `<p style="margin:0 0 6px">Statutory cost components may include: what the buyer paid <em>plus</em> recording fees, taxes, penalties, interest and costs the buyer has since paid, <em>plus</em> a <strong>25% premium in year one</strong> (through ${fmt(r.yearOneEnd)}) rising to <strong>50% in year two</strong>.</p>`
    : `<p style="margin:0 0 6px">Statutory cost components may include: what the buyer paid <em>plus</em> recording fees, taxes, penalties, interest and costs, <em>plus</em> a <strong>25% premium</strong>.</p>`;
  html += `<p style="margin:0;font-size:12.5px;color:var(--ink-3)">Computed from Tax Code §34.21; the premium shown assumes redemption from a private purchaser — buying back from a taxing unit follows different cost rules — and a lawyer or the tax office confirms your exact figure. Excess proceeds may be deposited with the court for two years; an eligible claimant may be able to petition for them.</p>`;
  byId<HTMLDivElement>("taxOut").innerHTML = html;
}

export function initTaxPanel(): void {
  byId<HTMLInputElement>("taxSaleDate").addEventListener("change", buildTax);
  byId<HTMLSelectElement>("taxHomestead").addEventListener("change", buildTax);
  buildTax();
}
