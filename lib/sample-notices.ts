/**
 * The two sample documents for the live extraction demo.
 *
 * These are SANITIZED SAMPLES, not the recorded instruments. Each one is
 * built from the public facts of a real recorded notice (instrument number,
 * Clerk file date, printed sale date, sale window, location, trustee and
 * servicer — all already public in the Clerk's foreclosure search and in
 * this repo's exhibit) wrapped in the standard Texas §51.002 notice
 * boilerplate. The homeowner's name, property address and legal description
 * are replaced with [REMOVED] markers, which is also why the extraction
 * schema deliberately has no fields for them.
 *
 * This module is the single source of truth: the API sends exactly this
 * text to the model, and the page shows exactly this text to the reader.
 */

export interface SampleNotice {
  id: "frcl-2026-2290" | "frcl-2026-3493";
  /** Short label for buttons. */
  label: string;
  /** The instrument this sample is based on. */
  basedOn: string;
  /** Clerk metadata for the underlying instrument — used by the
   * deterministic checks, never shown to the model. */
  clerk: { fileDate: string; saleDate: string };
  /** Ground truth for fidelity checks. Because the sample text is fixed,
   * we know what a faithful extraction must contain, field by field
   * (see SampleExpectation in extraction-checks.ts). */
  expected: import("./extraction-checks.js").SampleExpectation;
  /** The full text transmitted to the model and displayed to the reader. */
  text: string;
}

export const SAMPLE_NOTICES: readonly SampleNotice[] = [
  {
    id: "frcl-2026-2290",
    label: "Sample A — based on FRCL-2026-2290",
    basedOn: "FRCL-2026-2290",
    clerk: { fileDate: "2026-04-02", saleDate: "2026-09-01" },
    expected: {
      notice_type: {
        required: [/^notice of substitute trustee'?s sale$/i],
        allowedWords: ["notice", "substitute", "trustee", "trustees", "sale"],
        allowedDigits: [],
      },
      sale_time_window: {
        required: [/11(:00)?\s*a\.?m\.?/i],
        forbidden: [/\b(?!3\b)\d+\s*\)?\s*hours?\b/i, /\b(one|two|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hours?\b/i],
        allowedWords: ["begin", "beginning", "not", "later", "than", "three", "hours", "after", "that", "time", "the", "sale", "will", "and", "between", "starting", "start"],
        allowedDigits: ["11", "00", "3", "2", "14"],
      },
      sale_location: {
        required: [/bayou\s+city\s+event\s+center/i, /magnolia\s+ballroom/i],
        allowedWords: ["bayou", "city", "event", "center", "magnolia", "ballroom", "knight", "road", "houston", "texas", "harris", "county"],
        allowedDigits: ["9401"],
      },
      county: { required: [/^harris(\s+county)?(,\s*texas)?$/i], allowedWords: ["harris", "county", "texas"], allowedDigits: [] },
      trustee_or_substitute: {
        required: [/^auction\.com,?\s*(llc|l\.l\.c\.?)$/i],
        allowedWords: ["auction", "com", "llc"],
        allowedDigits: [],
      },
      deed_of_trust_date: null,
      lender_or_mortgagee: null, // the sample's mortgagee lines are [REMOVED]
      servicer_if_stated: {
        required: [/^lakeview loan servicing,?\s*(llc|l\.l\.c\.?)$/i],
        allowedWords: ["lakeview", "loan", "servicing", "llc"],
        allowedDigits: [],
      },
    },
    text: `SANITIZED SAMPLE FOR DEMONSTRATION — based on the public record of instrument FRCL-2026-2290, Harris County Clerk foreclosure search. The homeowner's name, property address and legal description have been [REMOVED]. This is not the recorded instrument.

NOTICE OF SUBSTITUTE TRUSTEE'S SALE

Deed of Trust Date: [REMOVED FOR THIS DEMO]
Grantor(s): [REMOVED FOR THIS DEMO]
Original Mortgagee: [REMOVED FOR THIS DEMO]
Current Mortgage Servicer: LAKEVIEW LOAN SERVICING, LLC
Property County: HARRIS
Property: [LEGAL DESCRIPTION REMOVED FOR THIS DEMO]

WHEREAS, defaults have occurred in the covenants of the Deed of Trust, monetary or otherwise, and the indebtedness secured by and described in the Deed of Trust is now wholly due, and the owner and holder of said debt has requested the undersigned to sell the property to satisfy same;

WHEREAS, the owner and holder of the indebtedness has appointed AUCTION.COM, LLC as Substitute Trustee, each empowered to act independently, to sell the Property;

NOW, THEREFORE, NOTICE IS HEREBY GIVEN that on Tuesday, September 1, 2026, the foreclosure sale will be conducted in Harris County at the Bayou City Event Center, Magnolia Ballroom, 9401 Knight Road, Houston, Texas, the area designated by the Commissioners Court for foreclosure sales. The sale will begin at 11:00 a.m. or not later than three (3) hours after that time, and will be conducted as a public auction to the highest bidder for cash.

Pursuant to Section 51.009 of the Texas Property Code, the Property will be sold in "as is", "where is" condition, without any expressed or implied warranties, except as to warranties of title.

Pursuant to Section 51.0075 of the Texas Property Code, the substitute trustee reserves the right to set further reasonable conditions for conducting the sale.

ASSERT AND PROTECT YOUR RIGHTS AS A MEMBER OF THE ARMED FORCES OF THE UNITED STATES. IF YOU ARE OR YOUR SPOUSE IS SERVING ON ACTIVE MILITARY DUTY, INCLUDING ACTIVE MILITARY DUTY AS A MEMBER OF THE TEXAS NATIONAL GUARD OR THE NATIONAL GUARD OF ANOTHER STATE OR AS A MEMBER OF A RESERVE COMPONENT OF THE ARMED FORCES OF THE UNITED STATES, PLEASE SEND WRITTEN NOTICE OF THE ACTIVE DUTY MILITARY SERVICE TO THE SENDER OF THIS NOTICE IMMEDIATELY.`,
  },
  {
    id: "frcl-2026-3493",
    label: "Sample B — based on FRCL-2026-3493",
    basedOn: "FRCL-2026-3493",
    clerk: { fileDate: "2026-05-14", saleDate: "2026-09-01" },
    expected: {
      notice_type: {
        required: [/^notice of substitute trustee'?s sale$/i],
        allowedWords: ["notice", "substitute", "trustee", "trustees", "sale"],
        allowedDigits: [],
      },
      sale_time_window: {
        required: [/10(:00)?\s*a\.?m\.?/i],
        forbidden: [/\b(?!3\b)\d+\s*\)?\s*hours?\b/i, /\b(one|two|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+hours?\b/i],
        allowedWords: ["begin", "beginning", "not", "earlier", "later", "than", "three", "hours", "after", "that", "time", "the", "sale", "will", "and", "between", "starting", "start"],
        allowedDigits: ["10", "00", "1", "3", "13"],
      },
      sale_location: {
        required: [/bayou\s+city\s+event\s+center/i, /magnolia\s+south\s+ballroom/i],
        allowedWords: ["bayou", "city", "event", "center", "magnolia", "south", "ballroom", "knight", "road", "houston", "texas", "harris", "county"],
        allowedDigits: ["9401"],
      },
      county: { required: [/^harris(\s+county)?(,\s*texas)?$/i], allowedWords: ["harris", "county", "texas"], allowedDigits: [] },
      trustee_or_substitute: {
        required: [/auction\.com,?\s*(llc|l\.l\.c\.?)/i, /barrett\s+daffin\s+frappier\s+turner\s*(&|and)\s*engel,?\s*l\.?l\.?p\.?/i],
        allowedWords: ["auction", "com", "llc", "and", "barrett", "daffin", "frappier", "turner", "engel", "llp"],
        allowedDigits: [],
      },
      deed_of_trust_date: null,
      lender_or_mortgagee: {
        required: [/^midfirst bank$/i],
        allowedWords: ["midfirst", "bank"],
        allowedDigits: [],
      },
      servicer_if_stated: {
        required: [/midland\s+mortgage/i],
        allowedWords: ["midland", "mortgage", "division", "midfirst", "bank"],
        allowedDigits: [],
      },
    },
    text: `SANITIZED SAMPLE FOR DEMONSTRATION — based on the public record of instrument FRCL-2026-3493, Harris County Clerk foreclosure search. The homeowner's name, property address and legal description have been [REMOVED]. This is not the recorded instrument.

NOTICE OF SUBSTITUTE TRUSTEE'S SALE

Deed of Trust Date: [REMOVED FOR THIS DEMO]
Grantor(s): [REMOVED FOR THIS DEMO]
Mortgagee: MIDFIRST BANK
Mortgage Servicer: MIDLAND MORTGAGE, A DIVISION OF MIDFIRST BANK
Property County: HARRIS
Property: [LEGAL DESCRIPTION REMOVED FOR THIS DEMO]

WHEREAS, default has occurred under the terms of the Deed of Trust and the indebtedness secured thereby is now wholly due, and MIDFIRST BANK, the owner and holder of said indebtedness, has requested the undersigned to sell the property to satisfy same;

WHEREAS, the owner and holder of the indebtedness has appointed AUCTION.COM, LLC, and BARRETT DAFFIN FRAPPIER TURNER & ENGEL, LLP, as Substitute Trustees, each empowered to act independently, to sell the Property;

NOW, THEREFORE, NOTICE IS HEREBY GIVEN that on Tuesday, September 1, 2026, the foreclosure sale will be conducted in Harris County at the Bayou City Event Center, Magnolia South Ballroom, 9401 Knight Road, Houston, Texas, the area designated by the Commissioners Court for foreclosure sales. The sale will begin no earlier than 10:00 a.m. and no later than three (3) hours after that time, and will be conducted as a public auction to the highest bidder for cash, subject to the provisions of the Deed of Trust permitting the beneficiary thereunder to have the bid credited to the note up to the amount of the unpaid debt secured by the Deed of Trust at the time of sale.

Pursuant to Section 51.009 of the Texas Property Code, the Property will be sold in "as is", "where is" condition, without any expressed or implied warranties, except as to warranties of title.

ASSERT AND PROTECT YOUR RIGHTS AS A MEMBER OF THE ARMED FORCES OF THE UNITED STATES. IF YOU ARE OR YOUR SPOUSE IS SERVING ON ACTIVE MILITARY DUTY, INCLUDING ACTIVE MILITARY DUTY AS A MEMBER OF THE TEXAS NATIONAL GUARD OR THE NATIONAL GUARD OF ANOTHER STATE OR AS A MEMBER OF A RESERVE COMPONENT OF THE ARMED FORCES OF THE UNITED STATES, PLEASE SEND WRITTEN NOTICE OF THE ACTIVE DUTY MILITARY SERVICE TO THE SENDER OF THIS NOTICE IMMEDIATELY.`,
  },
];

export function getSampleNotice(id: string): SampleNotice | undefined {
  return SAMPLE_NOTICES.find((s) => s.id === id);
}
