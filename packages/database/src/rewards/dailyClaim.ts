/**
 * Daily claim / streak.
 */

import { getStreakReward } from "./config.js";
import { applyRewardGrant } from "./grant.js";
import { ensureRewardUserState, setDailyClaimState } from "./state.js";
import { getDailyPeriodKey, isConsecutiveDailyClaim, isSameDailyPeriod } from "./time.js";
import type { GrantResult, RewardCurrencyGrant } from "./types.js";
import { bumpMissionProgress } from "./missions.js";
import { RewardActionError } from "./errors.js";

export { RewardActionError };

export function previewDailyClaim(userId: string, nowMs: number = Date.now()): {
  canClaim: boolean;
  alreadyClaimedToday: boolean;
  streak: number;
  lastClaimDate: string | null;
  nextDayIndex: number;
  nextReward: RewardCurrencyGrant;
} {
  const state = ensureRewardUserState(userId);
  const today = getDailyPeriodKey(nowMs);
  const alreadyClaimedToday = isSameDailyPeriod(state.lastDailyClaimDate, today);

  let nextStreak: number;
  if (alreadyClaimedToday) {
    nextStreak = state.dailyStreak;
  } else if (isConsecutiveDailyClaim(state.lastDailyClaimDate, today)) {
    nextStreak = state.dailyStreak + 1;
  } else {
    nextStreak = 1;
  }

  const dayIndex = ((nextStreak - 1) % 7) + 1;
  const reward = getStreakReward(dayIndex).reward;

  return {
    canClaim: !alreadyClaimedToday,
    alreadyClaimedToday,
    streak: state.dailyStreak,
    lastClaimDate: state.lastDailyClaimDate,
    nextDayIndex: dayIndex,
    nextReward: reward,
  };
}

export function claimDailyReward(
  userId: string,
  nowMs: number = Date.now()
): {
  streak: number;
  dayIndex: number;
  grant: GrantResult;
} {
  const today = getDailyPeriodKey(nowMs);
  const preview = previewDailyClaim(userId, nowMs);
  if (!preview.canClaim) {
    throw new RewardActionError("Daily reward already claimed today", "DAILY_ALREADY_CLAIMED");
  }

  const state = ensureRewardUserState(userId);
  let newStreak: number;
  if (isConsecutiveDailyClaim(state.lastDailyClaimDate, today)) {
    newStreak = state.dailyStreak + 1;
  } else {
    newStreak = 1;
  }
  const dayIndex = ((newStreak - 1) % 7) + 1;
  const reward = getStreakReward(dayIndex).reward;
  const idempotencyKey = `daily_claim:${userId}:${today}`;

  const grant = applyRewardGrant({
    userId,
    idempotencyKey,
    kind: "daily_claim",
    grant: reward,
    meta: { dayIndex, streak: newStreak },
  });

  if (grant.alreadyApplied) {
    // Ledger says already granted — sync claim date if needed and reject duplicate UX
    throw new RewardActionError("Daily reward already claimed today", "DAILY_ALREADY_CLAIMED");
  }

  const maxStreak = Math.max(state.maxDailyStreak, newStreak);
  setDailyClaimState(userId, { streak: newStreak, maxStreak, claimDate: today });

  // Mission progress: claim_daily
  bumpMissionProgress(userId, "claim_daily", 1, nowMs);

  // Achievement: max streak
  // deferred to achievements module via service after claim

  return { streak: newStreak, dayIndex, grant };
}
