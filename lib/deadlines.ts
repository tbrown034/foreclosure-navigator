/**
 * The statutory date engine — Tex. Prop. Code §51.002 and Tax Code §34.21,
 * as pure arithmetic. Every date this product shows a reader is computed
 * here, in code. A language model never produces a date.
 *
 * All date math is done at LOCAL NOON. Noon normalization means same-day
 * comparisons are exact (a threshold that lands exactly on a first Tuesday
 * matches that Tuesday instead of skipping a month) and day arithmetic is
 * immune to DST edges.
 */

/** Parse an ISO date string (YYYY-MM-DD) as a local-noon Date. */
export const atNoon = (iso: string): Date => new Date(iso + "T12:00:00");

/** Return a new Date n calendar days after d (negative n allowed). */
export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const MS_PER_DAY = 86_400_000;

/** Whole calendar days from a to b (both noon-normalized). */
export const daysBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);

/**
 * First day on or after d when a Texas non-judicial foreclosure sale may be
 * held: the first Tuesday of the month — except that under §51.002(a-1),
 * when the first Tuesday is January 1 or July 4, the sale is held the first
 * WEDNESDAY. Candidates carry the same noon time as inputs so same-day
 * comparisons never skip a month.
 */
export function firstAllowedSaleDayOnOrAfter(d: Date): Date {
  let y = d.getFullYear();
  let m = d.getMonth();
  for (let i = 0; i < 24; i++) {
    let x = new Date(y, m, 1, 12);
    while (x.getDay() !== 2) x = addDays(x, 1);
    if ((x.getMonth() === 0 && x.getDate() === 1) || (x.getMonth() === 6 && x.getDate() === 4)) {
      x = addDays(x, 1);
    }
    if (x.getTime() >= d.getTime()) return x;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return d;
}

/** Reg X planning marker: 38 days before a sale date (12 CFR §1024.41 —
 * a complete loss-mitigation application received more than 37 days before
 * a scheduled sale may trigger federal review protections). */
export const regXMarker = (saleDate: Date): Date => addDays(saleDate, -38);

/** Chain computed from a notice of default. Every downstream date here is a
 * statutory MINIMUM — projected, not scheduled. An actual sale requires its
 * own notice stating its own date. */
export interface DefaultNoticeChain {
  /** The notice date, at noon. */
  notice: Date;
  /** Last day to cure. §51.002(d): the day the notice is given counts as
   * day one of the 20-day cure period — so the last cure day is notice + 19. */
  cureEnd: Date;
  /** Earliest day a notice of sale could be filed, posted and mailed:
   * notice + 20, the day after the cure window closes. */
  earliestSaleNotice: Date;
  /** EARLIEST POSSIBLE sale under statutory minimums: the first allowed sale
   * day on or after earliestSaleNotice + 21 (§51.002(a)-(b), (a-1)). */
  projectedSale: Date;
  /** Reg X marker relative to the projected minimum sale. */
  regX: Date;
}

export function defaultNoticeChain(noticeIso: string): DefaultNoticeChain {
  const notice = atNoon(noticeIso);
  const cureEnd = addDays(notice, 19);
  const earliestSaleNotice = addDays(notice, 20);
  const projectedSale = firstAllowedSaleDayOnOrAfter(addDays(earliestSaleNotice, 21));
  return { notice, cureEnd, earliestSaleNotice, projectedSale, regX: regXMarker(projectedSale) };
}

/** Chain computed from a notice of trustee sale. The printed sale date is
 * honored VERBATIM — the tool never recomputes or invents a sale date. */
export interface SaleNoticeChain {
  /** Date the notice was filed or mailed, at noon. */
  notice: Date;
  /** The sale date exactly as printed on the notice. */
  sale: Date;
  /** Whole days between filing and the stated sale. */
  gapDays: number;
  /** §51.002(b): the notice must be filed, posted and mailed at least 21
   * days before the sale. Pass at >= 21; anything less is flagged. */
  meetsTwentyOneDayMinimum: boolean;
  /** Reg X marker relative to the printed sale date. */
  regX: Date;
  /** Planning marker: the day before the stated sale. */
  planBy: Date;
}

export function saleNoticeChain(noticeIso: string, printedSaleIso: string): SaleNoticeChain {
  const notice = atNoon(noticeIso);
  const sale = atNoon(printedSaleIso);
  const gapDays = daysBetween(notice, sale);
  return {
    notice,
    sale,
    gapDays,
    meetsTwentyOneDayMinimum: gapDays >= 21,
    regX: regXMarker(sale),
    planBy: addDays(sale, -1),
  };
}

/** Tax-sale redemption under Tax Code §34.21. The clock runs from the date
 * the buyer's DEED WAS RECORDED — not the sale date. */
export interface TaxRedemption {
  /** Deed-recording date, at noon. */
  recorded: Date;
  /** Redemption deadline: 2 years (homestead) or 180 days (other property)
   * after recording. */
  deadline: Date;
  /** End of redemption year one (recording + 1 year). The premium on the
   * §34.21 cost basis is 25% through this date, 50% in year two.
   * Only meaningful for homestead redemptions; non-homestead is a flat 25%. */
  yearOneEnd: Date;
  homestead: boolean;
}

export function taxRedemption(deedRecordedIso: string, homestead: boolean): TaxRedemption {
  const recorded = atNoon(deedRecordedIso);
  let deadline: Date;
  if (homestead) {
    deadline = new Date(recorded);
    deadline.setFullYear(deadline.getFullYear() + 2);
  } else {
    deadline = addDays(recorded, 180);
  }
  const yearOneEnd = new Date(recorded);
  yearOneEnd.setFullYear(yearOneEnd.getFullYear() + 1);
  return { recorded, deadline, yearOneEnd, homestead };
}

/** The next `count` allowed auction days starting from `from`'s month. */
export function upcomingAuctionDays(from: Date, count: number): Date[] {
  const out: Date[] = [];
  let d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  for (let i = 0; i < count; i++) {
    const t = firstAllowedSaleDayOnOrAfter(d);
    out.push(t);
    d = new Date(t.getFullYear(), t.getMonth() + 1, 1, 12);
  }
  return out;
}
