/**
 * The one live AI feature on the page: optional polish of the reader's own
 * sentence (the "one fact in your own words" field). Everything else on the
 * page is deterministic and keeps working if this endpoint is absent, over
 * quota, or down — the button degrades to a plain status message.
 *
 * The server (api/polish.ts) enforces the contract: grammar, spelling,
 * structure and tone only; a deterministic check rejects model output that
 * contains a digit run, month name or number/amount word absent from the
 * input. The reader approves
 * or discards the result — nothing is applied without a click.
 */

import { byId } from "../format";

interface PolishResponse {
  polished: string;
  facts_used: string[];
  flagged?: boolean;
  flag_reason?: string;
}

const QUOTA_MESSAGE = "Demo quota reached — the deterministic demo still works.";

function h4(text: string): HTMLHeadingElement {
  const e = document.createElement("h4");
  e.textContent = text;
  return e;
}

function tpl(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "tpl";
  p.style.fontFamily = "inherit";
  p.textContent = text;
  return p;
}

function status(text: string, flagged = false): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "polish-status" + (flagged ? " flagged" : "");
  p.textContent = text;
  return p;
}

export function initPolishDemo(): void {
  const btn = byId<HTMLButtonElement>("polishBtn");
  const result = byId<HTMLDivElement>("polishResult");
  const changeEl = byId<HTMLInputElement>("gChange");

  const show = (...nodes: HTMLElement[]): void => {
    result.replaceChildren(...nodes);
    result.hidden = false;
  };

  btn.addEventListener("click", async () => {
    const original = changeEl.value.trim();
    if (!original) {
      show(status("Type your sentence in the field above first."));
      return;
    }
    if (original.length > 1200) {
      show(status("The demo polishes up to 1,200 characters."));
      return;
    }

    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "Polishing…";
    try {
      const resp = await fetch("/api/polish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: original }),
      });
      if (resp.status === 429) {
        show(status(QUOTA_MESSAGE));
        return;
      }
      if (!resp.ok) {
        show(status("The polish endpoint is unavailable right now — the deterministic demo still works."));
        return;
      }
      const data = (await resp.json()) as PolishResponse;
      renderComparison(original, data);
    } catch {
      show(status("The polish endpoint is unavailable right now — the deterministic demo still works."));
    } finally {
      btn.disabled = false;
      btn.textContent = was;
    }
  });

  function renderComparison(original: string, data: PolishResponse): void {
    const row = document.createElement("div");
    row.className = "mockrow";

    const left = document.createElement("div");
    left.append(h4("Your words (original)"), tpl(original));
    const right = document.createElement("div");
    const polishedEl = tpl(data.polished);
    if (!data.flagged) polishedEl.classList.add("polished-ok");
    right.append(h4(data.flagged ? "Returned unchanged" : "AI-polished"), polishedEl);
    row.append(left, right);

    const nodes: HTMLElement[] = [row];

    if (data.flagged) {
      nodes.push(
        status(
          "Rejected by the deterministic check and returned unchanged" +
            (data.flag_reason ? ": " + data.flag_reason : "."),
          true,
        ),
      );
    } else {
      if (data.facts_used.length > 0) {
        nodes.push(h4("Facts the model reports using — each must trace to your words"));
        const ul = document.createElement("ul");
        ul.className = "facts";
        data.facts_used.forEach((f) => {
          const li = document.createElement("li");
          li.textContent = f;
          ul.appendChild(li);
        });
        nodes.push(ul);
      }

      const actions = document.createElement("div");
      actions.className = "btnrow";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "abtn";
      accept.textContent = "Use polished wording";
      accept.addEventListener("click", () => {
        changeEl.value = data.polished;
        changeEl.dispatchEvent(new Event("input"));
        show(status("Applied. Review every sentence of the draft before sending."));
      });
      const keep = document.createElement("button");
      keep.type = "button";
      keep.className = "abtn ghost";
      keep.textContent = "Keep my words";
      keep.addEventListener("click", () => {
        result.hidden = true;
      });
      actions.append(accept, keep);
      nodes.push(status("Nothing is applied until you choose."), actions);
    }

    show(...nodes);
  }
}
