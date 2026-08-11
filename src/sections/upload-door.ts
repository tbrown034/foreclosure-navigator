/**
 * The upload door — the production seam, live. A recorded notice PDF goes
 * to the model with one job: read the county stamp (file number + FILED
 * date) and the printed sale date. Code then requires all three to exactly
 * match one row of the Clerk's official index before anything is computed —
 * the chain that renders comes from the official record, never from the
 * model. A mismatch or a missing stamp renders as an unverified read-only
 * receipt, with the Clerk link and manual entry as the honest fallbacks.
 *
 * The two bundled fictional samples (John Smith, SAMPLE-2026-A/B) travel
 * the same road, verifying against the in-code sample table instead.
 */

import { byId } from "../format";
import { lookupDocId } from "./case-lookup";

interface UploadResponse {
  mode?: string;
  verified?: boolean;
  filing?: { docId: string; fileDate: string; saleDate: string } | null;
  sampleDoc?: { docId: string; fileDate: string; saleDate: string; label: string } | null;
  extracted?: {
    file_number: string | null;
    file_date: string | null;
    sale_date: string | null;
    county: string | null;
    notice_type: string | null;
  };
  ms?: number;
  model?: string;
  reason?: string;
  error?: string;
}

const MAX_FILE_BYTES = 3 * 1024 * 1024;

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const url = r.result as string;
      resolve(url.slice(url.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export function initUploadDoor(): void {
  const doorBtn = byId<HTMLButtonElement>("uploadDoor");
  const panel = byId<HTMLDivElement>("uploadPanel");
  const fileInput = byId<HTMLInputElement>("noticeFile");
  const status = byId<HTMLDivElement>("uploadStatus");

  doorBtn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    doorBtn.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) panel.scrollIntoView({ block: "nearest" });
  });

  const say = (html: null, text?: string): void => {
    status.replaceChildren();
    if (text !== undefined) {
      const p = document.createElement("p");
      p.className = "polish-status";
      p.textContent = text;
      status.appendChild(p);
    }
    status.hidden = false;
  };

  function receipt(kind: "official" | "sample"): HTMLParagraphElement {
    const p = document.createElement("p");
    p.className = "polish-status";
    const strong = document.createElement("strong");
    strong.textContent = "AI extracted → code checked → " + (kind === "official" ? "Clerk record matched → official dates computed." : "sample record matched → sample dates computed.");
    p.appendChild(strong);
    const rest = document.createElement("span");
    rest.textContent =
      kind === "official"
        ? " The file number, filing date and sale date the model read all match one row of the county's public index — the chain below uses the official record's dates, not the model's."
        : " This is the fictional John Smith sample — the three fields the model read match the sample's in-code record, the same check a real notice gets against the county index.";
    p.appendChild(rest);
    return p;
  }

  function unverified(r: UploadResponse): void {
    status.replaceChildren();
    const p = document.createElement("p");
    p.className = "polish-status";
    const strong = document.createElement("strong");
    strong.textContent = "AI read — unverified. No deadlines were computed from it.";
    p.appendChild(strong);
    const why = document.createElement("span");
    why.textContent = ` Reason: ${r.reason ?? "the read could not be confirmed"}. `;
    p.appendChild(why);
    status.appendChild(p);

    const e = r.extracted;
    if (e) {
      const ul = document.createElement("ul");
      ul.className = "extract-checks";
      const rows: Array<[string, string | null]> = [
        ["File number read", e.file_number],
        ["Filed date read", e.file_date],
        ["Sale date read", e.sale_date],
      ];
      rows.forEach(([label, val]) => {
        const li = document.createElement("li");
        li.textContent = `${label}: ${val ?? "not legible"}`;
        ul.appendChild(li);
      });
      status.appendChild(ul);
    }
    const foot = document.createElement("p");
    foot.className = "quiet-alts";
    foot.append("Not found can simply mean the filing is outside this September 1 index snapshot (as of Aug 10) or was posted later — it says nothing about the notice itself. ");
    const a = document.createElement("a");
    a.href = "https://cclerk.hctx.net/applications/websearch/FRCL_R.aspx";
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Check the Clerk's record directly";
    foot.appendChild(a);
    foot.append(", verify the dates there, and enter them manually above — the chain works the same.");
    status.appendChild(foot);
    status.hidden = false;
  }

  // Stale-response guard: only the latest upload may touch the page.
  let runSeq = 0;

  /** A new upload means the notice on screen is no longer the reader's
   * subject — clear the chain so a failed or unverified read can never
   * leave someone else's deadlines standing under their document. */
  function clearNoticeState(): void {
    const typeEl = byId<HTMLSelectElement>("noticeType");
    byId<HTMLInputElement>("noticeDate").value = "";
    byId<HTMLInputElement>("printedSaleDate").value = "";
    typeEl.dispatchEvent(new Event("change"));
    const lookup = byId<HTMLDivElement>("lookupResult");
    lookup.hidden = true;
    lookup.replaceChildren();
  }

  async function run(pdf: Blob, sourceLabel: string): Promise<void> {
    if (pdf.size > MAX_FILE_BYTES) {
      say(null, "That file is over 3 MB — the recorded notices themselves are typically well under 1 MB. Try the Clerk's copy of the instrument.");
      return;
    }
    const seq = ++runSeq;
    clearNoticeState();
    say(null, `Reading ${sourceLabel} with Claude Haiku (temperature 0)… the model's only job is the county stamp and the printed dates; code does the verifying.`);
    let data: UploadResponse;
    try {
      const b64 = await toBase64(pdf);
      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pdf: b64 }),
      });
      data = (await resp.json()) as UploadResponse;
      if (seq !== runSeq) return; // a newer upload superseded this one
      if (!resp.ok) {
        say(null, data.error ?? "The read failed — nothing was computed. The lookup and manual entry above still work.");
        return;
      }
    } catch {
      if (seq !== runSeq) return;
      say(null, "The read failed — nothing was computed. The lookup and manual entry above still work.");
      return;
    }

    if (data.verified && data.filing) {
      status.replaceChildren(receipt("official"));
      status.hidden = false;
      // Hand off to the same lookup path a typed file number takes,
      // flagged upload-originated so the AI offer reads as a comparison.
      lookupDocId(data.filing.docId, true);
      return;
    }
    if (data.verified && data.sampleDoc) {
      status.replaceChildren(receipt("sample"));
      status.hidden = false;
      const typeEl = byId<HTMLSelectElement>("noticeType");
      byId<HTMLInputElement>("noticeDate").value = data.sampleDoc.fileDate;
      byId<HTMLInputElement>("printedSaleDate").value = data.sampleDoc.saleDate;
      typeEl.value = "sale";
      typeEl.dispatchEvent(new Event("change"));
      document.dispatchEvent(new CustomEvent("fn:scenario", { detail: { sampleId: null, viaUpload: true } }));
      document.getElementById("urgency")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    unverified(data);
  }

  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      say(null, "PDF only for this demo — the Clerk's recorded copies download as PDFs.");
      return;
    }
    void run(f, "your document");
  });

  const wireSample = (btnId: string, path: string, label: string): void => {
    document.getElementById(btnId)?.addEventListener("click", async () => {
      try {
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(String(resp.status));
        await run(await resp.blob(), label);
      } catch {
        say(null, "The sample could not be loaded right now.");
      }
    });
  };
  wireSample("trySampleA", "/samples/sample-notice-a.pdf", "fictional sample A");
  wireSample("trySampleB", "/samples/sample-notice-b.pdf", "fictional sample B");
}
