"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useCareerStore } from "@/store/careerStore";
import AuthModal from "@/components/AuthModal";
import TrophyBadge, { RatingBadge } from "@/components/TrophyBadge";
import CareerLobby from "@/components/CareerLobby";

export default function CareerPage() {
  const router = useRouter();
  const { user, isLoggedIn, logout, refreshUser } = useAuthStore();
  const { 
    leaderboard,
    fetchLeaderboard,
    isLoadingLeaderboard,
  } = useCareerStore();
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Fetch leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
    if (isLoggedIn()) {
      refreshUser();
    }
  }, []);
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-indigo-400">
            KOUPPI
          </Link>
          
          {isLoggedIn() && user ? (
            <div className="flex items-center gap-4">
              <TrophyBadge 
                trophies={user.trophies} 
                arena={user.arena} 
                arenaName={user.arenaName}
                size="sm"
              />
              <div className="flex items-center gap-2">
                <span className="text-lg">{user.avatarEmoji}</span>
                <span className="font-medium">{user.username}</span>
              </div>
              <button
                onClick={logout}
                className="text-gray-400 hover:text-white text-sm"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Career Mode
          </h1>
          <p className="text-gray-400">
            Choose your league and stakes, join a room, and compete for trophies!
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Queue/Profile */}
          <div className="space-y-6">
            {/* Profile Card (if logged in) */}
            {isLoggedIn() && user && (
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
                <h2 className="text-lg font-bold mb-4 text-gray-300">Your Profile</h2>
                
                <div className="flex items-center gap-4 mb-4">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2"
                    style={{ 
                      backgroundColor: user.avatarColor,
                      borderColor: user.avatarBorder,
                    }}
                  >
                    {user.avatarEmoji}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{user.username}</div>
                    <div className="text-gray-400 text-sm">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-gray-400 text-sm">Bankroll</div>
                    <div className="text-xl font-bold text-yellow-400">
                      💰 {user.bankroll.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-gray-400 text-sm">Win Rate</div>
                    <div className="text-xl font-bold">
                      {user.gamesPlayed > 0 
                        ? `${Math.round((user.gamesWon / user.gamesPlayed) * 100)}%`
                        : "N/A"
                      }
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <TrophyBadge 
                    trophies={user.trophies} 
                    arena={user.arena} 
                    arenaName={user.arenaName}
                  />
                  <RatingBadge rating={user.rating} />
                </div>
              </div>
            )}
            
            {/* Career Lobby - Tier/Ante Selection */}
            <CareerLobby />
            
            {/* Quick Links */}
            <div className="flex gap-4">
              <Link 
                href="/lobby"
                className="flex-1 text-center py-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-xl transition-colors"
              >
                🎲 Custom Games
              </Link>
              <Link 
                href="/play/single"
                className="flex-1 text-center py-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-xl transition-colors"
              >
                🤖 Practice
              </Link>
            </div>
          </div>
          
          {/* Right: Leaderboard */}
          <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-300">Top Players</h2>
              <Link 
                href="/leaderboard"
                className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
                View All →
              </Link>
            </div>
            
            {isLoadingLeaderboard ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No players yet. Be the first!
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((player, index) => (
                  <div 
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      user?.id === player.id 
                        ? "bg-indigo-500/20 border border-indigo-500/30" 
                        : "bg-gray-900/30"
                    }`}
                  >
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                      index === 0 ? "bg-yellow-500 text-black" :
                      index === 1 ? "bg-gray-300 text-black" :
                      index === 2 ? "bg-orange-400 text-black" :
                      "bg-gray-700 text-gray-300"
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg border"
                      style={{ 
                        backgroundColor: player.avatarColor,
                        borderColor: player.avatarBorder,
                      }}
                    >
                      {player.avatarEmoji}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{player.username}</div>
                      <div className="text-xs text-gray-500">
                        {player.gamesPlayed} games • {player.winRate}% win
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-bold text-yellow-400">
                        🏆 {player.trophies}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.arenaName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </main>
  );
}
