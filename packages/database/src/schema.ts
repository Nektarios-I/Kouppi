/**
 * Database Schema - SQL statements for creating tables
 * 
 * This module contains all the SQL DDL statements for the Career Mode database.
 */

export const SCHEMA_SQL = `
-- Users table: stores player accounts and persistent game data
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  last_login_at INTEGER,
  
  -- Persistent game data
  bankroll INTEGER NOT NULL DEFAULT 1000,
  rating INTEGER NOT NULL DEFAULT 1200,
  trophies INTEGER NOT NULL DEFAULT 0,
  highest_trophies INTEGER NOT NULL DEFAULT 0,
  arena INTEGER NOT NULL DEFAULT 1,
  
  -- Statistics
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  total_earnings INTEGER NOT NULL DEFAULT 0,
  
  -- Customization (JSON stored as TEXT)
  avatar_emoji TEXT NOT NULL DEFAULT 'portrait-01',
  avatar_color TEXT NOT NULL DEFAULT '#0c101c',
  avatar_border TEXT NOT NULL DEFAULT '#d4af37'
);

-- Matches table: stores career match history
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  
  -- Players
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  winner_id TEXT,
  
  -- Rating/Trophy changes
  player1_rating_before INTEGER NOT NULL,
  player2_rating_before INTEGER NOT NULL,
  player1_rating_change INTEGER NOT NULL DEFAULT 0,
  player2_rating_change INTEGER NOT NULL DEFAULT 0,
  player1_trophy_change INTEGER NOT NULL DEFAULT 0,
  player2_trophy_change INTEGER NOT NULL DEFAULT 0,
  
  -- Match details
  rounds_played INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  player1_final_bankroll INTEGER NOT NULL DEFAULT 0,
  player2_final_bankroll INTEGER NOT NULL DEFAULT 0,
  
  FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Sessions table: stores active login sessions (for token validation)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  expires_at INTEGER NOT NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_trophies ON users(trophies DESC);
CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
CREATE INDEX IF NOT EXISTS idx_matches_player1 ON matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2 ON matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`;

export const CASUAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS casual_sessions (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  hands_played INTEGER NOT NULL DEFAULT 0,
  biggest_pot INTEGER NOT NULL DEFAULT 0,
  player_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS casual_session_players (
  session_id TEXT NOT NULL,
  user_id TEXT,
  display_name TEXT NOT NULL,
  final_bankroll INTEGER NOT NULL DEFAULT 0,
  is_mvp INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES casual_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_casual_sessions_ended ON casual_sessions(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_casual_session_players_user ON casual_session_players(user_id);
`;

export const FRIENDS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS friendships (
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (user_id != friend_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  responded_at INTEGER,
  UNIQUE (from_user_id, to_user_id),
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
`;

/**
 * Arena definitions for trophy gates
 */
export const ARENAS = [
  { level: 1, name: "Bronze", minTrophies: 0, reward: 0 },
  { level: 2, name: "Silver", minTrophies: 300, reward: 100 },
  { level: 3, name: "Gold", minTrophies: 600, reward: 200 },
  { level: 4, name: "Platinum", minTrophies: 1000, reward: 500 },
  { level: 5, name: "Diamond", minTrophies: 1500, reward: 1000 },
  { level: 6, name: "Champion", minTrophies: 2000, reward: 2000 },
  { level: 7, name: "Grand Champion", minTrophies: 2500, reward: 3000 },
  { level: 8, name: "Legend", minTrophies: 3000, reward: 5000 },
] as const;

export type Arena = typeof ARENAS[number];

/**
 * Get arena for a trophy count
 */
export function getArenaForTrophies(trophies: number): Arena {
  for (let i = ARENAS.length - 1; i >= 0; i--) {
    if (trophies >= ARENAS[i].minTrophies) {
      return ARENAS[i];
    }
  }
  return ARENAS[0];
}

/**
 * Get trophy floor (gate) for current arena
 * Players cannot drop below this threshold
 */
export function getTrophyFloor(currentArena: number): number {
  const arena = ARENAS.find(a => a.level === currentArena);
  return arena?.minTrophies ?? 0;
}
