/** Display formatting shared across sections. */

export const fmt = (d: Date): string =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export const fmtShort = (d: Date): string =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Days from now until d, rounded up — matches the urgency card's counting. */
export const daysFromNow = (d: Date): number => Math.ceil((d.getTime() - Date.now()) / 864e5);

/** Typed getElementById that fails loudly if the markup drifts. */
export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}
