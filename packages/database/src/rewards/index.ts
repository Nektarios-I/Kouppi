/**
 * Reward orchestration — public state + match / gameplay hooks.
 */

import { getProfileById } from "../users.js";
import {
  ACTIVE_SEASON,
  CAREER_MATCH_EXTRA_XP,
  FIRST_WIN_BONUS_XP,
  FIRST_WIN_REWARD_CHIPS,
  MATCH_PARTICIPATION_XP,
  MATCH_WIN_XP,
  REWARD_FEATURE_FLAGS,
  WHEEL_REWARD_TABLE,
  getMissionDefinition,
  getStreakReward,
} from "./config.js";
import { syncAchievements } from "./achievements.js";
import { claimDailyReward, previewDailyClaim } from "./dailyClaim.js";
import { hasFirstWinToday, tryGrantFirstWinOfDay } from "./firstWin.js";
import {
  bumpMissionProgress,
  claimMissionReward,
  ensureMissionAssignments,
  getDailyRerollsRemaining,
  getTotalRerollBudget,
  rerollMissionSlot,
} from "./missions.js";
import { buildTrackLevelViews, claimTrackLevel, getCurrentTrackLevel } from "./seasonTrack.js";
import { bumpGameplayCounters, ensureRewardUserState } from "./state.js";
import { applyRewardGrant } from "./grant.js";
import {
  getDailyPeriodKey,
  getNextDailyResetAt,
  getNextWeeklyResetAt,
  getWeeklyPeriodKey,
} from "./time.js";
import { spinWheel } from "./wheel.js";
import { listUnlocks } from "./unlocks.js";
import { ensureEquippedRow, equipCosmetic } from "./equipped.js";
import { ALL_COSMETICS, type CosmeticSlot } from "./cosmeticsCatalog.js";
import type {
  GameplayRewardEvent,
  MatchRewardEvent,
  MissionSlotView,
  RewardPublicState,
} from "./types.js";

function toMissionViews(
  slots: ReturnType<typeof ensureMissionAssignments>["daily"],
  rerollBudget: number
): MissionSlotView[] {
  return slots.map((slot) => {
    const def = getMissionDefinition(slot.definitionId);
    const canClaim = slot.status === "completed" || (slot.status === "active" && slot.progress >= slot.target);
    const canReroll =
      slot.periodType === "daily" &&
      slot.status === "active" &&
      slot.progress < slot.target &&
      rerollBudget > 0;
    return {
      id: slot.id,
      periodType: slot.periodType,
      slotIndex: slot.slotIndex,
      definitionId: slot.definitionId,
      title: def?.title ?? slot.definitionId,
      description: def?.description ?? "",
      metric: def?.metric ?? "play_matches",
      progress: slot.progress,
      target: slot.target,
      status: canClaim && slot.status === "active" ? "completed" : slot.status,
      reward: def?.reward ?? {},
      canClaim: canClaim && slot.status !== "claimed",
      canReroll,
    };
  });
}

export function getRewardPublicState(userId: string, nowMs: number = Date.now()): RewardPublicState {
  if (!REWARD_FEATURE_FLAGS.enabled) {
    throw new Error("Reward system disabled");
  }

  const profile = getProfileById(userId);
  if (!profile) {
    throw new Error("User not found");
  }

  const state = ensureRewardUserState(userId);
  const dailyPreview = previewDailyClaim(userId, nowMs);
  const { daily, weekly } = ensureMissionAssignments(userId, nowMs);
  const freeRerolls = getDailyRerollsRemaining(userId, nowMs);
  const rerollBudget = getTotalRerollBudget(userId, nowMs);
  const achievements = syncAchievements(userId);
  const levels = buildTrackLevelViews(userId);
  const nextDailyResetAt = getNextDailyResetAt(nowMs);
  const nextWeeklyResetAt = getNextWeeklyResetAt(nowMs);
  const equipped = ensureEquippedRow(userId);
  const ownedIds = new Set(listUnlocks(userId).map((u) => u.id));

  return {
    serverNow: nowMs,
    dailyPeriodKey: getDailyPeriodKey(nowMs),
    weeklyPeriodKey: getWeeklyPeriodKey(nowMs),
    nextDailyResetAt,
    nextWeeklyResetAt,
    currencies: {
      bankroll: profile.bankroll,
      wheelTokens: state.wheelTokens,
      missionRerollTokens: state.missionRerollTokens,
      seasonXp: state.seasonXp,
    },
    dailyClaim: {
      canClaim: dailyPreview.canClaim,
      alreadyClaimedToday: dailyPreview.alreadyClaimedToday,
      streak: dailyPreview.streak,
      lifetimeBestStreak: state.maxDailyStreak,
      lastClaimDate: dailyPreview.lastClaimDate,
      nextDayIndex: dailyPreview.nextDayIndex,
      nextReward: dailyPreview.nextReward,
      nextResetAt: nextDailyResetAt,
    },
    firstWin: {
      grantedToday: hasFirstWinToday(userId, nowMs),
      rewardChips: FIRST_WIN_REWARD_CHIPS,
      rewardXp: FIRST_WIN_BONUS_XP,
    },
    dailyMissions: toMissionViews(daily, rerollBudget),
    weeklyMissions: toMissionViews(weekly, 0),
    dailyRerollsRemaining: freeRerolls,
    season: {
      id: ACTIVE_SEASON.id,
      name: ACTIVE_SEASON.name,
      startsAt: ACTIVE_SEASON.startsAt,
      endsAt: ACTIVE_SEASON.endsAt,
      xp: state.seasonXp,
      currentLevel: getCurrentTrackLevel(state.seasonXp),
      levels,
    },
    wheel: {
      tokens: state.wheelTokens,
      table: WHEEL_REWARD_TABLE.map((r) => ({ id: r.id, label: r.label, weight: r.weight })),
    },
    unlocks: listUnlocks(userId),
    equipped,
    cosmeticsCatalog: ALL_COSMETICS.map((c) => ({
      id: c.id,
      kind: c.kind,
      slot: c.slot,
      label: c.label,
      owned: !!c.isDefault || ownedIds.has(c.id),
      isDefault: c.isDefault,
      tableThemeId: c.tableThemeId,
      emoteGlyph: c.emoteGlyph,
    })),
    achievements,
  };
}

export function equipRewardCosmetic(
  userId: string,
  slot: CosmeticSlot,
  cosmeticId: string | null,
  nowMs: number = Date.now()
) {
  const equipped = equipCosmetic(userId, slot, cosmeticId);
  return {
    equipped,
    state: getRewardPublicState(userId, nowMs),
  };
}

export function claimDaily(userId: string, nowMs: number = Date.now()) {
  const result = claimDailyReward(userId, nowMs);
  syncAchievements(userId);
  return {
    ...result,
    state: getRewardPublicState(userId, nowMs),
  };
}

export function claimMission(userId: string, slotId: string, nowMs: number = Date.now()) {
  const result = claimMissionReward(userId, slotId);
  syncAchievements(userId);
  return {
    ...result,
    state: getRewardPublicState(userId, nowMs),
  };
}

export function rerollMission(userId: string, slotId: string, nowMs: number = Date.now()) {
  const slot = rerollMissionSlot(userId, slotId, nowMs);
  return {
    slot,
    state: getRewardPublicState(userId, nowMs),
  };
}

export function claimTrack(userId: string, level: number, nowMs: number = Date.now()) {
  const result = claimTrackLevel(userId, level);
  syncAchievements(userId);
  return {
    ...result,
    state: getRewardPublicState(userId, nowMs),
  };
}

export function spinRewardWheel(userId: string, nowMs: number = Date.now(), rng?: () => number) {
  const result = spinWheel(userId, rng);
  syncAchievements(userId);
  return {
    ...result,
    state: getRewardPublicState(userId, nowMs),
  };
}

/**
 * Authoritative match completion hook (Career or logged-in multiplayer).
 */
export function onMatchFinished(event: MatchRewardEvent, nowMs: number = Date.now()): {
  firstWin: ReturnType<typeof tryGrantFirstWinOfDay>;
  matchXpApplied: boolean;
} {
  if (!REWARD_FEATURE_FLAGS.enabled) {
    return { firstWin: null, matchXpApplied: false };
  }

  ensureRewardUserState(event.userId);
  ensureMissionAssignments(event.userId, nowMs);

  bumpMissionProgress(event.userId, "play_matches", 1, nowMs);
  if (event.mode === "career") {
    bumpMissionProgress(event.userId, "career_matches", 1, nowMs);
  } else {
    bumpMissionProgress(event.userId, "multiplayer_matches", 1, nowMs);
  }
  if (event.won) {
    bumpMissionProgress(event.userId, "win_matches", 1, nowMs);
  }
  if (event.chipsWon > 0) {
    bumpMissionProgress(event.userId, "earn_chips", event.chipsWon, nowMs);
  }
  const pot = event.potWon ?? Math.max(0, event.chipsWon);
  if (pot > 0 && event.won) {
    bumpMissionProgress(event.userId, "pot_won", pot, nowMs);
  }

  let firstWin: ReturnType<typeof tryGrantFirstWinOfDay> = null;
  // First-win is a session trigger for Career (authoritative ranked results)
  if (event.won && event.mode === "career") {
    firstWin = tryGrantFirstWinOfDay(event.userId, nowMs);
  }

  let xp = MATCH_PARTICIPATION_XP + (event.won ? MATCH_WIN_XP : 0);
  if (event.mode === "career") xp += CAREER_MATCH_EXTRA_XP;

  const xpGrant = applyRewardGrant({
    userId: event.userId,
    idempotencyKey: `match_xp:${event.eventId}`,
    kind: "match_xp",
    grant: { seasonXp: xp },
    meta: { placement: event.placement, chipsWon: event.chipsWon, mode: event.mode },
  });

  syncAchievements(event.userId);

  return {
    firstWin,
    matchXpApplied: xpGrant.applied,
  };
}

/** Back-compat alias */
export function onCareerMatchFinished(
  event: MatchRewardEvent | (Omit<MatchRewardEvent, "mode"> & { mode?: MatchRewardEvent["mode"] }),
  nowMs?: number
) {
  return onMatchFinished(
    {
      ...event,
      mode: event.mode ?? "career",
    },
    nowMs
  );
}

/**
 * In-match authoritative progress (bets / SHISTRI) for authenticated players.
 */
export function onGameplayRewardEvent(event: GameplayRewardEvent, nowMs: number = Date.now()): void {
  if (!REWARD_FEATURE_FLAGS.enabled) return;
  if (!event.userId) return;

  ensureRewardUserState(event.userId);
  const bets = event.betsPlaced ?? 0;
  const shistri = event.shistriDeclared ?? 0;
  const shistriWon = event.shistriWon ?? 0;
  if (bets <= 0 && shistri <= 0 && shistriWon <= 0) return;

  bumpGameplayCounters(event.userId, {
    bets,
    shistriDeclared: shistri,
    shistriWon,
  });
  if (bets > 0) bumpMissionProgress(event.userId, "place_bets", bets, nowMs);
  if (shistri > 0) bumpMissionProgress(event.userId, "declare_shistri", shistri, nowMs);
  syncAchievements(event.userId);
}

export { previewDailyClaim, getStreakReward };
