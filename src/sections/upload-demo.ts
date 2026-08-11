/**
 * The upload path, live: run the production extraction flow (AI seam-map
 * job #1) on one of two sanitized sample documents. The samples are built
 * client- and server-side from the same module (lib/sample-notices.ts), so
 * the text shown to the reader is exactly the text sent to the model.
 *
 * The reader-facing contract mirrors the pilot: the model fills a fixed
 * schema, deterministic checks run in code AFTER it, and nothing enters
 * the calculator until the reader confirms the dates. If any check flags,
 * there is no confirm button — that result routes to a human in
 * production, so here it computes nothing.
 */

import type { Check, ExtractedNotice } from "../../lib/extraction-checks";
import { SAMPLE_NOTICES } from "../../lib/sample-notices";
import { byId, fmt } from "../format";
import { atNoon } from "../../lib/deadlines";
import { focusUrgency } from "./focus-urgency";

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
  const p = el("p", "polish-status" + (alarm ? " flagged" : ""), text);
  return p;
}

export function initUploadDemo(): void {
  const result = byId<HTMLDivElement>("extractResult");
  const buttons = document.querySelectorAll<HTMLButtonElement>(".extract-btn");

  const show = (...nodes: HTMLElement[]): void => {
    result.replaceChildren(...nodes);
    result.hidden = false;
  };

  buttons.forEach((btn) =>
    btn.addEventListener("click", async () => {
      const sampleId = btn.dataset.sample ?? "";
      buttons.forEach((b) => (b.disabled = true));
      const was = btn.textContent;
      btn.textContent = "Reading the document…";
      show(statusLine("Sending the sample's text to the model — the fixed schema and the checks run next."));
      try {
        const resp = await fetch("/api/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sample: sampleId }),
        });
        if (resp.status === 429) {
          show(
            statusLine(
              "Demo quota reached — the deterministic demo still works. The recorded results of the Aug 10 pilot on the real instruments are on the evidence page (/more).",
            ),
          );
          return;
        }
        if (!resp.ok) {
          const body = (await resp.json().catch(() => null)) as { error?: string } | null;
          show(
            statusLine(
              (body?.error ?? "The extraction endpoint is unavailable right now") +
                " — the rest of the page is deterministic and unaffected.",
            ),
          );
          return;
        }
        renderResult((await resp.json()) as ExtractResponse);
      } catch {
        show(statusLine("The extraction endpoint is unavailable right now — the rest of the page is deterministic and unaffected."));
      } finally {
        buttons.forEach((b) => (b.disabled = false));
        btn.textContent = was;
      }
    }),
  );

  function renderResult(data: ExtractResponse): void {
    const nodes: HTMLElement[] = [];

    nodes.push(
      el(
        "p",
        "extract-meta",
        `Extracted by ${data.model} in ${(data.ms / 1000).toFixed(1)}s — sanitized sample based on ${data.basedOn}. Unknowns stay UNKNOWN; the model never guesses.`,
      ),
    );

    // Field table
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
          td.appendChild(el("span", "cite", `model confidence ${c.toFixed(2)} — you confirm, not the model`));
        }
      }
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    nodes.push(wrap);

    // Deterministic checks
    nodes.push(el("h4", undefined, "Checks run in code, after the model"));
    const ul = el("ul", "extract-checks");
    data.checks.forEach((c) => {
      const li = el("li");
      const chip = el("span", "chip " + (c.pass ? "window" : "deadline"), c.pass ? "PASS" : "FLAG");
      li.append(chip, document.createTextNode(" " + c.name));
      ul.appendChild(li);
    });
    nodes.push(ul);

    if (data.allPass && data.extracted.sale_date) {
      const saleIso = data.extracted.sale_date;
      const actions = el("div", "btnrow");
      const confirm = el("button", "abtn", `Confirm these dates — compute the chain for a ${fmt(atNoon(saleIso))} sale`);
      confirm.type = "button";
      confirm.addEventListener("click", () => {
        const typeEl = byId<HTMLSelectElement>("noticeType");
        byId<HTMLInputElement>("noticeDate").value = data.clerk.fileDate;
        byId<HTMLInputElement>("printedSaleDate").value = saleIso;
        typeEl.value = "sale";
        typeEl.dispatchEvent(new Event("change"));
        focusUrgency();
      });
      actions.appendChild(confirm);
      nodes.push(
        statusLine(
          "Nothing has been computed yet — extraction only fills the form. The filing date comes from the Clerk's metadata, and check #1 verified the model's sale date against it.",
        ),
        actions,
      );
    } else {
      nodes.push(
        statusLine(
          "One or more checks flagged. In production this result routes to a human reviewer — so here, nothing is computed from it. That refusal is the design.",
          true,
        ),
      );
    }

    show(...nodes);
  }

  // "The exact text that gets sent" — the same module the server reads.
  SAMPLE_NOTICES.forEach((s) => {
    const slot = document.querySelector<HTMLElement>(`[data-sample-text="${s.id}"]`);
    if (slot) slot.appendChild(el("pre", "tpl", s.text));
  });
}
