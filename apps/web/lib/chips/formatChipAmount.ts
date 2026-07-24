/**
 * Exact + compact chip amount formatting.
 * Exact label is always authoritative; compact is supplemental only.
 */

import { sanitizeChipAmount } from "./decomposeAmountToChips";

export function formatChipAmountExact(
  amount: unknown,
  locale = "en-US"
): string {
  const safe = sanitizeChipAmount(amount);
  if (safe === null) return "0";
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
      safe
    );
  } catch {
    return String(safe);
  }
}

/**
 * Compact supplemental label: 1250 → 1.3K, 1000 → 1K, 1_000_000 → 1M.
 * Never use as the only representation of a stack value.
 */
export function formatChipAmountCompact(amount: unknown): string {
  const safe = sanitizeChipAmount(amount);
  if (safe === null) return "0";
  const abs = Math.abs(safe);
  const sign = safe < 0 ? "-" : "";

  if (abs < 1000) return `${sign}${abs}`;

  if (abs < 1_000_000) {
    const k = abs / 1000;
    const rounded = Math.round(k * 10) / 10;
    const text = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
    return `${sign}${text}K`;
  }

  const m = abs / 1_000_000;
  const rounded = Math.round(m * 10) / 10;
  const text = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return `${sign}${text}M`;
}

export function formatChipAmount(amount: unknown, locale = "en-US"): {
  exact: string;
  compact: string;
} {
  return {
    exact: formatChipAmountExact(amount, locale),
    compact: formatChipAmountCompact(amount),
  };
}
