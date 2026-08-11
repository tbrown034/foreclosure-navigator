/**
 * The AI summary — the one generative moment on the reader's path, built
 * on the same contract as everything else: CODE computes the facts (the
 * stage engine runs right here, server-side, from the submitted dates),
 * the model's only job is restating those facts in plain, warm language,
 * and a deterministic token guard rejects any output containing a date,
 * digit run or number word that is not in the computed facts. On a
 * rejection the reader keeps the computed panel — nothing is lost.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { stageAssessment, type NoticeKind } from "../lib/stage.js";
import { inventedTokens } from "./polish.js";
import { QUOTA_BODY, callAnthropic, clientIp, createRateLimiter } from "./_shared.js";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 700;

const limiter = createRateLimiter({
  perIpLimit: 6,
  perIpWindowMs: 60 * 60 * 1000,
  globalDailyLimit: 150,
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const PROMPT_HEADER = `You are writing a short plain-language summary for a homeowner using a Texas foreclosure-deadline tool. Below are COMPUTED FACTS produced by the tool's date engine from the homeowner's notice. Restate them as 3 to 5 warm, clear, second-person sentences.

HARD RULES:
- Use ONLY the computed facts below. Do not add any date, number, deadline, law, outcome or circumstance that is not in them.
- Do not introduce number words or month names absent from the facts.
- No advice ("you should...") — describe what the facts say, including what is open and what has passed, and carry over any "confirm with the servicer or a lawyer" framing.
- Plain words. No legal citations. No reassurance you cannot support.

Return ONLY a JSON object: {"summary": "<the sentences>"}

COMPUTED FACTS:
`;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const b = typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>) : {};
  const kind = b.kind === "default" || b.kind === "sale" ? (b.kind as NoticeKind) : null;
  const noticeIso = typeof b.noticeIso === "string" && ISO.test(b.noticeIso) ? b.noticeIso : null;
  const printedSaleIso = typeof b.printedSaleIso === "string" && ISO.test(b.printedSaleIso) ? b.printedSaleIso : null;
  const todayIso = typeof b.todayIso === "string" && ISO.test(b.todayIso) ? b.todayIso : null;
  if (!kind || !noticeIso || !todayIso || (kind === "sale" && !printedSaleIso)) {
    res.status(400).json({ error: "body must be JSON: {kind, noticeIso, printedSaleIso?, todayIso} as YYYY-MM-DD" });
    return;
  }

  // The facts come from OUR engine, recomputed here — never from the client.
  const s = stageAssessment(kind, noticeIso, printedSaleIso, todayIso);
  if (!s) {
    res.status(400).json({ error: "no stage could be computed from those inputs" });
    return;
  }
  const facts =
    s.headline +
    "\n" +
    s.lines.join("\n") +
    "\n" +
    s.recourses.map((r) => `${r.title} — ${r.label}. ${r.note}`).join("\n");

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
    res.status(503).json({ error: "summary is not configured on this deployment" });
    return;
  }

  const t0 = Date.now();
  const raw = await callAnthropic({ apiKey, model: MODEL, maxTokens: MAX_TOKENS, temperature: 0, prompt: PROMPT_HEADER + facts });
  if (raw === null) {
    res.status(502).json({ error: "model call failed" });
    return;
  }
  let summary: string;
  try {
    const parsed = JSON.parse(raw) as { summary?: unknown };
    if (typeof parsed.summary !== "string" || parsed.summary.trim() === "") throw new Error("shape");
    summary = parsed.summary.trim();
  } catch {
    res.status(502).json({ error: "model returned unparseable output — nothing was shown" });
    return;
  }

  // The facts are OUR computed text with abbreviated months ("Jul 25").
  // The model writing "July" is a faithful expansion, not an invention —
  // license the full name whenever its abbreviation is in the facts.
  // (Deterministic: the expansion set is fixed and derived only from the
  // facts, never from the model's output.)
  const MONTH_EXPANSIONS: Array<[RegExp, string]> = [
    [/\bjan\b/i, "january"], [/\bfeb\b/i, "february"], [/\bmar\b/i, "march"],
    [/\bapr\b/i, "april"], [/\bjun\b/i, "june"], [/\bjul\b/i, "july"],
    [/\baug\b/i, "august"], [/\bsept?\b/i, "september"], [/\boct\b/i, "october"],
    [/\bnov\b/i, "november"], [/\bdec\b/i, "december"],
  ];
  const guardFacts =
    facts + " " + MONTH_EXPANSIONS.filter(([re]) => re.test(facts)).map(([, full]) => full).join(" ");

  const invented = inventedTokens(guardFacts, summary);
  if (invented.length > 0) {
    res.status(200).json({
      flagged: true,
      flag_reason:
        "the model's output contained tokens not present in the computed facts (" +
        invented.join(", ") +
        ") and was discarded — the computed panel stands",
      ms: Date.now() - t0,
    });
    return;
  }

  res.status(200).json({ summary, model: MODEL, ms: Date.now() - t0 });
}
