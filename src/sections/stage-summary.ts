/**
 * "Where you stand" — the personalized stage readout, directly below the
 * deadline chain. Everything here is computed by lib/stage.ts from the same
 * dates the chain used; no model call, same answer for the same inputs.
 *
 * The recourse rows guide, they don't decide: every kit stays reachable,
 * ordered by what the clock says deserves attention first, and each row's
 * buttons jump straight to the matching kit or pre-select the matching
 * draft in the document desk.
 */

import { stageAssessment, type RecourseStatus } from "../../lib/stage";
import { byId, todayIso } from "../format";
import { getStageInfo, onStageInfoChange } from "../state";

const TIER_CLASS: Record<RecourseStatus["tier"], string> = {
  "act-now": "deadline",
  open: "window",
  confirm: "window",
  "passed-marker": "past",
};

/** Jump without smooth behavior (it silently no-ops in some Chrome
 * configurations, leaving the button looking dead) and flash the landing
 * so the reader sees where they arrived. */
function jumpTo(el: Element): void {
  el.scrollIntoView({ block: "start" });
  el.classList.remove("flash-target");
  // Reflow so re-adding restarts the animation.
  void (el as HTMLElement).offsetWidth;
  el.classList.add("flash-target");
  setTimeout(() => el.classList.remove("flash-target"), 1800);
}

function draftButton(r: RecourseStatus): HTMLButtonElement | null {
  if (!r.draft) return null;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "abtn ghost";
  b.textContent = r.draft === "script" ? "Draft the call" : "Draft the request attachment";
  const draft = r.draft;
  b.addEventListener("click", () => {
    const typeEl = byId<HTMLSelectElement>("docType");
    typeEl.value = draft;
    typeEl.dispatchEvent(new Event("input"));
    const note = byId<HTMLParagraphElement>("deskNote");
    note.textContent = `Draft matched to “${r.title}” — assembled in code from your facts. Edit the facts below; nothing is sent anywhere.`;
    note.hidden = false;
    const desk = document.getElementById("docH")?.closest("section");
    if (desk) jumpTo(desk);
    document.dispatchEvent(new CustomEvent("fn:paperwork"));
  });
  return b;
}

function kitButton(r: RecourseStatus): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "abtn ghost";
  b.textContent = "Open the kit";
  b.addEventListener("click", () => {
    const kit = document.querySelector<HTMLDetailsElement>(`details.action[data-kit="${r.id}"]`);
    if (kit) {
      kit.open = true;
      jumpTo(kit);
    }
  });
  return b;
}

export function initStageSummary(): void {
  const panel = byId<HTMLDivElement>("stagePanel");

  function render(): void {
    const info = getStageInfo();
    if (!info) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }
    const s = stageAssessment(info.kind, info.noticeIso, info.printedSaleIso, todayIso());
    if (!s) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }

    panel.replaceChildren();
    const h = document.createElement("h3");
    h.className = "stage-headline";
    h.textContent = s.headline;
    panel.appendChild(h);

    s.lines.forEach((line) => {
      const p = document.createElement("p");
      p.className = "stage-line";
      p.textContent = line;
      panel.appendChild(p);
    });

    const listLabel = document.createElement("p");
    listLabel.className = "stage-list-label";
    listLabel.textContent = "Questions and draft tools matched to this timeline — ordered by what the clock says, nothing removed:";
    panel.appendChild(listLabel);

    const list = document.createElement("div");
    list.className = "stage-list";
    s.recourses.forEach((r) => {
      const row = document.createElement("div");
      row.className = "stage-row " + TIER_CLASS[r.tier];
      const head = document.createElement("div");
      head.className = "stage-row-head";
      const title = document.createElement("strong");
      title.textContent = r.title;
      const chip = document.createElement("span");
      chip.className = "chip " + TIER_CLASS[r.tier];
      chip.textContent = r.label;
      head.append(title, chip);
      const note = document.createElement("p");
      note.textContent = r.note;
      const btns = document.createElement("div");
      btns.className = "btnrow";
      const d = draftButton(r);
      if (d) btns.appendChild(d);
      btns.appendChild(kitButton(r));
      row.append(head, note, btns);
      list.appendChild(row);
    });
    panel.appendChild(list);

    const foot = document.createElement("p");
    foot.className = "quiet-alts";
    foot.textContent =
      "Computed in code from the dates above — no AI. General legal information, not legal advice; windows the statute doesn't fix (like reinstatement cutoffs) belong to your loan documents, the servicer and a lawyer.";
    panel.appendChild(foot);

    panel.hidden = false;
    document.dispatchEvent(new CustomEvent("fn:stage"));
  }

  onStageInfoChange(render);
  render();
}
