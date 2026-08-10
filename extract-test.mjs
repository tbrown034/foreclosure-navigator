// Real-notice extraction test — foreclosure navigator job #1.
// Pattern mirrors Open Cabinet's parse-pdf.ts: document block + fixed schema,
// deterministic validation AFTER the model, privacy fields never extracted.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/home/Desktop/dev/open-cabinet/package.json");
const Anthropic = require("@anthropic-ai/sdk").default ?? require("@anthropic-ai/sdk");

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("No ANTHROPIC_API_KEY in env"); process.exit(1); }
const client = new Anthropic({ apiKey: KEY });

const SCHEMA_PROMPT = `You are extracting structured data from a recorded Notice of Trustee Sale (Texas foreclosure document, Harris County).

Return ONLY a JSON object with exactly these keys:
{
  "notice_type": "...",            // e.g. "Notice of Trustee Sale" / "Notice of Substitute Trustee Sale"
  "sale_date": "YYYY-MM-DD",       // the stated foreclosure sale date
  "sale_time_window": "...",       // stated earliest time / window
  "sale_location": "...",          // stated sale location
  "county": "...",
  "trustee_or_substitute": "...",  // trustee or substitute trustee NAME(S) (professionals, not the homeowner)
  "deed_of_trust_date": "YYYY-MM-DD or null",
  "lender_or_mortgagee": "...",    // the financial institution
  "servicer_if_stated": "... or null",
  "confidence": { "sale_date": 0.0, "trustee_or_substitute": 0.0, "lender_or_mortgagee": 0.0 }  // 0-1 per field
}

PRIVACY RULES (hard): Do NOT extract, quote, or mention the borrower/homeowner name, the property street address, or the legal description. Those fields are deliberately absent from the schema. If a value would reveal them, omit it.
If a field is not present in the document, use null. Never guess.`;

async function extract(file) {
  const pdf = fs.readFileSync(file).toString("base64");
  const t0 = Date.now();
  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
        { type: "text", text: SCHEMA_PROMPT },
      ],
    }],
  });
  const ms = Date.now() - t0;
  const text = resp.content.map(b => b.text ?? "").join("");
  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const data = JSON.parse(jsonText);
  const usage = resp.usage;
  return { data, ms, usage };
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
  checks.push(["no privacy fields present in output", banned.every(k => !(k in data))]);
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
  try {
    const { data, ms, usage } = await extract(full);
    const checks = validate(data, known);
    results.push({ instrument: known.id, ms, usage: { in: usage.input_tokens, out: usage.output_tokens }, data, checks: checks.map(([n, ok]) => (ok ? "PASS  " : "FAIL  ") + n) });
  } catch (e) {
    results.push({ instrument: known.id, error: String(e).slice(0, 300) });
  }
}
console.log(JSON.stringify(results, null, 2));
