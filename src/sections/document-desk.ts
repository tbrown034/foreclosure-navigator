/** Draft and call: pick who you need to reach, and the draft assembles in
 * code — no AI, no model call, nothing leaves the page. Empty by default;
 * a service button (or a "Draft the…" button in the what-you-can-do panel,
 * which dispatches fn:draft) loads the matching script or letter directly
 * below the buttons. */

import type { ServiceId } from "../../lib/templates";
import { SERVICES, buildServiceDraft, type ReaderGoal } from "../../lib/templates";
import { byId } from "../format";
import { currentSaleLine, onSaleInfoChange } from "../state";

function blobDownload(data: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type: "text/plain" }));
  a.download = "foreclosure-draft.txt";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function initDocumentDesk(): void {
  const btnRow = byId<HTMLDivElement>("serviceBtns");
  const area = byId<HTMLDivElement>("draftArea");
  const outEl = byId<HTMLPreElement>("docOut");
  const servicerEl = byId<HTMLInputElement>("gServicer");
  const goalEl = byId<HTMLSelectElement>("gGoal");
  const changeEl = byId<HTMLInputElement>("gChange");

  let current: ServiceId | null = null;
  const buttons = new Map<ServiceId, HTMLButtonElement>();

  const rebuild = (): void => {
    if (!current) return;
    outEl.textContent = buildServiceDraft(current, {
      servicer: servicerEl.value,
      goal: goalEl.value as ReaderGoal,
      change: changeEl.value,
      saleLine: currentSaleLine(),
    });
  };

  const select = (id: ServiceId): void => {
    current = id;
    buttons.forEach((b, bid) => b.setAttribute("aria-pressed", String(bid === id)));
    rebuild();
    area.hidden = false;
  };

  SERVICES.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "abtn service-btn " + s.kind;
    b.textContent = s.label;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      select(s.id);
      document.dispatchEvent(new CustomEvent("fn:paperwork"));
    });
    buttons.set(s.id, b);
    btnRow.appendChild(b);
  });

  [servicerEl, goalEl, changeEl].forEach((el) => el.addEventListener("input", rebuild));
  onSaleInfoChange(rebuild);

  // The what-you-can-do panel (and the demo beats) load a service remotely.
  document.addEventListener("fn:draft", (e) => {
    const id = (e as CustomEvent<{ service: ServiceId }>).detail.service;
    if (SERVICES.some((s) => s.id === id)) select(id);
  });

  byId<HTMLButtonElement>("dlBtn").addEventListener("click", () => {
    blobDownload(outEl.textContent ?? "");
  });
}
