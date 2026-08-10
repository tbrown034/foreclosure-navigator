/** Document desk: deterministic template assembly, no AI. The reader's
 * facts are slotted into attorney-reviewed-style template language in
 * lib/templates.ts, right in the browser. Rebuilds on every input change
 * and whenever the sale clock changes. */

import type { DocumentType, ReaderGoal } from "../../lib/templates";
import { buildDocument } from "../../lib/templates";
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
  const typeEl = byId<HTMLSelectElement>("docType");
  const servicerEl = byId<HTMLInputElement>("gServicer");
  const goalEl = byId<HTMLSelectElement>("gGoal");
  const changeEl = byId<HTMLInputElement>("gChange");
  const outEl = byId<HTMLPreElement>("docOut");

  const buildDoc = (): void => {
    outEl.textContent = buildDocument(typeEl.value as DocumentType, {
      servicer: servicerEl.value,
      goal: goalEl.value as ReaderGoal,
      change: changeEl.value,
      saleLine: currentSaleLine(),
    });
  };

  [typeEl, servicerEl, goalEl, changeEl].forEach((el) => el.addEventListener("input", buildDoc));
  onSaleInfoChange(buildDoc);
  buildDoc();

  byId<HTMLButtonElement>("dlBtn").addEventListener("click", () => {
    blobDownload(outEl.textContent ?? "");
  });
}
