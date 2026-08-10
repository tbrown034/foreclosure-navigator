/**
 * Live extraction demo — job #1 from the AI seam map, runnable by anyone.
 *
 * The client may only name one of the two built-in sanitized samples
 * (lib/sample-notices.ts); no arbitrary text is accepted. The sample's
 * text goes to Claude Haiku with the same fixed schema the Aug 10
 * real-document pilot used, and the same deterministic checks run in code
 * AFTER the model. Clerk metadata for the checks comes from this server,
 * never from the model.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateExtraction, validateFidelity, type ExtractedNotice } from "../lib/extraction-checks.js";
import { getSampleNotice } from "../lib/sample-notices.js";
import { QUOTA_BODY, callAnthropic, clientIp, createRateLimiter } from "./_shared.js";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 1200;

const limiter = createRateLimiter({
  perIpLimit: 6,
  perIpWindowMs: 60 * 60 * 1000,
  globalDailyLimit: 100,
});

const SCHEMA_PROMPT = `You are extracting structured data from a Notice of Trustee Sale (Texas foreclosure document, Harris County).

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

PRIVACY RULES (hard): Do NOT extract, quote, or mention any borrower/homeowner name, property street address, or legal description. Those fields are deliberately absent from the schema. If a value would reveal them, omit it.
If a field is not present in the document, use null. Never guess.

Document text:
`;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const sampleId =
    typeof req.body === "object" && req.body !== null ? (req.body as { sample?: unknown }).sample : undefined;
  const sample = typeof sampleId === "string" ? getSampleNotice(sampleId) : undefined;
  if (!sample) {
    res.status(400).json({ error: "body must be JSON: {\"sample\": \"frcl-2026-2290\" | \"frcl-2026-3493\"}" });
    return;
  }

  try {
    if (limiter.overQuota(clientIp(req))) {
      res.status(429).json(QUOTA_BODY);
      return;
    }
  } catch {
    res.status(429).json(QUOTA_BODY);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "extraction is not configured on this deployment" });
    return;
  }

  const t0 = Date.now();
  const raw = await callAnthropic({ apiKey, model: MODEL, maxTokens: MAX_TOKENS, prompt: SCHEMA_PROMPT + sample.text });
  const ms = Date.now() - t0;
  if (raw === null) {
    res.status(502).json({ error: "model call failed" });
    return;
  }

  let extracted: ExtractedNotice;
  try {
    const parsed: unknown = JSON.parse(raw);
    // JSON.parse can legally return null, arrays or primitives — none of
    // which are a schema object. Reject before validation dereferences.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      res.status(502).json({ error: "model returned non-object output — nothing was computed from it" });
      return;
    }
    extracted = parsed as ExtractedNotice;
  } catch {
    res.status(502).json({ error: "model returned unparseable output — nothing was computed from it" });
    return;
  }

  const checks = [
    ...validateExtraction(extracted as unknown as Record<string, unknown>, sample.clerk),
    ...validateFidelity(extracted as unknown as Record<string, unknown>, sample.expected, sample.text),
  ];

  res.status(200).json({
    sample: sample.id,
    basedOn: sample.basedOn,
    extracted,
    clerk: sample.clerk,
    checks,
    allPass: checks.every((c) => c.pass),
    model: MODEL,
    ms,
  });
}
