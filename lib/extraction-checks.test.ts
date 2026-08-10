import { describe, expect, it } from "vitest";
import { validateExtraction } from "./extraction-checks";

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
  it("passes all ten checks on faithful output (152-day gap for FRCL-2026-2290)", () => {
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

  it("runs ten checks total", () => {
    expect(validateExtraction(GOOD, CLERK)).toHaveLength(10);
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
});
