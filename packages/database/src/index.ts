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
  updateRatingAndTrophies,
  updateMatchStats,
  updateAvatar,
  getLeaderboard,
  getUserRank,
  deleteUser,
  type User,
  type UserProfile,
} from "./users.js";

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
