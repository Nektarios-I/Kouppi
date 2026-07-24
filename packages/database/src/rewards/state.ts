/**
 * Per-user reward state row helpers.
 */

import { getRawDb } from "../client.js";
import { ACTIVE_SEASON } from "./config.js";
import type { RewardUserStateRow } from "./types.js";

function rowToState(row: Record<string, unknown>): RewardUserStateRow {
  return {
    userId: String(row.user_id),
    wheelTokens: Number(row.wheel_tokens ?? 0),
    missionRerollTokens: Number(row.mission_reroll_tokens ?? 0),
    seasonId: String(row.season_id),
    seasonXp: Number(row.season_xp),
    dailyStreak: Number(row.daily_streak),
    maxDailyStreak: Number(row.max_daily_streak),
    lastDailyClaimDate: row.last_daily_claim_date == null ? null : String(row.last_daily_claim_date),
    firstWinDate: row.first_win_date == null ? null : String(row.first_win_date),
    dailyRerollsUsed: Number(row.daily_rerolls_used),
    dailyRerollDate: row.daily_reroll_date == null ? null : String(row.daily_reroll_date),
    dailyPeriodKey: row.daily_period_key == null ? null : String(row.daily_period_key),
    weeklyPeriodKey: row.weekly_period_key == null ? null : String(row.weekly_period_key),
    missionsClaimedTotal: Number(row.missions_claimed_total),
    wheelSpinsTotal: Number(row.wheel_spins_total),
    shistriDeclaredTotal: Number(row.shistri_declared_total ?? 0),
    shistriWonTotal: Number(row.shistri_won_total ?? 0),
    betsPlacedTotal: Number(row.bets_placed_total ?? 0),
    updatedAt: Number(row.updated_at),
  };
}

export function ensureRewardUserState(userId: string): RewardUserStateRow {
  const existing = getRewardUserState(userId);
  if (existing) {
    if (existing.seasonId !== ACTIVE_SEASON.id) {
      const db = getRawDb();
      db.prepare(
        `UPDATE reward_user_state
         SET season_id = ?, season_xp = 0, updated_at = ?
         WHERE user_id = ?`
      ).run(ACTIVE_SEASON.id, Date.now(), userId);
      return getRewardUserState(userId)!;
    }
    return existing;
  }

  const db = getRawDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO reward_user_state (
      user_id, wheel_tokens, mission_reroll_tokens, season_id, season_xp, daily_streak, max_daily_streak,
      last_daily_claim_date, first_win_date, daily_rerolls_used, daily_reroll_date,
      daily_period_key, weekly_period_key, missions_claimed_total, wheel_spins_total,
      shistri_declared_total, shistri_won_total, bets_placed_total, updated_at
    ) VALUES (?, 0, 0, ?, 0, 0, 0, NULL, NULL, 0, NULL, NULL, NULL, 0, 0, 0, 0, 0, ?)`
  ).run(userId, ACTIVE_SEASON.id, now);

  return getRewardUserState(userId)!;
}

export function getRewardUserState(userId: string): RewardUserStateRow | null {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM reward_user_state WHERE user_id = ?").get(userId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToState(row) : null;
}

export function bumpSeasonXp(userId: string, amount: number, seasonId: string): void {
  const db = getRawDb();
  ensureRewardUserState(userId);
  db.prepare(
    `UPDATE reward_user_state
     SET season_xp = season_xp + ?, season_id = ?, updated_at = ?
     WHERE user_id = ?`
  ).run(amount, seasonId, Date.now(), userId);
}

export function bumpWheelTokens(userId: string, delta: number): number {
  const db = getRawDb();
  ensureRewardUserState(userId);
  const current = getRewardUserState(userId)!.wheelTokens;
  const next = Math.max(0, current + Math.floor(delta));
  db.prepare(
    `UPDATE reward_user_state SET wheel_tokens = ?, updated_at = ? WHERE user_id = ?`
  ).run(next, Date.now(), userId);
  return next;
}

export function bumpMissionRerollTokens(userId: string, delta: number): number {
  const db = getRawDb();
  ensureRewardUserState(userId);
  const current = getRewardUserState(userId)!.missionRerollTokens;
  const next = Math.max(0, current + Math.floor(delta));
  db.prepare(
    `UPDATE reward_user_state SET mission_reroll_tokens = ?, updated_at = ? WHERE user_id = ?`
  ).run(next, Date.now(), userId);
  return next;
}

export function setDailyClaimState(
  userId: string,
  input: { streak: number; maxStreak: number; claimDate: string }
): void {
  const db = getRawDb();
  ensureRewardUserState(userId);
  db.prepare(
    `UPDATE reward_user_state
     SET daily_streak = ?, max_daily_streak = ?, last_daily_claim_date = ?, updated_at = ?
     WHERE user_id = ?`
  ).run(input.streak, input.maxStreak, input.claimDate, Date.now(), userId);
}

export function setFirstWinDate(userId: string, dateKey: string): void {
  const db = getRawDb();
  ensureRewardUserState(userId);
  db.prepare(
    `UPDATE reward_user_state SET first_win_date = ?, updated_at = ? WHERE user_id = ?`
  ).run(dateKey, Date.now(), userId);
}

export function setPeriodKeys(
  userId: string,
  dailyPeriodKey: string,
  weeklyPeriodKey: string
): void {
  const db = getRawDb();
  ensureRewardUserState(userId);
  db.prepare(
    `UPDATE reward_user_state
     SET daily_period_key = ?, weekly_period_key = ?, updated_at = ?
     WHERE user_id = ?`
  ).run(dailyPeriodKey, weeklyPeriodKey, Date.now(), userId);
}

export function setDailyRerollState(userId: string, dateKey: string, used: number): void {
  const db = getRawDb();
  ensureRewardUserState(userId);
  db.prepare(
    `UPDATE reward_user_state
     SET daily_reroll_date = ?, daily_rerolls_used = ?, updated_at = ?
     WHERE user_id = ?`
  ).run(dateKey, used, Date.now(), userId);
}

export function incrementMissionsClaimedTotal(userId: string): void {
  const db = getRawDb();
  ensureRewardUserState(userId);
  db.prepare(
    `UPDATE reward_user_state
     SET missions_claimed_total = missions_claimed_total + 1, updated_at = ?
     WHERE user_id = ?`
  ).run(Date.now(), userId);
}

export function incrementWheelSpinsTotal(userId: string): void {
  const db = getRawDb();
  ensureRewardUserState(userId);
  db.prepare(
    `UPDATE reward_user_state
     SET wheel_spins_total = wheel_spins_total + 1, updated_at = ?
     WHERE user_id = ?`
  ).run(Date.now(), userId);
}

export function bumpGameplayCounters(
  userId: string,
  input: { bets?: number; shistriDeclared?: number; shistriWon?: number }
): void {
  const db = getRawDb();
  ensureRewardUserState(userId);
  db.prepare(
    `UPDATE reward_user_state SET
      bets_placed_total = bets_placed_total + ?,
      shistri_declared_total = shistri_declared_total + ?,
      shistri_won_total = shistri_won_total + ?,
      updated_at = ?
     WHERE user_id = ?`
  ).run(
    Math.max(0, input.bets ?? 0),
    Math.max(0, input.shistriDeclared ?? 0),
    Math.max(0, input.shistriWon ?? 0),
    Date.now(),
    userId
  );
}
