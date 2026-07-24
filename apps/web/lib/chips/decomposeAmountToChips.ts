import { KOUPPI_CHIP_DENOMINATIONS } from "./denominations";
import type { ChipCount } from "./types";

/**
 * Normalize raw amounts for visual decomposition.
 * Game-core uses integer chip units (`SHISTRI_DEFAULT_MIN_CHIP = 1`).
 * Invalid / negative / non-finite → empty decomposition (no crash).
 */
export function sanitizeChipAmount(amount: unknown): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  if (amount < 0) return null;
  return Math.floor(amount);
}

/**
 * Exact greedy decomposition highest → lowest.
 * For valid non-negative integers, sum(count * value) === sourceAmount.
 * Does not mutate inputs. Returns a new array.
 */
export function decomposeAmountToChips(amount: unknown): ChipCount[] {
  const safe = sanitizeChipAmount(amount);
  if (safe === null || safe === 0) return [];

  let remaining = safe;
  const counts: ChipCount[] = [];

  for (const denomination of KOUPPI_CHIP_DENOMINATIONS) {
    if (remaining < denomination.value) continue;
    const count = Math.floor(remaining / denomination.value);
    if (count > 0) {
      counts.push({ denomination, count });
      remaining -= count * denomination.value;
    }
  }

  return counts;
}

/** Sum of represented chip counts (exact for valid decompositions). */
export function sumChipCounts(counts: readonly ChipCount[]): number {
  return counts.reduce((sum, c) => sum + c.count * c.denomination.value, 0);
}
