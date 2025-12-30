"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useRemoteGameStore, type AvatarConfig } from "@/store/remoteGameStore";
import { useAuthStore } from "@/store/authStore";
import dynamic from "next/dynamic";
import Chat from "../../../components/Chat";
import SoundControl from "../../../components/SoundControl";
import EmotePanel from "../../../components/EmotePanel";
import EmoteDisplay from "../../../components/EmoteDisplay";
import AvatarPicker, { Avatar } from "../../../components/AvatarPicker";
import { getDefaultAvatar } from "@/lib/avatars";

// Dynamic import to avoid SSR issues - Use new graphics version
const MultiplayerTable = dynamic(
  () => import("../../../components/MultiplayerTableGraphics"),
  { ssr: false }
);

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomIdParam = params.id as string;

  const {
    connect,
    connected,
    roomId,
    isHost,
    isSpectator,
    playersInRoom,
    spectatorsInRoom,
    gameStarted,
    state,
    playerId,
    playerName,
    playerAvatar,
    setIdentity,
    setAvatar,
    joinRoom,
    subscribeToCareerRoom,
    joinAsSpectator,
    leaveSpectator,
    startGame,
    leaveRoom,
    listRooms,
    lastError,
    clearError,
    sendIntent,
  } = useRemoteGameStore();

  const [starting, setStarting] = useState(false);
  const [localName, setLocalName] = useState("");
  const [joinFailed, setJoinFailed] = useState(false);
  const [showSpectatorOption, setShowSpectatorOption] = useState(false);
  // Check if this is a career game room
  const isCareerGame = roomIdParam?.startsWith("career-game-");
  
  // Get auth store for career mode
  const { user, isLoggedIn } = useAuthStore();

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Reset join state when room changes (e.g., navigating to a different room)
  useEffect(() => {
    setJoinFailed(false);
    setShowSpectatorOption(false);
  }, [roomIdParam]);

  // Load identity from auth store for career games, or sessionStorage for multiplayer
  useEffect(() => {
    if (isCareerGame && isLoggedIn() && user) {
      // Career mode: use auth store identity
      setIdentity(user.id, user.username);
      setLocalName(user.username);
      // Set avatar from user profile
      const avatar: AvatarConfig = {
        emoji: user.avatarEmoji || "🎮",
        color: user.avatarColor || "#4f46e5",
        borderColor: user.avatarBorder || "#818cf8",
      };
      setAvatar(avatar);
    } else {
      // Multiplayer: load from sessionStorage (per-tab, so multiple tabs can be different players)
      const savedId = sessionStorage.getItem("kouppi_player_id");
      const savedName = sessionStorage.getItem("kouppi_player_name");
      const savedAvatar = sessionStorage.getItem("kouppi_player_avatar");
      if (savedId && savedName) {
        setIdentity(savedId, savedName);
        setLocalName(savedName);
      }
      if (savedAvatar) {
        try {
          const avatar = JSON.parse(savedAvatar) as AvatarConfig;
          setAvatar(avatar);
        } catch {
          // Invalid avatar JSON, ignore
        }
      }
    }
  }, [isCareerGame, isLoggedIn, user, setIdentity, setAvatar]);

  // Join room if we have identity but not in the room yet
  // For career games, players are already added server-side, so we just need to subscribe to the room
  useEffect(() => {
    if (connected && playerId && playerName && !roomId && roomIdParam && !joinFailed) {
      const tryJoin = async () => {
        const decodedRoomId = decodeURIComponent(roomIdParam);
        
        // For career games, use subscribe (player already added server-side)
        if (isCareerGame) {
          const result = await subscribeToCareerRoom(decodedRoomId);
          if (!result.success) {
            console.error("[Career] Subscribe failed:", result.error);
            setJoinFailed(true);
          }
          return;
        }
        
        // For regular multiplayer, join normally
        const result = await joinRoom(decodedRoomId);
        if (!result.success) {
          setJoinFailed(true);
          // If room is full or game in progress, offer spectator mode
          if (result.error?.includes("full") || result.error?.includes("started") || result.error?.includes("progress")) {
            setShowSpectatorOption(true);
          }
        }
      };
      tryJoin();
    }
  }, [connected, playerId, playerName, roomId, roomIdParam, joinRoom, joinFailed]);

  // Redirect to lobby if room is closed (roomId becomes null while we had a room)
  useEffect(() => {
    // If we were in a room and it got closed, redirect to lobby
    if (connected && playerId && !roomId && lastError) {
      router.push("/lobby");
    }
  }, [connected, playerId, roomId, lastError, router]);

  // Refresh room list to detect changes
  useEffect(() => {
    if (!connected) return;
    listRooms();
    const interval = setInterval(listRooms, 2000);
    return () => clearInterval(interval);
  }, [connected, listRooms]);

  const handleSetName = () => {
    if (!localName.trim()) return;
    const id = playerId || `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setIdentity(id, localName.trim());
    sessionStorage.setItem("kouppi_player_id", id);
    sessionStorage.setItem("kouppi_player_name", localName.trim());
    
    // Set a random avatar if none exists
    if (!playerAvatar) {
      const newAvatar = getDefaultAvatar();
      setAvatar(newAvatar);
      sessionStorage.setItem("kouppi_player_avatar", JSON.stringify(newAvatar));
    }
  };
  
  const handleAvatarChange = (newAvatar: AvatarConfig) => {
    setAvatar(newAvatar);
    sessionStorage.setItem("kouppi_player_avatar", JSON.stringify(newAvatar));
  };

  const handleStartGame = async () => {
    setStarting(true);
    clearError();
    const result = await startGame();
    setStarting(false);
    if (!result.success) {
      alert(`Failed to start: ${result.error}`);
    }
  };

  const handleLeave = () => {
    if (isSpectator) {
      leaveSpectator();
    } else {
      leaveRoom();
    }
    router.push("/lobby");
  };

  const handleJoinAsSpectator = async () => {
    clearError();
    const result = await joinAsSpectator(decodeURIComponent(roomIdParam));
    if (!result.success) {
      alert(`Failed to join as spectator: ${result.error}`);
    }
  };

  // Need to set name first (only for non-career multiplayer games)
  if (!playerName && !isCareerGame) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-semibold mb-4">Enter Your Name</h2>
          <p className="text-gray-400 mb-4">To join room: <strong>{decodeURIComponent(roomIdParam)}</strong></p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              className="text-black rounded px-3 py-2 flex-1"
              placeholder="Your name..."
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              autoFocus
            />
            <button
              className="btn bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
              onClick={handleSetName}
              disabled={!localName.trim()}
            >
              Join
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Career game: Show loading while waiting to connect and receive state
  if (isCareerGame && (!connected || !state)) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full text-center">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Joining Career Game...</h2>
          <p className="text-gray-400">Connecting to game room</p>
          {lastError && (
            <p className="mt-4 text-red-400 text-sm">{lastError}</p>
          )}
        </div>
      </main>
    );
  }

  // Game started - show multiplayer game UI (players and spectators)
  if (gameStarted && state) {
    return (
      <>
        <MultiplayerTable />
        <Chat />
        <SoundControl />
        {!isSpectator && <EmotePanel />}
        <EmoteDisplay />
        {/* Spectator badge */}
        {isSpectator && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-purple-600/90 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
              👁️ Spectating
              <button
                onClick={handleLeave}
                className="ml-2 bg-purple-800 hover:bg-purple-700 px-2 py-0.5 rounded text-xs"
              >
                Leave
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Show spectator option if join failed and spectating is available
  if (showSpectatorOption && !roomId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">Game in Progress</h2>
          <p className="text-gray-400 mb-6">
            This game has already started. Would you like to watch as a spectator?
          </p>
          <div className="flex flex-col gap-3">
            <button
              className="btn bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg text-lg font-semibold"
              onClick={handleJoinAsSpectator}
            >
              👁️ Watch as Spectator
            </button>
            <button
              className="btn bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
              onClick={() => router.push("/lobby")}
            >
              Back to Lobby
            </button>
          </div>
          {lastError && (
            <div className="mt-4 text-sm text-red-400">
              {lastError}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Waiting room
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Room: {decodeURIComponent(roomIdParam)}</h1>
          <span
            className={`px-3 py-1 rounded-full text-sm ${
              connected ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* Error */}
        {lastError && (
          <div className="bg-red-600/30 border border-red-500 rounded-lg p-3 mb-4">
            ⚠️ {lastError}
          </div>
        )}

        {/* Waiting Room Card */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Waiting for players...</h2>
            {isHost && (
              <span className="bg-yellow-600 px-3 py-1 rounded-full text-sm">
                👑 You are the host
              </span>
            )}
          </div>

          {/* Players List */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Players ({playersInRoom.length})
            </h3>
            <div className="space-y-2">
              {playersInRoom.length === 0 ? (
                <div className="text-gray-500 py-4 text-center">
                  Waiting for players to join...
                </div>
              ) : (
                playersInRoom.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between bg-gray-700 rounded px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar avatar={player.avatar} size="sm" />
                      <span className="font-medium">{player.name}</span>
                      {player.id === playerId && (
                        <span className="text-xs text-green-400">(you)</span>
                      )}
                    </div>
                    {index === 0 && (
                      <span className="text-xs text-yellow-400">👑 Host</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Spectators */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Spectators ({spectatorsInRoom.length})
            </h3>
            {spectatorsInRoom.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {spectatorsInRoom.map((spectator) => (
                  <div
                    key={spectator.id}
                    className="flex items-center gap-2 bg-purple-900/30 border border-purple-500/30 rounded px-3 py-1.5"
                  >
                    <span className="text-purple-400">👁️</span>
                    <span className="text-sm text-gray-300">{spectator.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No spectators</div>
            )}
          </div>

          {/* Minimum players notice */}
          {playersInRoom.length < 2 && (
            <div className="bg-blue-600/20 border border-blue-500 rounded p-3 mb-4 text-sm">
              ℹ️ At least 2 players are required to start the game
            </div>
          )}
          
          {/* Your Avatar - Customization */}
          <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-1">Your Avatar</h3>
                <p className="text-xs text-gray-500">Click to customize</p>
              </div>
              <AvatarPicker
                currentAvatar={playerAvatar}
                onSelect={handleAvatarChange}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {isHost ? (
              <button
                className="btn bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-lg font-semibold disabled:opacity-50"
                onClick={handleStartGame}
                disabled={playersInRoom.length < 2 || starting}
              >
                {starting ? "Starting..." : "🎮 Start Game"}
              </button>
            ) : (
              <div className="text-gray-400">
                Waiting for host to start the game...
              </div>
            )}
            <button
              className="btn bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
              onClick={handleLeave}
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Room Link */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Share this link to invite players:
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm"
              value={typeof window !== "undefined" ? window.location.href : ""}
            />
            <button
              className="btn bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied!");
              }}
            >
              Copy
            </button>
          </div>
        </div>

        {/* Back to Lobby */}
        <div className="mt-6 text-center">
          <a href="/lobby" className="text-blue-400 hover:underline">
            ← Back to Lobby
          </a>
        </div>
      </div>
      
      {/* Chat */}
      <Chat />
    </main>
  );
}
