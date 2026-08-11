/** Action kits: every card opens into verified numbers, scripts and drafts.
 * Kits re-render whenever the sale clock changes so the sale date quoted in
 * their copy is never stale; open/closed state is preserved across renders. */

import { LOSS_MITIGATION_LETTER, REINSTATEMENT_DEMAND_LETTER } from "../../lib/templates";
import { byId } from "../format";
import { currentSaleLine, onSaleInfoChange } from "../state";

function copyBtn(label: string, getText: () => string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "abtn";
  b.textContent = label;
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getText());
      const was = b.textContent;
      b.textContent = "Copied";
      setTimeout(() => {
        b.textContent = was;
      }, 1400);
    } catch {
      const was = b.textContent;
      b.textContent = "Copy failed — select the text above";
      setTimeout(() => {
        b.textContent = was;
      }, 2500);
    }
  });
  return b;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string | null,
  html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

interface Kit {
  /** Stable id the stage panel's "Open the kit" buttons target. */
  id: string;
  cls: "free" | "deadline";
  title: string;
  lede: string;
  build(kit: HTMLDivElement): void;
}

const saleDateText = (): string => currentSaleLine();

const KITS: Kit[] = [
  {
    cls: "free",
    id: "legal-help",
    title: "Free legal help",
    lede: "Lone Star Legal Aid and Houston Volunteer Lawyers take foreclosure cases at no cost for qualifying households. The earlier they're in, the more they can do.",
    build(kit) {
      kit.appendChild(el("h4", null, "Call now — verified numbers"));
      const row = el("div", "btnrow");
      row.appendChild(el("a", "abtn", "Lone Star Legal Aid: 713-652-0077")).href = "tel:+17136520077";
      row.appendChild(el("a", "abtn", "LSLA toll-free: 800-733-8394")).href = "tel:+18007338394";
      row.appendChild(el("a", "abtn", "HVL LegalLine questions: 713-228-0735")).href = "tel:+17132280735";
      kit.appendChild(row);
      kit.appendChild(el("h4", null, "Information that may help when you call"));
      kit.appendChild(
        el(
          "ul",
          null,
          `
        <li>"I'm a homeowner in Harris County and I received a foreclosure notice."</li>
        <li>Which notice you got (default or trustee sale) and the date printed on it.</li>
        <li>If your notice states a sale date, share it early — it helps intake understand urgency. Computed reference: <strong>${saleDateText()}</strong>.</li>
        <li>Household size and rough monthly income — eligibility is income-based and determined by the provider.</li>
        <li>Ask: "What documents should I gather before our first meeting?"</li>`,
        ),
      );
      kit.appendChild(el("h4", null, "Or apply online — the official intake routes (verified Aug 10, 2026)"));
      const row2 = el("div", "btnrow");
      row2.appendChild(el("a", "abtn", "LSLA online application")).href =
        "https://www.lonestarlegal.org/services/foreclosure-prevention-project/";
      row2.appendChild(el("a", "abtn", "LegalHelpHouston.org — HVL's intake portal")).href =
        "https://legalhelphouston.org";
      kit.appendChild(row2);
    },
  },
  {
    cls: "free",
    id: "loss-mitigation",
    title: "Loss mitigation — apply in writing",
    lede: "Ask your servicer in writing for loss-mitigation options: modification, forbearance, repayment plan. Received complete more than 37 days before the sale, an application may restrict the servicer from moving forward with the sale while it is under review — exceptions apply.",
    build(kit) {
      kit.appendChild(el("h4", null, "The request letter — copy, fill the brackets, and send it in a trackable way"));
      kit.appendChild(el("pre", "tpl", LOSS_MITIGATION_LETTER.replace(/</g, "&lt;")));
      const row = el("div", "btnrow");
      row.appendChild(copyBtn("Copy letter", () => LOSS_MITIGATION_LETTER));
      row.appendChild(el("a", "abtn ghost", "Your rights under Reg X (CFPB)")).href =
        "https://www.consumerfinance.gov/rules-policy/regulations/1024/41/";
      row.appendChild(el("a", "abtn ghost", "LSLA self-help letter tool")).href =
        "https://www.lonestarlegal.org/services/foreclosure-prevention-project/";
      kit.appendChild(row);
      kit.appendChild(
        el(
          "ul",
          null,
          `
        <li>One common option: certified mail with return receipt, keeping a copy of everything sent. A delivery receipt documents arrival — not the package's contents, and not whether the servicer considers an application complete.</li>
        <li>The SERVICER judges completeness: send every item they list, keep copies of everything.</li>
        <li>The draft-and-call section below builds the request letter, with a hardship-narrative attachment draft in your own words.</li>`,
        ),
      );
    },
  },
  {
    cls: "free",
    id: "check-filing",
    title: "Check the filing yourself",
    lede: "Every notice of trustee sale must be on file with the Harris County Clerk. Look up the recorded instrument and verify every date against what you were mailed.",
    build(kit) {
      const row = el("div", "btnrow");
      row.appendChild(el("a", "abtn", "Harris County Clerk foreclosure search")).href =
        "https://cclerk.hctx.net/applications/websearch/FRCL_R.aspx";
      kit.appendChild(row);
      kit.appendChild(el("h4", null, "What to verify on the recorded notice"));
      kit.appendChild(
        el(
          "ul",
          null,
          `
        <li>The filing date: was it at least 21 days before the sale date? The chain above computes it.</li>
        <li>The property's legal description — does it actually match your property?</li>
        <li>The trustee's name and address, and the stated sale start time — the sale must begin within three hours after it (10 a.m.–4 p.m. is the statutory outer window).</li>
        <li>A discrepancy does not necessarily invalidate a sale — its effect depends on the facts and the law — but preserved copies or photographs are exactly what a lawyer wants to see.</li>`,
        ),
      );
    },
  },
  {
    cls: "deadline",
    id: "reinstate",
    title: "Reinstate or pay off",
    lede: "Depending on your loan and where the clock stands, paying the missed amount (reinstatement) or the full payoff may stop the process. Why the clock matters here: the money generally has to arrive before the sale is held, the servicer's cutoff may fall earlier than the sale date, and getting quotes and delivering funds both take days. The exact figures and cutoffs come from the servicer — request written confirmation, since phone information may not be binding.",
    build(kit) {
      kit.appendChild(el("h4", null, "The written demand — copy, fill, send"));
      kit.appendChild(el("pre", "tpl", REINSTATEMENT_DEMAND_LETTER.replace(/</g, "&lt;")));
      const row = el("div", "btnrow");
      row.appendChild(copyBtn("Copy demand letter", () => REINSTATEMENT_DEMAND_LETTER));
      kit.appendChild(row);
      kit.appendChild(
        el(
          "ul",
          null,
          `
        <li>Reinstatement (catching up) is usually far smaller than payoff — both numbers are worth requesting.</li>
        <li>Ask about accepted payment methods and exact delivery instructions, and allow time before the sale.</li>`,
        ),
      );
    },
  },
  {
    cls: "deadline",
    id: "sell",
    title: "Sell before the sale",
    lede: "With equity in the home, selling before the auction can preserve value that a foreclosure sale may not — whether it fits depends on the equity, the loan and the goals. Why the clock matters here: a private sale only helps if it CLOSES before the sale date, and listing, contract and closing commonly take weeks — which is why agents ask about the date on day one.",
    build(kit) {
      kit.appendChild(el("h4", null, "Questions a homeowner might ask an agent or buyer, on day one"));
      kit.appendChild(
        el(
          "ul",
          null,
          `
        <li>"Can you close before <strong>${saleDateText()}</strong>?" — if not, the timing may not work.</li>
        <li>"Will you coordinate the payoff directly with my servicer's foreclosure department?"</li>
        <li>"What is my realistic net after the payoff, taxes and costs?" — get it in writing.</li>
        <li>Beware anyone who asks you to sign over the deed "temporarily," to stop talking to your servicer, or to pay upfront fees — classic rescue-scam patterns. Run those letters past legal aid first.</li>`,
        ),
      );
    },
  },
  {
    cls: "deadline",
    id: "court",
    title: "Court and bankruptcy options",
    lede: "A court order (such as a temporary restraining order) or a bankruptcy filing may pause a sale in some circumstances — eligibility, timing, exceptions and consequences vary. Why the clock matters here: either route must be in place BEFORE the sale is held, and preparing one takes a lawyer time — days at minimum, not hours.",
    build(kit) {
      kit.appendChild(
        el(
          "ul",
          null,
          `
        <li>These are lawyer questions — this tool deliberately does not generate court documents. The legal-aid contacts above are one place to seek an assessment; sharing any printed sale date (<strong>${saleDateText()}</strong>) early helps them understand urgency.</li>
        <li>A bankruptcy filing generally puts a hold on collection actions when it's filed — but it has lasting consequences, exceptions exist, and only a lawyer can tell you whether it fits your situation.</li>
        <li>Whether a court would pause a sale depends on your specific facts — a lawyer must assess it. The records and discrepancies you photographed at the Clerk's office are what you bring to that conversation.</li>`,
        ),
      );
      const row = el("div", "btnrow");
      row.appendChild(el("a", "abtn ghost", "TexasLawHelp: foreclosure fact sheet")).href =
        "https://texaslawhelp.org/article/foreclosure-fact-sheet";
      kit.appendChild(row);
    },
  },
];

/** Build one kit's content for inline use inside a what-you-can-do row.
 * External links get target/rel here since the row bypasses renderKits. */
export function buildKitContent(id: string): HTMLDivElement | null {
  const k = KITS.find((kit) => kit.id === id);
  if (!k) return null;
  const kit = el("div", "kit");
  k.build(kit);
  kit.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener";
  });
  return kit;
}

export function initActionKits(): void {
  const cardsEl = byId<HTMLDivElement>("actionCards");

  function renderKits(): void {
    const openIdx = [...cardsEl.querySelectorAll<HTMLDetailsElement>("details.action")].map((d) => d.open);
    cardsEl.innerHTML = "";
    KITS.forEach((k) => {
      const d = el("details", "action");
      d.dataset.kit = k.id;
      const s = el(
        "summary",
        null,
        `<span class="tag ${k.cls}" style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${k.cls === "free" ? "var(--ok)" : "var(--alarm)"}">${k.cls === "free" ? "Free &middot; anytime" : "Free &middot; time-sensitive"}</span><h3>${k.title}</h3><span class="kit-open">Open kit <span class="arrow">&#9656;</span></span><p>${k.lede}</p>`,
      );
      d.appendChild(s);
      const kit = el("div", "kit");
      k.build(kit);
      d.appendChild(kit);
      cardsEl.appendChild(d);
    });
    [...cardsEl.querySelectorAll<HTMLDetailsElement>("details.action")].forEach((d, i) => {
      if (openIdx[i]) d.open = true;
    });
    cardsEl.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  renderKits();
  onSaleInfoChange(renderKits);
}
