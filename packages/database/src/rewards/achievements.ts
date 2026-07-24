/**
 * Achievement definitions + progress + one-time auto-grant on completion.
 */

import { getRawDb } from "../client.js";
import { ACHIEVEMENT_DEFINITIONS, REWARD_FEATURE_FLAGS } from "./config.js";
import { applyRewardGrant } from "./grant.js";
import { ensureRewardUserState } from "./state.js";
import { getCurrentTrackLevel } from "./seasonTrack.js";
import { getUserById } from "../users.js";
import type { AchievementMetric, AchievementView } from "./types.js";

function getStoredProgress(userId: string, achievementId: string): {
  progress: number;
  completedAt: number | null;
  claimedAt: number | null;
} {
  const db = getRawDb();
  const row = db
    .prepare(
      `SELECT progress, completed_at, claimed_at FROM reward_achievements
       WHERE user_id = ? AND achievement_id = ?`
    )
    .get(userId, achievementId) as
    | { progress: number; completed_at: number | null; claimed_at: number | null }
    | undefined;
  return {
    progress: row?.progress ?? 0,
    completedAt: row?.completed_at ?? null,
    claimedAt: row?.claimed_at ?? null,
  };
}

function upsertProgress(
  userId: string,
  achievementId: string,
  progress: number,
  completedAt: number | null,
  claimedAt: number | null
): void {
  const db = getRawDb();
  db.prepare(
    `INSERT INTO reward_achievements (user_id, achievement_id, progress, completed_at, claimed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, achievement_id) DO UPDATE SET
       progress = excluded.progress,
       completed_at = COALESCE(reward_achievements.completed_at, excluded.completed_at),
       claimed_at = COALESCE(reward_achievements.claimed_at, excluded.claimed_at)`
  ).run(userId, achievementId, progress, completedAt, claimedAt);
}

function metricValue(userId: string, metric: AchievementMetric): number {
  const state = ensureRewardUserState(userId);
  const user = getUserById(userId);
  switch (metric) {
    case "career_wins":
      return user?.gamesWon ?? 0;
    case "career_matches":
      return user?.gamesPlayed ?? 0;
    case "matches_won":
      return user?.gamesWon ?? 0;
    case "matches_played":
      return user?.gamesPlayed ?? 0;
    case "shistri_declared":
      return state.shistriDeclaredTotal;
    case "shistri_won":
      return state.shistriWonTotal;
    case "max_daily_streak":
      return state.maxDailyStreak;
    case "missions_claimed":
      return state.missionsClaimedTotal;
    case "wheel_spins":
      return state.wheelSpinsTotal;
    case "track_level":
      return getCurrentTrackLevel(state.seasonXp);
    case "total_chips_won":
      return user?.totalEarnings ?? 0;
    default:
      return 0;
  }
}

/**
 * Sync all achievement progress from canonical counters and auto-grant on complete.
 */
export function syncAchievements(userId: string): AchievementView[] {
  if (!REWARD_FEATURE_FLAGS.achievementsEnabled) return [];

  ensureRewardUserState(userId);
  const views: AchievementView[] = [];

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const value = metricValue(userId, def.metric);
    const stored = getStoredProgress(userId, def.id);
    const progress = Math.max(stored.progress, Math.min(def.target, value));
    const completed = progress >= def.target;
    let completedAt = stored.completedAt;
    let claimedAt = stored.claimedAt;

    if (completed && !completedAt) {
      completedAt = Date.now();
    }

    if (completed && !claimedAt) {
      const grant = applyRewardGrant({
        userId,
        idempotencyKey: `achievement:${userId}:${def.id}`,
        kind: "achievement",
        grant: def.reward,
        meta: { achievementId: def.id },
      });
      if (grant.applied || grant.alreadyApplied) {
        claimedAt = Date.now();
      }
    }

    upsertProgress(userId, def.id, progress, completedAt, claimedAt);

    views.push({
      id: def.id,
      name: def.name,
      description: def.description,
      progress,
      target: def.target,
      completed: !!completedAt || completed,
      claimed: !!claimedAt,
      reward: def.reward,
    });
  }

  return views;
}
