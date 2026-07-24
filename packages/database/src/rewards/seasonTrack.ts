/**
 * Seasonal reward track.
 */

import { getRawDb } from "../client.js";
import { ACTIVE_SEASON, REWARD_FEATURE_FLAGS } from "./config.js";
import { applyRewardGrant } from "./grant.js";
import { ensureRewardUserState } from "./state.js";
import type { TrackLevelView } from "./types.js";
import { RewardActionError } from "./errors.js";

export function getCurrentTrackLevel(seasonXp: number): number {
  let level = 0;
  for (const def of ACTIVE_SEASON.levels) {
    if (seasonXp >= def.xpRequired) level = def.level;
    else break;
  }
  return level;
}

export function listTrackClaims(userId: string, seasonId: string): Set<number> {
  const db = getRawDb();
  const rows = db
    .prepare(`SELECT level FROM reward_track_claims WHERE user_id = ? AND season_id = ?`)
    .all(userId, seasonId) as { level: number }[];
  return new Set(rows.map((r) => r.level));
}

export function buildTrackLevelViews(userId: string): TrackLevelView[] {
  if (!REWARD_FEATURE_FLAGS.seasonTrackEnabled) return [];
  const state = ensureRewardUserState(userId);
  const claimed = listTrackClaims(userId, state.seasonId);
  return ACTIVE_SEASON.levels.map((lvl) => {
    let viewState: TrackLevelView["state"] = "locked";
    if (claimed.has(lvl.level)) viewState = "claimed";
    else if (state.seasonXp >= lvl.xpRequired) viewState = "claimable";
    return {
      level: lvl.level,
      label: lvl.label,
      xpRequired: lvl.xpRequired,
      reward: lvl.reward,
      state: viewState,
    };
  });
}

export function claimTrackLevel(userId: string, level: number): {
  level: number;
  grant: ReturnType<typeof applyRewardGrant>;
} {
  if (!REWARD_FEATURE_FLAGS.seasonTrackEnabled) {
    throw new RewardActionError("Season track disabled", "TRACK_DISABLED");
  }

  const state = ensureRewardUserState(userId);
  const def = ACTIVE_SEASON.levels.find((l) => l.level === level);
  if (!def) {
    throw new RewardActionError("Track level not found", "TRACK_LEVEL_MISSING");
  }
  if (state.seasonXp < def.xpRequired) {
    throw new RewardActionError("Track level locked", "TRACK_LOCKED");
  }

  const claimed = listTrackClaims(userId, state.seasonId);
  if (claimed.has(level)) {
    throw new RewardActionError("Track level already claimed", "TRACK_ALREADY_CLAIMED");
  }

  const grant = applyRewardGrant({
    userId,
    idempotencyKey: `track_claim:${userId}:${state.seasonId}:${level}`,
    kind: "track_claim",
    grant: def.reward,
    meta: { seasonId: state.seasonId, level },
  });

  if (grant.alreadyApplied) {
    throw new RewardActionError("Track level already claimed", "TRACK_ALREADY_CLAIMED");
  }

  const db = getRawDb();
  try {
    db.prepare(
      `INSERT INTO reward_track_claims (user_id, season_id, level, claimed_at) VALUES (?, ?, ?, ?)`
    ).run(userId, state.seasonId, level, Date.now());
  } catch {
    throw new RewardActionError("Track level already claimed", "TRACK_ALREADY_CLAIMED");
  }

  return { level, grant };
}
