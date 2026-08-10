/**
 * Narrative polish for the reader's own sentence. Contract — fix grammar,
 * spelling, structure and tone ONLY; never add a fact, date or circumstance
 * absent from the input.
 *
 * The model is not trusted to honor that contract. A deterministic check
 * runs AFTER the model: if the output contains any digit run or month name
 * that does not appear in the input, the original text is returned with a
 * flag and an explanation. The page works fully without this endpoint.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { QUOTA_BODY, callAnthropic, clientIp, createRateLimiter } from "./_shared.js";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;
const MAX_INPUT_CHARS = 1200;

const limiter = createRateLimiter({
  perIpLimit: 5,
  perIpWindowMs: 60 * 60 * 1000,
  globalDailyLimit: 200,
});

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
];

/** Magnitude and money words that state amounts without digits. Common
 * small number-words ("one", "may") are excluded — they appear in ordinary
 * prose and would reject almost everything. This gate is deliberately a
 * NARROW token guard, and the UI says so: the reader's approval step, not
 * this check, is the semantic safety net. */
const AMOUNT_WORDS = ["hundred", "thousand", "million", "percent", "dollars"];

/** Digit runs, month names and amount words in the output that do not
 * appear in the input. Deliberately conservative: "Aug" in the input does
 * not license "August" in the output — a false rejection returns the
 * reader's original text, which is always safe. */
export function inventedTokens(input: string, output: string): string[] {
  const bad: string[] = [];
  for (const run of output.match(/\d+/g) ?? []) {
    if (!input.includes(run)) bad.push(run);
  }
  const inputLower = input.toLowerCase();
  for (const word of [...MONTH_NAMES, ...AMOUNT_WORDS]) {
    const inOutput = new RegExp(`\\b${word}\\b`, "i").test(output);
    if (inOutput && !inputLower.includes(word)) bad.push(word);
  }
  return [...new Set(bad)];
}

const PROMPT_HEADER = `You are a copy editor for a homeowner's hardship statement. Rewrite the text below for grammar, spelling, structure and tone only. HARD RULES:
- Do not add any fact, date, number, amount, name or circumstance that is not in the input.
- Do not remove or soften any fact.
- Do not give advice or add legal language.
- Keep first person and the writer's meaning exactly.

Return ONLY a JSON object: {"polished": "<the rewritten text>", "facts_used": ["<each factual claim you carried over, one per entry>"]}

Text to polish:
`;

interface ModelResult {
  polished: string;
  facts_used: string[];
}

function parseModelResult(raw: string): ModelResult | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ModelResult>;
    if (typeof parsed.polished !== "string") return null;
    return {
      polished: parsed.polished,
      facts_used: Array.isArray(parsed.facts_used)
        ? parsed.facts_used.filter((f): f is string => typeof f === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const text = typeof req.body === "object" && req.body !== null ? (req.body as { text?: unknown }).text : undefined;
  if (typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "body must be JSON: {\"text\": \"...\"}" });
    return;
  }
  if (text.length > MAX_INPUT_CHARS) {
    res.status(400).json({ error: `input must be ${MAX_INPUT_CHARS} characters or fewer` });
    return;
  }

  try {
    if (limiter.overQuota(clientIp(req))) {
      res.status(429).json(QUOTA_BODY);
      return;
    }
  } catch {
    // Fail closed: if the counter path breaks, no model call happens.
    res.status(429).json(QUOTA_BODY);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "polish is not configured on this deployment" });
    return;
  }

  const raw = await callAnthropic({ apiKey, model: MODEL, maxTokens: MAX_TOKENS, prompt: PROMPT_HEADER + text });
  if (raw === null) {
    res.status(502).json({ error: "model call failed" });
    return;
  }
  const result = parseModelResult(raw);
  if (!result) {
    res.status(502).json({ error: "model returned unparseable output" });
    return;
  }

  const invented = inventedTokens(text, result.polished);
  if (invented.length > 0) {
    res.status(200).json({
      polished: text,
      facts_used: [],
      flagged: true,
      flag_reason:
        "the model's output contained tokens not present in your words (" +
        invented.join(", ") +
        "), so it was rejected and your original text returned",
    });
    return;
  }

  res.status(200).json({ polished: result.polished, facts_used: result.facts_used });
}
