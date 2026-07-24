import type Database from "better-sqlite3";
import { CASUAL_SCHEMA_SQL, FRIENDS_SCHEMA_SQL } from "./schema.js";
import { REWARD_SCHEMA_SQL } from "./rewards/schema.js";

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

/** Apply idempotent schema migrations for existing databases. */
export function runMigrations(db: Database.Database): void {
  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const colNames = new Set(userCols.map((c) => c.name));

  if (!colNames.has("casual_games_played")) {
    db.exec("ALTER TABLE users ADD COLUMN casual_games_played INTEGER NOT NULL DEFAULT 0");
  }
  if (!colNames.has("casual_mvp_count")) {
    db.exec("ALTER TABLE users ADD COLUMN casual_mvp_count INTEGER NOT NULL DEFAULT 0");
  }

  db.exec(CASUAL_SCHEMA_SQL);
  db.exec(FRIENDS_SCHEMA_SQL);
  db.exec(REWARD_SCHEMA_SQL);

  // Reward columns added after initial reward_user_state create
  ensureColumn(db, "reward_user_state", "mission_reroll_tokens", "mission_reroll_tokens INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "reward_user_state", "shistri_declared_total", "shistri_declared_total INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "reward_user_state", "shistri_won_total", "shistri_won_total INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "reward_user_state", "bets_placed_total", "bets_placed_total INTEGER NOT NULL DEFAULT 0");
}
