/** The takeaway card: the whole clock in one glance, computed in code —
 * how many days until WHAT, what sits between now and then, what has
 * already passed, and which doors are open right now (with a jump to the
 * what-you-can-do section). The AI summary in that section is the
 * generative retelling; this card is the deterministic source. */

import { daysFromNow, fmt, fmtShort } from "../format";

export interface UrgencyStep {
  date: Date;
  /** Short name for the step, e.g. "38-day federal marker". */
  short: string;
}

export function renderUrgency(
  el: HTMLElement,
  saleDate: Date,
  verified: boolean,
  upcoming: UrgencyStep[],
  passed: UrgencyStep[],
  openNow: string[],
): void {
  const daysLeft = daysFromNow(saleDate);
  const wrap = document.createElement("div");
  wrap.className = "takeaway";

  // Source fact first, then what it means: the reader sees WHERE the
  // number comes from before the number.
  const source = document.createElement("p");
  source.className = "takeaway-source";
  source.append(
    verified
      ? `The filing states a sale date of ${fmt(saleDate)}. `
      : `No sale is scheduled — the earliest possible under the statutory minimums is ${fmt(saleDate)}. `,
  );
  const chip = document.createElement("span");
  chip.className = "chip " + (verified ? "deadline" : "window");
  chip.textContent = verified ? "From the notice" : "Projected minimum";
  source.appendChild(chip);
  wrap.appendChild(source);

  const big = document.createElement("p");
  big.className = "big";
  const num = document.createElement("span");
  num.className = "num";
  num.textContent = `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  if (daysLeft >= 0) {
    big.append("That means ", num, " from today.");
  } else {
    big.append("That date is behind today.");
  }
  wrap.appendChild(big);

  if (upcoming.length > 0 && daysLeft >= 0) {
    const ul = document.createElement("ul");
    ul.className = "takeaway-steps";
    upcoming.forEach((s) => {
      const li = document.createElement("li");
      const d = daysFromNow(s.date);
      li.textContent = `${d === 0 ? "Today" : `In ${d} day${d === 1 ? "" : "s"}`} — ${fmtShort(s.date)}: ${s.short}`;
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
  }

  if (passed.length > 0) {
    const p = document.createElement("p");
    p.className = "takeaway-passed";
    p.textContent =
      "Already behind you: " + passed.map((s) => `${s.short} (${fmtShort(s.date)})`).join(" · ") + ".";
    wrap.appendChild(p);
  }

  if (openNow.length > 0) {
    const p = document.createElement("p");
    p.className = "takeaway-open";
    p.append(`Doors open right now: ${openNow.join(", ")} — `);
    const go = document.createElement("button");
    go.type = "button";
    go.className = "linklike";
    go.textContent = "see what you can do ↓";
    go.addEventListener("click", () => {
      document.querySelector('section[data-tour="3"]')?.scrollIntoView({ block: "start" });
    });
    p.appendChild(go);
    wrap.appendChild(p);
  }

  const fine = document.createElement("p");
  fine.className = "fine";
  fine.textContent = "Computed in code from the dates on the notice — verify every date against the recorded copy.";
  wrap.appendChild(fine);

  el.replaceChildren(wrap);
}

export function renderUrgencyEmpty(el: HTMLElement): void {
  el.innerHTML =
    '<div style="border-left:3px solid var(--line);padding:2px 0 2px 16px">' +
    '<p style="margin:0;font-size:15px;color:var(--ink)">Nothing to compute yet.</p>' +
    '<p style="margin:6px 0 0;font-size:13.5px;color:var(--ink-2)">Click a button above, or enter the date from your notice — the deadline chain appears here.</p>' +
    "</div>";
}
