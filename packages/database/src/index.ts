/**
 * @kouppi/database - Career Mode Database Package
 * 
 * Provides SQLite-based persistence for:
 * - User accounts and authentication
 * - Match history
 * - Rating and trophy calculations
 */

// Database client
export { getDatabase, closeDatabase, getRawDb } from "./client.js";

// Schema and arenas
export { ARENAS, getArenaForTrophies, getTrophyFloor, type Arena } from "./schema.js";

// Users
export {
  createUser,
  validateCredentials,
  getUserById,
  getUserByUsername,
  getProfileById,
  getProfileByUsername,
  updateBankroll,
  creditBankroll,
  updateRatingAndTrophies,
  updateMatchStats,
  updateAvatar,
  getLeaderboard,
  getUserRank,
  deleteUser,
  type User,
  type UserProfile,
} from "./users.js";

// Reward system
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
  RewardActionError,
  REWARD_FEATURE_FLAGS,
  ACTIVE_SEASON,
  FIRST_WIN_REWARD_CHIPS,
  FIRST_WIN_BONUS_XP,
  DAILY_STREAK_REWARDS,
  getEquippedCosmetics,
  ensureEquippedRow,
  getPublicPlayerCosmetics,
  type RewardPublicState,
  type CareerMatchRewardEvent,
  type MatchRewardEvent,
  type GameplayRewardEvent,
  type MissionSlotView,
  type AchievementView,
  type TrackLevelView,
  type EquippedCosmetics,
  type CosmeticSlot,
  type PublicPlayerCosmetics,
} from "./rewards/public.js";

// Sessions
export {
  createSession,
  getSession,
  validateSession,
  deleteSession,
  deleteUserSessions,
  cleanupExpiredSessions,
  extendSession,
  type Session,
} from "./sessions.js";

// Matches
export {
  createMatch,
  completeMatch,
  getMatchById,
  getPlayerMatches,
  getRecentMatches,
  deleteMatch,
  getHeadToHead,
  type MatchRecord,
  type MatchWithPlayers,
} from "./matches.js";

// Friends multiplayer session history
export {
  recordCasualFriendsSession,
  getCasualStatsForUser,
  type CasualSessionInput,
  type CasualUserStats,
  type CasualSessionSummary,
} from "./casualSessions.js";

// Friend graph
export {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  listFriends,
  listPendingRequests,
  searchUsersByUsername,
  getFriendRequestById,
  isFriend,
  getFriendProfile,
  type FriendRequest,
  type FriendRequestStatus,
  type FriendProfile,
  type FriendRequestWithProfiles,
} from "./friends.js";

// Rating calculations
export {
  calculateExpectedScore,
  getKFactor,
  calculateRatingChange,
  calculateTrophyChange,
  calculateMatchResults,
  getMatchmakingRange,
  isMatchmakingCompatible,
  calculateNewRating,
  calculateMultiplayerTrophyChange,
  type MatchResult,
} from "./rating.js";
