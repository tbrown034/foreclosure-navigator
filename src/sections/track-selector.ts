/** Track selector: mortgage tool active; tax and HOA informational panels.
 * The tax panel runs the deterministic §34.21 redemption calculator. */

import { taxRedemption } from "../../lib/deadlines";
import { byId, fmt } from "../format";

function buildTax(): void {
  const raw = byId<HTMLInputElement>("taxSaleDate").value;
  if (!raw) return;
  const homestead = byId<HTMLSelectElement>("taxHomestead").value === "yes";
  const r = taxRedemption(raw, homestead);
  let html = `<p style="margin:0 0 6px"><strong style="color:var(--ink)">Redemption deadline: ${fmt(r.deadline)}</strong> — ${homestead ? "two years (homestead)" : "180 days (non-homestead)"} after the buyer's deed was recorded.</p>`;
  html += homestead
    ? `<p style="margin:0 0 6px">Cost to redeem: what the buyer paid <em>plus</em> recording fees, taxes, penalties, interest and costs the buyer has since paid, <em>plus</em> a <strong>25% premium in year one</strong> (through ${fmt(r.yearOneEnd)}) rising to <strong>50% in year two</strong>.</p>`
    : `<p style="margin:0 0 6px">Cost to redeem: what the buyer paid <em>plus</em> recording fees, taxes, penalties, interest and costs, <em>plus</em> a <strong>25% premium</strong>.</p>`;
  html += `<p style="margin:0;font-size:12.5px;color:var(--ink-3)">Computed from Tax Code §34.21; a lawyer or the tax office confirms your exact figure. If money was left over at the sale, it sits in the court registry for two years — you can petition to claim it.</p>`;
  byId<HTMLDivElement>("taxOut").innerHTML = html;
}

export function initTrackSelector(): void {
  const trackTax = byId<HTMLDivElement>("trackTax");
  const trackHoa = byId<HTMLDivElement>("trackHoa");
  const buttons = document.querySelectorAll<HTMLButtonElement>(".track-btn");

  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.add("ghost");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.remove("ghost");
      btn.setAttribute("aria-selected", "true");
      const t = btn.dataset.track;
      trackTax.hidden = t !== "tax";
      trackHoa.hidden = t !== "hoa";
    }),
  );

  byId<HTMLInputElement>("taxSaleDate").addEventListener("change", buildTax);
  byId<HTMLSelectElement>("taxHomestead").addEventListener("change", buildTax);
  buildTax();
}
