"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import AuthModal from "@/components/AuthModal";
import {
  LobbyShell,
  LobbyCard,
  LobbyFooterLink,
} from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";
import {
  FriendsStatsSummary,
  FriendsSessionRow,
  FriendsStatsEmpty,
  type FriendsStatsData,
} from "@/components/FriendsStatsView";

function getApiBase(): string {
  return typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin.replace(":3000", ":4000")
    : process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
}

export default function FriendsStatsPage() {
  const { user, isLoggedIn, token } = useAuthStore();
  const [stats, setStats] = useState<FriendsStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!isLoggedIn() || !token) {
      setLoading(false);
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`${getApiBase()}/api/casual/stats?limit=25`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load stats");
        return res.json();
      })
      .then((data) => {
        if (data?.success && data.stats) {
          setStats(data.stats);
        } else {
          setError("Could not load stats");
        }
      })
      .catch(() => setError("Could not load stats"))
      .finally(() => setLoading(false));
  }, [isLoggedIn, token, user?.id]);

  return (
    <LobbyShell>
      <header className="career-page-header -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-bold text-gold-light tracking-widest no-underline">
            KOUPPI
          </Link>
          {isLoggedIn() && user ? (
            <span className="font-ui text-sm text-gray-300">
              {user.avatarEmoji} {user.username}
            </span>
          ) : (
            <HudButton variant="kouppi" size="sm" onClick={() => setShowAuthModal(true)}>
              Sign in
            </HudButton>
          )}
        </div>
        <div className="mt-6 text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-light tracking-wide">
            Friends Stats
          </h1>
          <p className="text-gray-400 font-ui text-sm mt-2">
            Your casual multiplayer history with friends
          </p>
        </div>
      </header>

      {!isLoggedIn() && (
        <LobbyCard title="Sign in required" icon="🔐">
          <p className="text-sm text-gray-400 font-ui mb-4">
            Log in to track games played with friends. Guest sessions are not saved.
          </p>
          <HudButton variant="success" onClick={() => setShowAuthModal(true)}>
            Sign in
          </HudButton>
        </LobbyCard>
      )}

      {isLoggedIn() && loading && (
        <LobbyCard title="Loading" icon="⏳">
          <p className="text-sm text-gray-500 font-ui">Loading your stats…</p>
        </LobbyCard>
      )}

      {isLoggedIn() && !loading && error && (
        <LobbyCard title="Error" icon="⚠">
          <p className="text-sm text-error font-ui">{error}</p>
        </LobbyCard>
      )}

      {isLoggedIn() && !loading && stats && (
        <>
          <LobbyCard title="Overview" icon="📊">
            <FriendsStatsSummary stats={stats} />
          </LobbyCard>

          <LobbyCard title="Recent sessions" icon="📜">
            {stats.recentSessions.length === 0 ? (
              <FriendsStatsEmpty />
            ) : (
              <div className="space-y-3">
                {stats.recentSessions.map((session) => (
                  <FriendsSessionRow key={session.id} session={session} />
                ))}
              </div>
            )}
          </LobbyCard>
        </>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <LobbyFooterLink href="/lobby">← Back to lobby</LobbyFooterLink>
        {isLoggedIn() && stats && stats.gamesPlayed === 0 && (
          <LobbyFooterLink href="/lobby">Create a room</LobbyFooterLink>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </LobbyShell>
  );
}
