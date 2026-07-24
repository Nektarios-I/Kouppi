/**
 * Reward schema DDL — applied via migrations.
 */

export const REWARD_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS reward_user_state (
  user_id TEXT PRIMARY KEY,
  wheel_tokens INTEGER NOT NULL DEFAULT 0,
  mission_reroll_tokens INTEGER NOT NULL DEFAULT 0,
  season_id TEXT NOT NULL,
  season_xp INTEGER NOT NULL DEFAULT 0,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  max_daily_streak INTEGER NOT NULL DEFAULT 0,
  last_daily_claim_date TEXT,
  first_win_date TEXT,
  daily_rerolls_used INTEGER NOT NULL DEFAULT 0,
  daily_reroll_date TEXT,
  daily_period_key TEXT,
  weekly_period_key TEXT,
  missions_claimed_total INTEGER NOT NULL DEFAULT 0,
  wheel_spins_total INTEGER NOT NULL DEFAULT 0,
  shistri_declared_total INTEGER NOT NULL DEFAULT 0,
  shistri_won_total INTEGER NOT NULL DEFAULT 0,
  bets_placed_total INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_mission_slots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  definition_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  claimed_at INTEGER,
  UNIQUE (user_id, period_type, period_key, slot_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reward_mission_user
  ON reward_mission_slots(user_id, period_type, period_key);

CREATE TABLE IF NOT EXISTS reward_track_claims (
  user_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, season_id, level),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  claimed_at INTEGER,
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  amount_chips INTEGER NOT NULL DEFAULT 0,
  amount_xp INTEGER NOT NULL DEFAULT 0,
  amount_tokens INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reward_ledger_user ON reward_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reward_wheel_spins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reward_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_unlocks (
  user_id TEXT NOT NULL,
  unlock_kind TEXT NOT NULL,
  unlock_id TEXT NOT NULL,
  label TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, unlock_kind, unlock_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_equipped (
  user_id TEXT PRIMARY KEY,
  title_id TEXT,
  badge_id TEXT,
  frame_id TEXT,
  card_back_id TEXT,
  table_theme_id TEXT,
  seat_ring_id TEXT,
  chip_skin_id TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;
