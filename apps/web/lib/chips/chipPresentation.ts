import {
  decomposeAmountToChips,
  sanitizeChipAmount,
  sumChipCounts,
} from "./decomposeAmountToChips";
import { formatChipAmountCompact } from "./formatChipAmount";
import {
  CHIP_VISUAL_CAPS,
  type ChipCount,
  type ChipStackContext,
  type RenderedChipSubStack,
  type VisualChipStack,
} from "./types";

function maxTotalDiscs(context: ChipStackContext): number {
  return CHIP_VISUAL_CAPS[context];
}

/**
 * Build a compact visual stack from an exact decomposition.
 * Count markers keep representedAmount exact; isApproximate stays false when markers cover overflow.
 */
export function buildVisualChipStack(
  amount: unknown,
  context: ChipStackContext = "player-bankroll",
  options?: {
    maxDenominationGroups?: number;
    maxVisiblePerDenomination?: number;
    maxTotalDiscs?: number;
  }
): VisualChipStack {
  const safe = sanitizeChipAmount(amount);
  if (safe === null) {
    return {
      sourceAmount: 0,
      representedAmount: 0,
      remainderAmount: 0,
      counts: [],
      renderedStacks: [],
      compactLabel: "0",
      isApproximate: false,
    };
  }

  const counts = decomposeAmountToChips(safe);
  const maxGroups =
    options?.maxDenominationGroups ?? CHIP_VISUAL_CAPS.maxDenominationGroups;
  const maxPerDenom =
    options?.maxVisiblePerDenomination ??
    CHIP_VISUAL_CAPS.maxVisiblePerDenomination;
  let discsBudget = options?.maxTotalDiscs ?? maxTotalDiscs(context);

  // Prefer highest denominations when truncating groups (already sorted high→low).
  const groupSlice = counts.slice(0, maxGroups);
  const renderedStacks: RenderedChipSubStack[] = [];

  for (const { denomination, count } of groupSlice) {
    if (discsBudget <= 0) {
      // Still represent via a single disc + overflow marker when possible
      if (count > 0) {
        renderedStacks.push({
          denomination,
          visibleChipCount: 0,
          representedValue: count * denomination.value,
          overflowCount: count,
        });
      }
      continue;
    }

    const desiredVisible = Math.min(count, maxPerDenom, discsBudget);
    const overflowCount = Math.max(0, count - desiredVisible);
    renderedStacks.push({
      denomination,
      visibleChipCount: desiredVisible,
      representedValue: count * denomination.value,
      overflowCount,
    });
    discsBudget -= desiredVisible;
  }

  // Groups dropped beyond maxGroups are still in `counts`; represented via compactLabel + exact UI.
  // With count markers on included groups, representedAmount equals sum of all counts (exact).
  const representedAmount = sumChipCounts(counts);
  const remainderAmount = Math.max(0, safe - representedAmount);

  return {
    sourceAmount: safe,
    representedAmount,
    remainderAmount,
    counts: counts.map((c) => ({ ...c })),
    renderedStacks,
    compactLabel: formatChipAmountCompact(safe),
    // Count markers + exact numeric UI make the stack truthful; never mark approximate.
    isApproximate: false,
  };
}

/** Total visible physical discs in a visual stack. */
export function countVisibleDiscs(stack: VisualChipStack): number {
  return stack.renderedStacks.reduce((n, s) => n + s.visibleChipCount, 0);
}

/** Clone counts for tests / immutability checks. */
export function cloneChipCounts(counts: readonly ChipCount[]): ChipCount[] {
  return counts.map((c) => ({ denomination: c.denomination, count: c.count }));
}
