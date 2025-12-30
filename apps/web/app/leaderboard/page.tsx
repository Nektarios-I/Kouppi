"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useCareerStore } from "@/store/careerStore";
import TrophyBadge from "@/components/TrophyBadge";

const ARENAS = [
  { id: 0, name: "All Arenas", minTrophies: 0, color: "#6366f1" },
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
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
};

export default function LeaderboardPage() {
  const { user, isLoggedIn } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArena, setSelectedArena] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  const limit = 25;
  
  useEffect(() => {
    fetchLeaderboard();
  }, [selectedArena, page]);
  
  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const endpoint = selectedArena === 0 
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
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-400">
            KOUPPI
          </Link>
          <Link 
            href="/career"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            ← Back to Career
          </Link>
        </div>
      </header>
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🏆 Leaderboard</h1>
          <p className="text-gray-400">
            Top players ranked by trophies
          </p>
        </div>
        
        {/* Arena Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {ARENAS.map((arena) => (
            <button
              key={arena.id}
              onClick={() => {
                setSelectedArena(arena.id);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedArena === arena.id
                  ? "text-white shadow-lg"
                  : "bg-gray-800/50 text-gray-400 hover:text-white"
              }`}
              style={selectedArena === arena.id ? { backgroundColor: arena.color } : {}}
            >
              {arena.name}
            </button>
          ))}
        </div>
        
        {/* Leaderboard Table */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              No players found in this arena.
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-900/50 border-b border-gray-700 text-sm text-gray-400 font-medium">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-5">Player</div>
                <div className="col-span-2 text-center">Trophies</div>
                <div className="col-span-2 text-center">Rating</div>
                <div className="col-span-2 text-center">Win Rate</div>
              </div>
              
              {/* Table Body */}
              <div className="divide-y divide-gray-800/50">
                {leaderboard.map((player, index) => {
                  const rank = page * limit + index + 1;
                  const isCurrentUser = user?.id === player.id;
                  
                  return (
                    <div 
                      key={player.id}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors ${
                        isCurrentUser 
                          ? "bg-indigo-500/10" 
                          : "hover:bg-gray-800/30"
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex justify-center">
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                          rank === 1 ? "bg-yellow-500 text-black" :
                          rank === 2 ? "bg-gray-300 text-black" :
                          rank === 3 ? "bg-orange-400 text-black" :
                          "bg-gray-700 text-gray-300"
                        }`}>
                          {rank}
                        </div>
                      </div>
                      
                      {/* Player */}
                      <div className="col-span-5 flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 flex-shrink-0"
                          style={{ 
                            backgroundColor: player.avatarColor,
                            borderColor: player.avatarBorder,
                          }}
                        >
                          {player.avatarEmoji}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate flex items-center gap-2">
                            {player.username}
                            {isCurrentUser && (
                              <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {player.gamesPlayed} games played
                          </div>
                        </div>
                      </div>
                      
                      {/* Trophies */}
                      <div className="col-span-2 text-center">
                        <div className="font-bold text-yellow-400">
                          🏆 {player.trophies}
                        </div>
                        <div className="text-xs text-gray-500">
                          {player.arenaName}
                        </div>
                      </div>
                      
                      {/* Rating */}
                      <div className="col-span-2 text-center">
                        <div className="font-medium text-purple-400">
                          {player.rating}
                        </div>
                        <div className="text-xs text-gray-500">Elo</div>
                      </div>
                      
                      {/* Win Rate */}
                      <div className="col-span-2 text-center">
                        <div className={`font-medium ${
                          player.winRate >= 60 ? "text-green-400" :
                          player.winRate >= 40 ? "text-gray-300" :
                          "text-red-400"
                        }`}>
                          {player.winRate}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {player.gamesWon}W / {player.gamesLost}L
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        
        {/* Pagination */}
        {!isLoading && leaderboard.length > 0 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="px-4 py-2 text-gray-400">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasMore}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
