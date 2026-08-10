/**
 * Deadline chain: takes the editor state, runs the statutory date engine
 * (lib/deadlines.ts — the only place dates come from), and renders the
 * result as a timeline rail. Also publishes the sale-clock reading that the
 * action kits and document desk subscribe to.
 */

import { defaultNoticeChain, isAllowedSaleDay, saleNoticeChain } from "../../lib/deadlines";
import { byId, fmt, todayAtNoon } from "../format";
import { setSaleInfo } from "../state";
import type { EditorState } from "./editor-box";
import { initEditorBox } from "./editor-box";
import { renderUrgency, renderUrgencyEmpty } from "./urgency-card";

type RowClass = "past" | "window" | "deadline";

interface ChainRow {
  date: Date;
  what: string;
  cite: string;
  cls: RowClass;
  label: string;
}

const REGX_COPY =
  "Loss-mitigation window: a complete application received more than 37 days before a scheduled sale may trigger federal review protections — exceptions apply, and the servicer judges completeness. Get every requested item in, with proof of delivery.";

function defaultRows(noticeIso: string, today: Date): { rows: ChainRow[]; sale: Date } {
  const c = defaultNoticeChain(noticeIso);
  const rows: ChainRow[] = [
    {
      date: c.notice,
      what: "Notice of default served. The 20-day right-to-cure window opens — the notice day itself counts as day one.",
      cite: "Tex. Prop. Code §51.002(d)",
      cls: c.notice < today ? "past" : "window",
      label: c.notice < today ? "Served" : "Upcoming",
    },
    {
      date: c.cureEnd,
      what: "Last day to cure: pay the stated missed amount (not the whole loan) and the process must stop.",
      cite: "Day 20 of the statutory window",
      cls: c.cureEnd < today ? "deadline" : "window",
      label: c.cureEnd < today ? "Passed" : "Open",
    },
    {
      date: c.earliestSaleNotice,
      what: "Earliest day a notice of sale could be filed, posted and mailed.",
      cite: "After the cure window closes",
      cls: "window",
      label: "Projected",
    },
    {
      date: c.regX,
      what:
        REGX_COPY +
        " No sale is scheduled in this projection — an application completed before any sale is ever scheduled has the strongest protections.",
      cite: "RESPA / Reg X, 12 CFR §1024.41 — last ordinary qualifying day if the sale happened at the projected minimum",
      cls: c.regX < today ? "deadline" : "window",
      label: c.regX < today ? "Tight" : "Open",
    },
    {
      date: c.projectedSale,
      what: "EARLIEST POSSIBLE sale under statutory minimums — projected, not scheduled. An actual sale requires its own notice stating its own date. First-Tuesday rule (first Wednesday if that Tuesday is Jan 1 or Jul 4).",
      cite: "Tex. Prop. Code §51.002(a)-(b), (a-1)",
      cls: "deadline",
      label: "Projected",
    },
  ];
  return { rows, sale: c.projectedSale };
}

function saleRows(noticeIso: string, printedSaleIso: string, today: Date): { rows: ChainRow[]; sale: Date } {
  const c = saleNoticeChain(noticeIso, printedSaleIso);
  const pass = c.meetsTwentyOneDayMinimum;
  const allowedDay = isAllowedSaleDay(c.sale);
  const rows: ChainRow[] = [
    {
      date: c.notice,
      what:
        "Notice of sale filed with the county clerk, posted and mailed. Statutory check, computed: " +
        c.gapDays +
        " days before the stated sale — " +
        (pass ? "meets" : "SHORT OF") +
        " the 21-day minimum." +
        (allowedDay
          ? ""
          : " A second check: the printed sale date is NOT a first Tuesday (or the Jan 1 / Jul 4 Wednesday) — this tool never replaces a printed date, but that discrepancy is worth photographing and showing a lawyer."),
      cite: "Tex. Prop. Code §51.002(b)" + (allowedDay ? "" : " · §51.002(a), (a-1)"),
      cls: pass && allowedDay ? "window" : "deadline",
      label: pass && allowedDay ? "Check: pass" : "Check: FLAG",
    },
    {
      date: c.regX,
      what: REGX_COPY,
      cite: "RESPA / Reg X, 12 CFR §1024.41",
      cls: c.regX < today ? "past" : "window",
      label: c.regX < today ? "Passed" : "Open",
    },
    {
      date: c.planBy,
      what: "Planning marker: reinstatement funds, closings and any court filings must be COMPLETE before sale day — individual cutoffs vary and a lawyer confirms yours.",
      cite: "Day before the stated sale",
      cls: "deadline",
      label: "Plan by",
    },
    {
      date: c.sale,
      what: "Sale date — printed on your notice. First Tuesday (or first Wednesday if Jan 1 / Jul 4); 10 a.m.–4 p.m. is the statutory outer window, and your notice states the exact start time — the sale must begin within three hours after it. In Harris County, the Bayou City Event Center.",
      cite: "Tex. Prop. Code §51.002(a), (c)",
      cls: "deadline",
      label: "Sale day",
    },
  ];
  return { rows, sale: c.sale };
}

function renderRail(chainEl: HTMLOListElement, rows: ChainRow[]): void {
  chainEl.innerHTML = "";
  rows.forEach((row) => {
    const li = document.createElement("li");
    li.className = row.cls;

    const dot = document.createElement("span");
    dot.className = "rail-dot";
    dot.setAttribute("aria-hidden", "true");

    const head = document.createElement("div");
    head.className = "rail-head";
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = fmt(row.date);
    const chip = document.createElement("span");
    chip.className = "chip " + row.cls;
    chip.textContent = row.label;
    head.append(date, chip);

    const p = document.createElement("p");
    p.textContent = row.what;
    const cite = document.createElement("span");
    cite.className = "cite";
    cite.textContent = row.cite;
    p.appendChild(cite);

    li.append(dot, head, p);
    chainEl.appendChild(li);
  });
}

export function initDeadlineChain(): void {
  const chainEl = byId<HTMLOListElement>("chain");
  const urgencyEl = byId<HTMLDivElement>("urgency");

  const build = (state: EditorState): void => {
    if (!state.noticeIso || (state.type === "sale" && !state.printedSaleIso)) {
      chainEl.innerHTML = "";
      renderUrgencyEmpty(urgencyEl);
      setSaleInfo({ text: null, verified: false });
      return;
    }
    const today = todayAtNoon();
    const verified = state.type === "sale";
    const { rows, sale } = verified
      ? saleRows(state.noticeIso, state.printedSaleIso, today)
      : defaultRows(state.noticeIso, today);

    renderUrgency(urgencyEl, sale, verified);
    renderRail(chainEl, rows);
    setSaleInfo({ text: fmt(sale), verified });
  };

  initEditorBox(build);
}
