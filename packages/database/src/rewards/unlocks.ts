/**
 * Cosmetic / title unlock persistence.
 */

import { getRawDb } from "../client.js";
import type { RewardUnlockGrant, RewardUnlockKind } from "./types.js";

export function grantUnlocks(userId: string, unlocks: RewardUnlockGrant[]): void {
  if (!unlocks.length) return;
  const db = getRawDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO reward_unlocks (user_id, unlock_kind, unlock_id, label, unlocked_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const now = Date.now();
  for (const u of unlocks) {
    stmt.run(userId, u.kind, u.id, u.label, now);
  }
}

export function listUnlocks(userId: string): Array<{
  kind: RewardUnlockKind;
  id: string;
  label: string;
  unlockedAt: number;
}> {
  const db = getRawDb();
  const rows = db
    .prepare(
      `SELECT unlock_kind, unlock_id, label, unlocked_at FROM reward_unlocks
       WHERE user_id = ? ORDER BY unlocked_at ASC`
    )
    .all(userId) as Array<{
    unlock_kind: string;
    unlock_id: string;
    label: string;
    unlocked_at: number;
  }>;
  return rows.map((r) => ({
    kind: r.unlock_kind as RewardUnlockKind,
    id: r.unlock_id,
    label: r.label,
    unlockedAt: r.unlocked_at,
  }));
}
