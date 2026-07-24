"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { useRewardStore } from "@/store/rewardStore";
import AuthModal from "@/components/AuthModal";
import { LobbyShell, LobbyCard } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";
import {
  AchievementsPanel,
  DailyClaimCard,
  FirstWinBanner,
  MissionsPanel,
  SeasonTrackPanel,
  WheelPanel,
} from "@/components/rewards/RewardCenter";
import { CosmeticsWardrobe } from "@/components/rewards/CosmeticsWardrobe";

export default function RewardsPage() {
  const { user, isLoggedIn, refreshUser } = useAuthStore();
  const {
    state,
    isLoading,
    isActing,
    error,
    lastFeedback,
    fetchState,
    claimDaily,
    claimMission,
    rerollMission,
    claimTrack,
    spinWheel,
    equipCosmetic,
    clearError,
    clearFeedback,
  } = useRewardStore();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      void refreshUser();
      void fetchState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lastFeedback) return;
    const t = setTimeout(() => clearFeedback(), 3500);
    return () => clearTimeout(t);
  }, [lastFeedback, clearFeedback]);

  return (
    <LobbyShell>
      <header className="career-page-header -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-xl font-bold text-gold-light tracking-widest no-underline">
            KOUPPI
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/career" className="no-underline">
              <HudButton variant="ghost" size="sm">
                Career
              </HudButton>
            </Link>
            {!isLoggedIn() && (
              <HudButton variant="kouppi" size="sm" onClick={() => setShowAuthModal(true)}>
                Sign In
              </HudButton>
            )}
          </div>
        </div>
      </header>

      <div className="text-center mb-6 sm:mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-light tracking-wide mb-2">
          Reward Center
        </h1>
        <p className="text-gray-400 font-ui text-sm sm:text-base max-w-xl mx-auto">
          Daily claims, missions, season track, and wheel — tied to your Career account.
        </p>
      </div>

      {!isLoggedIn() || !user ? (
        <LobbyCard title="Sign in required" icon="◎">
          <p className="text-gray-400 font-ui text-sm mb-4">
            Rewards are persisted on your account. Sign in to claim daily rewards and track missions.
          </p>
          <HudButton variant="kouppi" onClick={() => setShowAuthModal(true)}>
            Sign In
          </HudButton>
        </LobbyCard>
      ) : isLoading && !state ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      ) : state ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="career-stat-tile text-center">
              <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Bankroll</div>
              <div className="text-lg sm:text-xl font-display font-bold text-gold">
                {state.currencies.bankroll.toLocaleString()}
              </div>
            </div>
            <div className="career-stat-tile text-center">
              <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Season XP</div>
              <div className="text-lg sm:text-xl font-display font-bold text-white">
                {state.currencies.seasonXp.toLocaleString()}
              </div>
            </div>
            <div className="career-stat-tile text-center">
              <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Wheel</div>
              <div className="text-lg sm:text-xl font-display font-bold text-gold-light">
                {state.currencies.wheelTokens}
              </div>
            </div>
            <div className="career-stat-tile text-center">
              <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Rerolls</div>
              <div className="text-lg sm:text-xl font-display font-bold text-white">
                {state.currencies.missionRerollTokens}
              </div>
            </div>
          </div>

          {lastFeedback && (
            <div className="mb-4 rounded-md border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-ui text-gold-light text-center">
              {lastFeedback}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-md border border-error/40 bg-error/10 px-4 py-2 text-sm font-ui text-error flex items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" className="underline text-xs" onClick={clearError}>
                Dismiss
              </button>
            </div>
          )}

          <div className="mb-5">
            <FirstWinBanner firstWin={state.firstWin} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">
            <div className="space-y-5">
              <DailyClaimCard
                dailyClaim={state.dailyClaim}
                serverNow={state.serverNow}
                isActing={isActing}
                onClaim={() => void claimDaily()}
              />
              <MissionsPanel
                title="Daily Missions"
                missions={state.dailyMissions}
                freeRerolls={state.dailyRerollsRemaining}
                rerollTokens={state.currencies.missionRerollTokens}
                showReroll
                isActing={isActing}
                onClaim={(id) => void claimMission(id)}
                onReroll={(id) => void rerollMission(id)}
              />
              <MissionsPanel
                title="Weekly Missions"
                missions={state.weeklyMissions}
                isActing={isActing}
                onClaim={(id) => void claimMission(id)}
              />
            </div>
            <div className="space-y-5">
              <SeasonTrackPanel
                season={state.season}
                isActing={isActing}
                onClaim={(level) => void claimTrack(level)}
              />
              <WheelPanel
                wheel={state.wheel}
                isActing={isActing}
                onSpin={() => void spinWheel()}
              />
              <CosmeticsWardrobe
                state={state}
                isActing={isActing}
                onEquip={(slot, id) => void equipCosmetic(slot, id)}
              />
              <AchievementsPanel achievements={state.achievements} />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500 font-ui">
            UTC daily · ISO weekly · Period {state.dailyPeriodKey} · {state.weeklyPeriodKey}
          </p>
        </>
      ) : (
        <LobbyCard title="Unable to load" icon="◎">
          <p className="text-gray-400 font-ui text-sm mb-4">{error ?? "Reward state unavailable"}</p>
          <HudButton variant="ghost" onClick={() => void fetchState()}>
            Retry
          </HudButton>
        </LobbyCard>
      )}

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </LobbyShell>
  );
}
