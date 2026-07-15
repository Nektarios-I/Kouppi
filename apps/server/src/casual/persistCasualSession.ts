import type { Room } from "../types.js";
import { buildSessionSummary } from "../rooms.js";
import { recordCasualFriendsSession } from "@kouppi/database";

/** Persist friends multiplayer session stats for logged-in players when a room closes. */
export function persistCasualFriendsSessionFromRoom(room: Room): void {
  if (!room.started) return;
  const stats = room.sessionStats;
  if (!stats || stats.handsPlayed < 1) return;

  const summary = buildSessionSummary(room);
  const mvpId = summary.mvp?.id;

  const players =
    room.state?.players?.map((p) => ({
      playerId: p.id,
      displayName: p.name,
      finalBankroll: p.bankroll ?? 0,
      isMvp: p.id === mvpId,
    })) ??
    room.players.map((p) => ({
      playerId: p.id,
      displayName: p.name,
      finalBankroll: 0,
      isMvp: p.id === mvpId,
    }));

  recordCasualFriendsSession({
    roomCode: room.code,
    startedAt: room.createdAt ?? Date.now(),
    endedAt: Date.now(),
    handsPlayed: stats.handsPlayed,
    biggestPot: stats.biggestPot,
    players,
  });
}
