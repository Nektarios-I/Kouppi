/**
 * Wheel token spin foundation.
 */

import { v4 as uuidv4 } from "uuid";
import { getRawDb } from "../client.js";
import { REWARD_FEATURE_FLAGS, WHEEL_REWARD_TABLE } from "./config.js";
import { applyRewardGrant } from "./grant.js";
import { bumpWheelTokens, ensureRewardUserState, incrementWheelSpinsTotal } from "./state.js";
import type { WheelRewardDefinition } from "./types.js";
import { RewardActionError } from "./errors.js";

function pickWheelReward(rng: () => number = Math.random): WheelRewardDefinition {
  const total = WHEEL_REWARD_TABLE.reduce((s, r) => s + r.weight, 0);
  let roll = rng() * total;
  for (const entry of WHEEL_REWARD_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return WHEEL_REWARD_TABLE[WHEEL_REWARD_TABLE.length - 1];
}

export function spinWheel(
  userId: string,
  rng: () => number = Math.random
): {
  spinId: string;
  rewardId: string;
  label: string;
  grant: ReturnType<typeof applyRewardGrant>;
  tokensRemaining: number;
} {
  if (!REWARD_FEATURE_FLAGS.wheelEnabled) {
    throw new RewardActionError("Wheel disabled", "WHEEL_DISABLED");
  }

  const state = ensureRewardUserState(userId);
  if (state.wheelTokens < 1) {
    throw new RewardActionError("No wheel tokens", "WHEEL_NO_TOKENS");
  }

  // Consume token first (ledger still guards the reward grant)
  const tokensRemaining = bumpWheelTokens(userId, -1);
  const spinId = uuidv4();
  const outcome = pickWheelReward(rng);

  const grant = applyRewardGrant({
    userId,
    idempotencyKey: `wheel_spin:${spinId}`,
    kind: "wheel_spin",
    grant: outcome.reward,
    meta: { rewardId: outcome.id, spinId },
  });

  const db = getRawDb();
  db.prepare(
    `INSERT INTO reward_wheel_spins (id, user_id, reward_id, created_at) VALUES (?, ?, ?, ?)`
  ).run(spinId, userId, outcome.id, Date.now());

  incrementWheelSpinsTotal(userId);

  return {
    spinId,
    rewardId: outcome.id,
    label: outcome.label,
    grant,
    tokensRemaining,
  };
}
