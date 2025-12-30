/**
 * Users Module - CRUD operations for user accounts
 */

import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { getRawDb } from "./client.js";
import { getArenaForTrophies, getTrophyFloor, ARENAS } from "./schema.js";

const SALT_ROUNDS = 10;
const DEFAULT_BANKROLL = 1000;
const DEFAULT_RATING = 1200;

/**
 * User type as stored in database
 */
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  lastLoginAt: number | null;
  
  // Game data
  bankroll: number;
  rating: number;
  trophies: number;
  highestTrophies: number;
  arena: number;
  
  // Statistics
  gamesPlayed: number;
  gamesWon: number;
  totalEarnings: number;
  
  // Avatar
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
}

/**
 * Public user profile (no password hash)
 */
export interface UserProfile {
  id: string;
  username: string;
  createdAt: number;
  lastLoginAt: number | null;
  bankroll: number;
  rating: number;
  trophies: number;
  highestTrophies: number;
  arena: number;
  arenaName: string;
  gamesPlayed: number;
  gamesWon: number;
  totalEarnings: number;
  winRate: number;
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
}

/**
 * Convert database row to User object
 */
function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    bankroll: row.bankroll,
    rating: row.rating,
    trophies: row.trophies,
    highestTrophies: row.highest_trophies,
    arena: row.arena,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    totalEarnings: row.total_earnings,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    avatarBorder: row.avatar_border,
  };
}

/**
 * Convert User to public profile
 */
function userToProfile(user: User): UserProfile {
  const arena = ARENAS.find(a => a.level === user.arena) ?? ARENAS[0];
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    bankroll: user.bankroll,
    rating: user.rating,
    trophies: user.trophies,
    highestTrophies: user.highestTrophies,
    arena: user.arena,
    arenaName: arena.name,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    totalEarnings: user.totalEarnings,
    winRate: user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0,
    avatarEmoji: user.avatarEmoji,
    avatarColor: user.avatarColor,
    avatarBorder: user.avatarBorder,
  };
}

/**
 * Create a new user account
 */
export async function createUser(
  username: string,
  password: string,
  avatar?: { emoji?: string; color?: string; border?: string }
): Promise<UserProfile> {
  const db = getRawDb();
  
  // Validate username
  if (username.length < 3 || username.length > 20) {
    throw new Error("Username must be 3-20 characters");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("Username can only contain letters, numbers, and underscores");
  }
  
  // Validate password
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  
  // Check if username exists
  const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
  if (existing) {
    throw new Error("Username already taken");
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  // Create user
  const id = uuidv4();
  const now = Date.now();
  
  const stmt = db.prepare(`
    INSERT INTO users (
      id, username, password_hash, created_at, last_login_at,
      bankroll, rating, trophies, highest_trophies, arena,
      games_played, games_won, total_earnings,
      avatar_emoji, avatar_color, avatar_border
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    username,
    passwordHash,
    now,
    now,
    DEFAULT_BANKROLL,
    DEFAULT_RATING,
    0,
    0,
    1,
    0,
    0,
    0,
    avatar?.emoji ?? "🎭",
    avatar?.color ?? "#6366f1",
    avatar?.border ?? "#4f46e5"
  );
  
  const user = getUserById(id);
  if (!user) {
    throw new Error("Failed to create user");
  }
  
  return userToProfile(user);
}

/**
 * Validate credentials and return user if valid
 */
export async function validateCredentials(
  username: string,
  password: string
): Promise<User | null> {
  const db = getRawDb();
  
  const row = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
  if (!row) {
    return null;
  }
  
  const user = rowToUser(row);
  const valid = await bcrypt.compare(password, user.passwordHash);
  
  if (!valid) {
    return null;
  }
  
  // Update last login time
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(Date.now(), user.id);
  
  return user;
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? rowToUser(row) : null;
}

/**
 * Get user by username
 */
export function getUserByUsername(username: string): User | null {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
  return row ? rowToUser(row) : null;
}

/**
 * Get public profile by ID
 */
export function getProfileById(id: string): UserProfile | null {
  const user = getUserById(id);
  return user ? userToProfile(user) : null;
}

/**
 * Get public profile by username
 */
export function getProfileByUsername(username: string): UserProfile | null {
  const user = getUserByUsername(username);
  return user ? userToProfile(user) : null;
}

/**
 * Update user's bankroll
 */
export function updateBankroll(userId: string, newBankroll: number): void {
  const db = getRawDb();
  db.prepare("UPDATE users SET bankroll = ? WHERE id = ?").run(Math.max(0, newBankroll), userId);
}

/**
 * Update user's rating and trophies after a match
 */
export function updateRatingAndTrophies(
  userId: string,
  ratingChange: number,
  trophyChange: number
): { newRating: number; newTrophies: number; newArena: number; arenaPromotion: boolean } {
  const db = getRawDb();
  
  const user = getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  // Calculate new rating (floor at 800)
  const newRating = Math.max(800, user.rating + ratingChange);
  
  // Calculate new trophies with floor based on current arena
  const trophyFloor = getTrophyFloor(user.arena);
  let newTrophies = Math.max(trophyFloor, user.trophies + trophyChange);
  
  // Check for arena change
  const newArenaData = getArenaForTrophies(newTrophies);
  const arenaPromotion = newArenaData.level > user.arena;
  
  // Update highest trophies if needed
  const highestTrophies = Math.max(user.highestTrophies, newTrophies);
  
  db.prepare(`
    UPDATE users 
    SET rating = ?, trophies = ?, highest_trophies = ?, arena = ?
    WHERE id = ?
  `).run(newRating, newTrophies, highestTrophies, newArenaData.level, userId);
  
  return {
    newRating,
    newTrophies,
    newArena: newArenaData.level,
    arenaPromotion,
  };
}

/**
 * Update user stats after a match
 */
export function updateMatchStats(userId: string, won: boolean, earnings: number): void {
  const db = getRawDb();
  
  if (won) {
    db.prepare(`
      UPDATE users 
      SET games_played = games_played + 1,
          games_won = games_won + 1,
          total_earnings = total_earnings + ?
      WHERE id = ?
    `).run(earnings, userId);
  } else {
    db.prepare(`
      UPDATE users 
      SET games_played = games_played + 1,
          total_earnings = total_earnings + ?
      WHERE id = ?
    `).run(earnings, userId);
  }
}

/**
 * Update user avatar
 */
export function updateAvatar(
  userId: string,
  avatar: { emoji?: string; color?: string; border?: string }
): void {
  const db = getRawDb();
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (avatar.emoji) {
    updates.push("avatar_emoji = ?");
    values.push(avatar.emoji);
  }
  if (avatar.color) {
    updates.push("avatar_color = ?");
    values.push(avatar.color);
  }
  if (avatar.border) {
    updates.push("avatar_border = ?");
    values.push(avatar.border);
  }
  
  if (updates.length === 0) return;
  
  values.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
}

/**
 * Get leaderboard by trophies
 */
export function getLeaderboard(limit: number = 100, offset: number = 0): UserProfile[] {
  const db = getRawDb();
  
  const rows = db.prepare(`
    SELECT * FROM users 
    ORDER BY trophies DESC, rating DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[];
  
  return rows.map(row => userToProfile(rowToUser(row)));
}

/**
 * Get user's rank (position in leaderboard)
 */
export function getUserRank(userId: string): number {
  const db = getRawDb();
  
  const user = getUserById(userId);
  if (!user) return 0;
  
  const result = db.prepare(`
    SELECT COUNT(*) as rank FROM users 
    WHERE trophies > ? OR (trophies = ? AND rating > ?)
  `).get(user.trophies, user.trophies, user.rating) as { rank: number };
  
  return result.rank + 1;
}

/**
 * Delete a user account
 */
export function deleteUser(userId: string): boolean {
  const db = getRawDb();
  const result = db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  return result.changes > 0;
}
