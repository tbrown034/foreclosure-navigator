import { describe, expect, it } from "vitest";
import { validateExtraction, validateFidelity } from "./extraction-checks";
import { RECORDED_EXTRACTIONS } from "./recorded-extractions";
import { getSampleNotice } from "./sample-notices";

describe("recorded extractions — the replayed default must stay check-clean", () => {
  // If a future change to the checks would flag the recorded runs, this
  // fails loudly instead of the page's default path quietly breaking.
  RECORDED_EXTRACTIONS.forEach((rec) => {
    it(`${rec.sampleId}: verbatim recorded output passes all 19 checks`, () => {
      const sample = getSampleNotice(rec.sampleId)!;
      const data = rec.extracted as unknown as Record<string, unknown>;
      const checks = [...validateExtraction(data, sample.clerk), ...validateFidelity(data, sample.expected)];
      expect(checks).toHaveLength(19);
      const flagged = checks.filter((c) => !c.pass).map((c) => c.name);
      expect(flagged).toEqual([]);
    });
  });
});
