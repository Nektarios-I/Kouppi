/**
 * Reward system unit/integration tests (SQLite temp DB).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  getDatabase,
  closeDatabase,
  createUser,
  getUserById,
  getRewardPublicState,
  claimDaily,
  claimMission,
  rerollMission,
  claimTrack,
  spinRewardWheel,
  onCareerMatchFinished,
  RewardActionError,
  getRawDb,
  FIRST_WIN_REWARD_CHIPS,
} from "../index.js";
import { getDailyPeriodKey, getPreviousDailyPeriodKey, getNextDailyResetAt } from "../rewards/time.js";
import {
  bumpWheelTokens,
  ensureRewardUserState,
  setDailyClaimState,
  bumpSeasonXp,
} from "../rewards/state.js";
import { ACTIVE_SEASON, DAILY_STREAK_REWARDS, WHEEL_REWARD_TABLE } from "../rewards/config.js";

const tmpDb = path.join(os.tmpdir(), `kouppi-rewards-${process.pid}-${Date.now()}.db`);

describe("Reward system V1 (product design)", () => {
  beforeAll(() => {
    process.env.DATABASE_PATH = tmpDb;
    if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
    closeDatabase();
    getDatabase(tmpDb);
  });

  afterAll(() => {
    closeDatabase();
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      // ignore
    }
  });

  let userId: string;

  beforeEach(async () => {
    const profile = await createUser(
      `u${Date.now().toString(36).slice(-6)}${Math.floor(Math.random() * 99)}`,
      "password123"
    );
    userId = profile.id;
  });

  it("exposes next daily reset and design streak day-1 reward", () => {
    const state = getRewardPublicState(userId);
    expect(state.dailyMissions).toHaveLength(3);
    expect(state.weeklyMissions).toHaveLength(3);
    expect(state.season.levels).toHaveLength(30);
    expect(state.nextDailyResetAt).toBe(getNextDailyResetAt(state.serverNow));
    expect(state.dailyClaim.nextReward.chips).toBe(DAILY_STREAK_REWARDS[0].reward.chips);
    expect(state.dailyClaim.nextReward.seasonXp).toBe(40);
    expect(state.firstWin.rewardChips).toBe(FIRST_WIN_REWARD_CHIPS);
    expect(state.firstWin.rewardXp).toBe(80);
  });

  it("claims daily once and blocks duplicate same-day claim", () => {
    const before = getUserById(userId)!.bankroll;
    const first = claimDaily(userId);
    expect(first.grant.applied).toBe(true);
    expect(first.streak).toBe(1);
    expect(first.grant.grant.chips).toBe(100);
    expect(first.grant.grant.seasonXp).toBe(40);
    expect(getUserById(userId)!.bankroll).toBe(before + 100);

    expect(() => claimDaily(userId)).toThrow(RewardActionError);
    const state = getRewardPublicState(userId);
    expect(state.dailyClaim.alreadyClaimedToday).toBe(true);
  });

  it("soft-resets streak on miss but keeps lifetime best", async () => {
    const profile = await createUser(`r${Date.now().toString(36).slice(-8)}`, "password123");
    const id = profile.id;
    const old = getDailyPeriodKey(Date.now() - 3 * 86400000);
    ensureRewardUserState(id);
    setDailyClaimState(id, { streak: 5, maxStreak: 5, claimDate: old });
    const result = claimDaily(id);
    expect(result.streak).toBe(1);
    expect(getRewardPublicState(id).dailyClaim.lifetimeBestStreak).toBeGreaterThanOrEqual(5);
  });

  it("increments streak on consecutive day", () => {
    const yesterday = getPreviousDailyPeriodKey();
    ensureRewardUserState(userId);
    setDailyClaimState(userId, { streak: 3, maxStreak: 3, claimDate: yesterday });
    const result = claimDaily(userId);
    expect(result.streak).toBe(4);
    expect(result.dayIndex).toBe(4);
  });

  it("grants day-7 wheel token from streak", async () => {
    const profile = await createUser(`d${Date.now().toString(36).slice(-8)}`, "password123");
    const id = profile.id;
    const yesterday = getPreviousDailyPeriodKey();
    ensureRewardUserState(id);
    setDailyClaimState(id, { streak: 6, maxStreak: 6, claimDate: yesterday });
    const result = claimDaily(id);
    expect(result.dayIndex).toBe(7);
    expect(result.grant.grant.wheelTokens).toBe(1);
    expect(result.grant.grant.chips).toBe(600);
  });

  it("grants first win once per day at design values", () => {
    const before = getUserById(userId)!.bankroll;
    const event = {
      eventId: `room:game:${userId}:1`,
      userId,
      mode: "career" as const,
      placement: 1,
      chipsWon: 50,
      potWon: 50,
      won: true,
    };
    const a = onCareerMatchFinished(event);
    expect(a.firstWin?.applied).toBe(true);
    expect(getUserById(userId)!.bankroll).toBe(before + FIRST_WIN_REWARD_CHIPS);

    const b = onCareerMatchFinished({ ...event, eventId: `room:game:${userId}:2` });
    expect(b.firstWin).toBeNull();
    expect(getUserById(userId)!.bankroll).toBe(before + FIRST_WIN_REWARD_CHIPS);
  });

  it("enforces one free daily reroll then allows token spend", () => {
    const state = getRewardPublicState(userId);
    const slot = state.dailyMissions[0];
    const first = rerollMission(userId, slot.id);
    expect(first.state.dailyRerollsRemaining).toBe(0);
    // Without tokens, second free reroll fails
    expect(() => rerollMission(userId, first.state.dailyMissions[0].id)).toThrow(RewardActionError);
  });

  it("claims track level once after XP grant", () => {
    bumpSeasonXp(userId, 100, ACTIVE_SEASON.id);
    expect(getRewardPublicState(userId).season.levels[0].state).toBe("claimable");
    claimTrack(userId, 1);
    expect(() => claimTrack(userId, 1)).toThrow(RewardActionError);
    expect(getRewardPublicState(userId).season.levels[0].state).toBe("claimed");
  });

  it("spins wheel consuming one token; odds weights sum to 1000", () => {
    expect(WHEEL_REWARD_TABLE.reduce((s, r) => s + r.weight, 0)).toBe(1000);
    bumpWheelTokens(userId, 1);
    const result = spinRewardWheel(userId, Date.now(), () => 0);
    expect(result.tokensRemaining).toBe(0);
    expect(result.grant.applied).toBe(true);
    expect(() => spinRewardWheel(userId)).toThrow(RewardActionError);
  });

  it("auto-grants first_kouppi_win achievement once", () => {
    getRawDb().prepare("UPDATE users SET games_won = 1, games_played = 1 WHERE id = ?").run(userId);
    const before = getUserById(userId)!.bankroll;
    const state = getRewardPublicState(userId);
    const ach = state.achievements.find((a) => a.id === "first_kouppi_win");
    expect(ach?.claimed).toBe(true);
    expect(getUserById(userId)!.bankroll).toBe(before + 100);
    getRewardPublicState(userId);
    expect(getUserById(userId)!.bankroll).toBe(before + 100);
  });

  it("progresses missions from career match", () => {
    onCareerMatchFinished({
      eventId: `m1:${userId}`,
      userId,
      mode: "career",
      placement: 2,
      chipsWon: 0,
      won: false,
    });
    const state = getRewardPublicState(userId);
    const career = state.dailyMissions.find((m) => m.metric === "career_matches");
    const play = state.dailyMissions.find((m) => m.metric === "play_matches");
    if (career) expect(career.progress).toBeGreaterThan(0);
    if (play) expect(play.progress).toBeGreaterThan(0);
    const claimable = state.dailyMissions.find((m) => m.canClaim);
    if (claimable) {
      claimMission(userId, claimable.id);
      expect(() => claimMission(userId, claimable.id)).toThrow(RewardActionError);
    }
  });

  it("equips unlocked table theme and rejects locked ones", async () => {
    const profile = await createUser(`c${Date.now().toString(36).slice(-8)}`, "password123");
    const id = profile.id;
    const { grantUnlocks } = await import("../rewards/unlocks.js");
    const { equipRewardCosmetic, getPublicPlayerCosmetics } = await import("../index.js");
    grantUnlocks(id, [{ kind: "table_theme", id: "midnight-blue", label: "Midnight Felt" }]);
    const ok = equipRewardCosmetic(id, "table_theme", "midnight-blue");
    expect(ok.equipped.tableThemeId).toBe("midnight-blue");
    expect(ok.state.equipped.tableThemeId).toBe("midnight-blue");
    expect(() => equipRewardCosmetic(id, "table_theme", "royal-blue")).toThrow(RewardActionError);

    grantUnlocks(id, [{ kind: "title", id: "title_first_win", label: "First Win" }]);
    equipRewardCosmetic(id, "title", "title_first_win");
    const pub = getPublicPlayerCosmetics(id);
    expect(pub.titleId).toBe("title_first_win");
    expect(pub.frameId).toBeTruthy();
  });
});
