import type Database from "better-sqlite3";
import { CASUAL_SCHEMA_SQL } from "./schema.js";

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
}
