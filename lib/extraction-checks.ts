/**
 * Deterministic validation of model extraction output — the model is never
 * the safety net. Ported from the Aug 10 real-document pilot
 * (extract-test.mjs) so the live demo runs the same checks the pilot ran.
 */

import { atNoon, daysBetween, isAllowedSaleDay } from "./deadlines.js";

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
  confidence: Record<string, number>;
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
    name: "sale date is an allowed sale day (first Tuesday, or Wednesday when that Tuesday is Jan 1 / Jul 4)",
    pass: sale !== null && isAllowedSaleDay(sale),
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

  const CONFIDENCE_KEYS = ["sale_date", "trustee_or_substitute", "lender_or_mortgagee"];
  checks.push({
    name: "confidence has exactly the three required keys, each a number within 0–1",
    pass:
      conf !== undefined &&
      conf !== null &&
      typeof conf === "object" &&
      Object.keys(conf).sort().join(",") === [...CONFIDENCE_KEYS].sort().join(",") &&
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

/** What one extracted text field must look like for a fixed sample: the
 * normalized value (lowercased, whitespace collapsed, trailing period
 * stripped) must match one of a small set of APPROVED COMPLETE-VALUE
 * variants — whole-field comparison, no token allowlists. Possible only
 * because the samples are fixed and extraction runs at temperature 0;
 * anything the variants don't recognize fails closed to human review. */
export interface FieldExpectation {
  variants: RegExp[];
}

/** Ground truth for a fixed sample, field by field. null means the
 * document does not carry the value (it was removed in sanitization), so
 * the extracted field must be null. */
export interface SampleExpectation {
  notice_type: FieldExpectation;
  sale_time_window: FieldExpectation;
  sale_location: FieldExpectation;
  county: FieldExpectation;
  trustee_or_substitute: FieldExpectation;
  deed_of_trust_date: null;
  lender_or_mortgagee: FieldExpectation | null;
  servicer_if_stated: FieldExpectation;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");
}

function fieldFaithful(value: unknown, exp: FieldExpectation): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  const norm = normalize(value);
  return exp.variants.some((re) => re.test(norm));
}

/** Field-exact fidelity checks against a fixed sample's known ground
 * truth: every text field must match an approved complete value, and
 * fields the sample redacts must come back null. */
export function validateFidelity(data: Record<string, unknown>, expected: SampleExpectation): Check[] {
  const nullOk = (k: string): boolean => data[k] === null || data[k] === undefined;
  return [
    {
      name: "notice type is the document's own title",
      pass: fieldFaithful(data["notice_type"], expected.notice_type),
    },
    {
      name: "sale window states the document's start time, in the document's words",
      pass: fieldFaithful(data["sale_time_window"], expected.sale_time_window),
    },
    {
      name: "sale location is the document's stated venue, nothing else",
      pass: fieldFaithful(data["sale_location"], expected.sale_location),
    },
    {
      name: "county is the document's stated county",
      pass: fieldFaithful(data["county"], expected.county),
    },
    {
      name: "trustee field names every appointed trustee and only them",
      pass: fieldFaithful(data["trustee_or_substitute"], expected.trustee_or_substitute),
    },
    {
      name: "deed-of-trust date is null — the sample removes it",
      pass: expected.deed_of_trust_date === null && nullOk("deed_of_trust_date"),
    },
    {
      name: expected.lender_or_mortgagee
        ? "lender/mortgagee is the document's named party and only them"
        : "lender/mortgagee is null — the document does not name one",
      pass: expected.lender_or_mortgagee
        ? fieldFaithful(data["lender_or_mortgagee"], expected.lender_or_mortgagee)
        : nullOk("lender_or_mortgagee"),
    },
    {
      name: "servicer is the document's named servicer and only them",
      pass: fieldFaithful(data["servicer_if_stated"], expected.servicer_if_stated),
    },
  ];
}
