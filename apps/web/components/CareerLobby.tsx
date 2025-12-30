"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useCareerLobbyStore, type Tier, type AnteOption } from "@/store/careerLobbyStore";

/**
 * Career Lobby Component
 * 
 * Displays tier selection and matchmaking UI for Career Mode.
 */
export default function CareerLobby() {
  const router = useRouter();
  const { token, user, isLoggedIn } = useAuthStore();
  const {
    socket,
    isConnected,
    isConnecting,
    isAuthenticated,
    playerRating,
    playerBankroll,
    tiers,
    selectedTierId,
    isLoadingTiers,
    currentRoom,
    isJoiningRoom,
    gameRoomId,
    error,
    connect,
    disconnect,
    fetchTiers,
    selectTier,
    joinAnte,
    leaveRoom,
    clearError,
  } = useCareerLobbyStore();

  const [countdown, setCountdown] = useState<number | null>(null);

  // Connect on mount if logged in
  useEffect(() => {
    if (isLoggedIn() && token && !socket) {
      connect(token);
    }
    
    return () => {
      // Don't disconnect on unmount - let the store manage this
    };
  }, [isLoggedIn, token]);

  // Countdown timer for auto-start
  useEffect(() => {
    if (currentRoom?.autoStartAt) {
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((currentRoom.autoStartAt! - Date.now()) / 1000));
        setCountdown(remaining);
      };
      
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [currentRoom?.autoStartAt]);

  // Navigate to game room when transition happens
  useEffect(() => {
    if (gameRoomId) {
      router.push(`/room/${gameRoomId}`);
    }
  }, [gameRoomId, router]);

  const handleJoinAnte = async (anteId: string) => {
    if (!token) return;
    await joinAnte(token, anteId);
  };

  const handleLeaveRoom = () => {
    if (!token) return;
    leaveRoom(token);
  };

  const selectedTier = tiers.find((t) => t.id === selectedTierId);

  // Not logged in
  if (!isLoggedIn()) {
    return (
      <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8 text-center">
        <p className="text-gray-400 mb-4">
          Sign in to access Career Mode matchmaking
        </p>
      </div>
    );
  }

  // Connecting
  if (isConnecting) {
    return (
      <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8 text-center">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Connecting to server...</p>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8 text-center">
        <p className="text-red-400 mb-4">Disconnected from server</p>
        <button
          onClick={() => token && connect(token)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
        >
          Reconnect
        </button>
      </div>
    );
  }

  // In a waiting room
  if (currentRoom) {
    return (
      <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
        {/* Room Header */}
        <div 
          className="p-4 border-b border-gray-700"
          style={{ backgroundColor: selectedTier?.color + "20" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                {selectedTier?.emoji} {selectedTier?.name}
              </h3>
              <p className="text-gray-400 text-sm">
                Ante: {currentRoom.ante} • Bet: {currentRoom.minBet}-{currentRoom.maxBet}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                {currentRoom.playerCount}/{currentRoom.maxPlayers}
              </div>
              <div className="text-gray-400 text-sm">Players</div>
            </div>
          </div>
        </div>

        {/* Players List */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Players in Room</h4>
          <div className="space-y-2">
            {currentRoom.players.map((player) => (
              <div 
                key={player.userId}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  player.userId === user?.id ? "bg-indigo-500/20" : "bg-gray-900/30"
                }`}
              >
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg border"
                  style={{ 
                    backgroundColor: player.avatarColor,
                    borderColor: player.avatarBorder,
                  }}
                >
                  {player.avatarEmoji}
                </div>
                <div className="flex-1">
                  <div className="font-medium">
                    {player.username}
                    {player.userId === user?.id && (
                      <span className="ml-2 text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Rating: {player.rating}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: currentRoom.maxPlayers - currentRoom.playerCount }).map((_, i) => (
              <div 
                key={`empty-${i}`}
                className="flex items-center gap-3 p-2 rounded-lg bg-gray-900/20 border border-dashed border-gray-700"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gray-800 text-gray-600">
                  ?
                </div>
                <div className="text-gray-500 text-sm">Waiting for player...</div>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-start Timer */}
        {countdown !== null && countdown > 0 && currentRoom.playerCount >= 2 && (
          <div className="px-4 pb-4">
            <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 text-center">
              <div className="text-green-400 text-sm mb-1">Game starting in</div>
              <div className="text-3xl font-bold text-green-300">{countdown}s</div>
            </div>
          </div>
        )}

        {/* Waiting message */}
        {currentRoom.playerCount < 2 && (
          <div className="px-4 pb-4">
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 text-center">
              <div className="text-yellow-400">
                Waiting for at least 2 players to start...
              </div>
            </div>
          </div>
        )}

        {/* Leave Button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLeaveRoom}
            className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
          >
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  // Tier selection (no room yet)
  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-400">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300">
            ✕
          </button>
        </div>
      )}

      {/* Player Info */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 flex items-center justify-between">
        <div>
          <span className="text-gray-400 text-sm">Your Rating</span>
          <div className="text-xl font-bold text-purple-400">{playerRating}</div>
        </div>
        <div>
          <span className="text-gray-400 text-sm">Bankroll</span>
          <div className="text-xl font-bold text-yellow-400">💰 {playerBankroll.toLocaleString()}</div>
        </div>
      </div>

      {/* Loading Tiers */}
      {isLoadingTiers ? (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-8 text-center">
          <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading leagues...</p>
        </div>
      ) : (
        <>
          {/* Tier Selection */}
          {!selectedTierId && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-300">Select a League</h3>
              <div className="grid gap-3">
                {tiers.map((tier) => (
                  <TierCard 
                    key={tier.id} 
                    tier={tier} 
                    playerRating={playerRating}
                    onSelect={() => selectTier(tier.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Ante Selection */}
          {selectedTierId && selectedTier && (
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => selectTier("")}
                className="text-gray-400 hover:text-white flex items-center gap-2"
              >
                ← Back to leagues
              </button>

              {/* Selected tier header */}
              <div 
                className="rounded-xl p-4 border"
                style={{ 
                  backgroundColor: selectedTier.color + "15",
                  borderColor: selectedTier.color + "50",
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedTier.emoji}</span>
                  <div>
                    <h3 className="text-xl font-bold">{selectedTier.name}</h3>
                    <p className="text-gray-400 text-sm">{selectedTier.description}</p>
                  </div>
                </div>
              </div>

              {/* Ante options */}
              <div className="space-y-3">
                <h4 className="text-lg font-bold text-gray-300">Choose Stakes</h4>
                {selectedTier.antes.map((ante) => (
                  <AnteCard
                    key={ante.id}
                    ante={ante}
                    tierColor={selectedTier.color}
                    isJoining={isJoiningRoom}
                    onJoin={() => handleJoinAnte(ante.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Tier Card Component
 */
function TierCard({ 
  tier, 
  playerRating, 
  onSelect 
}: { 
  tier: Tier; 
  playerRating: number;
  onSelect: () => void;
}) {
  const canAccess = tier.accessible;
  const ratingNeeded = tier.minRating - playerRating;

  return (
    <button
      onClick={canAccess ? onSelect : undefined}
      disabled={!canAccess}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        canAccess 
          ? "hover:scale-[1.02] cursor-pointer" 
          : "opacity-50 cursor-not-allowed"
      }`}
      style={{ 
        backgroundColor: canAccess ? tier.color + "15" : "transparent",
        borderColor: canAccess ? tier.color + "50" : "#374151",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{tier.emoji}</span>
          <div>
            <div className="font-bold">{tier.name}</div>
            <div className="text-sm text-gray-400">
              {tier.minRating}+ rating required
            </div>
          </div>
        </div>
        
        {canAccess ? (
          <div className="text-gray-400">→</div>
        ) : (
          <div className="text-red-400 text-sm">
            Need {ratingNeeded} more rating
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Ante Card Component
 */
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
      className="p-4 rounded-xl border bg-gray-900/30"
      style={{ borderColor: tierColor + "30" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-lg">{ante.label}</div>
          <div className="text-sm text-gray-400">
            Buy-in: {ante.buyIn.toLocaleString()} chips
          </div>
        </div>
        
        <button
          onClick={onJoin}
          disabled={!ante.canAfford || isJoining}
          className={`px-5 py-2 rounded-lg font-medium transition-all ${
            ante.canAfford && !isJoining
              ? "bg-green-600 hover:bg-green-500 text-white"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isJoining ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Joining...
            </span>
          ) : ante.canAfford ? (
            "Join"
          ) : (
            "Not enough chips"
          )}
        </button>
      </div>
    </div>
  );
}
