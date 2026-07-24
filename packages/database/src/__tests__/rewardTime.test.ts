/**
 * Pure unit tests for reward period helpers (no SQLite).
 */

import { describe, it, expect } from "vitest";
import {
  getDailyPeriodKey,
  getPreviousDailyPeriodKey,
  getWeeklyPeriodKey,
  isConsecutiveDailyClaim,
  isSameDailyPeriod,
  getNextDailyResetAt,
} from "../rewards/time.js";
import { getStreakReward } from "../rewards/config.js";

describe("reward time helpers", () => {
  it("formats UTC daily keys", () => {
    const key = getDailyPeriodKey(Date.UTC(2026, 6, 23, 15, 30, 0));
    expect(key).toBe("2026-07-23");
    expect(getPreviousDailyPeriodKey(Date.UTC(2026, 6, 23, 0, 0, 0))).toBe("2026-07-22");
  });

  it("computes ISO week keys", () => {
    expect(getWeeklyPeriodKey(Date.UTC(2026, 6, 23))).toBe("2026-W30");
  });

  it("detects consecutive daily claims", () => {
    expect(isSameDailyPeriod("2026-07-23", "2026-07-23")).toBe(true);
    expect(isConsecutiveDailyClaim("2026-07-22", "2026-07-23")).toBe(true);
    expect(isConsecutiveDailyClaim("2026-07-21", "2026-07-23")).toBe(false);
    expect(isConsecutiveDailyClaim(null, "2026-07-23")).toBe(false);
  });

  it("computes next daily reset at next UTC midnight", () => {
    const now = Date.UTC(2026, 6, 23, 15, 0, 0);
    expect(getNextDailyResetAt(now)).toBe(Date.UTC(2026, 6, 24, 0, 0, 0));
  });
});


describe("streak reward cycle", () => {
  it("maps day indexes 1-7 and wraps", () => {
    expect(getStreakReward(1).reward.chips).toBe(100);
    expect(getStreakReward(1).reward.seasonXp).toBe(40);
    expect(getStreakReward(7).reward.wheelTokens).toBe(1);
    expect(getStreakReward(7).reward.chips).toBe(600);
    expect(getStreakReward(8).dayIndex).toBe(1);
    expect(getStreakReward(14).dayIndex).toBe(7);
  });
});
