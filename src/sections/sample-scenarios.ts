/**
 * Sample scenarios: one click populates the form and the whole page
 * recomputes — urgency card, chain, kits, document desk. The two real
 * scenarios use only facts already public in this repo (the instruments'
 * file dates and printed sale date from the Harris County Clerk's search);
 * the third is clearly hypothetical and computes its date at click time.
 */

import type { NoticeType } from "./editor-box";
import { byId } from "../format";
import { focusUrgency } from "./focus-urgency";

interface Scenario {
  type: NoticeType;
  noticeIso: () => string;
  printedSaleIso?: string;
}

const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const SCENARIOS: Record<string, Scenario> = {
  // Notice of Substitute Trustee's Sale, filed 2026-04-02 for the Sept 1
  // auction — the instrument in the extraction exhibit (152-day gap).
  "frcl-2290": { type: "sale", noticeIso: () => "2026-04-02", printedSaleIso: "2026-09-01" },
  // Same auction, filed 2026-05-14 (110-day gap).
  "frcl-3493": { type: "sale", noticeIso: () => "2026-05-14", printedSaleIso: "2026-09-01" },
  // HYPOTHETICAL: a notice of default dated one week before the visit.
  hypothetical: {
    type: "default",
    noticeIso: () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return localIso(d);
    },
  },
};

/** The reader's-words test sentence from the hardship-polish exhibit. */
const SAMPLE_WORDS =
  "i got behind becuase my hours got cut at the plant in june, my wife had surgery in july so we had them bills to, im back to full time since august 3 and can pay the regular payment again but not the whole missed amount at once";

function applyScenario(s: Scenario): void {
  const typeEl = byId<HTMLSelectElement>("noticeType");
  const dateEl = byId<HTMLInputElement>("noticeDate");
  const printedEl = byId<HTMLInputElement>("printedSaleDate");

  typeEl.value = s.type;
  dateEl.value = s.noticeIso();
  if (s.printedSaleIso) printedEl.value = s.printedSaleIso;
  // One change event is enough: the editor box re-reads every field.
  typeEl.dispatchEvent(new Event("change"));
  focusUrgency();
}

export function initSampleScenarios(): void {
  document.querySelectorAll<HTMLButtonElement>(".scenario-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const s = SCENARIOS[btn.dataset.scenario ?? ""];
      if (s) applyScenario(s);
    }),
  );

  byId<HTMLButtonElement>("sampleWordsBtn").addEventListener("click", () => {
    const docType = byId<HTMLSelectElement>("docType");
    const changeEl = byId<HTMLInputElement>("gChange");
    docType.value = "hardship";
    docType.dispatchEvent(new Event("input"));
    changeEl.value = SAMPLE_WORDS;
    changeEl.dispatchEvent(new Event("input"));
    changeEl.focus();
  });
}
