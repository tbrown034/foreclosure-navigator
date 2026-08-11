/**
 * File-number grammar and the fictional-sample table — shared by the
 * browser lookup and the server's upload cross-check, so both sides parse
 * a file number exactly the same way.
 */

/** Accepts exactly "FRCL-2026-1234", "2026-1234" or "1234" (any casing,
 * surrounding whitespace ok). Anything else — wrong years, extra digits,
 * embedded text — is rejected rather than guessed, so a typo can never
 * surface the wrong case's deadlines. */
export function normalizeDocId(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = cleaned.match(/^(?:FRCL-?)?(?:2026-?)?(\d{1,4})$/);
  if (!m) return null;
  return `FRCL-2026-${Number(m[1])}`;
}

/** The two fictional sample notices bundled with the site (John Smith,
 * 123 Sample Street — no real person, property, loan or filing). Their
 * unmistakably fictional file numbers can never collide with the Clerk's
 * FRCL-2026-#### series, and their dates live HERE, in code — an uploaded
 * sample verifies against this table exactly the way a real notice
 * verifies against the county index. */
export interface SampleDoc {
  docId: string;
  fileDate: string;
  saleDate: string;
  label: string;
}

export const SAMPLE_DOCS: Record<string, SampleDoc> = {
  "SAMPLE-2026-A": {
    docId: "SAMPLE-2026-A",
    fileDate: "2026-08-04",
    saleDate: "2026-10-06",
    label: "fictional sample A — sale weeks out",
  },
  "SAMPLE-2026-B": {
    docId: "SAMPLE-2026-B",
    fileDate: "2026-08-05",
    saleDate: "2026-09-01",
    label: "fictional sample B — sale close",
  },
};

/** Parse a sample file number ("SAMPLE-2026-A", "sample 2026 b", …). */
export function normalizeSampleId(raw: string): string | null {
  const m = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .match(/^SAMPLE-?2026-?([AB])$/);
  return m ? `SAMPLE-2026-${m[1]}` : null;
}
