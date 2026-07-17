"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useCareerLobbyStore, type Tier, type AnteOption } from "@/store/careerLobbyStore";
import { HudButton } from "@/components/game/HudButton";
import {
  LobbyCard,
  LobbyAlert,
} from "@/components/game/LobbyUI";

export default function CareerLobby() {
  const router = useRouter();
  const { token, user, isLoggedIn } = useAuthStore();
  const {
    socket,
    isConnected,
    isConnecting,
    playerRating,
    playerBankroll,
    tiers,
    selectedTierId,
    isLoadingTiers,
    queueState,
    isJoiningQueue,
    matchFound,
    currentRoom,
    isJoiningRoom,
    gameRoomId,
    error,
    connect,
    fetchTiers,
    selectTier,
    joinQueue,
    leaveQueue,
    leaveRoom,
    clearError,
  } = useCareerLobbyStore();

  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (isLoggedIn() && token && !socket) {
      connect(token);
    }
  }, [isLoggedIn, token, socket, connect]);

  useEffect(() => {
    if (currentRoom?.autoStartAt) {
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((currentRoom.autoStartAt! - Date.now()) / 1000));
        setCountdown(remaining);
      };
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
    setCountdown(null);
  }, [currentRoom?.autoStartAt]);

  useEffect(() => {
    if (gameRoomId) {
      router.push(`/room/${gameRoomId}`);
    }
  }, [gameRoomId, router]);

  const handleJoinAnte = async (anteId: string) => {
    if (!token) return;
    await joinQueue(token, anteId);
  };

  const handleCancelSearch = () => {
    if (!token) return;
    leaveQueue(token);
  };

  const handleLeaveRoom = () => {
    if (!token) return;
    leaveRoom(token);
  };

  const selectedTier = tiers.find((t) => t.id === selectedTierId);

  if (!isLoggedIn()) {
    return (
      <LobbyCard title="Career Matchmaking" icon="🏆">
        <p className="text-gray-400 text-center font-ui py-4">
          Sign in to access Career Mode matchmaking
        </p>
      </LobbyCard>
    );
  }

  if (isConnecting) {
    return (
      <LobbyCard title="Connecting" icon="◎">
        <div className="flex justify-center py-8">
          <div className="hud-timer-ring w-12 h-12 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        </div>
      </LobbyCard>
    );
  }

  if (!isConnected) {
    return (
      <LobbyCard title="Disconnected" icon="◎">
        <p className="text-error text-center font-ui mb-4">Disconnected from server</p>
        <HudButton variant="bet" fullWidth onClick={() => token && connect(token)}>
          Reconnect
        </HudButton>
      </LobbyCard>
    );
  }

  if (queueState?.inQueue) {
    const queueTier = tiers.find((t) => t.id === queueState.tierId);
    return (
      <LobbyCard title={`${queueTier?.emoji ?? "🔍"} Finding Match`} icon="◎">
        <div className="space-y-4">
          <div className="hud-status-banner !bg-gold/10 !border-gold/30 text-center">
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-display text-lg font-bold text-gold mb-1">Searching for opponent...</div>
            <div className="text-sm text-gray-400">
              Position #{queueState.position} · {queueState.waitTime}s wait
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="career-stat-tile">
              <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Search Range</div>
              <div className="text-lg font-display font-bold text-gold">±{queueState.searchRange}</div>
            </div>
            <div className="career-stat-tile">
              <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Players in Queue</div>
              <div className="text-lg font-display font-bold text-gold">{queueState.queueSize}</div>
            </div>
          </div>
          {queueState.fallbackMode && (
            <div className="hud-status-banner text-center !py-3 font-ui">
              <div className="text-lg mb-1">
                {queueState.fallbackMode === "quick-match" && "🌍 Quick Match Mode"}
                {queueState.fallbackMode === "cross-tier" && "📡 Searching All Leagues"}
                {queueState.fallbackMode === "expanded" && "🔎 Expanding Search Range"}
              </div>
              <div className="text-xs text-gray-400">
                {queueState.fallbackMode === "quick-match" && "Accepting any opponent to get you in a game"}
                {queueState.fallbackMode === "cross-tier" && "Looking for players in nearby leagues"}
                {queueState.fallbackMode === "expanded" && "Widening rating range to find more matches"}
              </div>
            </div>
          )}
          <HudButton variant="danger" fullWidth onClick={handleCancelSearch}>
            Cancel Search
          </HudButton>
        </div>
      </LobbyCard>
    );
  }

  if (matchFound && !currentRoom) {
    return (
      <LobbyCard title="Match Found!" icon="✨">
        <div className="hud-result-win text-center py-6">
          <div className="text-4xl mb-3">⚔️</div>
          <div className="font-display text-xl font-bold text-success mb-2">Opponent Found!</div>
          <div className="text-sm text-gray-400">{matchFound.opponent.username} · Rating {matchFound.opponent.rating}</div>
          <div className="hud-status-banner text-center !py-2 mt-4 font-ui text-sm">Preparing game room...</div>
        </div>
      </LobbyCard>
    );
  }

  if (currentRoom) {
    return (
      <LobbyCard
        title={`${selectedTier?.emoji ?? "♠"} ${selectedTier?.name ?? "Career Room"}`}
        icon="♣"
        badge={
          <span className="hud-badge">
            {currentRoom.playerCount}/{currentRoom.maxPlayers}
          </span>
        }
      >
        <p className="text-sm text-gray-400 font-ui mb-4">
          Ante: {currentRoom.ante} · Bet: {currentRoom.minBet}–{currentRoom.maxBet}
        </p>

        <div className="space-y-2 mb-4">
          {currentRoom.players.map((player) => (
            <div
              key={player.userId}
              className={`lobby-player-row ${player.userId === user?.id ? "lobby-player-row-me" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="avatar-display w-10 h-10 text-lg"
                  style={{
                    backgroundColor: player.avatarColor,
                    border: `2px solid ${player.avatarBorder}`,
                  }}
                >
                  {player.avatarEmoji}
                </div>
                <div className="min-w-0">
                  <div className="font-ui font-medium truncate">
                    {player.username}
                    {player.userId === user?.id && (
                      <span className="text-gold text-xs ml-1">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">Rating {player.rating}</div>
                </div>
              </div>
            </div>
          ))}

          {Array.from({ length: currentRoom.maxPlayers - currentRoom.playerCount }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="lobby-player-row border-dashed opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="avatar-display w-10 h-10 text-lg bg-black/40 text-gray-600 border-2 border-white/10">
                  ?
                </div>
                <span className="text-gray-500 text-sm font-ui">Waiting for player…</span>
              </div>
            </div>
          ))}
        </div>

        {countdown !== null && countdown > 0 && currentRoom.playerCount >= 2 && (
          <div className="hud-result-win text-center py-3 mb-4 font-ui">
            <div className="text-sm mb-1">Game starting in</div>
            <div className="font-display text-3xl font-bold text-success">{countdown}s</div>
          </div>
        )}

        {currentRoom.playerCount < 2 && (
          <div className="hud-status-banner text-center !py-2 mb-4 font-ui text-sm">
            Waiting for at least 2 players to start…
          </div>
        )}

        <HudButton variant="danger" fullWidth onClick={handleLeaveRoom}>
          Leave Room
        </HudButton>
      </LobbyCard>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <LobbyAlert variant="error" onDismiss={clearError}>
          {error}
        </LobbyAlert>
      )}

      <LobbyCard title="Your Stats" icon="◎">
        <div className="grid grid-cols-2 gap-3">
          <div className="career-stat-tile">
            <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Rating</div>
            <div className="text-xl font-display font-bold text-gold-light">{playerRating}</div>
          </div>
          <div className="career-stat-tile">
            <div className="text-xs text-gray-500 font-ui uppercase tracking-wide">Bankroll</div>
            <div className="text-xl font-display font-bold text-gold">
              {playerBankroll.toLocaleString()}
            </div>
          </div>
        </div>
      </LobbyCard>

      {isLoadingTiers ? (
        <LobbyCard title="Loading Leagues" icon="🏆">
          <div className="flex justify-center py-8">
            <div className="hud-timer-ring w-12 h-12 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            </div>
          </div>
        </LobbyCard>
      ) : !selectedTierId ? (
        <LobbyCard title="Select a League" icon="🏆">
          <div className="space-y-2">
            {tiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                playerRating={playerRating}
                onSelect={() => selectTier(tier.id)}
              />
            ))}
          </div>
        </LobbyCard>
      ) : (
        selectedTier && (
          <LobbyCard
            title={`${selectedTier.emoji} ${selectedTier.name}`}
            icon="♠"
            badge={
              <HudButton variant="ghost" size="sm" onClick={() => selectTier("")}>
                ← Back
              </HudButton>
            }
          >
            <p className="text-sm text-gray-400 font-ui mb-4">{selectedTier.description}</p>
            <div className="space-y-2">
              {selectedTier.antes.map((ante) => (
                <AnteCard
                  key={ante.id}
                  ante={ante}
                  tierColor={selectedTier.color}
                  isJoining={isJoiningQueue}
                  onJoin={() => handleJoinAnte(ante.id)}
                />
              ))}
            </div>
          </LobbyCard>
        )
      )}
    </div>
  );
}

function TierCard({
  tier,
  playerRating,
  onSelect,
}: {
  tier: Tier;
  playerRating: number;
  onSelect: () => void;
}) {
  const canAccess = tier.accessible;
  const ratingNeeded = tier.minRating - playerRating;

  return (
    <button
      type="button"
      onClick={canAccess ? onSelect : undefined}
      disabled={!canAccess}
      className={`career-tier-card ${canAccess ? "career-tier-card-accessible cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
      style={{
        backgroundColor: canAccess ? tier.color + "15" : "transparent",
        borderColor: canAccess ? tier.color + "50" : "rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{tier.emoji}</span>
          <div className="min-w-0 text-left">
            <div className="font-display font-bold text-gold-light">{tier.name}</div>
            <div className="text-sm text-gray-400">{tier.minRating}+ rating required</div>
          </div>
        </div>
        {canAccess ? (
          <span className="text-gold shrink-0">→</span>
        ) : (
          <span className="text-error text-sm shrink-0">Need {ratingNeeded} more</span>
        )}
      </div>
    </button>
  );
}

function AnteCard({
  ante,
  tierColor,
  isJoining,
  onJoin,
}: {
  ante: AnteOption;
  tierColor: string;
  isJoining: boolean;
  onJoin: () => void;
}) {
  return (
    <div
      className="lobby-room-row"
      style={{ borderColor: tierColor + "30" }}
    >
      <div className="min-w-0">
        <div className="font-ui font-semibold text-white">{ante.label}</div>
        <div className="text-sm text-gray-400">
          Buy-in: {ante.buyIn.toLocaleString()} chips
        </div>
      </div>
      <HudButton
        variant={ante.canAfford && !isJoining ? "success" : "ghost"}
        size="sm"
        onClick={onJoin}
        disabled={!ante.canAfford || isJoining}
        className="shrink-0"
      >
        {isJoining ? "…" : ante.canAfford ? "Find Match" : "Not enough"}
      </HudButton>
    </div>
  );
}
