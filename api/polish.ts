/**
 * The one serverless function: narrative polish for the reader's own
 * sentence. Contract — fix grammar, spelling, structure and tone ONLY;
 * never add a fact, date or circumstance absent from the input.
 *
 * The model is not trusted to honor that contract. A deterministic check
 * runs AFTER the model: if the output contains any digit run or month name
 * that does not appear in the input, the original text is returned with a
 * flag and an explanation. The page works fully without this endpoint.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;
const MAX_INPUT_CHARS = 1200;

const PER_IP_LIMIT = 5; // requests per rolling hour
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_DAILY_LIMIT = 200;

const QUOTA_BODY = {
  error: "demo quota reached — the deterministic demo still works",
};

// In-memory counters, per serverless instance. Good enough for a demo with
// hard server-side caps; a production version would use a shared store.
// Anything unexpected in the counting path fails CLOSED (treated as over
// quota) rather than letting requests through uncounted.
const ipHits = new Map<string, number[]>();
let globalDay = "";
let globalCount = 0;

function overQuota(ip: string): boolean {
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  if (day !== globalDay) {
    globalDay = day;
    globalCount = 0;
  }
  if (globalCount >= GLOBAL_DAILY_LIMIT) return true;

  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < PER_IP_WINDOW_MS);
  if (hits.length >= PER_IP_LIMIT) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  globalCount++;
  return false;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
];

/** Digit runs and month names in the output that do not appear in the input.
 * Deliberately conservative: "Aug" in the input does not license "August"
 * in the output — a false rejection returns the reader's original text,
 * which is always safe. */
export function inventedTokens(input: string, output: string): string[] {
  const bad: string[] = [];
  for (const run of output.match(/\d+/g) ?? []) {
    if (!input.includes(run)) bad.push(run);
  }
  const inputLower = input.toLowerCase();
  for (const month of MONTH_NAMES) {
    const inOutput = new RegExp(`\\b${month}\\b`, "i").test(output);
    if (inOutput && !inputLower.includes(month)) bad.push(month);
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

async function callModel(apiKey: string, text: string): Promise<ModelResult | null> {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: PROMPT_HEADER + text }],
    }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const raw = (data.content ?? [])
    .map((b) => b.text ?? "")
    .join("")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");
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
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ?? "unknown";
    if (overQuota(ip)) {
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

  const result = await callModel(apiKey, text);
  if (!result) {
    res.status(502).json({ error: "model call failed" });
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
