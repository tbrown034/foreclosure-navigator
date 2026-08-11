import { describe, expect, it } from "vitest";
import { stageAssessment } from "./stage";

// The demo case's real dates: filed Apr 2 for the Sep 1 sale.
const SALE = "2026-09-01";
const FILED = "2026-04-02";

describe("sale-notice stage", () => {
  it("counts days to the printed sale date", () => {
    const s = stageAssessment("sale", FILED, SALE, "2026-08-11");
    expect(s).not.toBeNull();
    expect(s!.headline).toContain("21 days until the printed sale date");
    expect(s!.salePassed).toBe(false);
  });

  it("sale day itself says today, not passed", () => {
    const s = stageAssessment("sale", FILED, SALE, "2026-09-01")!;
    expect(s.headline).toContain("today");
    expect(s.salePassed).toBe(false);
  });

  it("day after the sale flips to passed, with the honest can't-tell line", () => {
    const s = stageAssessment("sale", FILED, SALE, "2026-09-02")!;
    expect(s.salePassed).toBe(true);
    expect(s.headline).toContain("has passed");
    expect(s.lines.join(" ")).toContain("cannot tell whether the sale occurred");
  });

  it("Reg X marker day itself still counts as open (more-than-37-days boundary)", () => {
    // Sep 1 sale → marker Jul 25 (38 days before).
    const s = stageAssessment("sale", FILED, SALE, "2026-07-25")!;
    expect(s.lines[0]).toContain("that is today");
  });

  it("after the marker: passed wording never says applying is impossible", () => {
    const s = stageAssessment("sale", FILED, SALE, "2026-08-11")!;
    const line = s.lines[0];
    expect(line).toContain("has passed");
    expect(line).toContain("does not by itself mean");
    const lm = s.recourses.find((r) => r.id === "loss-mitigation")!;
    expect(lm.tier).toBe("passed-marker");
    expect(lm.note).not.toMatch(/unavailable|too late|cannot apply/i);
  });

  it("before the marker: loss mitigation is an open window with the marker date", () => {
    const s = stageAssessment("sale", "2026-08-05", "2026-10-06", "2026-08-11")!;
    const lm = s.recourses.find((r) => r.id === "loss-mitigation")!;
    expect(lm.tier).toBe("open");
    expect(lm.label).toContain("Aug 29"); // Oct 6 − 38 days
  });

  it("within 14 days the tight-timeline tiers kick in", () => {
    const s = stageAssessment("sale", FILED, SALE, "2026-08-25")!;
    expect(s.recourses.find((r) => r.id === "reinstate")!.tier).toBe("act-now");
    expect(s.recourses.find((r) => r.id === "sell")!.label).toContain("Tight");
  });

  it("all six recourses always present, act-now first; reinstatement never inferred unavailable", () => {
    for (const today of ["2026-07-01", "2026-08-11", "2026-09-02"]) {
      const s = stageAssessment("sale", FILED, SALE, today)!;
      expect(s.recourses).toHaveLength(6);
      expect(s.recourses[0]!.tier).toBe("act-now");
      const re = s.recourses.find((r) => r.id === "reinstate")!;
      expect(re.note + re.label).not.toMatch(/unavailable|no longer possible/i);
    }
  });

  it("short 21-day gap surfaces the discrepancy line", () => {
    const s = stageAssessment("sale", "2026-08-20", SALE, "2026-08-21")!;
    expect(s.lines.join(" ")).toContain("short of the 21-day statutory minimum");
  });
});

describe("default-notice stage", () => {
  it("notice day is day one of the cure window", () => {
    const s = stageAssessment("default", "2026-08-11", null, "2026-08-11")!;
    expect(s.headline).toContain("day 1 of the 20-day cure window");
  });

  it("day 20 is still open; day 21 shows the minimum ended, hedged", () => {
    const open = stageAssessment("default", "2026-08-01", null, "2026-08-20")!;
    expect(open.headline).toContain("day 20 of the 20-day cure window");
    const done = stageAssessment("default", "2026-08-01", null, "2026-08-21")!;
    expect(done.headline).toContain("statutory minimum ended Aug 20");
    expect(done.lines.join(" ")).toContain("may allow more time");
    expect(done.headline).not.toMatch(/closed/i);
  });

  it("cure open: strongest-protections framing for loss mitigation, no sale invented", () => {
    const s = stageAssessment("default", "2026-08-09", null, "2026-08-11")!;
    expect(s.lines.join(" ")).toContain("No sale is scheduled at this stage");
    expect(s.recourses.find((r) => r.id === "loss-mitigation")!.label).toContain("Strongest");
    expect(s.salePassed).toBe(false);
  });

  it("future notice date is handled without a fake day count", () => {
    const s = stageAssessment("default", "2026-09-01", null, "2026-08-11")!;
    expect(s.headline).toContain("in the future");
  });
});

describe("guard rails", () => {
  it("sale kind without a printed date yields null — never a guessed stage", () => {
    expect(stageAssessment("sale", FILED, null, "2026-08-11")).toBeNull();
  });
});
