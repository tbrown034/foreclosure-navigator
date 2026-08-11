/**
 * Recorded extraction runs — the default, no-API-call path of the AI beat.
 *
 * These are the VERBATIM outputs of live claude-haiku-4-5 calls at
 * temperature 0 against the two sanitized samples (captured from the
 * production endpoint on Aug 10, 2026; temperature 0 makes the output
 * reproducible). Replaying them costs nothing and hits no quota — and the
 * page stays honest about it: the replay is labeled a recorded run, and
 * the 19 deterministic checks are RE-RUN in the visitor's browser against
 * this output at view time, using the same lib/extraction-checks.ts code
 * the server runs. The one choice the page offers is replay vs. calling
 * the live API.
 */

import type { ExtractedNotice } from "./extraction-checks.js";

export interface RecordedExtraction {
  sampleId: string;
  /** Verbatim model output from the recorded run. */
  extracted: ExtractedNotice;
  model: string;
  /** Latency of the recorded run, in ms. */
  ms: number;
  capturedOn: string;
}

export const RECORDED_EXTRACTIONS: readonly RecordedExtraction[] = [
  {
    sampleId: "frcl-2026-2290",
    model: "claude-haiku-4-5",
    ms: 2535,
    capturedOn: "Aug 10, 2026",
    extracted: {
      notice_type: "Notice of Substitute Trustee's Sale",
      sale_date: "2026-09-01",
      sale_time_window: "11:00 a.m. or not later than three (3) hours after that time",
      sale_location: "Bayou City Event Center, Magnolia Ballroom, 9401 Knight Road, Houston, Texas",
      county: "Harris",
      trustee_or_substitute: "AUCTION.COM, LLC",
      deed_of_trust_date: null,
      lender_or_mortgagee: null,
      servicer_if_stated: "LAKEVIEW LOAN SERVICING, LLC",
      confidence: { sale_date: 0.95, trustee_or_substitute: 0.95, lender_or_mortgagee: 0 },
    },
  },
  {
    sampleId: "frcl-2026-3493",
    model: "claude-haiku-4-5",
    ms: 1496,
    capturedOn: "Aug 10, 2026",
    extracted: {
      notice_type: "Notice of Substitute Trustee's Sale",
      sale_date: "2026-09-01",
      sale_time_window: "10:00 a.m. to 1:00 p.m.",
      sale_location: "Bayou City Event Center, Magnolia South Ballroom, 9401 Knight Road, Houston, Texas",
      county: "Harris",
      trustee_or_substitute: "AUCTION.COM, LLC and BARRETT DAFFIN FRAPPIER TURNER & ENGEL, LLP",
      deed_of_trust_date: null,
      lender_or_mortgagee: "MIDFIRST BANK",
      servicer_if_stated: "MIDLAND MORTGAGE, A DIVISION OF MIDFIRST BANK",
      confidence: { sale_date: 0.95, trustee_or_substitute: 0.95, lender_or_mortgagee: 0.95 },
    },
  },
];

export function getRecordedExtraction(sampleId: string): RecordedExtraction | undefined {
  return RECORDED_EXTRACTIONS.find((r) => r.sampleId === sampleId);
}
