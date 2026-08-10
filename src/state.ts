/**
 * The one piece of cross-section state: the current sale-clock reading.
 * The deadline chain writes it; the action kits and document desk subscribe,
 * so a date change (or a cleared input) can never leave a stale sale date
 * anywhere on the page.
 */

export interface SaleInfo {
  /** Formatted sale date, or null when the inputs are incomplete. */
  text: string | null;
  /** true = printed on the reader's notice; false = projected statutory minimum. */
  verified: boolean;
}

let saleInfo: SaleInfo = { text: null, verified: false };
const listeners = new Set<() => void>();

export const getSaleInfo = (): SaleInfo => saleInfo;

export function setSaleInfo(next: SaleInfo): void {
  saleInfo = next;
  listeners.forEach((fn) => fn());
}

/** Subscribe to sale-clock changes. Does not fire immediately. */
export function onSaleInfoChange(fn: () => void): void {
  listeners.add(fn);
}

/** The sale-clock reference line used by kits and documents — always labeled
 * as printed vs projected, never presented bare. */
export function currentSaleLine(): string {
  return saleInfo.text
    ? saleInfo.text + (saleInfo.verified ? " (from your notice)" : " (projected statutory minimum)")
    : "[SEE YOUR NOTICE]";
}
