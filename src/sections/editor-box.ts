/** Editor box: the notice-type selector and date inputs that feed the chain.
 * Switching to "notice of sale" reveals the printed-sale-date field and
 * relabels the date input; every change re-emits the full editor state. */

import { byId } from "../format";

export type NoticeType = "default" | "sale";

export interface EditorState {
  type: NoticeType;
  /** ISO date on the notice ("" when empty). */
  noticeIso: string;
  /** ISO sale date printed on a notice of sale ("" when empty). */
  printedSaleIso: string;
}

export function initEditorBox(onChange: (state: EditorState) => void): void {
  const typeEl = byId<HTMLSelectElement>("noticeType");
  const dateEl = byId<HTMLInputElement>("noticeDate");
  const printedEl = byId<HTMLInputElement>("printedSaleDate");
  const saleDateWrap = byId<HTMLDivElement>("saleDateWrap");
  const dateLabel = byId<HTMLLabelElement>("noticeDateLabel");

  const emit = (): void => {
    const type = typeEl.value as NoticeType;
    saleDateWrap.hidden = type !== "sale";
    // §51.002(e): service by certified mail is complete when deposited in
    // the mail — so the mailing date, not the letterhead date, starts the
    // cure clock. They usually match; the envelope's postmark settles it.
    dateLabel.textContent =
      type === "sale"
        ? "Date the notice was filed or mailed"
        : "Date the notice of default was mailed (usually the date on the letter — check the postmark)";
    onChange({ type, noticeIso: dateEl.value, printedSaleIso: printedEl.value });
  };

  typeEl.addEventListener("change", emit);
  dateEl.addEventListener("change", emit);
  printedEl.addEventListener("change", emit);
  emit();
}
