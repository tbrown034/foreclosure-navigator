/**
 * The stage engine — "where you stand," as pure arithmetic over the same
 * dates the deadline chain uses. Given the notice facts and today's date it
 * answers: which statutory windows are open, which markers have passed, and
 * which of the six recourse kits deserve attention first.
 *
 * Contract, same as lib/deadlines.ts: everything here is computed in code;
 * a language model never produces a date or a status. And a legal rail on
 * top: this module never declares an option unavailable — cutoffs the
 * statute doesn't fix (reinstatement, postponements) belong to the loan
 * documents, the servicer and a lawyer, and the wording says so.
 */

import { atNoon, daysBetween, defaultNoticeChain, saleNoticeChain } from "./deadlines";

export type NoticeKind = "default" | "sale";

/** Attention tiers, most to least urgent. Internal — the reader sees the
 * `label` wording, never these enum names. */
export type RecourseTier = "act-now" | "open" | "confirm" | "passed-marker";

export interface RecourseStatus {
  /** Matches the kit ordering ids used by the action-kit section. */
  id: "legal-help" | "loss-mitigation" | "check-filing" | "reinstate" | "sell" | "court";
  title: string;
  tier: RecourseTier;
  /** Short status chip text, reader-facing. */
  label: string;
  /** One reader-facing sentence: what this is worth right now, honestly. */
  note: string;
  /** Which document-desk draft this recourse maps to, if any. */
  draft: "script" | "hardship" | null;
}

export interface StageAssessment {
  /** e.g. "As of Mon, Aug 11, 2026 — 21 days until the printed sale date." */
  headline: string;
  /** 1–3 deterministic status sentences about the statutory windows. */
  lines: string[];
  /** True when the printed sale date is behind today. */
  salePassed: boolean;
  /** All six recourses, ordered most-relevant first. Nothing is deleted. */
  recourses: RecourseStatus[];
}

const fmtLong = (d: Date): string =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const fmtShort = (d: Date): string => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Order: act-now, open, confirm, passed-marker; stable within a tier. */
const TIER_RANK: Record<RecourseTier, number> = { "act-now": 0, open: 1, confirm: 2, "passed-marker": 3 };

export function stageAssessment(
  kind: NoticeKind,
  noticeIso: string,
  printedSaleIso: string | null,
  todayIso: string,
): StageAssessment | null {
  const today = atNoon(todayIso);

  if (kind === "sale" && printedSaleIso) {
    return saleStage(noticeIso, printedSaleIso, today);
  }
  if (kind === "default") {
    return defaultStage(noticeIso, today);
  }
  return null;
}

function saleStage(noticeIso: string, printedSaleIso: string, today: Date): StageAssessment {
  const c = saleNoticeChain(noticeIso, printedSaleIso);
  const toSale = daysBetween(today, c.sale);
  const salePassed = toSale < 0;
  const regXOpen = today.getTime() <= c.regX.getTime();
  const soon = !salePassed && toSale <= 14;

  const headline = salePassed
    ? `As of ${fmtLong(today)} — the printed sale date (${fmtShort(c.sale)}) has passed.`
    : toSale === 0
      ? `As of ${fmtLong(today)} — the printed sale date is today.`
      : `As of ${fmtLong(today)} — ${toSale} day${toSale === 1 ? "" : "s"} until the printed sale date (${fmtShort(c.sale)}).`;

  const lines: string[] = [];
  if (salePassed) {
    lines.push(
      "This tool cannot tell whether the sale occurred, was postponed or was canceled — the county record and the servicer can. Talking to a lawyer promptly is a common step either way; some options differ sharply after a sale.",
    );
  } else {
    if (regXOpen) {
      const toMarker = daysBetween(today, c.regX);
      lines.push(
        `${fmtShort(c.regX)} is 38 days before the printed sale date${toMarker === 0 ? " — that is today" : ` — ${toMarker} day${toMarker === 1 ? "" : "s"} away`}. Some federal protections depend on the servicer receiving a COMPLETE loss-mitigation application more than 37 days before the sale; completeness, timing and exceptions all matter.`,
      );
    } else {
      lines.push(
        `The more-than-37-days federal marker was ${fmtShort(c.regX)} and has passed. That does not by itself mean loss-mitigation materials cannot still be submitted or considered — other rules and exceptions may apply; the servicer and a lawyer can say what applies now.`,
      );
    }
    if (!c.meetsTwentyOneDayMinimum) {
      lines.push(
        `The filing-to-sale gap computed above is short of the 21-day statutory minimum — that discrepancy is worth photographing and showing a lawyer promptly.`,
      );
    }
  }

  const recourses: RecourseStatus[] = [
    {
      id: "legal-help",
      title: "Free legal help",
      tier: "act-now",
      label: salePassed ? "Call promptly" : soon ? "Call today" : "Call early",
      note: salePassed
        ? "Free legal aid can find out what actually happened and what applies now. Verified numbers in the kit below."
        : "The earlier legal aid is in, the more they can do — sharing the sale date early helps intake understand urgency. Verified numbers below.",
      draft: null,
    },
    {
      id: "loss-mitigation",
      title: "Loss mitigation — apply in writing",
      tier: salePassed ? "confirm" : regXOpen ? (soon ? "act-now" : "open") : "passed-marker",
      label: salePassed
        ? "Ask what applies"
        : regXOpen
          ? `38-day marker: ${fmtShort(c.regX)}`
          : "Marker passed — still worth asking",
      note: salePassed
        ? "After a sale date passes, whether review options remain is a servicer-and-lawyer question — worth asking in writing."
        : regXOpen
          ? "A complete application received more than 37 days before the sale may restrict the servicer from moving forward while it is reviewed — exceptions apply. The request letter below starts it."
          : "The 38-day marker has passed — that does not by itself mean materials cannot still be submitted or considered; protections differ, and the servicer and a lawyer can say what applies now.",
      draft: "hardship",
    },
    {
      id: "check-filing",
      title: "Check the filing yourself",
      tier: "open",
      label: "Free, any time",
      note: "Verify every date on the recorded instrument against what you were mailed — discrepancies are exactly what a lawyer wants to see.",
      draft: null,
    },
    {
      id: "reinstate",
      title: "Reinstate or pay off",
      tier: salePassed ? "confirm" : soon ? "act-now" : "confirm",
      label: "Confirm the cutoff",
      note: salePassed
        ? "Whether reinstatement or payoff remains possible after the printed date is a servicer question — this tool cannot determine it. Request current figures in writing."
        : "The exact amounts and the contractual cutoff come from the servicer, not the statute — request both quotes in writing early; delivery takes time.",
      draft: "script",
    },
    {
      id: "sell",
      title: "Sell before the sale",
      tier: salePassed ? "passed-marker" : soon ? "confirm" : "open",
      label: salePassed ? "Printed date passed — verify sale status" : soon ? "Tight timeline" : "Time-dependent",
      note: salePassed
        ? "Whether a pre-sale listing still fits depends on what actually happened to the sale — the county record and the servicer can say; a lawyer can advise."
        : soon
          ? "Whether a private sale can close before the printed date is a question for an agent or buyer on day one — the window is tight."
          : "With equity, selling before the auction can preserve value — whether it fits depends on the equity, the loan and the goals.",
      draft: null,
    },
    {
      id: "court",
      title: "Court and bankruptcy options",
      tier: salePassed ? "confirm" : soon ? "act-now" : "confirm",
      label: "Lawyer question",
      note: "Whether a court or bankruptcy route fits is a lawyer's call, none of it is fast, and eligibility and consequences vary — which is why the clock above matters.",
      draft: null,
    },
  ];

  recourses.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
  return { headline, lines, salePassed, recourses };
}

function defaultStage(noticeIso: string, today: Date): StageAssessment {
  const c = defaultNoticeChain(noticeIso);
  // §51.002(d): the notice day counts as day one.
  const day = daysBetween(c.notice, today) + 1;
  const cureOpen = day >= 1 && day <= 20;
  const beforeNotice = day < 1;

  const headline = beforeNotice
    ? `As of ${fmtLong(today)} — the notice date entered is in the future.`
    : cureOpen
      ? `As of ${fmtLong(today)} — day ${day} of the 20-day cure window.`
      : `As of ${fmtLong(today)} — the 20-day statutory minimum ended ${fmtShort(c.cureEnd)}.`;

  const lines: string[] = [];
  if (cureOpen) {
    lines.push(
      `Texas's minimum 20-day right-to-cure period runs through ${fmtShort(c.cureEnd)}, counting the notice date as day one. Fully curing the stated default by the applicable deadline may prevent the lender from proceeding on that default — the exact amount and deadline come from the servicer.`,
    );
    lines.push(
      "No sale is scheduled at this stage — a sale requires its own notice with its own date, at least 21 days out. A loss-mitigation application completed now, before any sale is scheduled, carries the strongest federal protections.",
    );
  } else if (!beforeNotice) {
    lines.push(
      "The notice or loan documents may allow more time than the statutory minimum — this tool cannot determine the operative cutoff; the servicer or a lawyer can. If a notice of sale arrives, enter it above: the clock changes.",
    );
  }

  const recourses: RecourseStatus[] = [
    {
      id: "legal-help",
      title: "Free legal help",
      tier: "act-now",
      label: "Call early",
      note: "This is the stage where legal aid has the most room to work. Verified numbers in the kit below.",
      draft: null,
    },
    {
      id: "loss-mitigation",
      title: "Loss mitigation — apply in writing",
      tier: "act-now",
      label: "Strongest window",
      note: "An application completed before any sale is scheduled carries the strongest federal review protections — the request letter below starts it.",
      draft: "hardship",
    },
    {
      id: "reinstate",
      title: "Cure the default / reinstate",
      tier: cureOpen ? "act-now" : "confirm",
      label: cureOpen ? `Cure window — day ${Math.max(day, 1)} of 20` : "Confirm the cutoff",
      note: cureOpen
        ? "Curing the stated default within the window may stop this process on that default — get the exact amount and deadline from the servicer in writing."
        : "The statutory minimum has ended, but the operative cutoff lives in your loan documents — confirm it with the servicer or a lawyer rather than assuming either way.",
      draft: "script",
    },
    {
      id: "check-filing",
      title: "Check the county record",
      tier: "open",
      label: "Free, any time",
      note: "No sale can be held without a notice of sale on file with the county clerk at least 21 days out — checking the record shows whether one exists.",
      draft: null,
    },
    {
      id: "sell",
      title: "Sell on your own timeline",
      tier: "open",
      label: "Most room now",
      note: "Before a sale is scheduled there is more room to list and close on ordinary timelines — whether it fits depends on equity, the loan and the goals.",
      draft: null,
    },
    {
      id: "court",
      title: "Court and bankruptcy options",
      tier: "confirm",
      label: "Lawyer question",
      note: "Usually a later-stage question, and always a lawyer's call — knowing the clock above is what makes that conversation productive.",
      draft: null,
    },
  ];

  recourses.sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier]);
  return { headline, lines, salePassed: false, recourses };
}
