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
  /** Servicer named in the underlying public record — keeps the document
   * desk telling the same story as the selected notice. */
  servicer?: string;
}

const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const SCENARIOS: Record<string, Scenario> = {
  // Notice of Substitute Trustee's Sale, filed 2026-04-02 for the Sept 1
  // auction — the instrument in the extraction exhibit (152-day gap).
  "frcl-2290": { type: "sale", noticeIso: () => "2026-04-02", printedSaleIso: "2026-09-01", servicer: "Lakeview Loan Servicing" },
  // Same auction, filed 2026-05-14 (110-day gap).
  "frcl-3493": { type: "sale", noticeIso: () => "2026-05-14", printedSaleIso: "2026-09-01", servicer: "Midland Mortgage (MidFirst Bank)" },
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
  // Always assign: a default-notice scenario must CLEAR any printed sale
  // date a previous scenario set, or switching back to sale mode later
  // would present a stale date as "from your notice".
  printedEl.value = s.printedSaleIso ?? "";
  if (s.servicer) {
    const servicerEl = document.getElementById("gServicer") as HTMLInputElement | null;
    if (servicerEl && servicerEl.value !== s.servicer) {
      servicerEl.value = s.servicer;
      servicerEl.dispatchEvent(new Event("input"));
    }
  }
  // One change event is enough: the editor box re-reads every field.
  typeEl.dispatchEvent(new Event("change"));
  focusUrgency();
}

export function initSampleScenarios(): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(".scenario-btn")];
  // Guards the manual-edit listeners below: applying a scenario dispatches
  // the same change events a manual edit does.
  let applying = false;

  const setActive = (target: HTMLButtonElement | null): void => {
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === target)));
  };

  // The guided tour's next beat (the AI-read offer) listens for this.
  const announce = (sampleId: string | null): void => {
    document.dispatchEvent(new CustomEvent("fn:scenario", { detail: { sampleId } }));
  };

  const SAMPLE_IDS: Record<string, string> = {
    "frcl-2290": "frcl-2026-2290",
    "frcl-3493": "frcl-2026-3493",
  };

  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      const key = btn.dataset.scenario ?? "";
      const s = SCENARIOS[key];
      if (!s) return;
      applying = true;
      applyScenario(s);
      applying = false;
      setActive(btn);
      announce(SAMPLE_IDS[key] ?? null);
    }),
  );

  // Editing the form by hand means the chain no longer shows a sample —
  // clear the selected state and retract the AI offer so nothing lies.
  ["noticeType", "noticeDate", "printedSaleDate"].forEach((id) =>
    byId<HTMLElement>(id).addEventListener("change", () => {
      if (!applying) {
        setActive(null);
        announce(null);
      }
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
