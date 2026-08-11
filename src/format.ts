/** Display formatting shared across sections. */

import { daysBetween } from "../lib/deadlines";

export const fmt = (d: Date): string =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export const fmtShort = (d: Date): string =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Today as a local-noon Date, for calendar-day comparisons. Deadlines are
 * calendar days: an inclusive deadline stays open through its whole day,
 * so past/open checks compare noon-normalized dates, never clock time. */
export function todayAtNoon(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
}

/** Today as a local YYYY-MM-DD string, for the stage engine. */
export function todayIso(): string {
  const now = new Date();
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole calendar days from today until d (0 = today). */
export const daysFromNow = (d: Date): number => daysBetween(todayAtNoon(), d);

/** Typed getElementById that fails loudly if the markup drifts. */
export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}
