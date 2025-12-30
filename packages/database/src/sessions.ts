/**
 * Sessions Module - Login session management
 */

import { v4 as uuidv4 } from "uuid";
import { getRawDb } from "./client.js";

// Session lifetime: 7 days
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Session type
 */
export interface Session {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Create a new session for a user
 */
export function createSession(userId: string): Session {
  const db = getRawDb();
  
  const token = uuidv4();
  const now = Date.now();
  const expiresAt = now + SESSION_LIFETIME_MS;
  
  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, now, expiresAt);
  
  return { token, userId, createdAt: now, expiresAt };
}

/**
 * Get session by token (returns null if expired)
 */
export function getSession(token: string): Session | null {
  const db = getRawDb();
  
  const row = db.prepare(`
    SELECT * FROM sessions 
    WHERE token = ? AND expires_at > ?
  `).get(token, Date.now()) as any;
  
  if (!row) return null;
  
  return {
    token: row.token,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Validate a session token
 * Returns the user ID if valid, null otherwise
 */
export function validateSession(token: string): string | null {
  const session = getSession(token);
  return session?.userId ?? null;
}

/**
 * Delete a session (logout)
 */
export function deleteSession(token: string): boolean {
  const db = getRawDb();
  const result = db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  return result.changes > 0;
}

/**
 * Delete all sessions for a user (logout everywhere)
 */
export function deleteUserSessions(userId: string): number {
  const db = getRawDb();
  const result = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return result.changes;
}

/**
 * Cleanup expired sessions
 */
export function cleanupExpiredSessions(): number {
  const db = getRawDb();
  const result = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  return result.changes;
}

/**
 * Extend session expiration
 */
export function extendSession(token: string): boolean {
  const db = getRawDb();
  const newExpiresAt = Date.now() + SESSION_LIFETIME_MS;
  const result = db.prepare(`
    UPDATE sessions SET expires_at = ? WHERE token = ?
  `).run(newExpiresAt, token);
  return result.changes > 0;
}
