"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  useCareerLobbyStore,
  type Tier,
  type AnteOption,
  type WaitingRoomSummary,
} from "@/store/careerLobbyStore";
import { HudButton } from "@/components/game/HudButton";
import {
  LobbyCard,
  LobbyAlert,
} from "@/components/game/LobbyUI";
import { Avatar } from "@/components/AvatarPicker";

/**
 * Career entry: three parallel paths
 * 1) Quick Match (queue search)
 * 2) Create Waiting Table
 * 3) Browse all live waiting tables and join anytime
 */
export default function CareerLobby({ expectedRoomId }: { expectedRoomId?: string }) {
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
    queueJoinedAt,
    isJoiningQueue,
    matchFound,
    currentRoom,
    isJoiningRoom,
    gameRoomId,
    waitingRooms,
    isLoadingWaitingRooms,
    error,
    connect,
    selectTier,
    joinQueue,
    leaveQueue,
    leaveRoom,
    setReady,
    browseAllWaitingRooms,
    createWaitingRoom,
    joinWaitingRoom,
    fetchTiers,
    clearError,
  } = useCareerLobbyStore();

  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

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
    if (!queueState?.inQueue || !queueJoinedAt) {
      setElapsedSec(0);
      return;
    }
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - queueJoinedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [queueState?.inQueue, queueJoinedAt]);

  useEffect(() => {
    if (gameRoomId) {
      router.replace(`/room/${gameRoomId}`);
      return;
    }

    const waitingRoomId = currentRoom?.roomId ?? matchFound?.roomId;
    if (!expectedRoomId && waitingRoomId) {
      router.push(`/career/table/${encodeURIComponent(waitingRoomId)}`);
      return;
    }

    if (expectedRoomId && currentRoom?.roomId && currentRoom.roomId !== expectedRoomId) {
      router.replace(`/career/table/${encodeURIComponent(currentRoom.roomId)}`);
    }
  }, [currentRoom?.roomId, expectedRoomId, gameRoomId, matchFound?.roomId, router]);

  // Always refresh the global live-table browser while idle in Career lobby
  useEffect(() => {
    if (!token || !isConnected) return;
    if (queueState?.inQueue || isJoiningQueue || currentRoom || matchFound) return;

    void browseAllWaitingRooms(token);
    const interval = setInterval(() => {
      void browseAllWaitingRooms(token);
    }, 4000);
    return () => clearInterval(interval);
  }, [
    token,
    isConnected,
    queueState?.inQueue,
    isJoiningQueue,
    currentRoom,
    matchFound,
    browseAllWaitingRooms,
  ]);

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
    if (expectedRoomId) {
      router.push("/career");
    }
  };

  const handleToggleReady = async () => {
    if (!token || !user?.id || !currentRoom) return;
    const me = currentRoom.players.find((p) => p.userId === user.id);
    await setReady(token, !me?.ready);
  };

  const handleCreateWaiting = async (anteId: string) => {
    if (!token) return;
    await createWaitingRoom(token, anteId);
  };

  const handleJoinWaiting = async (roomId: string) => {
    if (!token) return;
    await joinWaitingRoom(token, roomId);
  };

  const selectedTier = tiers.find((t) => t.id === selectedTierId);
  const searchingLeagueName =
    selectedTier?.name ??
    tiers.find((t) => t.id === queueState?.tierId)?.name ??
    "Career";

  if (!isLoggedIn()) {
    return (
      <LobbyCard title="Career Matchmaking" icon="🏆">
        <p className="text-gray-400 text-center font-ui py-4">
          Sign in to access Career Mode matchmaking
        </p>
      </LobbyCard>
    );
  }

  if (isConnecting && !currentRoom) {
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

  if (!isConnected && !currentRoom) {
    return (
      <LobbyCard title="Disconnected" icon="◎">
        <p className="text-error text-center font-ui mb-4">Disconnected from server</p>
        <HudButton variant="bet" fullWidth onClick={() => token && connect(token)}>
          Reconnect
        </HudButton>
      </LobbyCard>
    );
  }

  if (queueState?.inQueue || isJoiningQueue) {
    const queueTier = tiers.find((t) => t.id === queueState?.tierId) ?? selectedTier;
    return (
      <LobbyCard title={`${queueTier?.emoji ?? "🔍"} Finding Match`} icon="◎">
        <div className="space-y-4">
          <div
            className="hud-status-banner !bg-gold/10 !border-gold/30 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-display text-lg font-bold text-gold mb-1">
              Searching for a {searchingLeagueName} table…
            </div>
            <div className="text-sm text-gray-400">
              {queueState?.position ? `Position #${queueState.position} · ` : null}
              {elapsedSec}s elapsed
              {queueState?.queueSize ? ` · ${queueState.queueSize} in queue` : null}
            </div>
          </div>
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
        <div className="hud-result-win text-center py-6" role="status" aria-live="polite">
          <div className="text-4xl mb-3">⚔️</div>
          <div className="font-display text-xl font-bold text-success mb-2">Match found</div>
          <div className="text-sm text-gray-400">
            {matchFound.opponent.username} · Rating {matchFound.opponent.rating}
          </div>
          <div className="hud-status-banner text-center !py-2 mt-4 font-ui text-sm">
            Preparing game room...
          </div>
        </div>
      </LobbyCard>
    );
  }

  if (expectedRoomId && !currentRoom) {
    return (
      <LobbyCard title="Preparing Career Table" icon="♣">
        <div className="hud-status-banner text-center !py-4 font-ui text-sm" role="status">
          Connecting you to table {expectedRoomId}…
        </div>
        {error && (
          <LobbyAlert variant="error" onDismiss={clearError}>
            {error}
          </LobbyAlert>
        )}
        <HudButton variant="ghost" fullWidth onClick={() => router.push("/career")}>
          Back to Career
        </HudButton>
      </LobbyCard>
    );
  }

  if (currentRoom) {
    const me = currentRoom.players.find((p) => p.userId === user?.id);
    const bothPresent = currentRoom.playerCount >= 2;
    const allReady =
      bothPresent && currentRoom.players.every((p) => p.ready);
    const countdownActive =
      currentRoom.status === "starting" ||
      (countdown !== null && countdown > 0 && !!currentRoom.autoStartAt);

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
        {error && (
          <LobbyAlert variant="error" onDismiss={clearError}>
            {error}
          </LobbyAlert>
        )}

        {!isConnected && (
          <div className="hud-status-banner text-center !py-2 mb-4 font-ui text-sm">
            Connection lost — reconnecting to your table…
            <div className="mt-2">
              <HudButton variant="bet" size="sm" onClick={() => token && connect(token)}>
                Reconnect now
              </HudButton>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-400 font-ui mb-4">
          Waiting table · Ante: {currentRoom.ante} · Bet: {currentRoom.minBet}–{currentRoom.maxBet}
        </p>

        <div className="space-y-2 mb-4">
          {currentRoom.players.map((player) => (
            <div
              key={player.userId}
              className={`lobby-player-row ${player.userId === user?.id ? "lobby-player-row-me" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar avatar={{ id: player.avatarId }} size="md" />
                <div className="min-w-0">
                  <div className="font-ui font-medium truncate">
                    {player.username}
                    {player.userId === user?.id && (
                      <span className="text-gold text-xs ml-1">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Rating {player.rating}
                    {" · "}
                    {player.connected === false ? "Reconnecting…" : player.ready ? "Ready" : "Not ready"}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {Array.from({ length: Math.max(0, currentRoom.maxPlayers - currentRoom.playerCount) }).map((_, i) => (
            <div key={`empty-${i}`} className="lobby-player-row border-dashed opacity-60">
              <div className="flex items-center gap-3">
                <div className="avatar-display w-10 h-10 text-lg bg-black/40 text-gray-600 border-2 border-white/10">
                  ?
                </div>
                <span className="text-gray-500 text-sm font-ui">Waiting for opponent…</span>
              </div>
            </div>
          ))}
        </div>

        {countdownActive && countdown !== null && countdown > 0 && (
          <div className="hud-result-win text-center py-3 mb-4 font-ui">
            <div className="text-sm mb-1">Game starting in</div>
            <div className="font-display text-3xl font-bold text-success">{countdown}s</div>
          </div>
        )}

        {!bothPresent && (
          <div className="hud-status-banner text-center !py-2 mb-4 font-ui text-sm">
            Waiting for an opponent to join…
          </div>
        )}

        {bothPresent && !allReady && !countdownActive && (
          <div className="hud-status-banner text-center !py-2 mb-4 font-ui text-sm">
            Both players must Ready before the 60-second countdown begins.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {bothPresent && currentRoom.status !== "in-game" && isConnected && (
            <HudButton
              variant={me?.ready ? "ghost" : "success"}
              fullWidth
              onClick={handleToggleReady}
            >
              {me?.ready ? "Cancel Ready" : "Ready"}
            </HudButton>
          )}
          <HudButton variant="danger" fullWidth onClick={handleLeaveRoom} disabled={!isConnected}>
            Leave Room
          </HudButton>
        </div>
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

      <LiveTablesBrowser
        rooms={waitingRooms}
        isLoading={isLoadingWaitingRooms}
        isJoining={isJoiningRoom || isJoiningQueue}
        onRefresh={() => token && browseAllWaitingRooms(token)}
        onJoin={handleJoinWaiting}
      />

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
          <p className="text-sm text-gray-400 font-ui mb-3">
            Quick Match or create a waiting table for a specific league stake.
          </p>
          {tiers.length === 0 ? (
            <div className="space-y-3">
              <div className="hud-status-banner text-center !py-4 font-ui text-sm text-gray-300">
                No leagues loaded. If you were already signed in, your session may have expired —
                sign in again, then tap Retry.
              </div>
              <HudButton
                variant="bet"
                fullWidth
                onClick={() => token && fetchTiers(token)}
              >
                Retry loading leagues
              </HudButton>
            </div>
          ) : (
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
          )}
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
            <div className="space-y-3">
              {selectedTier.antes.map((ante) => (
                <AnteCard
                  key={ante.id}
                  ante={ante}
                  tierColor={selectedTier.color}
                  isJoining={isJoiningQueue || isJoiningRoom}
                  onQuickMatch={() => handleJoinAnte(ante.id)}
                  onCreateWaiting={() => handleCreateWaiting(ante.id)}
                />
              ))}
            </div>
          </LobbyCard>
        )
      )}
    </div>
  );
}

function LiveTablesBrowser({
  rooms,
  isLoading,
  isJoining,
  onRefresh,
  onJoin,
}: {
  rooms: WaitingRoomSummary[];
  isLoading: boolean;
  isJoining: boolean;
  onRefresh: () => void;
  onJoin: (roomId: string) => void;
}) {
  return (
    <LobbyCard
      title="Live Waiting Tables"
      icon="◎"
      badge={
        <HudButton variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading || isJoining}>
          {isLoading ? "…" : "Refresh"}
        </HudButton>
      }
    >
      <p className="text-sm text-gray-400 font-ui mb-3">
        Browse every open Career waiting table and join anytime. In-progress games are never listed.
      </p>
      {rooms.length === 0 ? (
        <div className="hud-status-banner text-center !py-4 font-ui text-sm text-gray-400">
          {isLoading ? "Loading live tables…" : "No waiting tables right now — Quick Match or create one below."}
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => {
            const joinable = room.canJoin !== false && room.status === "waiting";
            return (
              <div key={room.roomId} className="lobby-room-row items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-ui font-semibold text-white truncate">
                    {room.tierEmoji ?? "♠"} {room.tierName ?? room.tierId} ·{" "}
                    {room.anteLabel ?? `Ante ${room.ante}`}
                  </div>
                  <div className="text-sm text-gray-400">
                    {room.playerCount}/{room.maxPlayers} seated
                    {typeof room.buyIn === "number" ? ` · Buy-in ${room.buyIn.toLocaleString()}` : ""}
                    {typeof room.seatsOpen === "number" ? ` · ${room.seatsOpen} open` : ""}
                  </div>
                </div>
                <HudButton
                  variant={joinable ? "success" : "ghost"}
                  size="sm"
                  disabled={!joinable || isJoining}
                  onClick={() => onJoin(room.roomId)}
                  className="shrink-0"
                >
                  {isJoining ? "…" : joinable ? "Join" : "Unavailable"}
                </HudButton>
              </div>
            );
          })}
        </div>
      )}
    </LobbyCard>
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
  onQuickMatch,
  onCreateWaiting,
}: {
  ante: AnteOption;
  tierColor: string;
  isJoining: boolean;
  onQuickMatch: () => void;
  onCreateWaiting: () => void;
}) {
  return (
    <div className="lobby-room-row flex-col items-stretch gap-3" style={{ borderColor: tierColor + "30" }}>
      <div className="min-w-0">
        <div className="font-ui font-semibold text-white">{ante.label}</div>
        <div className="text-sm text-gray-400">Buy-in: {ante.buyIn.toLocaleString()} chips</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <HudButton
          variant={ante.canAfford && !isJoining ? "success" : "ghost"}
          size="sm"
          onClick={onQuickMatch}
          disabled={!ante.canAfford || isJoining}
        >
          {isJoining ? "Searching…" : ante.canAfford ? "Quick Match" : "Not enough"}
        </HudButton>
        <HudButton
          variant="bet"
          size="sm"
          onClick={onCreateWaiting}
          disabled={!ante.canAfford || isJoining}
        >
          Create Waiting Table
        </HudButton>
      </div>
    </div>
  );
}
