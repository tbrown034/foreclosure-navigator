import { describe, expect, it } from "vitest";
import { inventedTokens } from "./polish";
import { guardFacts } from "./summary";

// The stage engine's real output style for the demo case.
const FACTS =
  "As of Tue, Aug 11, 2026 — 21 days until the printed sale date (Sep 1).\n" +
  "The 38-day marker — was Jul 25 and has passed.\n" +
  "Free legal help — Call early. Verified numbers below.";

describe("AI summary guard", () => {
  it("licenses full month names whose abbreviations are in the facts", () => {
    const out = "You have 21 days until the printed sale date of September 1. The marker passed on July 25.";
    expect(inventedTokens(guardFacts(FACTS), out)).toEqual([]);
  });

  it("still rejects months absent from the facts entirely", () => {
    const out = "By December, this will be resolved.";
    expect(inventedTokens(guardFacts(FACTS), out)).toContain("december");
  });

  it("rejects invented digit runs — 21 in the facts does not license 12", () => {
    const out = "You have 12 days left.";
    expect(inventedTokens(guardFacts(FACTS), out)).toContain("12");
  });

  it("rejects invented number words", () => {
    const out = "You owe thousands of dollars.";
    expect(inventedTokens(guardFacts(FACTS), out)).toContain("dollars");
  });

  it("the expansion derives only from the facts, never the output", () => {
    // "august" appears in output; facts contain "Aug 11" — licensed.
    expect(inventedTokens(guardFacts(FACTS), "As of August 11.")).toEqual([]);
    // Facts WITHOUT any august token do not license it.
    expect(inventedTokens(guardFacts("21 days until Sep 1."), "By August it may differ.")).toContain("august");
  });
});
