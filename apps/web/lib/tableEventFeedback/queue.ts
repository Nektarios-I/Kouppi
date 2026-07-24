import type { FeedbackPriority, TableFeedbackEvent } from "./types";

const PRIORITY_RANK: Record<FeedbackPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
};

export type RibbonQueueState = {
  current: TableFeedbackEvent | null;
  /** Bounded pending (max 3) */
  pending: TableFeedbackEvent[];
};

export function createRibbonQueue(): RibbonQueueState {
  return { current: null, pending: [] };
}

/**
 * Enqueue a table-channel event.
 * - Only one visible ribbon.
 * - Low can replace current low.
 * - Higher priority may replace lower.
 * - Queue length bounded.
 */
export function enqueueRibbon(
  state: RibbonQueueState,
  event: TableFeedbackEvent,
  maxPending = 3
): RibbonQueueState {
  if (event.channel !== "table") return state;

  if (!state.current) {
    return { current: event, pending: [] };
  }

  const curRank = PRIORITY_RANK[state.current.priority];
  const nextRank = PRIORITY_RANK[event.priority];

  // Replace if incoming is higher, or both low (freshest low wins)
  if (nextRank > curRank || (event.priority === "low" && state.current.priority === "low")) {
    return { current: event, pending: state.pending };
  }

  // Same or lower: queue if room and not duplicate id
  if (state.pending.some((p) => p.id === event.id) || state.current.id === event.id) {
    return state;
  }
  if (state.pending.length >= maxPending) {
    // Drop oldest pending low first
    const pending = [...state.pending];
    const lowIdx = pending.findIndex((p) => p.priority === "low");
    if (lowIdx >= 0) pending.splice(lowIdx, 1);
    else pending.shift();
    pending.push(event);
    return { current: state.current, pending };
  }
  return { current: state.current, pending: [...state.pending, event] };
}

export function advanceRibbon(state: RibbonQueueState): RibbonQueueState {
  if (state.pending.length === 0) {
    return { current: null, pending: [] };
  }
  const [next, ...rest] = state.pending;
  return { current: next, pending: rest };
}

export function pushHistory(
  history: TableFeedbackEvent[],
  event: TableFeedbackEvent,
  maxEntries: number
): TableFeedbackEvent[] {
  if (history.some((h) => h.id === event.id)) return history;
  const next = [...history, event];
  if (next.length <= maxEntries) return next;
  return next.slice(next.length - maxEntries);
}

export function historyLimitForViewport(width: number): number {
  return width < 768 ? 16 : 28;
}
