import type { Chips, TableConfig, Upcards } from "./types.js";

export function betweenExclusive(x: number, a: number, b: number): boolean {
  const low = Math.min(a,b);
  const high = Math.max(a,b);
  return x > low && x < high;
}

export function gapSize(up: Upcards): number {
  const low = Math.min(up.a.rank, up.b.rank);
  const high = Math.max(up.a.rank, up.b.rank);
  return high - low - 1;
}

export function isPair(up: Upcards): boolean {
  return up.a.rank === up.b.rank;
}

export function isConsecutive(up: Upcards): boolean {
  const low = Math.min(up.a.rank, up.b.rank);
  const high = Math.max(up.a.rank, up.b.rank);
  return high - low === 1;
}

export function effectiveMinBet(configMin: Chips, pot: Chips): Chips {
  return Math.min(configMin, pot);
}

export function shistriBet(pot: Chips, percent: number, minChip: number): Chips {
  return Math.max(Math.floor((percent/100) * pot), minChip);
}

export function canShistri(up: Upcards): boolean {
  return gapSize(up) === 1; // exactly one winning rank
}

export function legalBetRange(params: {
  bankroll: Chips;
  pot: Chips;
  configMinBet: Chips;
}) {
  const min = effectiveMinBet(params.configMinBet, params.pot);
  const max = Math.min(params.bankroll, params.pot);
  return { min, max };
}
