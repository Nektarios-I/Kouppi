"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChipTransferDedupeSet,
  boundTransferQueue,
  deriveChipTransfersFromResolution,
  type ChipTransfer,
} from "@/lib/chips";
import type { LastResolutionLike } from "@/lib/tableEventFeedback/types";

export type UseChipTransferEventsInput = {
  lastResolution: LastResolutionLike | null | undefined;
  /** history.length or gameStateVersion — salt for dedupe */
  sequenceSalt?: string | number;
  enabled?: boolean;
};

/**
 * Derive chip transfers from authoritative lastResolution with bounded dedupe.
 * Does not mutate game state. Safe under Strict Mode double-effects (id-based).
 */
export function useChipTransferEvents(
  input: UseChipTransferEventsInput
): {
  transfers: ChipTransfer[];
  completeTransfer: (id: string) => void;
} {
  const { lastResolution, sequenceSalt, enabled = true } = input;
  const dedupe = useRef(new ChipTransferDedupeSet(64));
  const [active, setActive] = useState<ChipTransfer[]>([]);

  const derived = useMemo(() => {
    if (!enabled || !lastResolution) return [] as ChipTransfer[];
    return deriveChipTransfersFromResolution({
      resolution: lastResolution,
      sequenceSalt,
    });
  }, [lastResolution, sequenceSalt, enabled]);

  useEffect(() => {
    if (!enabled || derived.length === 0) return;
    const fresh = derived.filter((t) => dedupe.current.add(t.id));
    if (fresh.length === 0) return;
    setActive((prev) => boundTransferQueue([...prev, ...fresh], 12));
  }, [derived, enabled]);

  const completeTransfer = (id: string) => {
    setActive((prev) => prev.filter((t) => t.id !== id));
  };

  return { transfers: active, completeTransfer };
}

export default useChipTransferEvents;
