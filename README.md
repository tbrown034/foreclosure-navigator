# Foreclosure Navigator — Harris County (concept demo)

A working concept for a newsroom reader tool: walk a Harris County homeowner from "what is this letter" to "here is your deadline, here is who to call, here is the paperwork" — built the way responsible newsroom AI products are built, with the model kept away from everything that can hurt someone.

**This is a demo, not a service.** Demo data is labeled, nothing here is legal advice, and every deadline must be verified against the recorded notice. Free legal help in Harris County: [Lone Star Legal Aid](https://www.lonestarlegal.org/services/foreclosure-prevention-project/) (713-652-0077) and [Houston Volunteer Lawyers via LegalHelpHouston.org](https://legalhelphouston.org).

Built August 10, 2026 by [Trevor Brown](https://trevorthewebdeveloper.com), a journalist-developer, as a design study in civic reader tools. It is modeled on the pattern behind newsroom products like property-tax protest tools: a scary bureaucratic process, a hard statutory deadline, free public data and a reader who must act. Live at [foreclosure-navigator.vercel.app](https://foreclosure-navigator.vercel.app).

## The design contract

1. **Code computes every date.** The deadline chain is pure arithmetic from Tex. Prop. Code §51.002 — including the notice-day-counts cure rule, the 21-day sale-notice minimum, the first-Tuesday rule and the first-Wednesday exception for Jan 1 / Jul 4. A language model never produces a date.
2. **A notice of sale states its own sale date — the tool never invents one.** Projected minimums (from a notice of default) are labeled projected everywhere they appear.
3. **Attorneys own legal language.** Templates are static with the reader's facts slotted in. In production they ship only after documented review by Texas housing counsel — which has not happened for this demo, and the page says so.
4. **AI works only at the edges**: reading the uploaded notice into a fixed schema, translating boilerplate with a no-citation-no-sentence rule, and polishing the reader's own words without adding a fact. Deadline math, remedy selection and advice are off-limits by design.
5. **Survival is never paywalled.** Deadlines, action guidance and legal-aid referrals are free; the plausible paid layer is document storage and proof-of-submission tracking.

## Architecture

Vite + TypeScript, static build output, two small serverless functions, no framework. That is a deliberate decision, and it is the same decision the product itself makes about AI: the smallest tool that does the job. A page of static HTML with a few typed behavior modules does not need a component framework, and a codebase meant to be read as a work sample benefits from having nothing in it that isn't earning its place.

```
index.html               All page content, as plain HTML — the copy is the product
lib/deadlines.ts         The statutory date engine: pure typed functions, no DOM
lib/deadlines.test.ts    Tests pinning the statutory boundary cases
lib/templates.ts         Letter and call-script templates: facts in, string out
lib/sample-notices.ts    The two sanitized sample documents for the live
                         extraction demo — single source of truth for what the
                         page shows AND what the server sends to the model
lib/extraction-checks.ts Deterministic validation of extraction output
src/main.ts              Entry point; mounts one behavior module per section
src/sections/            Stepper, editor box, deadline chain (timeline rail),
                         urgency card, sample scenarios, upload demo,
                         track selector + tax calculator, action kits,
                         document desk, polish demo, auction calendar
src/state.ts             The one shared value: the current sale-clock reading
src/styles.css           Hand-rolled token CSS — light/dark themes, print styles
api/extract.ts           Live extraction on the sanitized samples (see below)
api/polish.ts            Narrative polish for the reader's sentence (see below)
```

The exhibits, AI seam map and trust receipt are static HTML in `index.html` on purpose — they are content, not behavior.

### The two live AI features

Both are optional, clearly marked, disclose exactly what is transmitted (and that Anthropic's standard API retention applies — the demo itself stores nothing), and degrade gracefully — the entire page keeps working when either endpoint is absent or over quota. Rate limits (extraction: 6/IP/hour, 100/day; polish: 5/IP/hour, 200/day) fail closed; the counters are in-memory per serverless instance, so they are approximate deployment-wide but strict per instance — a production version would use a shared store. Upstream model calls carry a hard timeout. There are no other AI endpoints.

- **`api/extract.ts` — the upload path, live.** Runs seam-map job #1 on one of two built-in sanitized sample documents (no arbitrary input is accepted). The samples are reconstructions from the public facts of the two recorded instruments in the exhibit — file dates, sale date, trustees, servicers — wrapped in standard §51.002 boilerplate with the homeowner's name, address and legal description removed, and labeled as such in the document text itself. The real PDFs are deliberately not in this repo. Claude Haiku fills the fixed schema; nineteen deterministic checks run in code after it — the six from the Aug 10 pilot (the Tuesday check upgraded to the full allowed-sale-day rule), strict schema validation (exact key set, required keys, types, the exact three-key confidence object with 0-1 bounds, an address-shape scan across all output values), and field-exact fidelity checks against the fixed sample's ground truth: for every text field, the required names must be present and every word must come from that field's own source vocabulary — so a servicer promoted into the trustee field fails even though the words appear elsewhere in the document — and fields the sample redacts (deed-of-trust date, sample A's mortgagee) must come back null; and nothing enters the calculator until the reader confirms the dates. If any check flags, there is no confirm button — the result computes nothing, which is the contract.
- **`api/polish.ts` — narrative polish.** Polishes the reader's own sentence in the document desk — grammar, spelling, structure and tone only. The model is not trusted to honor that contract: a deterministic check runs after it, and any output containing a guarded token absent from the input — digits, written numbers, month names, percent and money words — is rejected and the reader's original text returned with a flag. It is a narrow token guard, labeled as such on the page — the reader's approval step covers what tokens cannot. 1,200-character input cap.

## What was actually tested (Aug 10, 2026)

- **Extraction, on real documents:** two Notices of Substitute Trustee's Sale for the Sept 1, 2026 auction, pulled from the Harris County Clerk's public foreclosure search (instruments FRCL-2026-2290 and FRCL-2026-3493), extracted by Claude Haiku 4.5 into a fixed schema. 12/12 deterministic validation checks passed — sale dates matched the Clerk's own metadata, the §51.002 21-day check passed in code, and the schema excluded homeowner names and addresses by design. Script: [`extract-test.mjs`](extract-test.mjs).
- **Translation, with a catch:** the plain-language pass on a real notice required every sentence to carry its basis from the document or statute. One of four sentences contradicted its own citation (10:00 AM vs the document's 11:00 a.m.) — which is precisely the class of error the citation-required design routes to a human instead of a reader. The error is displayed on the page, not hidden, because it is the argument for the architecture.
- **Polish, verified:** a hardship narrative rewrite with an automated check confirming zero facts, dates or numbers appeared in the output that were absent from the input. The same check now runs server-side in `api/polish.ts`, with unit tests.
- **The date engine:** the statutory arithmetic is unit-tested in [`lib/deadlines.test.ts`](lib/deadlines.test.ts) — month-boundary cases, the first-Wednesday exception, the exactly-21-days floor, short-notice flagging, the noon-normalization edge where a threshold lands exactly on a first Tuesday. CI runs the suite and the build on every push.

Two documents is a pilot, not a benchmark. Production needs a golden set, calibrated accuracy and human confirmation flows.

## Running it

```
pnpm install
pnpm dev        # Vite dev server — the full page, minus both API endpoints
pnpm test       # Vitest: date engine, extraction checks, polish gate
pnpm build      # typecheck + static build to dist/
vercel dev      # the page plus both API functions locally (needs ANTHROPIC_API_KEY)
```

The extraction test (`extract-test.mjs`) needs an `ANTHROPIC_API_KEY` and the notice PDFs (not included — they are public records, but they contain homeowner information; fetch your own from the [Harris County Clerk](https://cclerk.hctx.net/applications/websearch/FRCL_R.aspx)).

## Honest limitations

Not legal advice; not attorney-reviewed; mortgage track only (the tax and HOA panels are informational); demo figures in the county chart are placeholders; the AI jobs marked "designed" are not built. Known simplifications a production version must resolve: the sale-notice chain takes one date where §51.002(b) requires filing, posting AND mailing each at 21+ days; the cure clock asks for the mailing date but cannot verify it against the postmark; the tax calculator handles the main §34.21 branches (homestead/agricultural/mineral vs. other) but not every purchaser-path variation; and rate limiting is per-instance, not deployment-global. The endpoint handlers are thin and not covered by HTTP-level tests (their gates are unit-tested); provider-side spend limits exist at the account level but are not verifiable from this repo. The trust-receipt section on the page enumerates what a production version would owe its readers: named editorial ownership, a corrections log, counsel-reviewed templates, provider and retention disclosure for uploaded documents, and redaction before model transmission.
