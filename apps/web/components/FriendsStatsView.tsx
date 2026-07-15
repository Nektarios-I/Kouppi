"use client";

import React from "react";

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

export type FriendsStatsData = {
  gamesPlayed: number;
  mvpCount: number;
  recentSessions: CasualSessionSummary[];
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationMs(startedAt: number, endedAt: number): string {
  const mins = Math.max(1, Math.round((endedAt - startedAt) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function FriendsStatsSummary({ stats }: { stats: FriendsStatsData }) {
  const mvpRate =
    stats.gamesPlayed > 0 ? Math.round((stats.mvpCount / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg bg-black/30 border border-white/10 p-4 text-center">
        <p className="text-2xl font-display text-gold-light">{stats.gamesPlayed}</p>
        <p className="text-xs text-gray-500 font-ui mt-1">Games played</p>
      </div>
      <div className="rounded-lg bg-black/30 border border-white/10 p-4 text-center">
        <p className="text-2xl font-display text-gold-light">{stats.mvpCount}</p>
        <p className="text-xs text-gray-500 font-ui mt-1">MVP tables</p>
      </div>
      <div className="rounded-lg bg-black/30 border border-white/10 p-4 text-center">
        <p className="text-2xl font-display text-gold-light">{mvpRate}%</p>
        <p className="text-xs text-gray-500 font-ui mt-1">MVP rate</p>
      </div>
      <div className="rounded-lg bg-black/30 border border-white/10 p-4 text-center">
        <p className="text-2xl font-display text-gold-light">{stats.recentSessions.length}</p>
        <p className="text-xs text-gray-500 font-ui mt-1">Recent sessions</p>
      </div>
    </div>
  );
}

export function FriendsSessionRow({ session }: { session: CasualSessionSummary }) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-black/30 border border-white/10"
      data-testid={`session-${session.id}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-display text-gold-light tracking-wide">{session.roomCode}</span>
          {session.wasMvp && (
            <span className="text-xs font-ui px-2 py-0.5 rounded-full bg-gold/20 text-gold-light border border-gold/30">
              MVP
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 font-ui mt-1">{formatDate(session.endedAt)}</p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-ui text-gray-400">
        <span>
          <strong className="text-gray-300">{session.playerCount}</strong> players
        </span>
        <span>
          <strong className="text-gray-300">{session.handsPlayed}</strong> hands
        </span>
        <span>
          Pot <strong className="text-gray-300">{session.biggestPot}</strong>
        </span>
        <span>
          Stack <strong className="text-gray-300">{session.finalBankroll}</strong>
        </span>
      </div>
    </div>
  );
}

export function FriendsStatsEmpty() {
  return (
    <p className="text-sm text-gray-500 font-ui text-center py-8">
      No friends games recorded yet. Create a room and play with logged-in friends — your stats appear here when the table closes.
    </p>
  );
}

export { formatDate, formatDurationMs };
