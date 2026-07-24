/**
 * Canonical reward grant pipeline.
 * All chip / XP / token / unlock grants should flow through applyRewardGrant.
 */

import { getRawDb } from "../client.js";
import { creditBankroll } from "../users.js";
import { insertLedgerEntry } from "./ledger.js";
import type { GrantResult, NormalizedCurrencyGrant, RewardCurrencyGrant } from "./types.js";
import { ACTIVE_SEASON } from "./config.js";
import {
  bumpMissionRerollTokens,
  bumpSeasonXp,
  bumpWheelTokens,
  ensureRewardUserState,
} from "./state.js";
import { grantUnlocks } from "./unlocks.js";
import { autoEquipNewUnlocks } from "./equipped.js";

export function normalizeGrant(grant: RewardCurrencyGrant): NormalizedCurrencyGrant {
  return {
    chips: Math.max(0, Math.floor(grant.chips ?? 0)),
    seasonXp: Math.max(0, Math.floor(grant.seasonXp ?? 0)),
    wheelTokens: Math.max(0, Math.floor(grant.wheelTokens ?? 0)),
    missionRerollTokens: Math.max(0, Math.floor(grant.missionRerollTokens ?? 0)),
    unlocks: grant.unlocks ?? [],
  };
}

/**
 * Apply a grant exactly once for the given idempotency key.
 */
export function applyRewardGrant(input: {
  userId: string;
  idempotencyKey: string;
  kind: string;
  grant: RewardCurrencyGrant;
  meta?: Record<string, unknown>;
}): GrantResult {
  const normalized = normalizeGrant(input.grant);
  ensureRewardUserState(input.userId);

  const { inserted, row } = insertLedgerEntry({
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    kind: input.kind,
    grant: {
      chips: normalized.chips,
      seasonXp: normalized.seasonXp,
      wheelTokens: normalized.wheelTokens,
    },
    meta: {
      ...input.meta,
      missionRerollTokens: normalized.missionRerollTokens,
      unlocks: normalized.unlocks,
    },
  });

  if (!inserted) {
    let unlocks = normalized.unlocks;
    try {
      const meta = row.metaJson ? (JSON.parse(row.metaJson) as { unlocks?: typeof unlocks }) : null;
      if (meta?.unlocks) unlocks = meta.unlocks;
    } catch {
      // ignore
    }
    return {
      applied: false,
      alreadyApplied: true,
      grant: {
        chips: row.amountChips,
        seasonXp: row.amountXp,
        wheelTokens: row.amountTokens,
        missionRerollTokens: 0,
        unlocks,
      },
      ledgerId: row.id,
    };
  }

  const db = getRawDb();
  const tx = db.transaction(() => {
    if (normalized.chips > 0) creditBankroll(input.userId, normalized.chips);
    if (normalized.seasonXp > 0) bumpSeasonXp(input.userId, normalized.seasonXp, ACTIVE_SEASON.id);
    if (normalized.wheelTokens > 0) bumpWheelTokens(input.userId, normalized.wheelTokens);
    if (normalized.missionRerollTokens > 0) {
      bumpMissionRerollTokens(input.userId, normalized.missionRerollTokens);
    }
    if (normalized.unlocks.length) {
      grantUnlocks(input.userId, normalized.unlocks);
      autoEquipNewUnlocks(
        input.userId,
        normalized.unlocks.map((u) => u.id)
      );
    }
  });
  tx();

  return {
    applied: true,
    alreadyApplied: false,
    grant: normalized,
    ledgerId: row.id,
  };
}
