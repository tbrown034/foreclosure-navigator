import { describe, expect, it } from "vitest";
import {
  addDays,
  atNoon,
  daysBetween,
  defaultNoticeChain,
  firstAllowedSaleDayOnOrAfter,
  isAllowedSaleDay,
  regXMarker,
  saleNoticeChain,
  taxRedemption,
  upcomingAuctionDays,
} from "./deadlines";

/** Compact local-date literal for assertions: "2026-08-04". */
const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("cure period — §51.002(d), notice day counts as day one", () => {
  it("default notice 2026-06-24: last cure day is Jul 13 2026 (notice + 19)", () => {
    const chain = defaultNoticeChain("2026-06-24");
    expect(iso(chain.cureEnd)).toBe("2026-07-13");
  });

  it("earliest sale-notice day is notice + 20, the day after cure closes", () => {
    const chain = defaultNoticeChain("2026-06-24");
    expect(iso(chain.earliestSaleNotice)).toBe("2026-07-14");
    expect(daysBetween(chain.cureEnd, chain.earliestSaleNotice)).toBe(1);
  });
});

describe("projected earliest sale — first-Tuesday rule with 21-day minimum", () => {
  it("default notice 2026-06-24 projects to Tue Aug 4 2026", () => {
    const chain = defaultNoticeChain("2026-06-24");
    const sale = chain.projectedSale;
    expect(iso(sale)).toBe("2026-08-04");
    expect(sale.getDay()).toBe(2);
  });

  it("threshold landing EXACTLY on a first Tuesday keeps that Tuesday (noon normalization)", () => {
    // 2026-06-24 + 20 + 21 = Aug 4 2026, which IS the first Tuesday of August.
    // Midnight-vs-noon skew here would wrongly skip to September.
    const threshold = addDays(defaultNoticeChain("2026-06-24").earliestSaleNotice, 21);
    expect(iso(threshold)).toBe("2026-08-04");
    expect(iso(firstAllowedSaleDayOnOrAfter(threshold))).toBe("2026-08-04");
  });

  it("default notice 2026-07-23 projects to Tue Oct 6 2026 (misses Sep 1 by one day)", () => {
    // Threshold = Jul 23 + 41 = Sep 2, one day past September's first Tuesday.
    const chain = defaultNoticeChain("2026-07-23");
    expect(iso(chain.projectedSale)).toBe("2026-10-06");
    expect(chain.projectedSale.getDay()).toBe(2);
  });
});

describe("§51.002(a-1) — first-Wednesday exception for Jan 1 and Jul 4", () => {
  it("July 2028: first Tuesday is Jul 4, so the allowed day is Wed Jul 5 2028", () => {
    expect(iso(firstAllowedSaleDayOnOrAfter(atNoon("2028-07-01")))).toBe("2028-07-05");
    expect(firstAllowedSaleDayOnOrAfter(atNoon("2028-07-01")).getDay()).toBe(3);
  });

  it("a default-notice chain that crosses Jul 4 2028 projects to Wed Jul 5 2028", () => {
    // 2028-05-20 + 41 = Jun 30 2028, past June's first Tuesday (Jun 6).
    const chain = defaultNoticeChain("2028-05-20");
    expect(iso(chain.projectedSale)).toBe("2028-07-05");
  });

  it("January 2030: first Tuesday is Jan 1, so the allowed day is Wed Jan 2 2030", () => {
    expect(iso(firstAllowedSaleDayOnOrAfter(atNoon("2029-12-06")))).toBe("2030-01-02");
  });
});

describe("notice of sale — printed date honored verbatim, 21-day check in code", () => {
  it("keeps the printed sale date exactly, even when it is not a first Tuesday", () => {
    // Sep 4 2026 is a Friday — a real notice's printed date is never recomputed.
    const chain = saleNoticeChain("2026-08-01", "2026-09-04");
    expect(iso(chain.sale)).toBe("2026-09-04");
  });

  it("passes at exactly 21 days (>= 21 is the statutory floor)", () => {
    const chain = saleNoticeChain("2026-08-11", "2026-09-01");
    expect(chain.gapDays).toBe(21);
    expect(chain.meetsTwentyOneDayMinimum).toBe(true);
  });

  it("flags a 20-day gap as short of the minimum", () => {
    const chain = saleNoticeChain("2026-08-12", "2026-09-01");
    expect(chain.gapDays).toBe(20);
    expect(chain.meetsTwentyOneDayMinimum).toBe(false);
  });

  it("sets the planning marker to the day before the stated sale", () => {
    expect(iso(saleNoticeChain("2026-08-01", "2026-09-01").planBy)).toBe("2026-08-31");
  });
});

describe("Reg X marker — 38 days before the sale (12 CFR §1024.41)", () => {
  it("computes sale minus 38 for a printed sale date", () => {
    expect(iso(saleNoticeChain("2026-07-01", "2026-09-01").regX)).toBe("2026-07-25");
    expect(iso(regXMarker(atNoon("2026-09-01")))).toBe("2026-07-25");
  });

  it("the default-notice chain carries NO Reg X date — no sale is scheduled to anchor one", () => {
    const chain = defaultNoticeChain("2026-06-24");
    expect("regX" in chain).toBe(false);
  });

  it("default-chain dates are chronological (the rule row is undated by design)", () => {
    const c = defaultNoticeChain("2026-06-24");
    const times = [c.notice, c.cureEnd, c.earliestSaleNotice, c.projectedSale].map((d) => d.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("tax redemption — Tax Code §34.21, clock runs from DEED RECORDING", () => {
  it("homestead: two years after recording", () => {
    const r = taxRedemption("2026-07-10", true);
    expect(iso(r.deadline)).toBe("2028-07-10");
  });

  it("non-homestead: 180 days after recording", () => {
    const r = taxRedemption("2026-07-10", false);
    expect(iso(r.deadline)).toBe("2027-01-06");
  });

  it("year-one boundary for the 25%-then-50% premium is recording + 1 year", () => {
    expect(iso(taxRedemption("2026-07-10", true).yearOneEnd)).toBe("2027-07-10");
  });
});

describe("isAllowedSaleDay — checking a printed date, never replacing it", () => {
  it("accepts a first Tuesday", () => {
    expect(isAllowedSaleDay(atNoon("2026-09-01"))).toBe(true);
  });

  it("rejects the day after a first Tuesday and a second Tuesday", () => {
    expect(isAllowedSaleDay(atNoon("2026-09-02"))).toBe(false);
    expect(isAllowedSaleDay(atNoon("2026-09-08"))).toBe(false);
  });

  it("accepts the Jul 4 exception Wednesday and rejects Jul 4 itself", () => {
    expect(isAllowedSaleDay(atNoon("2028-07-05"))).toBe(true);
    expect(isAllowedSaleDay(atNoon("2028-07-04"))).toBe(false);
  });
});

describe("auction calendar", () => {
  it("lists the next allowed sale days, honoring the first-Wednesday exception", () => {
    const days = upcomingAuctionDays(atNoon("2028-06-10"), 3);
    expect(days.map(iso)).toEqual(["2028-07-05", "2028-08-01", "2028-09-05"]);
  });

  it("includes the current month's first Tuesday when it has not passed yet", () => {
    const days = upcomingAuctionDays(atNoon("2026-08-01"), 2);
    expect(days.map(iso)).toEqual(["2026-08-04", "2026-09-01"]);
  });
});
