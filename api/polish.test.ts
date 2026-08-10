import { describe, expect, it } from "vitest";
import { inventedTokens } from "./polish";

const INPUT =
  "i got behind becuase my hours got cut at the plant in june, im back to full time since august 3";

describe("inventedTokens — the deterministic gate on model output", () => {
  it("accepts output whose digits and months all appear in the input", () => {
    const out =
      "My hours were cut at the plant in June. I returned to full time on August 3.";
    expect(inventedTokens(INPUT, out)).toEqual([]);
  });

  it("rejects a digit run absent from the input", () => {
    const out = "My hours were cut in June and I was 38 days behind.";
    expect(inventedTokens(INPUT, out)).toContain("38");
  });

  it("rejects a month name absent from the input", () => {
    const out = "My hours were cut in June and I fell behind in July.";
    expect(inventedTokens(INPUT, out)).toContain("july");
  });

  it("does not let '3' license '30' (digit runs match whole, not per-character)", () => {
    const out = "I have been back at work for 30 days.";
    expect(inventedTokens(INPUT, out)).toContain("30");
  });

  it("is conservative: an abbreviation in the input does not license the full month name", () => {
    const invented = inventedTokens("back at work since Aug 3", "I returned to work on August 3.");
    expect(invented).toContain("august");
  });
});
