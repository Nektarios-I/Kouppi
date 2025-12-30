/**
 * Matches Module - Career match history operations
 */

import { v4 as uuidv4 } from "uuid";
import { getRawDb } from "./client.js";

/**
 * Match record type
 */
export interface MatchRecord {
  id: string;
  createdAt: number;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  player1RatingBefore: number;
  player2RatingBefore: number;
  player1RatingChange: number;
  player2RatingChange: number;
  player1TrophyChange: number;
  player2TrophyChange: number;
  roundsPlayed: number;
  durationSeconds: number;
  player1FinalBankroll: number;
  player2FinalBankroll: number;
}

/**
 * Match with player info (for display)
 */
export interface MatchWithPlayers extends MatchRecord {
  player1Username: string;
  player2Username: string;
  winnerUsername: string | null;
}

/**
 * Convert database row to MatchRecord
 */
function rowToMatch(row: any): MatchRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    winnerId: row.winner_id,
    player1RatingBefore: row.player1_rating_before,
    player2RatingBefore: row.player2_rating_before,
    player1RatingChange: row.player1_rating_change,
    player2RatingChange: row.player2_rating_change,
    player1TrophyChange: row.player1_trophy_change,
    player2TrophyChange: row.player2_trophy_change,
    roundsPlayed: row.rounds_played,
    durationSeconds: row.duration_seconds,
    player1FinalBankroll: row.player1_final_bankroll,
    player2FinalBankroll: row.player2_final_bankroll,
  };
}

/**
 * Create a new match record
 */
export function createMatch(data: {
  player1Id: string;
  player2Id: string;
  player1RatingBefore: number;
  player2RatingBefore: number;
}): string {
  const db = getRawDb();
  
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO matches (
      id, player1_id, player2_id, 
      player1_rating_before, player2_rating_before
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    data.player1Id,
    data.player2Id,
    data.player1RatingBefore,
    data.player2RatingBefore
  );
  
  return id;
}

/**
 * Complete a match with results
 */
export function completeMatch(
  matchId: string,
  data: {
    winnerId: string | null;
    player1RatingChange: number;
    player2RatingChange: number;
    player1TrophyChange: number;
    player2TrophyChange: number;
    roundsPlayed: number;
    durationSeconds: number;
    player1FinalBankroll: number;
    player2FinalBankroll: number;
  }
): void {
  const db = getRawDb();
  
  db.prepare(`
    UPDATE matches SET
      winner_id = ?,
      player1_rating_change = ?,
      player2_rating_change = ?,
      player1_trophy_change = ?,
      player2_trophy_change = ?,
      rounds_played = ?,
      duration_seconds = ?,
      player1_final_bankroll = ?,
      player2_final_bankroll = ?
    WHERE id = ?
  `).run(
    data.winnerId,
    data.player1RatingChange,
    data.player2RatingChange,
    data.player1TrophyChange,
    data.player2TrophyChange,
    data.roundsPlayed,
    data.durationSeconds,
    data.player1FinalBankroll,
    data.player2FinalBankroll,
    matchId
  );
}

/**
 * Get match by ID
 */
export function getMatchById(matchId: string): MatchRecord | null {
  const db = getRawDb();
  const row = db.prepare("SELECT * FROM matches WHERE id = ?").get(matchId);
  return row ? rowToMatch(row) : null;
}

/**
 * Get match history for a player
 */
export function getPlayerMatches(
  playerId: string,
  limit: number = 20,
  offset: number = 0
): MatchWithPlayers[] {
  const db = getRawDb();
  
  const rows = db.prepare(`
    SELECT 
      m.*,
      u1.username as player1_username,
      u2.username as player2_username,
      uw.username as winner_username
    FROM matches m
    LEFT JOIN users u1 ON m.player1_id = u1.id
    LEFT JOIN users u2 ON m.player2_id = u2.id
    LEFT JOIN users uw ON m.winner_id = uw.id
    WHERE m.player1_id = ? OR m.player2_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(playerId, playerId, limit, offset) as any[];
  
  return rows.map(row => ({
    ...rowToMatch(row),
    player1Username: row.player1_username,
    player2Username: row.player2_username,
    winnerUsername: row.winner_username,
  }));
}

/**
 * Get recent matches (for global feed)
 */
export function getRecentMatches(limit: number = 20): MatchWithPlayers[] {
  const db = getRawDb();
  
  const rows = db.prepare(`
    SELECT 
      m.*,
      u1.username as player1_username,
      u2.username as player2_username,
      uw.username as winner_username
    FROM matches m
    LEFT JOIN users u1 ON m.player1_id = u1.id
    LEFT JOIN users u2 ON m.player2_id = u2.id
    LEFT JOIN users uw ON m.winner_id = uw.id
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(limit) as any[];
  
  return rows.map(row => ({
    ...rowToMatch(row),
    player1Username: row.player1_username,
    player2Username: row.player2_username,
    winnerUsername: row.winner_username,
  }));
}

/**
 * Delete a match record
 */
export function deleteMatch(matchId: string): boolean {
  const db = getRawDb();
  const result = db.prepare("DELETE FROM matches WHERE id = ?").run(matchId);
  return result.changes > 0;
}

/**
 * Get head-to-head stats between two players
 */
export function getHeadToHead(player1Id: string, player2Id: string): {
  player1Wins: number;
  player2Wins: number;
  draws: number;
  totalGames: number;
} {
  const db = getRawDb();
  
  const result = db.prepare(`
    SELECT 
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as p1_wins,
      SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as p2_wins,
      SUM(CASE WHEN winner_id IS NULL THEN 1 ELSE 0 END) as draws,
      COUNT(*) as total
    FROM matches
    WHERE (player1_id = ? AND player2_id = ?) 
       OR (player1_id = ? AND player2_id = ?)
  `).get(player1Id, player2Id, player1Id, player2Id, player2Id, player1Id) as any;
  
  return {
    player1Wins: result.p1_wins || 0,
    player2Wins: result.p2_wins || 0,
    draws: result.draws || 0,
    totalGames: result.total || 0,
  };
}
