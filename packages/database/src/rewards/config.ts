/**
 * Centralized reward configuration — product design source of truth.
 * Tune values here only.
 */

import type {
  AchievementDefinition,
  DailyStreakDayReward,
  MissionDefinition,
  RewardCurrencyGrant,
  SeasonDefinition,
  SeasonLevelDefinition,
  WheelRewardDefinition,
} from "./types.js";

export const REWARD_FEATURE_FLAGS = {
  enabled: true,
  firstWinEnabled: true,
  missionsEnabled: true,
  seasonTrackEnabled: true,
  wheelEnabled: true,
  achievementsEnabled: true,
} as const;

/** First win of day — design: +100 chips + 80 XP */
export const FIRST_WIN_REWARD_CHIPS = 100;
export const FIRST_WIN_BONUS_XP = 80;

/** Match XP pacing (design) */
export const MATCH_PARTICIPATION_XP = 20;
export const MATCH_WIN_XP = 15;
export const CAREER_MATCH_EXTRA_XP = 10;

export const DAILY_MISSION_SLOT_COUNT = 3;
export const WEEKLY_MISSION_SLOT_COUNT = 3;
/** Free daily mission rerolls (plus optional missionRerollTokens inventory) */
export const DAILY_REROLLS_PER_DAY = 1;

export const DAILY_STREAK_REWARDS: DailyStreakDayReward[] = [
  { dayIndex: 1, reward: { chips: 100, seasonXp: 40 } },
  { dayIndex: 2, reward: { chips: 150, seasonXp: 40 } },
  { dayIndex: 3, reward: { chips: 200, seasonXp: 50 } },
  { dayIndex: 4, reward: { chips: 250, seasonXp: 50 } },
  { dayIndex: 5, reward: { chips: 300, seasonXp: 60 } },
  { dayIndex: 6, reward: { chips: 400, seasonXp: 60 } },
  { dayIndex: 7, reward: { chips: 600, seasonXp: 100, wheelTokens: 1 } },
];

export const DAILY_MISSION_POOL: MissionDefinition[] = [
  {
    id: "d_play_2",
    periodType: "daily",
    title: "Table Time",
    description: "Play 2 matches",
    metric: "play_matches",
    target: 2,
    reward: { chips: 75, seasonXp: 80 },
    weight: 10,
  },
  {
    id: "d_win_1",
    periodType: "daily",
    title: "Take One",
    description: "Win 1 match",
    metric: "win_matches",
    target: 1,
    reward: { chips: 100, seasonXp: 120 },
    weight: 10,
  },
  {
    id: "d_bets_10",
    periodType: "daily",
    title: "In the Action",
    description: "Place 10 bets total",
    metric: "place_bets",
    target: 10,
    reward: { chips: 75, seasonXp: 70 },
    weight: 8,
  },
  {
    id: "d_shistri_1",
    periodType: "daily",
    title: "Declare SHISTRI",
    description: "Declare SHISTRI once",
    metric: "declare_shistri",
    target: 1,
    reward: { chips: 100, seasonXp: 100 },
    weight: 7,
  },
  {
    id: "d_career_1",
    periodType: "daily",
    title: "Career Seat",
    description: "Finish 1 Career match",
    metric: "career_matches",
    target: 1,
    reward: { chips: 80, seasonXp: 120 },
    weight: 8,
  },
  {
    id: "d_mp_1",
    periodType: "daily",
    title: "Open Table",
    description: "Play 1 multiplayer match",
    metric: "multiplayer_matches",
    target: 1,
    reward: { chips: 80, seasonXp: 100 },
    weight: 8,
  },
  {
    id: "d_claim_daily",
    periodType: "daily",
    title: "Show Up",
    description: "Claim your daily reward",
    metric: "claim_daily",
    target: 1,
    reward: { chips: 50, seasonXp: 40 },
    weight: 5,
  },
];

export const WEEKLY_MISSION_POOL: MissionDefinition[] = [
  {
    id: "w_win_5",
    periodType: "weekly",
    title: "Winning Week",
    description: "Win 5 matches",
    metric: "win_matches",
    target: 5,
    reward: { chips: 400, seasonXp: 500 },
    weight: 10,
  },
  {
    id: "w_play_10",
    periodType: "weekly",
    title: "Full Schedule",
    description: "Play 10 matches",
    metric: "play_matches",
    target: 10,
    reward: { chips: 350, seasonXp: 450 },
    weight: 10,
  },
  {
    id: "w_career_3",
    periodType: "weekly",
    title: "Career Circuit",
    description: "Complete 3 Career matches",
    metric: "career_matches",
    target: 3,
    reward: { chips: 350, seasonXp: 550 },
    weight: 8,
  },
  {
    id: "w_pot_500",
    periodType: "weekly",
    title: "Pot Hunter",
    description: "Win total pot value of 500",
    metric: "pot_won",
    target: 500,
    reward: { chips: 400, seasonXp: 500 },
    weight: 7,
  },
  {
    id: "w_shistri_5",
    periodType: "weekly",
    title: "SHISTRI Week",
    description: "Declare SHISTRI 5 times",
    metric: "declare_shistri",
    target: 5,
    reward: { chips: 400, seasonXp: 550 },
    weight: 7,
  },
];

/** Cumulative XP gates for a casual→committed 8-week season */
const TRACK_XP: number[] = [
  100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3300, 4000, 4800, 5700, 6700, 7800, 9000, 10300,
  11700, 13200, 14800, 16500, 18300, 20200, 22200, 24300, 26500, 28800, 31200, 33700, 36500,
];

function lvl(
  level: number,
  label: string,
  reward: RewardCurrencyGrant
): SeasonLevelDefinition {
  return { level, xpRequired: TRACK_XP[level - 1], reward, label };
}

/**
 * Season 1 — 8 weeks, 30 levels, cosmetic-heavy track.
 * Wheel is not required to finish the track.
 */
export const ACTIVE_SEASON: SeasonDefinition = {
  id: "S1",
  name: "Season 1 — Opening Tables",
  startsAt: Date.UTC(2026, 6, 1), // 2026-07-01
  endsAt: Date.UTC(2026, 7, 26, 23, 59, 59), // ~8 weeks
  levels: [
    lvl(1, "Opening Stack", { chips: 200 }),
    lvl(2, "Beginner's Luck", {
      unlocks: [{ kind: "title", id: "title_beginners_luck", label: "Beginner's Luck" }],
    }),
    lvl(3, "Wheel Token", { wheelTokens: 1 }),
    lvl(4, "Chip Drop", { chips: 250 }),
    lvl(5, "Classic Blue", {
      unlocks: [{ kind: "card_back", id: "cardback_classic_blue", label: "Classic Blue Card Back" }],
    }),
    lvl(6, "Chip Drop", { chips: 300 }),
    lvl(7, "Seat Ring", {
      unlocks: [{ kind: "seat_ring", id: "seat_ring_classic", label: "Classic Seat Ring" }],
    }),
    lvl(8, "Mission Reroll", { missionRerollTokens: 1 }),
    lvl(9, "Chip Drop", { chips: 350 }),
    lvl(10, "Table Badge", {
      unlocks: [{ kind: "table_badge", id: "badge_kouppi_exclusive", label: "Exclusive KOUPPI Table Badge" }],
    }),
    lvl(11, "Mid Stack", { chips: 400 }),
    lvl(12, "Wheel Token", { wheelTokens: 1 }),
    lvl(13, "Midnight Felt", {
      unlocks: [{ kind: "table_theme", id: "midnight-blue", label: "Midnight Felt" }],
    }),
    lvl(14, "Chip Drop", { chips: 450 }),
    lvl(15, "Title", {
      unlocks: [{ kind: "title", id: "title_table_regular", label: "Table Regular" }],
    }),
    lvl(16, "Chip Skin", {
      unlocks: [{ kind: "chip_skin", id: "chipskin_gold_edge", label: "Gold-Edge Chips" }],
    }),
    lvl(17, "Chip Drop", { chips: 500 }),
    lvl(18, "Mission Reroll", { missionRerollTokens: 1 }),
    lvl(19, "Avatar Frame", {
      unlocks: [{ kind: "frame", id: "frame_onyx", label: "Onyx Avatar Frame" }],
    }),
    lvl(20, "Milestone Token", { wheelTokens: 1, chips: 250 }),
    lvl(21, "Chip Drop", { chips: 550 }),
    lvl(22, "Emote", {
      unlocks: [{ kind: "emote", id: "emote_nod", label: "Respectful Nod Emote" }],
    }),
    lvl(23, "Chip Drop", { chips: 600 }),
    lvl(24, "Profile Badge", {
      unlocks: [{ kind: "badge", id: "badge_season1_24", label: "Season 1 Contender" }],
    }),
    lvl(25, "Royal Blue", {
      unlocks: [{ kind: "table_theme", id: "royal-blue", label: "Royal Blue Felt" }],
    }),
    lvl(26, "Chip Drop", { chips: 700 }),
    lvl(27, "Mission Reroll", { missionRerollTokens: 1 }),
    lvl(28, "Woodland Rail", {
      unlocks: [{ kind: "table_theme", id: "woodland", label: "Brass Rail / Woodland" }],
    }),
    lvl(29, "Chip Drop", { chips: 850 }),
    lvl(30, "Season Finale", {
      chips: 1000,
      wheelTokens: 2,
      unlocks: [{ kind: "frame", id: "frame_s1_finale", label: "Season 1 Finale Frame" }],
    }),
  ],
};

/**
 * Wheel odds (weights / 1000 = %). Transparent in config per design.
 * Token-based access only — secondary excitement, not core loop.
 */
export const WHEEL_REWARD_TABLE: WheelRewardDefinition[] = [
  { id: "w_100", label: "100 Chips", weight: 300, reward: { chips: 100 } },
  { id: "w_150", label: "150 Chips", weight: 220, reward: { chips: 150 } },
  { id: "w_200", label: "200 Chips", weight: 160, reward: { chips: 200 } },
  { id: "w_250", label: "250 Chips", weight: 100, reward: { chips: 250 } },
  { id: "w_350", label: "350 Chips", weight: 80, reward: { chips: 350 } },
  { id: "w_500", label: "500 Chips", weight: 50, reward: { chips: 500 } },
  { id: "w_700", label: "700 Chips", weight: 30, reward: { chips: 700 } },
  { id: "w_1000", label: "1,000 Chips", weight: 15, reward: { chips: 1000 } },
  {
    id: "w_fragment",
    label: "Cosmetic Fragment",
    weight: 30,
    reward: {
      unlocks: [{ kind: "cosmetic_fragment", id: "fragment_generic", label: "Cosmetic Fragment" }],
    },
  },
  { id: "w_jackpot", label: "Jackpot 2,000 Chips", weight: 15, reward: { chips: 2000 } },
];

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first_kouppi_win",
    name: "First KOUPPI Win",
    description: "Win your first match",
    metric: "matches_won",
    target: 1,
    reward: {
      chips: 100,
      unlocks: [{ kind: "title", id: "title_first_win", label: "First Win" }],
    },
  },
  {
    id: "wins_10",
    name: "10 Match Wins",
    description: "Win 10 matches",
    metric: "matches_won",
    target: 10,
    reward: {
      unlocks: [{ kind: "badge", id: "badge_10_wins", label: "10 Wins Badge" }],
    },
  },
  {
    id: "first_shistri_win",
    name: "First SHISTRI Win",
    description: "Win a SHISTRI declaration",
    metric: "shistri_won",
    target: 1,
    reward: {
      chips: 150,
      unlocks: [{ kind: "title", id: "title_shistri", label: "SHISTRI" }],
    },
  },
  {
    id: "streak_7",
    name: "7-Day Login Streak",
    description: "Reach a 7-day daily claim streak",
    metric: "max_daily_streak",
    target: 7,
    reward: {
      wheelTokens: 1,
      unlocks: [{ kind: "badge", id: "badge_7day", label: "7-Day Streak Badge" }],
    },
  },
  {
    id: "career_50",
    name: "50 Career Matches",
    description: "Complete 50 Career matches",
    metric: "career_matches",
    target: 50,
    reward: {
      unlocks: [{ kind: "frame", id: "frame_career_50", label: "Premium Career Frame" }],
    },
  },
  {
    id: "missions_25",
    name: "Mission Runner",
    description: "Claim 25 mission rewards",
    metric: "missions_claimed",
    target: 25,
    reward: { chips: 400 },
  },
  {
    id: "spins_10",
    name: "Wheel Curious",
    description: "Spin the reward wheel 10 times",
    metric: "wheel_spins",
    target: 10,
    reward: { chips: 250 },
  },
  {
    id: "track_level_10",
    name: "Track Climber",
    description: "Reach season track level 10",
    metric: "track_level",
    target: 10,
    reward: { chips: 500 },
  },
];

export function getMissionDefinition(id: string): MissionDefinition | undefined {
  return [...DAILY_MISSION_POOL, ...WEEKLY_MISSION_POOL].find((m) => m.id === id);
}

export function getStreakReward(dayIndex: number): DailyStreakDayReward {
  const idx = ((dayIndex - 1) % 7) + 1;
  return DAILY_STREAK_REWARDS.find((d) => d.dayIndex === idx) ?? DAILY_STREAK_REWARDS[0];
}

export function formatGrantLabel(grant: RewardCurrencyGrant): string {
  const parts: string[] = [];
  if (grant.chips) parts.push(`${grant.chips.toLocaleString()} chips`);
  if (grant.seasonXp) parts.push(`${grant.seasonXp} XP`);
  if (grant.wheelTokens) parts.push(`${grant.wheelTokens} wheel token${grant.wheelTokens === 1 ? "" : "s"}`);
  if (grant.missionRerollTokens) {
    parts.push(`${grant.missionRerollTokens} reroll token${grant.missionRerollTokens === 1 ? "" : "s"}`);
  }
  for (const u of grant.unlocks ?? []) parts.push(u.label);
  return parts.join(" · ") || "—";
}
