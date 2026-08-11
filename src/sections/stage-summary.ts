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
import { buildKitContent } from "./action-kits";
import { byId, todayIso } from "../format";
import { getStageInfo, onStageInfoChange, type StageInfo } from "../state";

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

function draftButton(r: RecourseStatus, row: HTMLDivElement): HTMLButtonElement | null {
  if (!r.draft) return null;
  const service = r.draft;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "abtn primary";
  b.textContent = service === "legal" || service === "servicer" ? "Call — get the script" : "Email — draft it";
  b.setAttribute("aria-label", `${service === "legal" || service === "servicer" ? "Get the call script" : "Draft the email"} for ${r.title}`);
  b.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("fn:draft", { detail: { service, host: row } }));
    document.dispatchEvent(new CustomEvent("fn:paperwork"));
  });
  return b;
}

/** "Tell me more" expands the kit's full content INSIDE the row — no
 * jumping away to a second list. Built lazily on first open. */
function kitToggle(r: RecourseStatus, row: HTMLDivElement): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "abtn ghost";
  b.textContent = "Tell me more";
  b.setAttribute("aria-label", `Tell me more about ${r.title}`);
  b.setAttribute("aria-expanded", "false");
  let body: HTMLDivElement | null = null;
  b.addEventListener("click", () => {
    if (!body) {
      body = buildKitContent(r.id);
      if (!body) return;
      body.classList.add("row-kit");
      row.appendChild(body);
    } else {
      body.hidden = !body.hidden;
    }
    const open = !body.hidden;
    b.setAttribute("aria-expanded", String(open));
    b.textContent = open ? "Show less" : "Tell me more";
    // Growing the document at the bottom can shove the viewport past the
    // content — keep the row where the reader can see it.
    if (open) row.scrollIntoView({ block: "nearest" });
  });
  return b;
}

/** The one generative moment on the reader's path — clearly labeled,
 * optional, and double-checked: the server recomputes the same stage
 * facts in code, the model restates them in plain words, and a token
 * guard rejects any output containing a date or number not in the facts. */
function aiSummaryBox(info: StageInfo, autorun: boolean): HTMLDivElement {
  const box = document.createElement("div");
  box.className = "ai-summary";
  const tag = document.createElement("p");
  tag.className = "ai-badge";
  tag.textContent = "AI summary — optional live model call";
  const row = document.createElement("div");
  row.className = "btnrow";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "abtn ai";
  btn.textContent = "Put this in plain words →";
  row.appendChild(btn);
  const fine = document.createElement("p");
  fine.className = "ai-offer-fine";
  fine.textContent =
    "Sends only the computed facts above — no personal data — to Anthropic's Claude Haiku; a code check rejects any output containing a date or number that isn't in those facts.";
  const out = document.createElement("div");
  out.hidden = true;
  box.append(tag, row, fine, out);

  const run = (): void => {
    btn.disabled = true;
    btn.textContent = "The model is reading the computed facts…";
    void (async () => {
      try {
        const resp = await fetch("/api/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: info.kind,
            noticeIso: info.noticeIso,
            printedSaleIso: info.printedSaleIso,
            todayIso: todayIso(),
          }),
        });
        const data = (await resp.json()) as { summary?: string; flagged?: boolean; flag_reason?: string; error?: string };
        out.replaceChildren();
        const label = document.createElement("p");
        label.className = "ai-badge";
        const body = document.createElement("p");
        body.className = "ai-summary-text";
        if (resp.ok && data.summary) {
          label.textContent = "AI-generated from the computed panel below — dates and numbers checked in code; compare with the panel:";
          body.textContent = data.summary;
        } else if (data.flagged) {
          label.textContent = "The code check rejected the model's output:";
          body.textContent = (data.flag_reason ?? "guard rejection") + ". The computed panel above stands — that's the contract.";
        } else {
          label.textContent = "No AI summary right now:";
          body.textContent = (data.error ?? "the endpoint is unavailable") + " — the computed panel above stands.";
        }
        out.append(label, body);
        out.hidden = false;
        row.hidden = true;
        fine.hidden = true;
      } catch {
        btn.disabled = false;
        btn.textContent = "Put this in plain words →";
      }
    })();
  };
  btn.addEventListener("click", run);
  // A document was just handed over — the plain-words readout shouldn't
  // need a second ask. Typed and demo paths keep the explicit button.
  if (autorun) run();
  return box;
}

export function initStageSummary(): void {
  const panel = byId<HTMLDivElement>("stagePanel");

  // Set by fn:scenario when the current notice arrived through the upload
  // door; consumed by the next render.
  let uploadOriginated = false;
  document.addEventListener("fn:scenario", (e) => {
    uploadOriginated = (e as CustomEvent<{ viaUpload?: boolean }>).detail?.viaUpload === true;
  });

  const emptyHint = (): HTMLParagraphElement => {
    const p = document.createElement("p");
    p.className = "quiet-alts";
    p.textContent =
      "Load a notice above and this list personalizes to your dates — which windows are open, what deserves attention first. The kits below work either way.";
    return p;
  };

  function render(): void {
    const info = getStageInfo();
    const s = info ? stageAssessment(info.kind, info.noticeIso, info.printedSaleIso, todayIso()) : null;
    if (!s) {
      panel.replaceChildren(emptyHint());
      const cards = document.getElementById("actionCards");
      if (cards) cards.hidden = false;
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
    listLabel.textContent = "Ordered by your clock — nothing is removed:";
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
      const d = draftButton(r, row);
      if (d) btns.appendChild(d);
      btns.appendChild(kitToggle(r, row));
      row.append(head, note, btns);
      list.appendChild(row);
    });
    panel.appendChild(list);

    const foot = document.createElement("p");
    foot.className = "quiet-alts";
    foot.textContent =
      "Everything above is computed in code from the dates on the notice — no AI. Windows the statute doesn't fix (like reinstatement cutoffs) belong to your loan documents, the servicer and a lawyer.";
    panel.appendChild(foot);

    if (info) {
      panel.insertBefore(aiSummaryBox(info, uploadOriginated), listLabel);
      uploadOriginated = false;
    }

    // The panel replaces the standalone kit list — same six, personalized.
    const cards = document.getElementById("actionCards");
    if (cards) cards.hidden = true;

    document.dispatchEvent(new CustomEvent("fn:stage"));
  }

  onStageInfoChange(render);
  render();
}
