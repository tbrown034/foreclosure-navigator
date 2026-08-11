/**
 * Letter and script templates — template language written for attorney review (not yet reviewed)
 * with the reader's facts slotted in, assembled deterministically. Facts in,
 * string out; no model call anywhere in this module.
 *
 * The wording here is part of the product's content contract: questions
 * only, no promised outcomes, unknowns stay bracketed as UNKNOWN.
 */

export type ReaderGoal = "keep" | "time" | "understand";

export interface DocumentFacts {
  /** Servicer / sender named on the notice (may be empty). */
  servicer: string;
  goal: ReaderGoal;
  /** One fact in the reader's own words (may be empty). */
  change: string;
  /** The current computed sale-clock reference line, e.g.
   * "Tue, Sep 1, 2026 (from your notice)" or "[SEE YOUR NOTICE]". */
  saleLine: string;
}

// The reader's text goes into these plain-text drafts verbatim — never
// altered (an "AT&T" must survive). Rendering always uses textContent.
const servicerName = (f: DocumentFacts): string => f.servicer.trim() || "[SERVICER NAME — UNKNOWN]";

const readerFact = (f: DocumentFacts): string => f.change.trim() || "[YOUR FACTS HERE]";

export function callScript(f: DocumentFacts): string {
  const goal =
    f.goal === "keep"
      ? "explore options to keep the home"
      : f.goal === "time"
        ? "understand the timeline while I pursue a sale"
        : "understand the notice I received";
  return `CALL SCRIPT — ${servicerName(f)}
Goal: ${goal}
Items that may be useful: the loan number, the notice, pen and paper. You can ask for the LOSS MITIGATION department.

1. "Can you confirm whether a foreclosure sale is currently scheduled for my property, and for what date?"
   (Their records may differ from your notice. Write down the answer and the rep's name.)
2. "What loss-mitigation options am I eligible to APPLY for, and what exactly do you require for a complete application?"
3. "Where do I send it, and how will I receive written confirmation that you received every item?"
4. "Can you send me a written reinstatement quote — the exact amount to bring the loan current, and through what date?"
5. Before hanging up: "Can you give me a reference number for this call?"

One fact to state, in your words: "${readerFact(f)}"
NOTE: This script asks questions only. A phone statement may not be binding — requesting important information in writing is a common step. Computed sale-clock reference: ${f.saleLine}.\nThis script is general legal information, not legal advice.`;
}

export function noticeBrief(f: DocumentFacts): string {
  return `NOTICE-TO-ACTION BRIEF
Sender on notice: ${servicerName(f)}
Notice type: [from your selection above — see the deadline chain]
Key computed dates: see the deadline chain — every date is calculated from Tex. Prop. Code §51.002 minimums, not estimated.

WHAT THIS NOTICE IS: a formal step in the Texas non-judicial foreclosure process. It is not a court judgment, and it does not by itself mean the home is lost.

QUESTIONS TO RESOLVE
- Does the amount claimed match your own records? [YOUR RECORDS — UNKNOWN]
- Have you received BOTH notices (default AND sale), or only one?
- Is your loan under review for loss mitigation? If an application is complete more than 37 days before the sale, Reg X may restrict the servicer from proceeding to the sale while it is reviewed — exceptions apply.

DOCUMENTS THAT ARE COMMONLY USEFUL: the notice and its envelope (postmark matters), recent mortgage statements, available income records, and any letters from ${servicerName(f)}.

YOUR STATED FACT: "${readerFact(f)}"
FREE HELP: Lone Star Legal Aid · Houston Volunteer Lawyers. This brief organizes facts; it is not legal advice.`;
}

export function hardshipNarrative(f: DocumentFacts): string {
  const request =
    f.goal === "keep"
      ? "review for options that would allow me to keep my home, including a repayment plan or modification"
      : f.goal === "time"
        ? "information about my account status and timeline while I pursue a sale of the property"
        : "a full written accounting of my loan status and the options available to me";
  return `HARDSHIP NARRATIVE — draft attachment for a loss-mitigation application
To: ${servicerName(f)}

What happened, in my words:
${readerFact(f)}.

What I am requesting: ${request}.

Documentation I can provide for the statements above: [LIST ONLY RECORDS YOU ACTUALLY HAVE].

[DRAFT FOR REVIEW — review every sentence before sending. General template, not legal advice, and not a substitute for advice about your situation.]`;
}

export type DocumentType = "script" | "brief" | "hardship";

export function buildDocument(type: DocumentType, f: DocumentFacts): string {
  if (type === "script") return callScript(f);
  if (type === "brief") return noticeBrief(f);
  return hardshipNarrative(f);
}

/** The loss-mitigation request letter from the action kits (fill-the-brackets,
 * send certified mail). */
export const LOSS_MITIGATION_LETTER = `[YOUR NAME]
[PROPERTY ADDRESS]
Loan number: [LOAN NUMBER]

To the Loss Mitigation Department:

I am requesting a review for all loss-mitigation options available on my loan, including modification, forbearance and repayment plans.

Please send me, in writing:
1. A complete list of every document you require for a complete application.
2. The exact address or portal where my application must be submitted.
3. Written confirmation when you have received each item I send.

I intend to submit the materials you identify as required. Please tell me in writing whether anything remains missing, and confirm the current status of any scheduled foreclosure sale on this account.

[SIGNATURE]
[DATE]

[Template note — delete before sending: this is general legal information, not legal advice.]`;

/** The reinstatement/payoff written demand from the action kits. */
export const REINSTATEMENT_DEMAND_LETTER = `[YOUR NAME]
[PROPERTY ADDRESS]
Loan number: [LOAN NUMBER]

I am requesting the following in writing — promptly, and if possible within five business days:

1. A REINSTATEMENT QUOTE: the exact amount required to bring this loan fully current, itemized, with the date through which it is valid.
2. A PAYOFF QUOTE: the exact amount to satisfy the loan in full, itemized, with its good-through date.
3. The acceptable payment methods and exact delivery address for each.

Please confirm the status and date of any scheduled foreclosure sale on this account.

[SIGNATURE]
[DATE]

[Template note — delete before sending: this is general legal information, not legal advice.]`;
