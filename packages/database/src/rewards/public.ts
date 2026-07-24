/**
 * Public reward API surface for @kouppi/database consumers.
 */

export {
  getRewardPublicState,
  claimDaily,
  claimMission,
  rerollMission,
  claimTrack,
  spinRewardWheel,
  onCareerMatchFinished,
  onMatchFinished,
  onGameplayRewardEvent,
  equipRewardCosmetic,
  previewDailyClaim,
} from "./index.js";

export { RewardActionError } from "./errors.js";
export {
  REWARD_FEATURE_FLAGS,
  ACTIVE_SEASON,
  FIRST_WIN_REWARD_CHIPS,
  FIRST_WIN_BONUS_XP,
  DAILY_STREAK_REWARDS,
  formatGrantLabel,
} from "./config.js";
export {
  getEquippedCosmetics,
  ensureEquippedRow,
  getPublicPlayerCosmetics,
  type PublicPlayerCosmetics,
} from "./equipped.js";
export {
  ALL_COSMETICS,
  getCosmeticById,
  type EquippedCosmetics,
  type CosmeticSlot,
} from "./cosmeticsCatalog.js";

export type {
  RewardPublicState,
  CareerMatchRewardEvent,
  MatchRewardEvent,
  GameplayRewardEvent,
  MissionSlotView,
  AchievementView,
  TrackLevelView,
  RewardCurrencyGrant,
} from "./types.js";
