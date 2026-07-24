/**
 * First win of day — Career authoritative.
 */

import { FIRST_WIN_BONUS_XP, FIRST_WIN_REWARD_CHIPS, REWARD_FEATURE_FLAGS } from "./config.js";
import { applyRewardGrant } from "./grant.js";
import { ensureRewardUserState, setFirstWinDate } from "./state.js";
import { getDailyPeriodKey, isSameDailyPeriod } from "./time.js";
import type { GrantResult } from "./types.js";

export function hasFirstWinToday(userId: string, nowMs: number = Date.now()): boolean {
  const state = ensureRewardUserState(userId);
  const today = getDailyPeriodKey(nowMs);
  return isSameDailyPeriod(state.firstWinDate, today);
}

/**
 * Grant first-win bonus if eligible. Safe under reconnect / duplicate processing.
 */
export function tryGrantFirstWinOfDay(
  userId: string,
  nowMs: number = Date.now()
): GrantResult | null {
  if (!REWARD_FEATURE_FLAGS.firstWinEnabled) return null;

  const today = getDailyPeriodKey(nowMs);
  if (hasFirstWinToday(userId, nowMs)) {
    return null;
  }

  const idempotencyKey = `first_win:${userId}:${today}`;
  const grant = applyRewardGrant({
    userId,
    idempotencyKey,
    kind: "first_win",
    grant: { chips: FIRST_WIN_REWARD_CHIPS, seasonXp: FIRST_WIN_BONUS_XP },
    meta: { date: today },
  });

  if (grant.applied || grant.alreadyApplied) {
    setFirstWinDate(userId, today);
  }

  return grant;
}
