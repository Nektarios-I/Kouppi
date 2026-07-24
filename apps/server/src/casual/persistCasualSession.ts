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

  // Reward progress for authenticated multiplayer participants (session = 1 match)
  void import("@kouppi/database")
    .then(({ onMatchFinished, getUserById }) => {
      for (const p of players) {
        if (!getUserById(p.playerId)) continue;
        const bankrolls = players.map((x) => x.finalBankroll);
        const best = Math.max(...bankrolls);
        const won =
          p.finalBankroll === best && players.filter((x) => x.finalBankroll === best).length === 1;
        onMatchFinished({
          eventId: `casual:${room.id}:${p.playerId}`,
          userId: p.playerId,
          mode: "multiplayer",
          placement: won ? 1 : 2,
          chipsWon: 0,
          potWon: won ? Math.max(0, stats.biggestPot) : 0,
          won,
        });
      }
    })
    .catch(() => {
      // ignore reward failures
    });
}
