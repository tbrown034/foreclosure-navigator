# Foreclosure Navigator — Harris County (concept demo)

A working concept for a newsroom reader tool: walk a Harris County homeowner from "what is this letter" to "here is your deadline, here is who to call, here is the paperwork" — built the way responsible newsroom AI products are built, with the model kept away from everything that can hurt someone.

**This is a demo, not a service.** Demo data is labeled, nothing here is legal advice, and every deadline must be verified against the recorded notice. Free legal help in Harris County: [Lone Star Legal Aid](https://www.lonestarlegal.org/services/foreclosure-prevention-project/) (713-652-0077) and [Houston Volunteer Lawyers via LegalHelpHouston.org](https://legalhelphouston.org).

Built in one day — August 10, 2026 — by [Trevor Brown](https://trevorthewebdeveloper.com), a journalist-developer, as a design study in civic reader tools. It is modeled on the pattern behind newsroom products like property-tax protest tools: a scary bureaucratic process, a hard statutory deadline, free public data and a reader who must act.

## The design contract

1. **Code computes every date.** The deadline chain is pure arithmetic from Tex. Prop. Code §51.002 — including the notice-day-counts cure rule, the 21-day sale-notice minimum, the first-Tuesday rule and the first-Wednesday exception for Jan 1 / Jul 4. A language model never produces a date.
2. **A notice of sale states its own sale date — the tool never invents one.** Projected minimums (from a notice of default) are labeled projected everywhere they appear.
3. **Attorneys own legal language.** Templates are static with the reader's facts slotted in. In production they ship only after documented review by Texas housing counsel — which has not happened for this demo, and the page says so.
4. **AI works only at the edges**: reading the uploaded notice into a fixed schema, translating boilerplate with a no-citation-no-sentence rule, and polishing the reader's own words without adding a fact. Deadline math, remedy selection and advice are off-limits by design.
5. **Survival is never paywalled.** Deadlines, action guidance and legal-aid referrals are free; the plausible paid layer is document storage and proof-of-submission tracking.

## What was actually tested (Aug 10, 2026)

- **Extraction, on real documents:** two Notices of Substitute Trustee's Sale for the Sept 1, 2026 auction, pulled from the Harris County Clerk's public foreclosure search (instruments FRCL-2026-2290 and FRCL-2026-3493), extracted by Claude Haiku 4.5 into a fixed schema. 12/12 deterministic validation checks passed — sale dates matched the Clerk's own metadata, the §51.002 21-day check passed in code, and the schema excluded homeowner names and addresses by design. Script: [`extract-test.mjs`](extract-test.mjs).
- **Translation, with a catch:** the plain-language pass on a real notice required every sentence to carry its basis from the document or statute. One of four sentences contradicted its own citation (10:00 AM vs the document's 11:00 a.m.) — which is precisely the class of error the citation-required design routes to a human instead of a reader. The error is displayed on the page, not hidden, because it is the argument for the architecture.
- **Polish, verified:** a hardship narrative rewrite with an automated check confirming zero facts, dates or numbers appeared in the output that were absent from the input.
- **The page itself:** 23 browser-driven unit tests on the date engine and interactions (month-boundary cases, the first-Wednesday exception, short-notice flagging, stale-state clearing), plus an adversarial review pass by a second model whose findings — including a real date-engine bug — were applied before publication.

Two documents is a pilot, not a benchmark. Production needs a golden set, calibrated accuracy and human confirmation flows.

## Running it

It's one static file. Open `index.html`, or serve it: `python3 -m http.server`. The extraction test needs an `ANTHROPIC_API_KEY` and the notice PDFs (not included — they are public records, but they contain homeowner information; fetch your own from the [Harris County Clerk](https://cclerk.hctx.net/applications/websearch/FRCL_R.aspx)).

## Honest limitations

Not legal advice; not attorney-reviewed; mortgage track only (the tax and HOA panels are informational); demo figures in the county chart are placeholders; the AI jobs marked "designed" are not built. The trust-receipt section on the page enumerates what a production version would owe its readers: named editorial ownership, a corrections log, counsel-reviewed templates, provider and retention disclosure for uploaded documents, and redaction before model transmission.
