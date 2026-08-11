/**
 * Beat two of the guided tour: after a real-notice scenario computes the
 * chain, ONE offer appears with it — watch AI read the same document,
 * live. No parallel entry point, no decision: the deterministic chain
 * comes first, the model reads second, and the checks judge it in front
 * of the visitor.
 *
 * The samples are built client- and server-side from the same module
 * (lib/sample-notices.ts), so the text shown to the reader is exactly the
 * text sent to the model. The chain is never computed from model output
 * here — the scenario already filled it from the Clerk's public dates,
 * and check #1 verifies the model's sale date against that same record.
 */

import type { Check, ExtractedNotice } from "../../lib/extraction-checks";
import { SAMPLE_NOTICES, getSampleNotice } from "../../lib/sample-notices";
import { byId } from "../format";

interface ExtractResponse {
  sample: string;
  basedOn: string;
  extracted: ExtractedNotice;
  clerk: { fileDate: string; saleDate: string };
  checks: Check[];
  allPass: boolean;
  model: string;
  ms: number;
}

const FIELD_LABELS: Array<[keyof ExtractedNotice, string]> = [
  ["notice_type", "Notice type"],
  ["sale_date", "Sale date"],
  ["sale_time_window", "Sale window"],
  ["sale_location", "Sale location"],
  ["county", "County"],
  ["trustee_or_substitute", "Substitute trustee"],
  ["lender_or_mortgagee", "Lender / mortgagee"],
  ["servicer_if_stated", "Servicer (if stated)"],
  ["deed_of_trust_date", "Deed of trust date"],
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function statusLine(text: string, alarm = false): HTMLParagraphElement {
  return el("p", "polish-status" + (alarm ? " flagged" : ""), text);
}

export function initUploadDemo(): void {
  const offer = byId<HTMLDivElement>("aiOffer");
  const result = byId<HTMLDivElement>("extractResult");
  let currentSample: string | null = null;
  let busy = false;

  const showResult = (...nodes: HTMLElement[]): void => {
    result.replaceChildren(...nodes);
    result.hidden = false;
  };

  const clearAll = (): void => {
    offer.hidden = true;
    offer.replaceChildren();
    result.hidden = true;
    result.replaceChildren();
  };

  function renderOffer(sampleId: string): void {
    const sample = getSampleNotice(sampleId);
    if (!sample) return;
    offer.replaceChildren();

    const box = el("div", "ai-offer");
    box.append(
      el(
        "p",
        "ai-offer-lede",
        `That chain was computed in code from the Clerk's public record of ${sample.basedOn}. In production, AI would read the notice itself — watch it happen, live, with every check run in code:`,
      ),
    );
    const btn = el("button", "abtn ai");
    btn.type = "button";
    btn.textContent = "Next: watch AI read this notice →";
    btn.addEventListener("click", () => void runExtraction(sampleId, btn));
    const row = el("div", "btnrow");
    row.append(btn);
    box.append(row);
    box.append(
      el(
        "p",
        "ai-offer-fine",
        "Optional. Sends the sanitized sample's text (nothing of yours) to Claude Haiku — full disclosure under “About these samples” above.",
      ),
    );
    offer.append(box);
    offer.hidden = false;
  }

  async function runExtraction(sampleId: string, btn: HTMLButtonElement): Promise<void> {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "Reading the document…";
    showResult(statusLine("Sending the sample's text to the model — the fixed schema and the checks run next."));
    try {
      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample: sampleId }),
      });
      if (resp.status === 429) {
        showResult(
          statusLine(
            "Demo quota reached — the chain above is deterministic and unaffected. The recorded results of the Aug 10 pilot on the real instruments are on the evidence page (/more).",
          ),
        );
        return;
      }
      if (!resp.ok) {
        const body = (await resp.json().catch(() => null)) as { error?: string } | null;
        showResult(
          statusLine(
            (body?.error ?? "The extraction endpoint is unavailable right now") +
              " — the chain above is deterministic and unaffected.",
          ),
        );
        return;
      }
      renderResult((await resp.json()) as ExtractResponse);
    } catch {
      showResult(statusLine("The extraction endpoint is unavailable right now — the chain above is deterministic and unaffected."));
    } finally {
      busy = false;
      btn.disabled = false;
      btn.textContent = was;
    }
  }

  function renderResult(data: ExtractResponse): void {
    const nodes: HTMLElement[] = [];

    nodes.push(
      el(
        "p",
        "extract-meta",
        `Extracted by ${data.model} in ${(data.ms / 1000).toFixed(1)}s — sanitized sample based on ${data.basedOn}. Unknowns stay UNKNOWN; the model never guesses.`,
      ),
    );

    const wrap = el("div", "extract-table-wrap");
    const table = el("table", "ledger");
    const tbody = el("tbody");
    const conf = data.extracted.confidence ?? {};
    FIELD_LABELS.forEach(([key, label]) => {
      const tr = el("tr");
      tr.appendChild(el("td", undefined, label));
      const value = data.extracted[key];
      const td = el("td");
      if (value === null || value === undefined || value === "") {
        td.appendChild(el("span", "extract-unknown", "UNKNOWN — not in the document"));
      } else {
        td.textContent = String(value);
        const c = conf[key as string];
        if (typeof c === "number") {
          td.appendChild(el("span", "cite", `model confidence ${c.toFixed(2)} — a human confirms, not the model`));
        }
      }
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    nodes.push(wrap);

    nodes.push(el("h4", undefined, "Checks run in code, after the model"));
    const ul = el("ul", "extract-checks");
    data.checks.forEach((c) => {
      const li = el("li");
      const chip = el("span", "chip " + (c.pass ? "window" : "deadline"), c.pass ? "PASS" : "FLAG");
      li.append(chip, document.createTextNode(" " + c.name));
      ul.appendChild(li);
    });
    nodes.push(ul);

    if (data.allPass) {
      nodes.push(
        statusLine(
          "Same record, two readers: the chain above was computed in code from the Clerk's public dates. The model just read the document text — and check #1 confirms its sale date matches the record the chain used.",
        ),
      );
    } else {
      nodes.push(
        statusLine(
          "One or more checks flagged. In production this result routes to a human reviewer and computes nothing — that refusal is the design. The chain above is untouched: it never depended on the model.",
          true,
        ),
      );
    }

    // Beat three: keep the thread moving into the document desk.
    const nextRow = el("div", "btnrow");
    const next = el("button", "abtn");
    next.type = "button";
    next.textContent = "Next: the paperwork — polish a homeowner's own words ↓";
    next.addEventListener("click", () => {
      const docType = byId<HTMLSelectElement>("docType");
      docType.value = "hardship";
      docType.dispatchEvent(new Event("input"));
      byId<HTMLButtonElement>("sampleWordsBtn").click();
      byId<HTMLElement>("docH").scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    nextRow.append(next);
    nodes.push(nextRow);

    showResult(...nodes);
  }

  // Wire to the scenario beat.
  document.addEventListener("fn:scenario", (e) => {
    const sampleId = (e as CustomEvent<{ sampleId: string | null }>).detail.sampleId;
    if (sampleId === currentSample && sampleId !== null) return;
    currentSample = sampleId;
    clearAll();
    if (sampleId) renderOffer(sampleId);
  });

  // "The exact text that gets sent" — the same module the server reads.
  SAMPLE_NOTICES.forEach((s) => {
    const slot = document.querySelector<HTMLElement>(`[data-sample-text="${s.id}"]`);
    if (slot) slot.appendChild(el("pre", "tpl", s.text));
  });
}
