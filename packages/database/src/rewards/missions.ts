/**
 * Daily + weekly mission assignment, progress, claim, reroll.
 */

import { v4 as uuidv4 } from "uuid";
import { getRawDb } from "../client.js";
import {
  DAILY_MISSION_POOL,
  DAILY_MISSION_SLOT_COUNT,
  DAILY_REROLLS_PER_DAY,
  getMissionDefinition,
  REWARD_FEATURE_FLAGS,
  WEEKLY_MISSION_POOL,
  WEEKLY_MISSION_SLOT_COUNT,
} from "./config.js";
import { applyRewardGrant } from "./grant.js";
import {
  ensureRewardUserState,
  incrementMissionsClaimedTotal,
  setDailyRerollState,
  setPeriodKeys,
  bumpMissionRerollTokens,
} from "./state.js";
import { getDailyPeriodKey, getWeeklyPeriodKey, isSameDailyPeriod } from "./time.js";
import type {
  MissionDefinition,
  MissionMetric,
  MissionPeriodType,
  MissionSlotRow,
  MissionSlotStatus,
} from "./types.js";
import { RewardActionError } from "./errors.js";

function rowToSlot(row: Record<string, unknown>): MissionSlotRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    periodType: row.period_type as MissionPeriodType,
    periodKey: String(row.period_key),
    slotIndex: Number(row.slot_index),
    definitionId: String(row.definition_id),
    progress: Number(row.progress),
    target: Number(row.target),
    status: row.status as MissionSlotStatus,
    claimedAt: row.claimed_at == null ? null : Number(row.claimed_at),
  };
}

function weightedPick(pool: MissionDefinition[], excludeIds: Set<string>): MissionDefinition {
  const available = pool.filter((p) => !excludeIds.has(p.id));
  const use = available.length > 0 ? available : pool;
  const total = use.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * total;
  for (const def of use) {
    roll -= def.weight;
    if (roll <= 0) return def;
  }
  return use[use.length - 1];
}

function insertSlot(
  userId: string,
  periodType: MissionPeriodType,
  periodKey: string,
  slotIndex: number,
  def: MissionDefinition
): MissionSlotRow {
  const db = getRawDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO reward_mission_slots
      (id, user_id, period_type, period_key, slot_index, definition_id, progress, target, status, claimed_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'active', NULL)`
  ).run(id, userId, periodType, periodKey, slotIndex, def.id, def.target);
  return getSlotById(id)!;
}

export function getSlotById(slotId: string): MissionSlotRow | null {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM reward_mission_slots WHERE id = ?").get(slotId) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToSlot(row) : null;
}

export function listSlots(
  userId: string,
  periodType: MissionPeriodType,
  periodKey: string
): MissionSlotRow[] {
  const db = getRawDb();
  const rows = db
    .prepare(
      `SELECT * FROM reward_mission_slots
       WHERE user_id = ? AND period_type = ? AND period_key = ?
       ORDER BY slot_index ASC`
    )
    .all(userId, periodType, periodKey) as Record<string, unknown>[];
  return rows.map(rowToSlot);
}

function assignPeriodMissions(
  userId: string,
  periodType: MissionPeriodType,
  periodKey: string,
  count: number,
  pool: MissionDefinition[]
): MissionSlotRow[] {
  const existing = listSlots(userId, periodType, periodKey);
  if (existing.length >= count) return existing.slice(0, count);

  const used = new Set(existing.map((s) => s.definitionId));
  const created: MissionSlotRow[] = [...existing];
  for (let i = existing.length; i < count; i++) {
    const def = weightedPick(pool, used);
    used.add(def.id);
    created.push(insertSlot(userId, periodType, periodKey, i, def));
  }
  return created;
}

/**
 * Ensure daily/weekly mission slots exist for current periods.
 */
export function ensureMissionAssignments(userId: string, nowMs: number = Date.now()): {
  daily: MissionSlotRow[];
  weekly: MissionSlotRow[];
} {
  if (!REWARD_FEATURE_FLAGS.missionsEnabled) {
    return { daily: [], weekly: [] };
  }

  ensureRewardUserState(userId);
  const dailyKey = getDailyPeriodKey(nowMs);
  const weeklyKey = getWeeklyPeriodKey(nowMs);
  setPeriodKeys(userId, dailyKey, weeklyKey);

  const daily = assignPeriodMissions(
    userId,
    "daily",
    dailyKey,
    DAILY_MISSION_SLOT_COUNT,
    DAILY_MISSION_POOL
  );
  const weekly = assignPeriodMissions(
    userId,
    "weekly",
    weeklyKey,
    WEEKLY_MISSION_SLOT_COUNT,
    WEEKLY_MISSION_POOL
  );
  return { daily, weekly };
}

function syncSlotCompletion(slot: MissionSlotRow): MissionSlotRow {
  if (slot.status === "claimed") return slot;
  if (slot.progress >= slot.target && slot.status === "active") {
    const db = getRawDb();
    db.prepare(`UPDATE reward_mission_slots SET status = 'completed' WHERE id = ? AND status = 'active'`).run(
      slot.id
    );
    return getSlotById(slot.id)!;
  }
  return slot;
}

/**
 * Increment progress for all active missions matching a metric.
 */
export function bumpMissionProgress(
  userId: string,
  metric: MissionMetric,
  amount: number,
  nowMs: number = Date.now()
): void {
  if (!REWARD_FEATURE_FLAGS.missionsEnabled || amount <= 0) return;
  const { daily, weekly } = ensureMissionAssignments(userId, nowMs);
  const db = getRawDb();

  for (const slot of [...daily, ...weekly]) {
    if (slot.status !== "active") continue;
    const def = getMissionDefinition(slot.definitionId);
    if (!def || def.metric !== metric) continue;

    const next = Math.min(slot.target, slot.progress + amount);
    db.prepare(`UPDATE reward_mission_slots SET progress = ? WHERE id = ? AND status = 'active'`).run(
      next,
      slot.id
    );
    syncSlotCompletion({ ...slot, progress: next });
  }
}

export function claimMissionReward(userId: string, slotId: string): {
  slot: MissionSlotRow;
  grant: ReturnType<typeof applyRewardGrant>;
} {
  const slot = getSlotById(slotId);
  if (!slot || slot.userId !== userId) {
    throw new RewardActionError("Mission not found", "MISSION_NOT_FOUND");
  }

  const fresh = syncSlotCompletion(slot);
  if (fresh.status === "claimed") {
    throw new RewardActionError("Mission already claimed", "MISSION_ALREADY_CLAIMED");
  }
  if (fresh.status !== "completed" && fresh.progress < fresh.target) {
    throw new RewardActionError("Mission not complete", "MISSION_NOT_COMPLETE");
  }

  const def = getMissionDefinition(fresh.definitionId);
  if (!def) {
    throw new RewardActionError("Mission definition missing", "MISSION_DEF_MISSING");
  }

  const grant = applyRewardGrant({
    userId,
    idempotencyKey: `mission_claim:${slotId}`,
    kind: "mission_claim",
    grant: def.reward,
    meta: { definitionId: def.id, periodType: fresh.periodType },
  });

  if (grant.alreadyApplied) {
    throw new RewardActionError("Mission already claimed", "MISSION_ALREADY_CLAIMED");
  }

  const db = getRawDb();
  const claimedAt = Date.now();
  db.prepare(
    `UPDATE reward_mission_slots SET status = 'claimed', claimed_at = ?, progress = ? WHERE id = ?`
  ).run(claimedAt, fresh.target, slotId);

  incrementMissionsClaimedTotal(userId);
  bumpMissionProgress(userId, "missions_claimed", 1);

  return { slot: getSlotById(slotId)!, grant };
}

export function getDailyRerollsRemaining(userId: string, nowMs: number = Date.now()): number {
  const state = ensureRewardUserState(userId);
  const today = getDailyPeriodKey(nowMs);
  if (!isSameDailyPeriod(state.dailyRerollDate, today)) {
    return DAILY_REROLLS_PER_DAY;
  }
  return Math.max(0, DAILY_REROLLS_PER_DAY - state.dailyRerollsUsed);
}

/** Free daily rerolls + inventory mission reroll tokens */
export function getTotalRerollBudget(userId: string, nowMs: number = Date.now()): number {
  const state = ensureRewardUserState(userId);
  return getDailyRerollsRemaining(userId, nowMs) + state.missionRerollTokens;
}

export function rerollMissionSlot(userId: string, slotId: string, nowMs: number = Date.now()): MissionSlotRow {
  const slot = getSlotById(slotId);
  if (!slot || slot.userId !== userId) {
    throw new RewardActionError("Mission not found", "MISSION_NOT_FOUND");
  }
  if (slot.periodType !== "daily") {
    throw new RewardActionError("Only daily missions can be rerolled", "REROLL_NOT_ALLOWED");
  }
  if (slot.status !== "active" || slot.progress >= slot.target) {
    throw new RewardActionError("Cannot reroll a completed mission", "REROLL_NOT_ALLOWED");
  }

  const freeRemaining = getDailyRerollsRemaining(userId, nowMs);
  const state = ensureRewardUserState(userId);
  if (freeRemaining <= 0 && state.missionRerollTokens <= 0) {
    throw new RewardActionError("No rerolls remaining", "REROLL_EXHAUSTED");
  }

  const today = getDailyPeriodKey(nowMs);
  const siblings = listSlots(userId, "daily", slot.periodKey);
  const exclude = new Set(siblings.map((s) => s.definitionId));
  exclude.delete(slot.definitionId);
  const nextDef = weightedPick(DAILY_MISSION_POOL, exclude);

  const db = getRawDb();
  db.prepare(
    `UPDATE reward_mission_slots
     SET definition_id = ?, progress = 0, target = ?, status = 'active', claimed_at = NULL
     WHERE id = ?`
  ).run(nextDef.id, nextDef.target, slotId);

  if (freeRemaining > 0) {
    const used = isSameDailyPeriod(state.dailyRerollDate, today) ? state.dailyRerollsUsed + 1 : 1;
    setDailyRerollState(userId, today, used);
  } else {
    bumpMissionRerollTokens(userId, -1);
  }

  return getSlotById(slotId)!;
}
