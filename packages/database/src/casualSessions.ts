import { v4 as uuidv4 } from "uuid";
import { getRawDb } from "./client.js";
import { getUserById } from "./users.js";

export type CasualSessionPlayerInput = {
  playerId: string;
  displayName: string;
  finalBankroll: number;
  isMvp: boolean;
};

export type CasualSessionInput = {
  roomCode: string;
  startedAt: number;
  endedAt: number;
  handsPlayed: number;
  biggestPot: number;
  players: CasualSessionPlayerInput[];
};

export type CasualSessionSummary = {
  id: string;
  roomCode: string;
  endedAt: number;
  handsPlayed: number;
  biggestPot: number;
  playerCount: number;
  wasMvp: boolean;
  finalBankroll: number;
};

export type CasualUserStats = {
  gamesPlayed: number;
  mvpCount: number;
  recentSessions: CasualSessionSummary[];
};

function isGuestPlayerId(playerId: string): boolean {
  return playerId.startsWith("player_");
}

/** Persist a completed friends multiplayer session for logged-in participants. */
export function recordCasualFriendsSession(input: CasualSessionInput): string | null {
  const linkedPlayers = input.players.filter((p) => !isGuestPlayerId(p.playerId) && getUserById(p.playerId));
  if (linkedPlayers.length === 0) return null;

  const db = getRawDb();
  const sessionId = uuidv4();

  const insertSession = db.prepare(`
    INSERT INTO casual_sessions (id, room_code, started_at, ended_at, hands_played, biggest_pot, player_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPlayer = db.prepare(`
    INSERT INTO casual_session_players (session_id, user_id, display_name, final_bankroll, is_mvp)
    VALUES (?, ?, ?, ?, ?)
  `);

  const bumpStats = db.prepare(`
    UPDATE users
    SET casual_games_played = casual_games_played + 1,
        casual_mvp_count = casual_mvp_count + ?
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    insertSession.run(
      sessionId,
      input.roomCode,
      input.startedAt,
      input.endedAt,
      input.handsPlayed,
      input.biggestPot,
      input.players.length
    );

    for (const player of input.players) {
      if (isGuestPlayerId(player.playerId) || !getUserById(player.playerId)) continue;
      insertPlayer.run(
        sessionId,
        player.playerId,
        player.displayName,
        player.finalBankroll,
        player.isMvp ? 1 : 0
      );
      bumpStats.run(player.isMvp ? 1 : 0, player.playerId);
    }
  });

  tx();
  return sessionId;
}

export function getCasualStatsForUser(userId: string, recentLimit = 10): CasualUserStats {
  const db = getRawDb();

  const rollup = db.prepare(`
    SELECT casual_games_played, casual_mvp_count FROM users WHERE id = ?
  `).get(userId) as { casual_games_played: number; casual_mvp_count: number } | undefined;

  const recent = db.prepare(`
    SELECT
      cs.id,
      cs.room_code,
      cs.ended_at,
      cs.hands_played,
      cs.biggest_pot,
      cs.player_count,
      csp.is_mvp,
      csp.final_bankroll
    FROM casual_session_players csp
    JOIN casual_sessions cs ON cs.id = csp.session_id
    WHERE csp.user_id = ?
    ORDER BY cs.ended_at DESC
    LIMIT ?
  `).all(userId, recentLimit) as Array<{
    id: string;
    room_code: string;
    ended_at: number;
    hands_played: number;
    biggest_pot: number;
    player_count: number;
    is_mvp: number;
    final_bankroll: number;
  }>;

  return {
    gamesPlayed: rollup?.casual_games_played ?? 0,
    mvpCount: rollup?.casual_mvp_count ?? 0,
    recentSessions: recent.map((row) => ({
      id: row.id,
      roomCode: row.room_code,
      endedAt: row.ended_at,
      handsPlayed: row.hands_played,
      biggestPot: row.biggest_pot,
      playerCount: row.player_count,
      wasMvp: row.is_mvp === 1,
      finalBankroll: row.final_bankroll,
    })),
  };
}
