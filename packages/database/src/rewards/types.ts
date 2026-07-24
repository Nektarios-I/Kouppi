/**
 * Reward system domain types — aligned to KOUPPI product design.
 */

export type RewardUnlockKind =
  | "title"
  | "badge"
  | "frame"
  | "card_back"
  | "table_theme"
  | "seat_ring"
  | "chip_skin"
  | "emote"
  | "table_badge"
  | "cosmetic_fragment";

export type RewardUnlockGrant = {
  kind: RewardUnlockKind;
  id: string;
  label: string;
};

/** Three v1 currencies + optional unlock payloads / reroll tokens */
export type RewardCurrencyGrant = {
  chips?: number;
  seasonXp?: number;
  /** Wheel spin tokens */
  wheelTokens?: number;
  /** Extra mission rerolls beyond the free daily one */
  missionRerollTokens?: number;
  unlocks?: RewardUnlockGrant[];
};

export type MissionPeriodType = "daily" | "weekly";

export type MissionMetric =
  | "play_matches"
  | "win_matches"
  | "career_matches"
  | "multiplayer_matches"
  | "place_bets"
  | "declare_shistri"
  | "pot_won"
  | "earn_chips"
  | "claim_daily"
  | "missions_claimed";

export type MissionSlotStatus = "active" | "completed" | "claimed";

export type AchievementMetric =
  | "career_wins"
  | "career_matches"
  | "matches_won"
  | "matches_played"
  | "shistri_declared"
  | "shistri_won"
  | "max_daily_streak"
  | "missions_claimed"
  | "wheel_spins"
  | "track_level"
  | "total_chips_won";

export interface MissionDefinition {
  id: string;
  periodType: MissionPeriodType;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  reward: RewardCurrencyGrant;
  weight: number;
}

export interface SeasonLevelDefinition {
  level: number;
  xpRequired: number;
  reward: RewardCurrencyGrant;
  label: string;
}

export interface SeasonDefinition {
  id: string;
  name: string;
  startsAt: number;
  endsAt: number;
  levels: SeasonLevelDefinition[];
}

export interface WheelRewardDefinition {
  id: string;
  label: string;
  /** Relative weight; design odds use weights that sum to 1000 (= 100.0%) */
  weight: number;
  reward: RewardCurrencyGrant;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  metric: AchievementMetric;
  target: number;
  reward: RewardCurrencyGrant;
}

export interface DailyStreakDayReward {
  dayIndex: number;
  reward: RewardCurrencyGrant;
}

export interface MissionSlotRow {
  id: string;
  userId: string;
  periodType: MissionPeriodType;
  periodKey: string;
  slotIndex: number;
  definitionId: string;
  progress: number;
  target: number;
  status: MissionSlotStatus;
  claimedAt: number | null;
}

export interface RewardUserStateRow {
  userId: string;
  wheelTokens: number;
  missionRerollTokens: number;
  seasonId: string;
  seasonXp: number;
  dailyStreak: number;
  maxDailyStreak: number;
  lastDailyClaimDate: string | null;
  firstWinDate: string | null;
  dailyRerollsUsed: number;
  dailyRerollDate: string | null;
  dailyPeriodKey: string | null;
  weeklyPeriodKey: string | null;
  missionsClaimedTotal: number;
  wheelSpinsTotal: number;
  shistriDeclaredTotal: number;
  shistriWonTotal: number;
  betsPlacedTotal: number;
  updatedAt: number;
}

export type MatchRewardMode = "career" | "multiplayer";

export interface MatchRewardEvent {
  eventId: string;
  userId: string;
  mode: MatchRewardMode;
  placement: number;
  chipsWon: number;
  /** Pot value credited toward pot_won missions when positive */
  potWon?: number;
  won: boolean;
}

/** @deprecated use MatchRewardEvent */
export type CareerMatchRewardEvent = MatchRewardEvent;

export interface GameplayRewardEvent {
  userId: string;
  betsPlaced?: number;
  shistriDeclared?: number;
  shistriWon?: number;
}

export interface NormalizedCurrencyGrant {
  chips: number;
  seasonXp: number;
  wheelTokens: number;
  missionRerollTokens: number;
  unlocks: RewardUnlockGrant[];
}

export interface GrantResult {
  applied: boolean;
  alreadyApplied: boolean;
  grant: NormalizedCurrencyGrant;
  ledgerId: string | null;
}

export interface RewardPublicState {
  serverNow: number;
  dailyPeriodKey: string;
  weeklyPeriodKey: string;
  nextDailyResetAt: number;
  nextWeeklyResetAt: number;
  currencies: {
    bankroll: number;
    wheelTokens: number;
    missionRerollTokens: number;
    seasonXp: number;
  };
  dailyClaim: {
    canClaim: boolean;
    alreadyClaimedToday: boolean;
    streak: number;
    lifetimeBestStreak: number;
    lastClaimDate: string | null;
    nextDayIndex: number;
    nextReward: RewardCurrencyGrant;
    nextResetAt: number;
  };
  firstWin: {
    grantedToday: boolean;
    rewardChips: number;
    rewardXp: number;
  };
  dailyMissions: MissionSlotView[];
  weeklyMissions: MissionSlotView[];
  dailyRerollsRemaining: number;
  season: {
    id: string;
    name: string;
    startsAt: number;
    endsAt: number;
    xp: number;
    currentLevel: number;
    levels: TrackLevelView[];
  };
  wheel: {
    tokens: number;
    table: Array<{ id: string; label: string; weight: number }>;
  };
  unlocks: Array<{ kind: RewardUnlockKind; id: string; label: string; unlockedAt: number }>;
  equipped: {
    titleId: string | null;
    badgeId: string | null;
    frameId: string | null;
    cardBackId: string | null;
    tableThemeId: string | null;
    seatRingId: string | null;
    chipSkinId: string | null;
  };
  cosmeticsCatalog: Array<{
    id: string;
    kind: string;
    slot: string;
    label: string;
    owned: boolean;
    isDefault?: boolean;
    tableThemeId?: string;
    emoteGlyph?: string;
  }>;
  achievements: AchievementView[];
}

export interface MissionSlotView {
  id: string;
  periodType: MissionPeriodType;
  slotIndex: number;
  definitionId: string;
  title: string;
  description: string;
  metric: MissionMetric;
  progress: number;
  target: number;
  status: MissionSlotStatus;
  reward: RewardCurrencyGrant;
  canClaim: boolean;
  canReroll: boolean;
}

export interface TrackLevelView {
  level: number;
  label: string;
  xpRequired: number;
  reward: RewardCurrencyGrant;
  state: "locked" | "claimable" | "claimed";
}

export interface AchievementView {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  reward: RewardCurrencyGrant;
}
