// Real-notice extraction test — the Aug 10, 2026 pilot script, kept as the
// record of how the exhibit numbers were produced. Self-contained: plain
// fetch, no SDK. The notice PDFs are NOT in this repo (they are public
// records but contain homeowner information); fetch your own from the
// Harris County Clerk's foreclosure search and save them as notice-1.pdf /
// notice-2.pdf beside this script. The live equivalent of this flow, on
// sanitized samples, is api/extract.ts.
//
// Usage: ANTHROPIC_API_KEY=... node extract-test.mjs
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error("No ANTHROPIC_API_KEY in env");
  process.exit(1);
}

const SCHEMA_PROMPT = `You are extracting structured data from a recorded Notice of Trustee Sale (Texas foreclosure document, Harris County).

Return ONLY a JSON object with exactly these keys:
{
  "notice_type": "...",
  "sale_date": "YYYY-MM-DD",
  "sale_time_window": "...",
  "sale_location": "...",
  "county": "...",
  "trustee_or_substitute": "...",
  "deed_of_trust_date": "YYYY-MM-DD or null",
  "lender_or_mortgagee": "...",
  "servicer_if_stated": "... or null",
  "confidence": { "sale_date": 0.0, "trustee_or_substitute": 0.0, "lender_or_mortgagee": 0.0 }
}

PRIVACY RULES (hard): Do NOT extract, quote, or mention the borrower/homeowner name, the property street address, or the legal description. Those fields are deliberately absent from the schema. If a value would reveal them, omit it.
If a field is not present in the document, use null. Never guess.`;

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

// Deterministic validation — the model is never the safety net.
function validate(data, known) {
  const checks = [];
  checks.push(["sale_date matches Clerk metadata (" + known.saleDate + ")", data.sale_date === known.saleDate]);
  const sale = new Date(data.sale_date + "T12:00:00");
  checks.push(["sale date is a Tuesday (first-Tuesday rule)", sale.getDay() === 2]);
  const fileDate = new Date(known.fileDate + "T12:00:00");
  const days = Math.round((sale - fileDate) / 86400000);
  checks.push(["filed >= 21 days before sale (actual: " + days + " days)", days >= 21]);
  checks.push(["county is Harris", /harris/i.test(data.county || "")]);
  const banned = ["borrower", "homeowner_name", "property_address", "legal_description"];
  checks.push(["no privacy fields present in output", banned.every((k) => !(k in data))]);
  checks.push(["confidence present for key fields", data.confidence && typeof data.confidence.sale_date === "number"]);
  return checks;
}

const KNOWN = {
  "notice-1.pdf": { id: "FRCL-2026-2290", saleDate: "2026-09-01", fileDate: "2026-04-02" },
  "notice-2.pdf": { id: "FRCL-2026-3493", saleDate: "2026-09-01", fileDate: "2026-05-14" },
};

const results = [];
for (const [file, known] of Object.entries(KNOWN)) {
  const full = path.join(import.meta.dirname, file);
  if (!fs.existsSync(full)) {
    results.push({ instrument: known.id, skipped: `${file} not present — see header comment` });
    continue;
  }
  try {
    const { data, ms, usage } = await extract(full);
    const checks = validate(data, known);
    results.push({
      instrument: known.id,
      ms,
      usage: { in: usage.input_tokens, out: usage.output_tokens },
      data,
      checks: checks.map(([n, ok]) => (ok ? "PASS  " : "FAIL  ") + n),
    });
  } catch (e) {
    results.push({ instrument: known.id, error: String(e).slice(0, 300) });
  }
}
console.log(JSON.stringify(results, null, 2));
