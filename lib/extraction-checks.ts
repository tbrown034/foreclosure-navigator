/**
 * Deterministic validation of model extraction output — the model is never
 * the safety net. Ported from the Aug 10 real-document pilot
 * (extract-test.mjs) so the live demo runs the same checks the pilot ran.
 */

import { atNoon, daysBetween } from "./deadlines.js";

/** The fixed extraction schema. Privacy fields (borrower name, property
 * address, legal description) are deliberately absent. */
export interface ExtractedNotice {
  notice_type: string | null;
  sale_date: string | null;
  sale_time_window: string | null;
  sale_location: string | null;
  county: string | null;
  trustee_or_substitute: string | null;
  deed_of_trust_date: string | null;
  lender_or_mortgagee: string | null;
  servicer_if_stated: string | null;
  confidence?: Record<string, number>;
}

export interface Check {
  name: string;
  pass: boolean;
}

const PRIVACY_FIELDS = ["borrower", "homeowner_name", "property_address", "legal_description"];

export function validateExtraction(
  data: Record<string, unknown>,
  clerk: { fileDate: string; saleDate: string },
): Check[] {
  const checks: Check[] = [];
  const saleDate = typeof data.sale_date === "string" ? data.sale_date : "";

  checks.push({
    name: `sale date matches Clerk metadata (${clerk.saleDate})`,
    pass: saleDate === clerk.saleDate,
  });

  const sale = saleDate ? atNoon(saleDate) : null;
  checks.push({
    name: "sale date is a Tuesday (first-Tuesday rule)",
    pass: sale !== null && sale.getDay() === 2,
  });

  const gap = sale ? daysBetween(atNoon(clerk.fileDate), sale) : null;
  checks.push({
    name: `filed at least 21 days before sale (actual: ${gap ?? "n/a"} days)`,
    pass: gap !== null && gap >= 21,
  });

  checks.push({
    name: "county is Harris",
    pass: typeof data.county === "string" && /harris/i.test(data.county),
  });

  checks.push({
    name: "no privacy fields present in output",
    pass: PRIVACY_FIELDS.every((k) => !(k in data)),
  });

  const conf = data.confidence as Record<string, unknown> | undefined;
  checks.push({
    name: "confidence present for key fields",
    pass: conf !== undefined && conf !== null && typeof conf["sale_date"] === "number",
  });

  return checks;
}
