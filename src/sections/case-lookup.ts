/**
 * The real front door (Goal 1): look up an actual September 2026 Harris
 * County filing by its instrument number against the Clerk's own index
 * (public/data/frcl-index.json — metadata only: file number and dates,
 * ingested from the county's public foreclosure search). Found cases fill
 * the same calculator the demo uses; nothing is invented.
 *
 * Saved case: localStorage ONLY — nothing leaves the browser, and the
 * page says so where it appears.
 */

import { normalizeDocId } from "../../lib/lookup";
import { byId } from "../format";
import { focusUrgency } from "./focus-urgency";

export { normalizeDocId };

interface Filing {
  docId: string;
  saleDate: string;
  fileDate: string;
  pages: number;
}

interface FrclIndex {
  asOf: string;
  count: number;
  filings: Filing[];
}

let indexCache: FrclIndex | null = null;

async function loadIndex(): Promise<FrclIndex | null> {
  if (indexCache) return indexCache;
  try {
    const resp = await fetch("/data/frcl-index.json");
    if (!resp.ok) return null;
    indexCache = (await resp.json()) as FrclIndex;
    return indexCache;
  } catch {
    return null;
  }
}

/** Instruments we hold recorded temperature-0 model runs for — looking
 * one of these up (the demo case included) unlocks the AI beat, because
 * the replay is of that exact instrument. All other cases never touch AI. */
const RECORDED_SAMPLE_IDS: Record<string, string> = {
  "FRCL-2026-2290": "frcl-2026-2290",
  "FRCL-2026-3493": "frcl-2026-3493",
};

function applyFiling(f: Filing, viaUpload = false): void {
  const typeEl = byId<HTMLSelectElement>("noticeType");
  byId<HTMLInputElement>("noticeDate").value = f.fileDate;
  byId<HTMLInputElement>("printedSaleDate").value = f.saleDate;
  typeEl.value = "sale";
  typeEl.dispatchEvent(new Event("change"));
  document.dispatchEvent(
    new CustomEvent("fn:scenario", {
      detail: { sampleId: RECORDED_SAMPLE_IDS[f.docId] ?? null, viaUpload },
    }),
  );
  focusUrgency();
}

/** The upload door hands verified filings off through here, so its results
 * take exactly the road a typed file number takes — flagged as
 * upload-originated so the AI offer can present itself as a comparison
 * rather than a first read. Assigned during init. */
export let lookupDocId: (docId: string, viaUpload: boolean) => void = () => {};

const SAVE_KEY = "fn-saved-case";

function reminderSchedule(saleIso: string): Array<{ date: string; label: string }> {
  const sale = new Date(saleIso + "T12:00:00");
  const fmtd = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const minus = (n: number) => {
    const d = new Date(sale);
    d.setDate(d.getDate() - n);
    return d;
  };
  return [
    { date: fmtd(minus(38)), label: "38 days out — the Reg X window marker on this page" },
    { date: fmtd(minus(21)), label: "21 days out — the statutory notice minimum" },
    { date: fmtd(minus(7)), label: "one week out" },
    { date: fmtd(minus(1)), label: "day before the printed sale date" },
  ];
}

export function initCaseLookup(): void {
  const input = byId<HTMLInputElement>("caseNumber");
  const btn = byId<HTMLButtonElement>("findCaseBtn");
  const out = byId<HTMLDivElement>("lookupResult");

  const show = (html: string): void => {
    out.innerHTML = html;
    out.hidden = false;
  };

  async function find(viaUpload = false): Promise<void> {
    const norm = normalizeDocId(input.value);
    if (!norm) {
      show('<p class="polish-status">Enter the file number from the notice — it looks like FRCL-2026-1234.</p>');
      return;
    }
    const idx = await loadIndex();
    if (!idx) {
      show('<p class="polish-status">The index could not be loaded right now — the calculator below still works with dates entered manually.</p>');
      return;
    }
    const filing = idx.filings.find((f) => f.docId === norm);
    if (!filing) {
      show(
        `<p class="polish-status">${norm} is not in this index of ${idx.count} filings for the September 1, 2026 sale (as of ${new Date(idx.asOf).toLocaleDateString("en-US", { month: "short", day: "numeric" })}). ` +
          `Newer filings post daily — <a href="https://cclerk.hctx.net/applications/websearch/FRCL_R.aspx" target="_blank" rel="noopener">search the Clerk's record directly</a>, or enter the dates from the notice manually below.</p>`,
      );
      return;
    }
    show(
      `<p class="polish-status"><strong>${filing.docId}</strong> — filed ${filing.fileDate} for the September 1, 2026 sale, per the Clerk's public index. The chain below is computed from those official dates. ` +
        `<button type="button" class="linklike" id="saveCaseBtn">Save on this device</button></p>`,
    );
    applyFiling(filing, viaUpload);
    byId<HTMLButtonElement>("saveCaseBtn").addEventListener("click", () => {
      localStorage.setItem(SAVE_KEY, JSON.stringify(filing));
      renderSaved();
    });
  }

  btn.addEventListener("click", () => void find());
  lookupDocId = (docId, viaUpload) => {
    input.value = docId;
    void find(viaUpload);
  };
  // The demo case: a real filing that also carries a recorded model run,
  // so the guided AI beat follows the chain.
  document.getElementById("demoCase")?.addEventListener("click", () => {
    input.value = "FRCL-2026-2290";
    void find().then(() => {
      // Make sure a scared reader can't mistake the demo for their case.
      const first = out.querySelector("p");
      first?.insertAdjacentText("afterbegin", "Demo case (a real recorded filing, not yours): ");
    });
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void find();
  });

  // Saved case (localStorage only).
  function renderSaved(): void {
    const slot = byId<HTMLDivElement>("savedCase");
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      slot.hidden = true;
      slot.replaceChildren();
      return;
    }
    let f: Filing;
    try {
      f = JSON.parse(raw) as Filing;
      if (typeof f.docId !== "string" || !/^FRCL-2026-\d{1,4}$/.test(f.docId) ||
          !/^2026-\d{2}-\d{2}$/.test(f.saleDate ?? "") || !/^2026-\d{2}-\d{2}$/.test(f.fileDate ?? "")) {
        throw new Error("malformed");
      }
    } catch {
      localStorage.removeItem(SAVE_KEY);
      slot.hidden = true;
      return;
    }
    const sched = reminderSchedule(f.saleDate)
      .map((r) => `<li>${r.date} — ${r.label}</li>`)
      .join("");
    slot.innerHTML =
      `<p style="margin:0 0 4px"><strong>Saved case: ${f.docId}</strong> — sale date Sep 1, 2026. ` +
      `<button type="button" class="linklike" id="openSaved">Open</button> · <button type="button" class="linklike" id="forgetSaved">Remove</button></p>` +
      `<p class="quiet-alts" style="margin:0 0 4px">Reminder schedule a production version would offer by email or text — this demo stores the case in this browser only; nothing leaves your device:</p>` +
      `<ul class="extract-checks" style="margin:0">${sched}</ul>`;
    slot.hidden = false;
    byId<HTMLButtonElement>("openSaved").addEventListener("click", () => applyFiling(f));
    byId<HTMLButtonElement>("forgetSaved").addEventListener("click", () => {
      localStorage.removeItem(SAVE_KEY);
      renderSaved();
    });
  }
  renderSaved();
}
