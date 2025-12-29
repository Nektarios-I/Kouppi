"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import CreateRoomDialog from "../../components/CreateRoomDialog";

export default function LobbyPage() {
  const router = useRouter();
  const {
    connect,
    connected,
    rooms,
    listRooms,
    playerId,
    playerName,
    setIdentity,
    joinRoom,
    lastError,
    clearError,
  } = useRemoteGameStore();

  const [joinRoomId, setJoinRoomId] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [localName, setLocalName] = useState("");
  const [joining, setJoining] = useState(false);

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Refresh room list periodically
  useEffect(() => {
    if (!connected) return;
    listRooms();
    const interval = setInterval(listRooms, 3000);
    return () => clearInterval(interval);
  }, [connected, listRooms]);

  // Load saved identity from sessionStorage (per-tab, so multiple tabs can be different players)
  useEffect(() => {
    const savedId = sessionStorage.getItem("kouppi_player_id");
    const savedName = sessionStorage.getItem("kouppi_player_name");
    if (savedId && savedName) {
      setIdentity(savedId, savedName);
      setLocalName(savedName);
    }
  }, [setIdentity]);

  const handleSetName = () => {
    if (!localName.trim()) return;
    const id = playerId || `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setIdentity(id, localName.trim());
    sessionStorage.setItem("kouppi_player_id", id);
    sessionStorage.setItem("kouppi_player_name", localName.trim());
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!playerId || !playerName) {
      alert("Please set your name first");
      return;
    }
    setJoining(true);
    clearError();
    const result = await joinRoom(roomId);
    setJoining(false);
    if (result.success) {
      router.push(`/room/${encodeURIComponent(roomId)}`);
    } else {
      alert(`Failed to join: ${result.error}`);
    }
  };

  const handleCreateRoom = () => {
    if (!playerId || !playerName) {
      alert("Please set your name first");
      return;
    }
    setShowCreateDialog(true);
  };

  const waitingRooms = rooms.filter((r) => !r.started);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">KOUPPI Lobby</h1>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                connected ? "bg-green-600" : "bg-red-600"
              }`}
            >
              {connected ? "🟢 Connected" : "🔴 Disconnected"}
            </span>
            <button
              className="btn bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              onClick={() => listRooms()}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Identity Section */}
        <div className="card bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Your Identity</h2>
          {playerName ? (
            <div className="flex items-center gap-4">
              <span className="text-lg">
                Playing as: <strong>{playerName}</strong>
              </span>
              <button
                className="text-sm text-blue-400 hover:underline"
                onClick={() => setIdentity("", "")}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="text"
                className="text-black rounded px-3 py-2 flex-1"
                placeholder="Enter your name..."
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              />
              <button
                className="btn bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
                onClick={handleSetName}
                disabled={!localName.trim()}
              >
                Set Name
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              className="btn bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-lg font-semibold disabled:opacity-50"
              onClick={handleCreateRoom}
              disabled={!playerName}
            >
              ➕ Create Room
            </button>

            <div className="flex items-center gap-2">
              <input
                type="text"
                className="text-black rounded px-3 py-2"
                placeholder="Room ID to join..."
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
              />
              <button
                className="btn bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
                onClick={() => handleJoinRoom(joinRoomId)}
                disabled={!joinRoomId.trim() || !playerName || joining}
              >
                {joining ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {lastError && (
          <div className="bg-red-600/30 border border-red-500 rounded-lg p-3 mb-6 flex items-center justify-between">
            <span>⚠️ {lastError}</span>
            <button className="text-sm hover:underline" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}

        {/* Room List */}
        <div className="card bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">
            Waiting Rooms ({waitingRooms.length})
          </h2>

          {waitingRooms.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-lg">No rooms available</p>
              <p className="text-sm mt-2">Create a room to start playing!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-semibold">{room.id}</div>
                    <div className="text-sm text-gray-400">
                      {room.playerCount} / {room.maxPlayers} players
                    </div>
                    {room.hostId && (
                      <div className="text-xs text-blue-400">
                        Host: {room.hostId.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                  <button
                    className="btn bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={
                      !playerName ||
                      room.playerCount >= room.maxPlayers ||
                      joining
                    }
                  >
                    {room.playerCount >= room.maxPlayers ? "Full" : "Join"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <a href="/" className="text-blue-400 hover:underline">
            ← Back to Home
          </a>
        </div>
      </div>

      {/* Create Room Dialog */}
      <CreateRoomDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </main>
  );
}
