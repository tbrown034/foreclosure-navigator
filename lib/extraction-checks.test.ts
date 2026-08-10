import { describe, expect, it } from "vitest";
import { validateExtraction, validateFidelity } from "./extraction-checks";
import { SAMPLE_NOTICES } from "./sample-notices";

const CLERK = { fileDate: "2026-04-02", saleDate: "2026-09-01" };

const GOOD = {
  notice_type: "Notice of Substitute Trustee's Sale",
  sale_date: "2026-09-01",
  sale_time_window: "11:00 a.m., no later than 3 hours after",
  sale_location: "Bayou City Event Center, Magnolia Ballroom",
  county: "Harris",
  trustee_or_substitute: "Auction.com, LLC",
  deed_of_trust_date: null,
  lender_or_mortgagee: "Lakeview Loan Servicing, LLC",
  servicer_if_stated: "Lakeview Loan Servicing, LLC",
  confidence: { sale_date: 0.98, trustee_or_substitute: 0.95, lender_or_mortgagee: 0.95 },
};

describe("validateExtraction — deterministic checks after the model", () => {
  it("passes every core check on faithful output (152-day gap for FRCL-2026-2290)", () => {
    const checks = validateExtraction(GOOD, CLERK);
    expect(checks.every((c) => c.pass)).toBe(true);
    expect(checks[2]!.name).toContain("actual: 152 days");
  });

  it("fails the Clerk-metadata check when the model reports a different sale date", () => {
    const checks = validateExtraction({ ...GOOD, sale_date: "2026-09-02" }, CLERK);
    expect(checks[0]!.pass).toBe(false);
    // Sep 2 2026 is a Wednesday, so the first-Tuesday check fails too.
    expect(checks[1]!.pass).toBe(false);
  });

  it("fails when the model output contains a privacy field", () => {
    const checks = validateExtraction({ ...GOOD, property_address: "123 Main St" }, CLERK);
    expect(checks.find((c) => c.name.includes("privacy"))!.pass).toBe(false);
  });

  it("fails the confidence check when confidence is missing", () => {
    const { confidence: _omitted, ...noConfidence } = GOOD;
    const checks = validateExtraction(noConfidence, CLERK);
    expect(checks.find((c) => c.name.includes("confidence"))!.pass).toBe(false);
  });

  it("fails the 21-day check for a file date under the minimum", () => {
    const checks = validateExtraction(GOOD, { fileDate: "2026-08-15", saleDate: "2026-09-01" });
    expect(checks[2]!.pass).toBe(false);
    expect(checks[2]!.name).toContain("actual: 17 days");
  });

  it("handles a null sale_date without throwing (all date checks fail)", () => {
    const checks = validateExtraction({ ...GOOD, sale_date: null }, CLERK);
    expect(checks[0]!.pass).toBe(false);
    expect(checks[1]!.pass).toBe(false);
    expect(checks[2]!.pass).toBe(false);
  });

  it("runs eleven core checks total", () => {
    expect(validateExtraction(GOOD, CLERK)).toHaveLength(11);
  });

  it("fails the presence check when a schema key is missing entirely", () => {
    const { sale_time_window: _omitted, ...missing } = GOOD;
    const checks = validateExtraction(missing, CLERK);
    expect(checks.find((c) => c.name.includes("key is present"))!.pass).toBe(false);
  });

  it("fails the schema-keys check when the model returns an extra field", () => {
    const checks = validateExtraction({ ...GOOD, extra_notes: "surprise" }, CLERK);
    expect(checks.find((c) => c.name.includes("only the schema's keys"))!.pass).toBe(false);
  });

  it("fails the type check when a field is a nested object", () => {
    const checks = validateExtraction({ ...GOOD, sale_location: { venue: "x" } }, CLERK);
    expect(checks.find((c) => c.name.includes("string or null"))!.pass).toBe(false);
  });

  it("fails when confidence values fall outside 0-1", () => {
    const checks = validateExtraction({ ...GOOD, confidence: { sale_date: 1.7 } }, CLERK);
    expect(checks.find((c) => c.name.includes("0–1"))!.pass).toBe(false);
  });

  it("flags an address-shaped value smuggled into a non-address field", () => {
    const checks = validateExtraction({ ...GOOD, sale_location: "123 Maple Street, Houston" }, CLERK);
    expect(checks.find((c) => c.name.includes("address-shaped"))!.pass).toBe(false);
  });

  it("allows the public auction venue's address in sale_location", () => {
    const checks = validateExtraction(
      { ...GOOD, sale_location: "Bayou City Event Center, 9401 Knight Road, Houston" },
      CLERK,
    );
    expect(checks.find((c) => c.name.includes("address-shaped"))!.pass).toBe(true);
  });

  it("rejects the venue address when it appears OUTSIDE sale_location", () => {
    const checks = validateExtraction({ ...GOOD, trustee_or_substitute: "9401 Knight Road" }, CLERK);
    expect(checks.find((c) => c.name.includes("address-shaped"))!.pass).toBe(false);
  });

  it("rejects sale_location carrying a second, non-venue address alongside the venue", () => {
    const checks = validateExtraction(
      { ...GOOD, sale_location: "9401 Knight Road, near 123 Maple Street" },
      CLERK,
    );
    expect(checks.find((c) => c.name.includes("address-shaped"))!.pass).toBe(false);
  });
});

describe("validateFidelity — field-exact ground truth for the fixed samples", () => {
  const A = SAMPLE_NOTICES[0]!;
  const B = SAMPLE_NOTICES[1]!;

  // What the live pilot actually extracted for sample A — the mortgagee
  // lines and deed date are [REMOVED] in the document, so both are null.
  const FAITHFUL_A = {
    notice_type: "Notice of Substitute Trustee's Sale",
    sale_time_window: "11:00 a.m. or not later than three (3) hours after that time",
    sale_location: "Bayou City Event Center, Magnolia Ballroom, 9401 Knight Road, Houston, Texas",
    county: "Harris",
    trustee_or_substitute: "AUCTION.COM, LLC",
    deed_of_trust_date: null,
    lender_or_mortgagee: null,
    servicer_if_stated: "LAKEVIEW LOAN SERVICING, LLC",
  };

  it("passes a faithful sample-A extraction (eight field checks)", () => {
    const checks = validateFidelity(FAITHFUL_A, A.expected);
    expect(checks).toHaveLength(8);
    expect(checks.every((c) => c.pass)).toBe(true);
  });

  it("rejects an invented co-trustee even when the real one is present", () => {
    const checks = validateFidelity(
      { ...FAITHFUL_A, trustee_or_substitute: "Auction.com, LLC and Invented Trustee Partners" },
      A.expected,
    );
    expect(checks.find((c) => c.name.includes("trustee"))!.pass).toBe(false);
  });

  it("rejects field-swapping: the servicer promoted into the trustee field fails", () => {
    // Every word here exists in the document — but not in the trustee
    // field's own vocabulary. This is the round-4 bypass, closed.
    const checks = validateFidelity(
      { ...FAITHFUL_A, trustee_or_substitute: "AUCTION.COM, LLC and LAKEVIEW LOAN SERVICING, LLC" },
      A.expected,
    );
    expect(checks.find((c) => c.name.includes("trustee"))!.pass).toBe(false);
  });

  it("rejects an invented deed-of-trust date — the sample removes it, so it must be null", () => {
    const checks = validateFidelity({ ...FAITHFUL_A, deed_of_trust_date: "1999-01-01" }, A.expected);
    expect(checks.find((c) => c.name.includes("deed-of-trust"))!.pass).toBe(false);
  });

  it("rejects an invented bank appended to the real servicer", () => {
    const checks = validateFidelity({ ...FAITHFUL_A, servicer_if_stated: "Lakeview and Invented Bank" }, A.expected);
    expect(checks.find((c) => c.name.includes("servicer"))!.pass).toBe(false);
  });

  it("sample A requires lender to be null (the document's mortgagee is removed)", () => {
    const checks = validateFidelity({ ...FAITHFUL_A, lender_or_mortgagee: "Lakeview Loan Servicing" }, A.expected);
    expect(checks.find((c) => c.name.includes("lender"))!.pass).toBe(false);
  });

  it("a null servicer fails — the document names one", () => {
    const checks = validateFidelity({ ...FAITHFUL_A, servicer_if_stated: null }, A.expected);
    expect(checks.find((c) => c.name.includes("servicer"))!.pass).toBe(false);
  });

  it("fails when the stated time drifts (sample A says 11:00 a.m., not 10)", () => {
    const checks = validateFidelity({ ...FAITHFUL_A, sale_time_window: "10:00 AM" }, A.expected);
    expect(checks.find((c) => c.name.includes("start time"))!.pass).toBe(false);
  });

  it("rejects an invented digit run even when every word is allowed ('999 hours')", () => {
    const checks = validateFidelity(
      { ...FAITHFUL_A, sale_time_window: "11:00 a.m. or not later than 999 hours after that time" },
      A.expected,
    );
    expect(checks.find((c) => c.name.includes("start time"))!.pass).toBe(false);
  });

  it("rejects a wrong hours-count built from allowed digits ('2 hours', the round-6 bypass)", () => {
    const checks = validateFidelity(
      { ...FAITHFUL_A, sale_time_window: "11:00 a.m. or not later than 2 hours after that time" },
      A.expected,
    );
    expect(checks.find((c) => c.name.includes("start time"))!.pass).toBe(false);
  });

  it("rejects composed durations built from allowed digits ('2-3 hours', '2.3 hours')", () => {
    for (const window of [
      "11:00 a.m. or not later than 2-3 hours after that time",
      "11:00 a.m. or not later than 2.3 hours after that time",
    ]) {
      const checks = validateFidelity({ ...FAITHFUL_A, sale_time_window: window }, A.expected);
      expect(checks.find((c) => c.name.includes("start time"))!.pass).toBe(false);
    }
  });

  it("rejects 'MIDLAND MORTGAGE BANK' — not an approved complete value for sample B's servicer", () => {
    const checks = validateFidelity({ servicer_if_stated: "MIDLAND MORTGAGE BANK" }, B.expected);
    expect(checks.find((c) => c.name.includes("servicer"))!.pass).toBe(false);
  });

  it("rejects a wrong written hours-count ('two hours')", () => {
    const checks = validateFidelity(
      { ...FAITHFUL_A, sale_time_window: "11:00 a.m. or not later than two hours after that time" },
      A.expected,
    );
    expect(checks.find((c) => c.name.includes("start time"))!.pass).toBe(false);
  });

  it("sample B rejects a location omitting 'South' from Magnolia South Ballroom", () => {
    const checks = validateFidelity(
      { sale_location: "Bayou City Event Center, Magnolia Ballroom, 9401 Knight Road, Houston, Texas" },
      B.expected,
    );
    expect(checks.find((c) => c.name.includes("venue"))!.pass).toBe(false);
  });

  it("sample B rejects a truncated trustee firm name", () => {
    const checks = validateFidelity(
      { trustee_or_substitute: "AUCTION.COM, LLC and BARRETT DAFFIN" },
      B.expected,
    );
    expect(checks.find((c) => c.name.includes("trustee"))!.pass).toBe(false);
  });

  it("sample B rejects 'MIDLAND BANK' as servicer — the document says Midland Mortgage", () => {
    const checks = validateFidelity({ servicer_if_stated: "MIDLAND BANK" }, B.expected);
    expect(checks.find((c) => c.name.includes("servicer"))!.pass).toBe(false);
  });

  it("sample B requires BOTH trustees — Auction.com alone fails; the full faithful set passes", () => {
    const one = validateFidelity({ trustee_or_substitute: "Auction.com, LLC" }, B.expected);
    expect(one.find((c) => c.name.includes("trustee"))!.pass).toBe(false);
    const both = validateFidelity(
      {
        notice_type: "Notice of Substitute Trustee's Sale",
        sale_time_window: "no earlier than 10:00 a.m. and no later than three (3) hours after that time",
        sale_location: "Bayou City Event Center, Magnolia South Ballroom, 9401 Knight Road, Houston, Texas",
        county: "Harris",
        trustee_or_substitute: "AUCTION.COM, LLC, and BARRETT DAFFIN FRAPPIER TURNER & ENGEL, LLP",
        deed_of_trust_date: null,
        lender_or_mortgagee: "MIDFIRST BANK",
        servicer_if_stated: "MIDLAND MORTGAGE, A DIVISION OF MIDFIRST BANK",
      },
      B.expected,
    );
    expect(both.every((c) => c.pass)).toBe(true);
  });
});

describe("allowed-sale-day check accepts the statutory Wednesday exception", () => {
  it("passes Wed Jul 5 2028 (first Tuesday is July 4) and fails Jul 4 itself", () => {
    const clerk = { fileDate: "2028-05-01", saleDate: "2028-07-05" };
    const wed = validateExtraction({ ...GOOD, sale_date: "2028-07-05" }, clerk);
    expect(wed.find((c) => c.name.includes("allowed sale day"))!.pass).toBe(true);
    const tue4 = validateExtraction({ ...GOOD, sale_date: "2028-07-04" }, { ...clerk, saleDate: "2028-07-04" });
    expect(tue4.find((c) => c.name.includes("allowed sale day"))!.pass).toBe(false);
  });
});

describe("confidence must be the exact three-key object", () => {
  it("fails when only sale_date confidence is present", () => {
    const checks = validateExtraction({ ...GOOD, confidence: { sale_date: 0.95 } }, CLERK);
    expect(checks.find((c) => c.name.includes("three required keys"))!.pass).toBe(false);
  });
});
