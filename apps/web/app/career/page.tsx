"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useCareerStore } from "@/store/careerStore";
import AuthModal from "@/components/AuthModal";
import TrophyBadge, { RatingBadge } from "@/components/TrophyBadge";
import CareerLobby from "@/components/CareerLobby";
import { LobbyShell, LobbyCard } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";
import { Avatar } from "@/components/AvatarPicker";

export default function CareerPage() {
  const { user, isLoggedIn, logout, refreshUser } = useAuthStore();
  const { leaderboard, fetchLeaderboard, isLoadingLeaderboard } = useCareerStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [joinedLabel, setJoinedLabel] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
    if (isLoggedIn()) {
      refreshUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.createdAt) {
      setJoinedLabel(null);
      return;
    }
    // Format only on client after mount to avoid SSR/locale hydration mismatch (React #418/#425)
    setJoinedLabel(new Date(user.createdAt).toLocaleDateString());
  }, [user?.createdAt]);

  return (
    <LobbyShell>
      <header className="career-page-header -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-bold text-gold-light tracking-widest no-underline">
            KOUPPI
          </Link>

          {isLoggedIn() && user ? (
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <TrophyBadge
                trophies={user.trophies}
                arena={user.arena}
                arenaName={user.arenaName}
                size="sm"
              />
              <span className="font-ui text-sm text-gray-300 hidden sm:inline">
                {user.username}
              </span>
              <HudButton variant="ghost" size="sm" onClick={logout}>
                Logout
              </HudButton>
            </div>
          ) : (
            <HudButton variant="kouppi" size="sm" onClick={() => setShowAuthModal(true)}>
              Sign In
            </HudButton>
          )}
        </div>
      </header>

      <div className="text-center mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-light tracking-wide mb-2">
          Career Mode
        </h1>
        <p className="text-gray-400 font-ui text-sm sm:text-base">
          Choose your league and stakes, join a room, and compete for trophies!
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        <div className="space-y-5">
          {isLoggedIn() && user && (
            <LobbyCard title="Your Profile" icon="◎">
              <div className="flex items-center gap-4 mb-4">
                <Avatar avatar={{ id: user.avatarId }} size="lg" />
                <div>
                  <div className="font-display text-xl font-bold text-gold-light">{user.username}</div>
                  <div className="text-gray-400 text-sm font-ui">
                    {joinedLabel ? `Joined ${joinedLabel}` : "Career player"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="career-stat-tile">
                  <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Bankroll</div>
                  <div className="text-xl font-display font-bold text-gold">
                    {user.bankroll.toLocaleString()}
                  </div>
                </div>
                <div className="career-stat-tile">
                  <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Win Rate</div>
                  <div className="text-xl font-display font-bold text-white">
                    {user.gamesPlayed > 0
                      ? `${Math.round((user.gamesWon / user.gamesPlayed) * 100)}%`
                      : "N/A"}
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
            </LobbyCard>
          )}

          <CareerLobby />

          <div className="flex gap-3">
            <Link href="/lobby" className="flex-1 no-underline">
              <HudButton variant="ghost" fullWidth>
                Custom Games
              </HudButton>
            </Link>
            <Link href="/play/single" className="flex-1 no-underline">
              <HudButton variant="ghost" fullWidth>
                Practice
              </HudButton>
            </Link>
          </div>
        </div>

        <LobbyCard
          title="Top Players"
          icon="🏆"
          badge={
            <Link href="/leaderboard" className="hud-btn hud-btn-ghost text-xs py-1 px-2 no-underline">
              View All →
            </Link>
          }
        >
          {isLoadingLeaderboard ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-center py-12 text-gray-500 font-ui">No players yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((player, index) => (
                <div
                  key={player.id}
                  className={`lobby-player-row ${user?.id === player.id ? "lobby-player-row-me" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 flex items-center justify-center rounded-full font-display font-bold text-sm shrink-0 ${
                        index === 0
                          ? "bg-gold text-black"
                          : index === 1
                            ? "bg-gray-300 text-black"
                            : index === 2
                              ? "bg-orange-400 text-black"
                              : "bg-black/50 text-gray-300 border border-white/10"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <Avatar avatar={{ id: player.avatarId }} size="md" />
                    <div className="min-w-0">
                      <div className="font-ui font-medium truncate">{player.username}</div>
                      <div className="text-xs text-gray-500">
                        {player.gamesPlayed} games · {player.winRate}% win
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display font-bold text-gold">{player.trophies}</div>
                    <div className="text-xs text-gray-500">{player.arenaName}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </LobbyCard>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </LobbyShell>
  );
}
