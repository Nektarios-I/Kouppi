"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues
const MultiplayerTable = dynamic(
  () => import("../../../components/MultiplayerTable"),
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
    playersInRoom,
    gameStarted,
    state,
    playerId,
    playerName,
    setIdentity,
    joinRoom,
    startGame,
    leaveRoom,
    listRooms,
    lastError,
    clearError,
    sendIntent,
  } = useRemoteGameStore();

  const [starting, setStarting] = useState(false);
  const [localName, setLocalName] = useState("");

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Load identity from sessionStorage (per-tab, so multiple tabs can be different players)
  useEffect(() => {
    const savedId = sessionStorage.getItem("kouppi_player_id");
    const savedName = sessionStorage.getItem("kouppi_player_name");
    if (savedId && savedName) {
      setIdentity(savedId, savedName);
      setLocalName(savedName);
    }
  }, [setIdentity]);

  // Join room if we have identity but not in the room yet
  useEffect(() => {
    if (connected && playerId && playerName && !roomId && roomIdParam) {
      joinRoom(decodeURIComponent(roomIdParam));
    }
  }, [connected, playerId, playerName, roomId, roomIdParam, joinRoom]);

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
    leaveRoom();
    router.push("/lobby");
  };

  // Need to set name first
  if (!playerName) {
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

  // Game started - show multiplayer game UI
  if (gameStarted && state) {
    return <MultiplayerTable />;
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
                      <span className="text-gray-400">#{index + 1}</span>
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

          {/* Minimum players notice */}
          {playersInRoom.length < 2 && (
            <div className="bg-blue-600/20 border border-blue-500 rounded p-3 mb-4 text-sm">
              ℹ️ At least 2 players are required to start the game
            </div>
          )}

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
    </main>
  );
}
