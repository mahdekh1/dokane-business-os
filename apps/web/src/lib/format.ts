const SYMBOLS: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };

/** Format integer minor units as a currency string. */
export function money(minor: number, currency = 'USD'): string {
  const sym = SYMBOLS[currency] ?? `${currency} `;
  const neg = minor < 0;
  return `${neg ? '−' : ''}${sym}${(Math.abs(minor) / 100).toFixed(2)}`;
}

/** Currency symbol for a code (for input adornments). */
export const currencySymbol = (currency = 'USD'): string => SYMBOLS[currency] ?? currency;

/** Parse a major-unit string ("12.50") to integer minor units. */
export const toMinor = (v: string): number => Math.round((parseFloat(v) || 0) * 100);

export const shortWhen = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
