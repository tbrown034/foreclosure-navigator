/** Entry point for /methodology. The benchmark renders from the measured
 * JSON results; the auction calendar and §34.21 calculator remain live code. */

import "./styles.css";
import { byId } from "./format";
import { initAuctionCalendar } from "./sections/auction-calendar";
import { initTaxPanel } from "./sections/track-selector";

interface BenchmarkSummary {
  ranAt: string;
  model: string;
  temperature: number;
  documents: number;
  sale_date_exact_match: number;
  county_match: number;
  no_privacy_fields: number;
  flagged_for_human_review: string[];
  mean_latency_ms: number;
  est_cost_usd: number;
}

interface BenchmarkResult {
  docId: string;
  official: {
    saleDate: string;
  };
  extracted: {
    sale_date: string;
  };
  checks: {
    sale_date_matches_index: boolean;
    all_pass: boolean;
  };
  latency_ms: number;
}

interface BenchmarkData {
  summary: BenchmarkSummary;
  results: BenchmarkResult[];
}

function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function statCard(value: string, label: string): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "card";
  card.append(textElement("h3", value), textElement("p", label));
  return card;
}

function addCell(row: HTMLTableRowElement, text: string, className?: string): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  row.append(cell);
  return cell;
}

function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function formatRunDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}

function renderBenchmark(data: BenchmarkData): void {
  const { summary, results } = data;
  const percentage = Math.round((summary.sale_date_exact_match / summary.documents) * 100);

  byId<HTMLDivElement>("benchmarkStats").replaceChildren(
    statCard(`${summary.sale_date_exact_match}/${summary.documents}`, "Exact sale-date matches"),
    statCard(String(summary.flagged_for_human_review.length), "Flagged for human review"),
    statCard(formatSeconds(summary.mean_latency_ms), "Mean extraction time"),
    statCard(`$${summary.est_cost_usd.toFixed(2)}`, "Total model cost"),
  );

  const body = byId<HTMLTableSectionElement>("benchmarkBody");
  body.replaceChildren();
  results.forEach((result) => {
    const row = document.createElement("tr");
    addCell(row, result.docId);
    addCell(row, result.official.saleDate, "date");
    addCell(row, result.extracted.sale_date, "date");
    const matchCell = addCell(row, "");
    matchCell.append(
      textElement(
        "span",
        result.checks.sale_date_matches_index ? "PASS" : "REVIEW",
        `chip ${result.checks.sale_date_matches_index ? "window" : "deadline"}`,
      ),
    );
    addCell(row, formatSeconds(result.latency_ms), "date");
    body.append(row);
  });

  const flagged = new Set(summary.flagged_for_human_review);
  const flaggedList = byId<HTMLUListElement>("benchmarkFlaggedList");
  flaggedList.replaceChildren();
  results
    .filter((result) => flagged.has(result.docId))
    .forEach((result) => {
      flaggedList.append(
        textElement(
          "li",
          `${result.docId}: extracted ${result.extracted.sale_date}; official ${result.official.saleDate}.`,
        ),
      );
    });

  byId<HTMLParagraphElement>("benchmarkSummary").textContent =
    `${summary.documents} documents · ${summary.sale_date_exact_match}/${summary.documents} exact sale-date match (${percentage}%) · ` +
    `county ${summary.county_match}/${summary.documents} · privacy-clean ${summary.no_privacy_fields}/${summary.documents} · ` +
    `mean ${formatSeconds(summary.mean_latency_ms)} · total cost $${summary.est_cost_usd.toFixed(2)} · ` +
    `model ${summary.model} at temperature ${summary.temperature} · run ${formatRunDate(summary.ranAt)}`;
}

async function initBenchmark(): Promise<void> {
  try {
    const response = await fetch("/data/benchmark-results.json");
    if (!response.ok) throw new Error(`Benchmark request failed: ${response.status}`);
    renderBenchmark((await response.json()) as BenchmarkData);
  } catch {
    byId<HTMLDivElement>("benchmarkStats").replaceChildren(
      textElement("p", "The benchmark results could not be loaded. The raw JSON remains available below.", "sub"),
    );
    const body = byId<HTMLTableSectionElement>("benchmarkBody");
    body.replaceChildren();
    const row = document.createElement("tr");
    const cell = addCell(row, "Benchmark rows unavailable.");
    cell.colSpan = 5;
    body.append(row);
    byId<HTMLUListElement>("benchmarkFlaggedList").replaceChildren(
      textElement("li", "Flagged-document details unavailable."),
    );
    byId<HTMLParagraphElement>("benchmarkSummary").textContent = "Benchmark summary unavailable.";
  }
}

initTaxPanel();
initAuctionCalendar();
void initBenchmark();

// Real filings-by-week bars from the county index — the last demo figures
// on the site, replaced with the official record.
async function renderWeekBars(): Promise<void> {
  const slot = document.getElementById("weekBars");
  if (!slot) return;
  try {
    const resp = await fetch("/data/frcl-index.json");
    if (!resp.ok) return;
    const idx = (await resp.json()) as { filings: Array<{ fileDate: string }> };
    const weeks = new Map<string, number>();
    for (const f of idx.filings) {
      const d = new Date(f.fileDate + "T12:00:00");
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weeks.set(key, (weeks.get(key) ?? 0) + 1);
    }
    const entries = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const max = Math.max(...entries.map(([, n]) => n));
    for (const [week, n] of entries) {
      const row = document.createElement("div");
      row.className = "bar";
      const label = document.createElement("span");
      label.className = "zip";
      label.textContent = new Date(week + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const track = document.createElement("div");
      track.className = "track";
      const fill = document.createElement("div");
      fill.className = "fill";
      fill.style.width = `${Math.round((n / max) * 100)}%`;
      track.appendChild(fill);
      const v = document.createElement("span");
      v.className = "v";
      v.textContent = String(n);
      row.append(label, track, v);
      slot.appendChild(row);
    }
  } catch {
    // leave empty on failure — the section header explains the source
  }
}
void renderWeekBars();
