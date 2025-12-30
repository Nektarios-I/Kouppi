/**
 * Database Client - SQLite connection and initialization
 */

import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

/**
 * Initialize and return the database connection
 */
export function getDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  // Default to data/kouppi.db in the server directory
  const finalPath = dbPath ?? getDefaultDbPath();
  
  // Ensure directory exists
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(finalPath);
  
  // Enable WAL mode for better concurrent performance
  db.pragma("journal_mode = WAL");
  
  // Initialize schema
  db.exec(SCHEMA_SQL);
  
  console.log(`[Database] Connected to ${finalPath}`);
  
  return db;
}

/**
 * Get default database path
 */
function getDefaultDbPath(): string {
  // Use environment variable if set
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  
  // Default to data/kouppi.db relative to working directory
  return path.join(process.cwd(), "data", "kouppi.db");
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log("[Database] Connection closed");
  }
}

/**
 * Get raw database instance (for advanced queries)
 */
export function getRawDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call getDatabase() first.");
  }
  return db;
}
