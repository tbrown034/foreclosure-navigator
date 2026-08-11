/** The draft dock: one shared, movable drafting panel that mounts INSIDE
 * whichever what-you-can-do row asked for it. A row's "Call — get the
 * script" / "Email — draft it" button dispatches fn:draft with the
 * service and its host row; the dock (facts editor + the code-built
 * draft + download) attaches there and rebuilds live as facts change.
 * No AI, no model call, nothing leaves the page. */

import type { ServiceId } from "../../lib/templates";
import { buildServiceDraft, type ReaderGoal } from "../../lib/templates";
import { currentSaleLine, onSaleInfoChange } from "../state";

function blobDownload(data: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type: "text/plain" }));
  a.download = "foreclosure-draft.txt";
  a.click();
  URL.revokeObjectURL(a.href);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function initDocumentDesk(): void {
  // Build the dock once; it moves between rows.
  const dock = el("div", "draft-dock");
  dock.hidden = true;

  const lede = el("p", "quiet-alts");
  lede.textContent =
    "Assembled in code from your facts, right here — no AI, and nothing you type leaves this page. A draft, not legal advice; this template has not been reviewed by Texas housing counsel.";

  const facts = document.createElement("details");
  facts.className = "sample-text";
  facts.innerHTML =
    "<summary>Facts used in this draft — edit any of them</summary>" +
    '<label for="gServicer">Servicer / sender on your notice</label>' +
    '<input type="text" id="gServicer" class="text-input" value="" placeholder="The sender named on your notice" />' +
    '<label for="gGoal">What are you trying to do?</label>' +
    '<select id="gGoal">' +
    '<option value="keep">Keep the home (catch up or modify)</option>' +
    '<option value="time">Buy time to sell it myself</option>' +
    '<option value="understand">Understand what I received</option>' +
    "</select>" +
    '<label for="gChange">One fact in your own words (what happened / what changed)</label>' +
    '<input type="text" id="gChange" class="text-input" value="" placeholder="One sentence, your words — or leave blank" />';

  const out = el("pre");
  out.id = "docOut";

  const row = el("div", "btnrow");
  const dl = el("button", undefined, "Download this draft");
  dl.type = "button";
  dl.id = "dlBtn";
  dl.addEventListener("click", () => blobDownload(out.textContent ?? ""));
  const close = el("button", "linklike", "Close draft");
  close.type = "button";
  close.addEventListener("click", () => {
    dock.hidden = true;
  });
  row.append(dl, close);

  dock.append(lede, facts, out, row);

  let current: ServiceId | null = null;

  const servicerEl = facts.querySelector<HTMLInputElement>("#gServicer")!;
  const goalEl = facts.querySelector<HTMLSelectElement>("#gGoal")!;
  const changeEl = facts.querySelector<HTMLInputElement>("#gChange")!;

  const rebuild = (): void => {
    if (!current) return;
    out.textContent = buildServiceDraft(current, {
      servicer: servicerEl.value,
      goal: goalEl.value as ReaderGoal,
      change: changeEl.value,
      saleLine: currentSaleLine(),
    });
  };

  [servicerEl, goalEl, changeEl].forEach((e) => e.addEventListener("input", rebuild));
  onSaleInfoChange(rebuild);

  // Attached (hidden) from the start so #gServicer etc. are findable.
  document.body.appendChild(dock);

  document.addEventListener("fn:draft", (e) => {
    const detail = (e as CustomEvent<{ service: ServiceId; host?: HTMLElement }>).detail;
    current = detail.service;
    rebuild();
    if (detail.host) detail.host.appendChild(dock);
    dock.hidden = false;
    dock.scrollIntoView({ block: "nearest" });
  });
}
