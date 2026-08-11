import { describe, expect, it } from "vitest";
import { normalizeDocId } from "../src/sections/case-lookup";

describe("normalizeDocId — anchored, never guesses", () => {
  it("accepts the three exact forms", () => {
    expect(normalizeDocId("FRCL-2026-5486")).toBe("FRCL-2026-5486");
    expect(normalizeDocId("2026-5486")).toBe("FRCL-2026-5486");
    expect(normalizeDocId("5486")).toBe("FRCL-2026-5486");
    expect(normalizeDocId("  frcl-2026-2290 ")).toBe("FRCL-2026-2290");
  });

  it("rejects wrong years instead of rewriting them", () => {
    expect(normalizeDocId("FRCL-2025-5486")).toBeNull();
    expect(normalizeDocId("2025-5486")).toBeNull();
  });

  it("rejects excess digits and embedded text", () => {
    expect(normalizeDocId("999999")).toBeNull();
    expect(normalizeDocId("case 5486 please")).toBeNull();
    expect(normalizeDocId("")).toBeNull();
  });

  it("normalizes leading zeros via numeric suffix", () => {
    expect(normalizeDocId("FRCL-2026-0486")).toBe("FRCL-2026-486");
  });
});
