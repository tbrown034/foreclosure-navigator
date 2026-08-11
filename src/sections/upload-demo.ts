/**
 * Beat two of the guided tour: after a real-notice scenario computes the
 * chain, ONE offer appears with it — watch AI read the same document.
 *
 * The default path REPLAYS the recorded temperature-0 run (verbatim model
 * output, no API call, no quota) and re-runs all 19 deterministic checks
 * in the visitor's browser at view time, using the same
 * lib/extraction-checks.ts code the server runs. The one choice the page
 * offers is replay vs. live: a quiet "run it live" link makes the real
 * API call. Labels never blur which one the visitor is looking at.
 */

import type { Check, ExtractedNotice } from "../../lib/extraction-checks";
import { validateExtraction, validateFidelity } from "../../lib/extraction-checks";
import { getRecordedExtraction } from "../../lib/recorded-extractions";
import { SAMPLE_NOTICES, getSampleNotice } from "../../lib/sample-notices";
import { byId } from "../format";

interface ExtractResult {
  basedOn: string;
  extracted: ExtractedNotice;
  checks: Check[];
  allPass: boolean;
  meta: string;
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
  let currentViaUpload = false;
  let busy = false;
  // A live call answering after the reader switched cases must not render
  // under the new chain — every fn:scenario invalidates pending responses.
  let scenarioSeq = 0;

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

  function renderOffer(sampleId: string, viaUpload: boolean): void {
    const sample = getSampleNotice(sampleId);
    if (!sample) return;
    offer.replaceChildren();

    const box = el("div", "ai-offer");
    box.append(
      el(
        "p",
        "ai-offer-lede",
        viaUpload
          ? `The dates above came from the Clerk's official index — the AI read was only the key. Compare it with the recorded temperature-0 run of this same instrument, checked nineteen ways in code:`
          : `That chain came from the Clerk's record of ${sample.basedOn}. In production, AI reads the notice itself:`,
      ),
    );
    const btn = el("button", "abtn ai");
    btn.type = "button";
    btn.textContent = viaUpload
      ? "Compare: the recorded AI read, checked →"
      : "Next: replay the AI read of this notice →";
    btn.addEventListener("click", () => playRecorded(sampleId));
    const row = el("div", "btnrow");
    row.append(btn);
    box.append(row);
    box.append(el("p", "ai-offer-fine", "Instant recorded run — nothing is sent anywhere."));
    offer.append(box);
    offer.hidden = false;
  }

  function playRecorded(sampleId: string): void {
    const sample = getSampleNotice(sampleId);
    const recorded = getRecordedExtraction(sampleId);
    if (!sample || !recorded) return;
    const data = recorded.extracted as unknown as Record<string, unknown>;
    const checks = [...validateExtraction(data, sample.clerk), ...validateFidelity(data, sample.expected)];
    renderResult(
      {
        basedOn: sample.basedOn,
        extracted: recorded.extracted,
        checks,
        allPass: checks.every((c) => c.pass),
        meta: `Recorded ${recorded.model} run (temperature 0, captured ${recorded.capturedOn}), replayed verbatim — no API call. The 19 checks re-ran in your browser just now.`,
      },
      sampleId,
      "recorded",
    );
  }

  async function runLive(sampleId: string, trigger: HTMLElement): Promise<void> {
    if (busy) return;
    busy = true;
    const seq = scenarioSeq;
    const status = statusLine("Calling the live API — the model is reading the document now…");
    trigger.replaceWith(status);
    try {
      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample: sampleId }),
      });
      if (seq !== scenarioSeq) return; // the reader moved on — drop it
      if (resp.status === 429) {
        status.textContent =
          "Live-demo quota reached for now — the recorded run above used the same sample and temperature-zero settings, and the chain never depended on either.";
        return;
      }
      if (!resp.ok) {
        const body = (await resp.json().catch(() => null)) as { error?: string } | null;
        status.textContent =
          (body?.error ?? "The live endpoint is unavailable right now") +
          " — the recorded run above stands, and the chain never depended on either.";
        return;
      }
      const parsedAt = (await resp.json()) as unknown;
      if (seq !== scenarioSeq) return; // moved on while parsing — drop it
      const live = parsedAt as {
        basedOn: string;
        extracted: ExtractedNotice;
        checks: Check[];
        allPass: boolean;
        model: string;
        ms: number;
      };
      renderResult(
        {
          basedOn: live.basedOn,
          extracted: live.extracted,
          checks: live.checks,
          allPass: live.allPass,
          meta: `Extracted LIVE by ${live.model} just now, in ${(live.ms / 1000).toFixed(1)}s — checks run server-side in code, after the model.`,
        },
        sampleId,
        "live",
      );
    } catch {
      status.textContent =
        "The live endpoint is unavailable right now — the recorded run above stands, and the chain never depended on either.";
    } finally {
      busy = false;
    }
  }

  function renderResult(data: ExtractResult, sampleId: string, mode: "recorded" | "live"): void {
    const nodes: HTMLElement[] = [];

    nodes.push(el("p", "extract-meta", data.meta));

    // The story first; the payload behind dropdowns.
    if (data.allPass) {
      nodes.push(
        statusLine(
          `It read the sale date as ${data.extracted.sale_date} — matching the Clerk's record the chain used — and every check passed. Code computed the chain; the model just agreed with the record.`,
        ),
      );
    } else {
      nodes.push(
        statusLine(
          "One or more checks flagged. In production this routes to a human reviewer and computes nothing — that refusal is the design. The chain above never depended on the model.",
          true,
        ),
      );
    }

    const fieldsDetails = document.createElement("details");
    fieldsDetails.className = "sample-text";
    const fSummary = document.createElement("summary");
    fSummary.textContent = mode === "recorded" ? "Nine fields extracted by the recorded AI run" : "Nine fields extracted by the live AI run";
    fieldsDetails.appendChild(fSummary);
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
        if (typeof c === "number" && key === "sale_date") {
          td.appendChild(el("span", "cite", `model confidence ${c.toFixed(2)} — a human confirms, not the model`));
        }
      }
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    fieldsDetails.appendChild(wrap);
    nodes.push(fieldsDetails);

    const flaggedCount = data.checks.filter((c) => !c.pass).length;
    const checksDetails = document.createElement("details");
    checksDetails.className = "sample-text";
    if (flaggedCount > 0) checksDetails.open = true;
    const summary = document.createElement("summary");
    summary.textContent =
      flaggedCount === 0
        ? `All ${data.checks.length} checks passed ${mode === "recorded" ? "in your browser, just now" : "in code, after the model"}`
        : `${flaggedCount} of ${data.checks.length} checks FLAGGED`;
    checksDetails.appendChild(summary);
    const ul = el("ul", "extract-checks");
    ul.style.marginTop = "8px";
    data.checks.forEach((c) => {
      const li = el("li");
      const chip = el("span", "chip " + (c.pass ? "window" : "deadline"), c.pass ? "PASS" : "FLAG");
      li.append(chip, document.createTextNode(" " + c.name));
      ul.appendChild(li);
    });
    checksDetails.appendChild(ul);
    nodes.push(checksDetails);

    // The one allowed choice: replay (default, already shown) vs live proof.
    if (mode === "recorded") {
      const liveP = el("p", "ai-offer-fine");
      const liveLink = el("button", "linklike");
      liveLink.type = "button";
      liveLink.textContent = "Not convinced? Run it live against the API →";
      liveLink.addEventListener("click", () => void runLive(sampleId, liveP));
      liveP.append(liveLink);
      nodes.push(liveP);
    }

    // Keep the thread moving into the document desk.
    const nextRow = el("div", "btnrow");
    const next = el("button", "abtn");
    next.type = "button";
    next.textContent = "Next: see what you can do now ↓";
    next.addEventListener("click", () => {
      document.querySelector('section[data-tour="3"]')?.scrollIntoView({ block: "start" });
    });
    nextRow.append(next);
    nodes.push(nextRow);

    showResult(...nodes);
    document.dispatchEvent(new CustomEvent("fn:extracted"));
  }

  // Wire to the scenario beat.
  document.addEventListener("fn:scenario", (e) => {
    const detail = (e as CustomEvent<{ sampleId: string | null; viaUpload?: boolean }>).detail;
    const sampleId = detail.sampleId;
    const viaUpload = detail.viaUpload === true;
    if (sampleId === currentSample && sampleId !== null && viaUpload === currentViaUpload) return;
    scenarioSeq++;
    currentSample = sampleId;
    currentViaUpload = viaUpload;
    clearAll();
    if (sampleId) renderOffer(sampleId, viaUpload);
  });

  // "The exact text that gets sent" — the same module the server reads.
  SAMPLE_NOTICES.forEach((s) => {
    const slot = document.querySelector<HTMLElement>(`[data-sample-text="${s.id}"]`);
    if (slot) slot.appendChild(el("pre", "tpl", s.text));
  });
}
