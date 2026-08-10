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

/** The schema's exact key set. Anything extra is rejected — privacy by
 * structure, not just by prompt. */
const SCHEMA_KEYS = [
  "notice_type",
  "sale_date",
  "sale_time_window",
  "sale_location",
  "county",
  "trustee_or_substitute",
  "deed_of_trust_date",
  "lender_or_mortgagee",
  "servicer_if_stated",
  "confidence",
] as const;

/** Street-address shapes that should never appear in any output value —
 * the schema has no address field, so this catches leakage through OTHER
 * fields (e.g. an address smuggled into sale_location). */
const ADDRESS_LIKE =
  /\b\d+\s+\w+(\s+\w+)?\s+(street|st|road|rd|lane|ln|drive|dr|avenue|ave|court|ct|circle|cir|boulevard|blvd|way|trail|trl|place|pl)\b/gi;

/** The one address the output may legitimately contain: the public auction
 * venue — and only in sale_location. Every address-shaped match must be
 * the venue; a value carrying the venue PLUS another address still fails. */
const PUBLIC_VENUE = /9401\s+knight/i;

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

  // Strict schema validation — structure, not just content.
  const keys = Object.keys(data);
  checks.push({
    name: "output contains only the schema's keys (no extra fields)",
    pass: keys.every((k) => (SCHEMA_KEYS as readonly string[]).includes(k)),
  });

  checks.push({
    name: "every schema key is present in the output",
    pass: SCHEMA_KEYS.every((k) => k in data),
  });

  checks.push({
    name: "every field is a string or null (no nested surprises)",
    pass: SCHEMA_KEYS.filter((k) => k !== "confidence").every((k) => {
      const v = data[k];
      return v === null || v === undefined || typeof v === "string";
    }),
  });

  checks.push({
    name: "confidence values are numbers within 0–1",
    pass:
      conf !== undefined &&
      conf !== null &&
      typeof conf === "object" &&
      Object.values(conf).every((v) => typeof v === "number" && v >= 0 && v <= 1),
  });

  checks.push({
    name: "no address-shaped value outside the public auction venue",
    pass: Object.entries(data).every(([k, v]) => {
      if (k === "confidence" || typeof v !== "string") return true;
      const matches = v.match(ADDRESS_LIKE) ?? [];
      if (matches.length === 0) return true;
      // Only sale_location may carry an address, and every address-shaped
      // match in it must be the public venue.
      return k === "sale_location" && matches.every((m) => PUBLIC_VENUE.test(m));
    }),
  });

  return checks;
}

/** Fidelity checks against a fixed sample's known ground truth. Only
 * possible because the demo's documents are fixed — a faithful extraction
 * must contain these values. */
export function validateFidelity(
  data: Record<string, unknown>,
  expected: { trustee: RegExp; party: RegExp; time: RegExp },
): Check[] {
  const str = (k: string): string => (typeof data[k] === "string" ? (data[k] as string) : "");
  return [
    {
      name: "extracted trustee matches the document's named trustee",
      pass: expected.trustee.test(str("trustee_or_substitute")),
    },
    {
      name: "extracted lender/servicer matches the document's named party",
      pass: expected.party.test(str("lender_or_mortgagee") + " " + str("servicer_if_stated")),
    },
    {
      name: "extracted sale window states the document's start time",
      pass: expected.time.test(str("sale_time_window")),
    },
  ];
}
