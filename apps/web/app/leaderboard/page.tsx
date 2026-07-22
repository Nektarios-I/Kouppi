"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useCareerStore } from "@/store/careerStore";
import TrophyBadge from "@/components/TrophyBadge";
import { LobbyShell, LobbyCard, LobbyEmpty } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";
import { getServerUrl } from "@/lib/serverUrl";
import { Avatar } from "@/components/AvatarPicker";

const ARENAS = [
  { id: 0, name: "All Arenas", minTrophies: 0, color: "#d4af37" },
  { id: 1, name: "Bronze Arena", minTrophies: 0, color: "#CD7F32" },
  { id: 2, name: "Silver Arena", minTrophies: 400, color: "#C0C0C0" },
  { id: 3, name: "Gold Arena", minTrophies: 800, color: "#FFD700" },
  { id: 4, name: "Platinum Arena", minTrophies: 1200, color: "#E5E4E2" },
  { id: 5, name: "Diamond Arena", minTrophies: 1600, color: "#B9F2FF" },
  { id: 6, name: "Master Arena", minTrophies: 2000, color: "#9B59B6" },
  { id: 7, name: "Champion Arena", minTrophies: 2500, color: "#E74C3C" },
  { id: 8, name: "Legend Arena", minTrophies: 3000, color: "#F1C40F" },
];

type LeaderboardEntry = {
  id: string;
  username: string;
  rating: number;
  trophies: number;
  arena: number;
  arenaName: string;
  gamesWon: number;
  gamesLost: number;
  gamesPlayed: number;
  winRate: number;
  avatarId: string;
};

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArena, setSelectedArena] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const limit = 25;

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArena, page]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const baseUrl = getServerUrl();
      const endpoint =
        selectedArena === 0
          ? `/api/leaderboard?limit=${limit}&offset=${page * limit}`
          : `/api/leaderboard/arena/${selectedArena}?limit=${limit}&offset=${page * limit}`;

      const res = await fetch(`${baseUrl}${endpoint}`);
      const data = await res.json();

      if (data.entries) {
        setLeaderboard(data.entries);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LobbyShell>
      <header className="career-page-header -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-bold text-gold-light tracking-widest no-underline">
            KOUPPI
          </Link>
          <Link href="/career" className="no-underline">
            <HudButton variant="ghost" size="sm">
              ← Career
            </HudButton>
          </Link>
        </div>
      </header>

      <div className="text-center mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-light tracking-wide mb-2">
          Leaderboard
        </h1>
        <p className="text-gray-400 font-ui">Top players ranked by trophies</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {ARENAS.map((arena) => (
          <button
            key={arena.id}
            type="button"
            onClick={() => {
              setSelectedArena(arena.id);
              setPage(0);
            }}
            className={`emote-tab ${selectedArena === arena.id ? "emote-tab-active" : ""}`}
            style={
              selectedArena === arena.id
                ? { borderColor: arena.color + "80", color: arena.color }
                : undefined
            }
          >
            {arena.name}
          </button>
        ))}
      </div>

      <LobbyCard title="Rankings" icon="🏆">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <LobbyEmpty title="No players found in this arena" />
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 pb-2 text-xs text-gray-500 font-ui uppercase tracking-wide border-b border-white/5 mb-2">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-center">Trophies</div>
              <div className="col-span-2 text-center">Rating</div>
              <div className="col-span-2 text-center">Win Rate</div>
            </div>

            <div className="space-y-2">
              {leaderboard.map((player, index) => {
                const rank = page * limit + index + 1;
                const isCurrentUser = user?.id === player.id;

                return (
                  <div
                    key={player.id}
                    className={`lobby-player-row flex-col sm:flex-row sm:items-center !items-stretch gap-3 ${
                      isCurrentUser ? "lobby-player-row-me" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:col-span-5 flex-1 min-w-0">
                      <div
                        className={`w-8 h-8 flex items-center justify-center rounded-full font-display font-bold text-sm shrink-0 ${
                          rank === 1
                            ? "bg-gold text-black"
                            : rank === 2
                              ? "bg-gray-300 text-black"
                              : rank === 3
                                ? "bg-orange-400 text-black"
                                : "bg-black/50 text-gray-300 border border-white/10"
                        }`}
                      >
                        {rank}
                      </div>
                      <Avatar avatar={{ id: player.avatarId }} size="md" />
                      <div className="min-w-0">
                        <div className="font-ui font-medium truncate flex items-center gap-2">
                          {player.username}
                          {isCurrentUser && <span className="hud-badge text-[10px] py-0">You</span>}
                        </div>
                        <div className="text-xs text-gray-500 sm:hidden">
                          {player.trophies} 🏆 · {player.rating} Elo · {player.winRate}%
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:flex sm:col-span-2 justify-center">
                      <TrophyBadge
                        trophies={player.trophies}
                        arena={player.arena}
                        arenaName={player.arenaName}
                        size="sm"
                        showArena={false}
                      />
                    </div>
                    <div className="hidden sm:block sm:col-span-2 text-center font-ui text-purple-300">
                      {player.rating}
                    </div>
                    <div
                      className={`hidden sm:block sm:col-span-2 text-center font-ui ${
                        player.winRate >= 60
                          ? "text-success"
                          : player.winRate >= 40
                            ? "text-gray-300"
                            : "text-error"
                      }`}
                    >
                      {player.winRate}%
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </LobbyCard>

      {!isLoading && leaderboard.length > 0 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <HudButton variant="ghost" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
            ← Previous
          </HudButton>
          <span className="text-gray-400 font-ui text-sm">Page {page + 1}</span>
          <HudButton variant="ghost" onClick={() => setPage(page + 1)} disabled={!hasMore}>
            Next →
          </HudButton>
        </div>
      )}
    </LobbyShell>
  );
}
