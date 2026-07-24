/**
 * Immutable reward ledger + idempotency.
 */

import { v4 as uuidv4 } from "uuid";
import { getRawDb } from "../client.js";
import type { RewardCurrencyGrant } from "./types.js";

export interface LedgerRow {
  id: string;
  userId: string;
  idempotencyKey: string;
  kind: string;
  amountChips: number;
  amountXp: number;
  amountTokens: number;
  metaJson: string | null;
  createdAt: number;
}

export function findLedgerByKey(idempotencyKey: string): LedgerRow | null {
  const db = getRawDb();
  const row = db
    .prepare("SELECT * FROM reward_ledger WHERE idempotency_key = ?")
    .get(idempotencyKey) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    idempotencyKey: String(row.idempotency_key),
    kind: String(row.kind),
    amountChips: Number(row.amount_chips),
    amountXp: Number(row.amount_xp),
    amountTokens: Number(row.amount_tokens),
    metaJson: row.meta_json == null ? null : String(row.meta_json),
    createdAt: Number(row.created_at),
  };
}

export function insertLedgerEntry(input: {
  userId: string;
  idempotencyKey: string;
  kind: string;
  grant: RewardCurrencyGrant;
  meta?: Record<string, unknown>;
}): { inserted: boolean; row: LedgerRow } {
  const existing = findLedgerByKey(input.idempotencyKey);
  if (existing) {
    return { inserted: false, row: existing };
  }

  const db = getRawDb();
  const id = uuidv4();
  const createdAt = Date.now();
  const chips = input.grant.chips ?? 0;
  const xp = input.grant.seasonXp ?? 0;
  const tokens = input.grant.wheelTokens ?? 0;
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;

  try {
    db.prepare(
      `INSERT INTO reward_ledger
        (id, user_id, idempotency_key, kind, amount_chips, amount_xp, amount_tokens, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.userId, input.idempotencyKey, input.kind, chips, xp, tokens, metaJson, createdAt);
  } catch (err) {
    const again = findLedgerByKey(input.idempotencyKey);
    if (again) return { inserted: false, row: again };
    throw err;
  }

  return {
    inserted: true,
    row: {
      id,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      amountChips: chips,
      amountXp: xp,
      amountTokens: tokens,
      metaJson,
      createdAt,
    },
  };
}
