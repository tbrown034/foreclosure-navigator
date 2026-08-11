// Extraction benchmark — the measured version of the Aug 10 two-document
// pilot. Runs the SAME extractor the live demo uses (claude-haiku-4-5,
// fixed schema, temperature 0) across every notice PDF in data-local/pdfs/
// (real recorded instruments, downloaded from the Harris County Clerk's
// public search; gitignored, never committed), then verifies each
// extraction IN CODE against the Clerk's own index (public/data/frcl-index.json).
//
// Output: public/data/benchmark-results.json — NON-PERSONAL fields only (dates,
// county, trustee firm, servicer, notice type), per-field match verdicts
// against the official index, latency and token cost. Homeowner names,
// addresses and legal descriptions are never extracted (the schema has no
// fields for them) and never persisted.
//
// Usage: ANTHROPIC_API_KEY=... node scripts/benchmark.mjs
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error("No ANTHROPIC_API_KEY in env");
  process.exit(1);
}

const ROOT = new URL("..", import.meta.url).pathname;
const PDF_DIR = path.join(ROOT, "data-local/pdfs");
const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/frcl-index.json"), "utf8"));
const byId = new Map(INDEX.filings.map((f) => [f.docId, f]));

// Same schema as api/extract.ts and the Aug 10 pilot.
const SCHEMA_PROMPT = `You are extracting structured data from a recorded Notice of Trustee Sale (Texas foreclosure document, Harris County).

Return ONLY a JSON object with exactly these keys:
{
  "notice_type": "...",
  "sale_date": "YYYY-MM-DD",
  "sale_time_window": "...",
  "sale_location": "...",
  "county": "...",
  "trustee_or_substitute": "...",  // if multiple substitute trustees are appointed, list ALL of them, exactly as named
  "deed_of_trust_date": "YYYY-MM-DD or null",
  "lender_or_mortgagee": "...",
  "servicer_if_stated": "... or null",
  "confidence": { "sale_date": 0.0, "trustee_or_substitute": 0.0, "lender_or_mortgagee": 0.0 }
}

PRIVACY RULES (hard): Do NOT extract, quote, or mention the borrower/homeowner name, the property street address, or the legal description. Those fields are deliberately absent from the schema. If a value would reveal them, omit it.
If a field is not present in the document, use null. Never guess.`;

// Haiku 4.5 pricing (per million tokens).
const IN_RATE = 1.0 / 1e6;
const OUT_RATE = 5.0 / 1e6;

async function extract(file) {
  const pdf = fs.readFileSync(file).toString("base64");
  const t0 = Date.now();
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
            { type: "text", text: SCHEMA_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const body = await resp.json();
  const ms = Date.now() - t0;
  const text = body.content.map((b) => b.text ?? "").join("");
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  return { data: JSON.parse(jsonText), ms, usage: body.usage };
}

// Verification against the Clerk's own index — deterministic, in code.
function verify(extracted, official) {
  const saleMatch = extracted.sale_date === official.saleDate;
  const sale = new Date(extracted.sale_date + "T12:00:00");
  const tuesday = !Number.isNaN(sale.getTime()) && sale.getDay() === 2;
  const countyMatch = /harris/i.test(extracted.county ?? "");
  const banned = ["borrower", "homeowner_name", "property_address", "legal_description"];
  const noPrivacy = banned.every((k) => !(k in extracted));
  const fileDate = new Date(official.fileDate + "T12:00:00");
  const gapDays = Math.round((sale - fileDate) / 86400000);
  return {
    sale_date_matches_index: saleMatch,
    sale_is_first_tuesday: tuesday,
    county_matches: countyMatch,
    no_prohibited_keys: noPrivacy,
    filing_gap_days: Number.isNaN(gapDays) ? null : gapDays,
    gap_meets_21_day_minimum: !Number.isNaN(gapDays) && gapDays >= 21,
    all_pass: saleMatch && tuesday && countyMatch && noPrivacy && gapDays >= 21,
  };
}

const files = fs
  .readdirSync(PDF_DIR)
  .filter((f) => f.endsWith(".pdf"))
  .sort();
console.error(`Benchmarking ${files.length} documents…`);

const results = [];
let totalIn = 0;
let totalOut = 0;
for (const file of files) {
  const docId = file.replace(".pdf", "");
  const official = byId.get(docId);
  if (!official) {
    console.error(`SKIP ${docId}: not in index`);
    continue;
  }
  try {
    const { data, ms, usage } = await extract(path.join(PDF_DIR, file));
    totalIn += usage.input_tokens;
    totalOut += usage.output_tokens;
    const checks = verify(data, official);
    results.push({
      docId,
      official: { saleDate: official.saleDate, fileDate: official.fileDate, pages: official.pages },
      // Persist ONLY what the benchmark measures — no free-text model
      // output (party names could theoretically carry personal data).
      extracted: {
        sale_date: data.sale_date ?? null,
        county: data.county ?? null,
        confidence_sale_date: data.confidence?.sale_date ?? null,
      },
      checks,
      latency_ms: ms,
      tokens: { in: usage.input_tokens, out: usage.output_tokens },
    });
    console.error(`${docId} ${checks.all_pass ? "PASS" : "REVIEW"} ${ms}ms sale=${data.sale_date}`);
  } catch (e) {
    results.push({ docId, error: String(e).slice(0, 200) });
    console.error(`${docId} ERROR ${String(e).slice(0, 120)}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}

const ok = results.filter((r) => !r.error);
const summary = {
  ranAt: new Date().toISOString(),
  model: "claude-haiku-4-5",
  temperature: 0,
  documents: files.length,
  completed: ok.length,
  errors: results.length - ok.length,
  sale_date_exact_match: ok.filter((r) => r.checks.sale_date_matches_index).length,
  county_match: ok.filter((r) => r.checks.county_matches).length,
  no_prohibited_keys: ok.filter((r) => r.checks.no_prohibited_keys).length,
  all_checks_pass: ok.filter((r) => r.checks.all_pass).length,
  flagged_for_human_review: ok.filter((r) => !r.checks.all_pass).map((r) => r.docId),
  mean_latency_ms: Math.round(ok.reduce((s, r) => s + r.latency_ms, 0) / (ok.length || 1)),
  total_tokens: { in: totalIn, out: totalOut },
  est_cost_usd: Number((totalIn * IN_RATE + totalOut * OUT_RATE).toFixed(4)),
};

fs.writeFileSync(
  path.join(ROOT, "public/data/benchmark-results.json"),
  JSON.stringify({ summary, results }, null, 1),
);
console.error(JSON.stringify(summary, null, 2));
