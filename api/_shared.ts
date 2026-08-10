/**
 * Shared plumbing for the two demo endpoints. Files prefixed with "_" in
 * api/ are not deployed as functions; this code compiles into each one.
 *
 * Rate limiting is in-memory per serverless instance — good enough for a
 * demo with hard caps; a production version would use a shared store.
 * Anything unexpected in the counting path fails CLOSED (treated as over
 * quota) rather than letting requests through uncounted.
 */

import type { VercelRequest } from "@vercel/node";

export const QUOTA_BODY = {
  error: "demo quota reached — the deterministic demo still works",
} as const;

export interface RateLimiter {
  /** Records the hit and returns true when the request must be refused. */
  overQuota(ip: string): boolean;
}

export function createRateLimiter(opts: {
  perIpLimit: number;
  perIpWindowMs: number;
  globalDailyLimit: number;
}): RateLimiter {
  const ipHits = new Map<string, number[]>();
  let day = "";
  let globalCount = 0;

  return {
    overQuota(ip: string): boolean {
      const now = Date.now();
      const today = new Date().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        globalCount = 0;
      }
      if (globalCount >= opts.globalDailyLimit) return true;

      const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < opts.perIpWindowMs);
      if (hits.length >= opts.perIpLimit) {
        ipHits.set(ip, hits);
        return true;
      }
      hits.push(now);
      ipHits.set(ip, hits);
      globalCount++;
      return false;
    },
  };
}

export function clientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ?? "unknown";
}

/** Call the Anthropic Messages API and return the concatenated text output
 * (with any markdown fence stripped), or null on failure or timeout. */
export async function callAnthropic(opts: {
  apiKey: string;
  model: string;
  maxTokens: number;
  prompt: string;
  timeoutMs?: number;
  /** 0 for extraction (reproducibility matters more than variety). */
  temperature?: number;
}): Promise<string | null> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        messages: [{ role: "user", content: opts.prompt }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { content?: Array<{ type: string; text?: string }> };
    return (data.content ?? [])
      .map((b) => b.text ?? "")
      .join("")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "");
  } catch {
    return null;
  }
}
