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

  it("rejects written-out amounts the reader never typed", () => {
    const out = "I owe several thousand dollars from that period.";
    const invented = inventedTokens(INPUT, out);
    expect(invented).toContain("thousand");
    expect(invented).toContain("dollars");
  });

  it("allows amount words the reader did type", () => {
    const invented = inventedTokens("i missed three thousand dollars of pay", "I missed three thousand dollars of pay.");
    expect(invented).toEqual([]);
  });

  it("compares digit runs as whole tokens: '30' in the input does not license '3'", () => {
    expect(inventedTokens("I was 30 days late", "I was 3 days late")).toContain("3");
  });

  it("matches guard words on word boundaries: 'marching' does not license 'March'", () => {
    expect(inventedTokens("we kept marching on", "It happened in March.")).toContain("march");
  });

  it("catches a written-number substitution: 'one hundred' does not license 'nine hundred'", () => {
    expect(inventedTokens("i owe one hundred dollars", "I owe nine hundred dollars.")).toContain("nine");
  });

  it("catches 'no missed payment' becoming 'one missed payment'", () => {
    expect(inventedTokens("I have no missed payment.", "I have one missed payment.")).toContain("one");
  });

  it("catches an introduced 'zero' and singular 'dollar'", () => {
    expect(inventedTokens("i am behind on payments", "I have zero savings and not a dollar spare.")).toEqual(
      expect.arrayContaining(["zero", "dollar"]),
    );
  });
});
