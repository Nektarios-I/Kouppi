import type { GameState, Chips } from "./types.js";
import { isConsecutive, isPair, gapSize, effectiveMinBet, canShistri, shistriBet } from "./validators.js";

/** Bot behavior configuration shared by all (or per-bot) */
export type BotProfile = {
  /** 'deterministic' → no randomness; 'stochastic' → adds mild RNG noise */
  mode: "deterministic" | "stochastic";
  /** tunes risk appetite and KOUPPI threshold */
  difficulty: "easy" | "normal" | "hard";
};

function paramsForDifficulty(diff: BotProfile["difficulty"]) {
  // k: risk factor on pot; kouppiMinP: minimum p(win) to attempt KOUPPI
  // passMinP: pass if p(win) below this, unless SHISTRI is eligible
  if (diff === "easy")   return { k: 0.40, kouppiMinP: 0.78, passMinP: 0.55 };
  if (diff === "hard")   return { k: 0.75, kouppiMinP: 0.62, passMinP: 0.48 };
  return /* normal */      { k: 0.55, kouppiMinP: 0.70, passMinP: 0.52 };
}

/** Optional noise helper for stochastic mode */
function noise(state: GameState, magnitude: number): number {
  // magnitude in [0..1]; returns ~[-mag, +mag]
  const r = state.rng();
  return (r * 2 - 1) * magnitude;
}

/**
 * Bot policy that considers:
 * - p(win) from gap (winners/13)
 * - bankroll & pot constraints
 * - difficulty (risk k, kouppi threshold, pass threshold)
 * - mode (deterministic vs stochastic noise)
 * - special SHISTRI & all-in rules
 */
export function botChooseActionWithProfile(
  state: GameState,
  profile: BotProfile
): { type: "pass" } | { type: "bet"; amount: Chips } | { type: "kouppi" } | { type: "shistri" } {
  const turn = state.turn;
  if (!turn || !turn.upcards) return { type: "pass" };
  const player = state.players[state.currentIndex];
  const up = turn.upcards;
  const pot = state.round.pot;

  // Pair or consecutive has no winning range - always pass
  if (isPair(up) || isConsecutive(up)) return { type: "pass" };

  const winners = gapSize(up);
  if (winners <= 0) return { type: "pass" };

  let pWin = winners / 13;
  if (profile.mode === "stochastic") {
    // add tiny noise so it isn't predictable
    pWin = Math.min(1, Math.max(0, pWin + noise(state, 0.05)));
  }

  const { k, kouppiMinP, passMinP } = paramsForDifficulty(profile.difficulty);
  const bankroll = player.bankroll;

  const configMin = state.config.minBetPolicy.type === "fixed"
    ? state.config.minBetPolicy.value
    : 1;
  const effMin = Math.min(configMin, pot);
  const maxBet = Math.min(bankroll, pot);

  // Consider SHISTRI first (exactly one winner) when enabled
  if (state.config.shistri.enabled && winners === 1 && canShistri(up)) {
    return { type: "shistri" };
  }

  // Consider KOUPPI if favorable enough and affordable (avoid huge-pot disasters)
  if (bankroll >= pot && pot > 0 && pWin >= kouppiMinP) {
    const hugePot = pot > Math.max(20, 0.25 * bankroll);
    if (!hugePot) return { type: "kouppi" };
  }

  // PASS on low probability hands
  if (pWin < passMinP) return { type: "pass" };

  // If bankroll below min bet but positive, attempt ALL-IN (allowed by reducer)
  if (bankroll > 0 && bankroll < effMin) {
    if (bankroll <= maxBet) return { type: "bet", amount: bankroll };
    return { type: "pass" };
  }

  // Regular scaled bet
  let bet = Math.floor(pWin * pot * k);
  if (profile.mode === "stochastic") bet = Math.floor(bet * (1 + noise(state, 0.2)));
  if (bet < effMin) bet = effMin;
  if (bet > maxBet) bet = maxBet;
  if (bet <= 0) return { type: "pass" };
  return { type: "bet", amount: bet };
}

/** Back-compat default: deterministic, normal difficulty. */
export function botChooseAction(state: GameState) {
  return botChooseActionWithProfile(state, { mode: "deterministic", difficulty: "normal" });
}
