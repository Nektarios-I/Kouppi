import type { AnteProgressionConfig, AnteProgressionStrategy, Chips } from "./types.js";

export const DEFAULT_ANTE_INTERVAL_ROUNDS = 5;
export const DEFAULT_ANTE_MULTIPLIER = 2;

export function defaultAnteProgression(startingAnte: Chips): AnteProgressionConfig {
  return {
    enabled: true,
    intervalRounds: DEFAULT_ANTE_INTERVAL_ROUNDS,
    strategy: "MULTIPLY",
    multiplier: DEFAULT_ANTE_MULTIPLIER,
    incrementAmount: null,
    maxAnte: null,
    startingAnte: Math.max(1, Math.floor(startingAnte)),
  };
}

/**
 * Normalize partial / legacy configs. Missing fields get defaults.
 * `startingAnte` falls back to `fallbackStartingAnte` (typically TableConfig.ante).
 */
export function normalizeAnteProgression(
  input: Partial<AnteProgressionConfig> | null | undefined,
  fallbackStartingAnte: Chips
): AnteProgressionConfig {
  const startingAnte = Math.max(
    1,
    Math.floor(input?.startingAnte ?? fallbackStartingAnte ?? 10)
  );
  const base = defaultAnteProgression(startingAnte);
  if (!input) return base;

  const strategy: AnteProgressionStrategy =
    input.strategy === "ADD" || input.strategy === "MULTIPLY" ? input.strategy : base.strategy;

  const intervalRounds = Math.max(
    1,
    Math.floor(input.intervalRounds ?? base.intervalRounds)
  );
  const multiplier = Math.max(1, Number(input.multiplier ?? base.multiplier));
  const incrementAmount =
    input.incrementAmount == null
      ? strategy === "ADD"
        ? startingAnte
        : null
      : Math.max(0, Math.floor(input.incrementAmount));
  const maxAnte =
    input.maxAnte == null || input.maxAnte <= 0
      ? null
      : Math.max(1, Math.floor(input.maxAnte));

  return {
    enabled: input.enabled ?? base.enabled,
    intervalRounds,
    strategy,
    multiplier,
    incrementAmount,
    maxAnte,
    startingAnte,
  };
}

/** Deterministic ante from starting ante + completed rounds (reconnect-safe). */
export function deriveAnte(
  progression: AnteProgressionConfig,
  completedRounds: number
): Chips {
  const rounds = Math.max(0, Math.floor(completedRounds));
  if (!progression.enabled) {
    return Math.max(1, Math.floor(progression.startingAnte));
  }

  const interval = Math.max(1, Math.floor(progression.intervalRounds));
  const completedIntervals = Math.floor(rounds / interval);
  let ante: number;

  if (progression.strategy === "ADD") {
    const inc = Math.max(0, Math.floor(progression.incrementAmount ?? 0));
    ante = progression.startingAnte + inc * completedIntervals;
  } else {
    const mult = Math.max(1, Number(progression.multiplier) || 1);
    ante = progression.startingAnte * Math.pow(mult, completedIntervals);
  }

  ante = Math.floor(ante);
  if (progression.maxAnte != null && progression.maxAnte > 0) {
    ante = Math.min(ante, Math.floor(progression.maxAnte));
  }
  return Math.max(1, ante);
}

export function formatAnteProgressionSummary(progression: AnteProgressionConfig): string {
  if (!progression.enabled) {
    return `Fixed ante ${progression.startingAnte}`;
  }
  if (progression.strategy === "ADD") {
    return `Ante +${progression.incrementAmount ?? 0} every ${progression.intervalRounds} rounds (start ${progression.startingAnte})`;
  }
  return `Ante ×${progression.multiplier} every ${progression.intervalRounds} rounds (start ${progression.startingAnte})`;
}
