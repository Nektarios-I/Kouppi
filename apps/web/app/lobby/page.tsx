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
    joinAsSpectator,
    clearRoomState,
    lastError,
    clearError,
  } = useRemoteGameStore();

  const [joinRoomId, setJoinRoomId] = useState("");
  const [spectateSearch, setSpectateSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [localName, setLocalName] = useState("");
  const [joining, setJoining] = useState(false);
  const [spectating, setSpectating] = useState(false);
  
  // Password modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalRoomId, setPasswordModalRoomId] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Connect on mount and clear any lingering room state
  useEffect(() => {
    connect();
    // Clear any previous room state when returning to lobby
    clearRoomState();
  }, [connect, clearRoomState]);

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

  const handleJoinRoom = async (roomId: string, password?: string) => {
    if (!playerId || !playerName) {
      alert("Please set your name first");
      return;
    }
    
    // Check if room is private and password not provided
    const targetRoom = rooms.find(r => r.id === roomId);
    if (targetRoom?.isPrivate && !password) {
      setPasswordModalRoomId(roomId);
      setPasswordInput("");
      setPasswordError(null);
      setPasswordModalOpen(true);
      return;
    }
    
    setJoining(true);
    clearError();
    const result = await joinRoom(roomId, password);
    setJoining(false);
    
    if (result.success) {
      setPasswordModalOpen(false);
      router.push(`/room/${encodeURIComponent(roomId)}`);
    } else {
      // Check for wrong password error
      if ((result as any).code === "wrong_password" || result.error?.toLowerCase().includes("password")) {
        if (passwordModalOpen) {
          setPasswordError("Incorrect password");
        } else {
          // Room might be private but we didn't know - open modal
          setPasswordModalRoomId(roomId);
          setPasswordInput("");
          setPasswordError("This room requires a password");
          setPasswordModalOpen(true);
        }
      } else {
        alert(`Failed to join: ${result.error}`);
      }
    }
  };
  
  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) {
      setPasswordError("Please enter a password");
      return;
    }
    handleJoinRoom(passwordModalRoomId, passwordInput.trim());
  };

  const handleCreateRoom = () => {
    if (!playerId || !playerName) {
      alert("Please set your name first");
      return;
    }
    setShowCreateDialog(true);
  };

  const handleSpectateRoom = async (roomId: string) => {
    if (!playerId || !playerName) {
      alert("Please set your name first");
      return;
    }
    setSpectating(true);
    clearError();
    const result = await joinAsSpectator(roomId);
    setSpectating(false);
    if (result.success) {
      router.push(`/room/${encodeURIComponent(roomId)}`);
    } else {
      alert(`Failed to spectate: ${result.error}`);
    }
  };

  const waitingRooms = rooms.filter((r) => !r.started);
  
  // Active rooms that allow spectators (games in progress)
  const spectatorRooms = rooms.filter((r) => 
    r.started && 
    r.spectatorsAllowed && 
    r.playerCount > 0
  );
  
  // Filter spectator rooms by search
  const filteredSpectatorRooms = spectateSearch.trim() 
    ? spectatorRooms.filter(r => 
        r.id.toLowerCase().includes(spectateSearch.toLowerCase())
      )
    : spectatorRooms;

  return (
    <main 
      className="min-h-screen text-white relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #0f1922 100%)",
      }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 text-6xl opacity-10 rotate-12">🂡</div>
        <div className="absolute top-20 right-20 text-5xl opacity-10 -rotate-12">🂮</div>
        <div className="absolute bottom-20 left-20 text-5xl opacity-10 rotate-6">🃁</div>
        <div className="absolute bottom-10 right-10 text-6xl opacity-10 -rotate-6">🃎</div>
        <div className="absolute top-1/3 left-1/4 text-4xl opacity-5 rotate-45">🎰</div>
        <div className="absolute top-1/2 right-1/4 text-4xl opacity-5 -rotate-45">🎲</div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="text-5xl">🎰</span>
            <h1 
              className="text-5xl font-bold tracking-wider"
              style={{
                background: "linear-gradient(135deg, #ffd700 0%, #ffaa00 50%, #ff8c00 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              KOUPPI
            </h1>
            <span className="text-5xl">🎰</span>
          </div>
          <p className="text-gray-400 text-lg">The Ultimate Card Game Experience</p>
          
          <div className="mt-4 flex items-center justify-center gap-4">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                connected 
                  ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`}></span>
              {connected ? "Connected" : "Disconnected"}
            </span>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
              onClick={() => listRooms()}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Identity Section */}
        <div 
          className="rounded-2xl p-6 mb-6 backdrop-blur-sm"
          style={{
            background: "linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 140, 0, 0.05) 100%)",
            border: "1px solid rgba(255, 215, 0, 0.2)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">👤</span>
            <h2 className="text-xl font-bold text-yellow-400">Your Identity</h2>
          </div>
          
          {playerName ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                    boxShadow: "0 4px 15px rgba(59, 130, 246, 0.4)",
                  }}
                >
                  {playerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{playerName}</div>
                  <div className="text-sm text-gray-400">Ready to play</div>
                </div>
              </div>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 transition-all"
                onClick={() => setIdentity("", "")}
              >
                Change Name
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="text"
                className="flex-1 bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                placeholder="Enter your name to join..."
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              />
              <button
                className="px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
                style={{
                  background: localName.trim() 
                    ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                    : "rgba(34, 197, 94, 0.3)",
                  boxShadow: localName.trim() ? "0 4px 15px rgba(34, 197, 94, 0.4)" : "none",
                }}
                onClick={handleSetName}
                disabled={!localName.trim()}
              >
                Set Name
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div 
          className="rounded-2xl p-6 mb-6 backdrop-blur-sm"
          style={{
            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎮</span>
            <h2 className="text-xl font-bold text-green-400">Quick Actions</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <button
              className="px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: playerName 
                  ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                  : "rgba(34, 197, 94, 0.3)",
                boxShadow: playerName ? "0 4px 20px rgba(34, 197, 94, 0.4)" : "none",
              }}
              onClick={handleCreateRoom}
              disabled={!playerName}
            >
              🎲 Create Room
            </button>

            <div className="flex-1 flex items-center gap-3">
              <span className="text-gray-400">or</span>
              <input
                type="text"
                className="flex-1 bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                placeholder="Enter Room ID to join..."
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinRoomId.trim() && handleJoinRoom(joinRoomId)}
              />
              <button
                className="px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  background: joinRoomId.trim() && playerName
                    ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                    : "rgba(59, 130, 246, 0.3)",
                  boxShadow: joinRoomId.trim() && playerName ? "0 4px 15px rgba(59, 130, 246, 0.4)" : "none",
                }}
                onClick={() => handleJoinRoom(joinRoomId)}
                disabled={!joinRoomId.trim() || !playerName || joining}
              >
                {joining ? "⏳ Joining..." : "🚪 Join"}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {lastError && (
          <div 
            className="rounded-xl p-4 mb-6 flex items-center justify-between backdrop-blur-sm"
            style={{
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.1) 100%)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <span className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="text-red-400">{lastError}</span>
            </span>
            <button 
              className="px-3 py-1 rounded-lg text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
              onClick={clearError}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Room List */}
        <div 
          className="rounded-2xl p-6 backdrop-blur-sm"
          style={{
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏠</span>
              <h2 className="text-xl font-bold text-indigo-400">Available Rooms</h2>
            </div>
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
            >
              {waitingRooms.length} room{waitingRooms.length !== 1 ? "s" : ""}
            </span>
          </div>

          {waitingRooms.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4 opacity-50">🎴</div>
              <p className="text-lg text-gray-400">No rooms available</p>
              <p className="text-sm text-gray-500 mt-2">Create a room to start playing!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between rounded-xl p-4 transition-all hover:scale-[1.02]"
                  style={{
                    background: "linear-gradient(135deg, rgba(55, 65, 81, 0.5) 0%, rgba(31, 41, 55, 0.5) 100%)",
                    border: "1px solid rgba(75, 85, 99, 0.3)",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                      style={{
                        background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                        boxShadow: "0 4px 15px rgba(99, 102, 241, 0.3)",
                      }}
                    >
                      🎰
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white flex items-center gap-2">
                        {room.id}
                        {room.isPrivate && (
                          <span className="text-yellow-500" title="Password protected">🔒</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <span>👥</span>
                          {room.playerCount} / {room.maxPlayers}
                        </span>
                        {room.hostId && (
                          <span className="text-indigo-400">
                            Host: {room.hostId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className="px-6 py-2 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: playerName && room.playerCount < room.maxPlayers
                        ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                        : "rgba(59, 130, 246, 0.3)",
                      boxShadow: playerName && room.playerCount < room.maxPlayers 
                        ? "0 4px 15px rgba(59, 130, 246, 0.4)" 
                        : "none",
                    }}
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={
                      !playerName ||
                      room.playerCount >= room.maxPlayers ||
                      joining
                    }
                  >
                    {room.playerCount >= room.maxPlayers ? "🚫 Full" : "🚪 Join"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spectator Section */}
        <div 
          className="rounded-2xl p-6 backdrop-blur-sm mt-6"
          style={{
            background: "linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)",
            border: "1px solid rgba(168, 85, 247, 0.2)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👁️</span>
              <h2 className="text-xl font-bold text-purple-400">Watch Games</h2>
            </div>
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30"
            >
              {spectatorRooms.length} active game{spectatorRooms.length !== 1 ? "s" : ""}
            </span>
          </div>
          
          <p className="text-gray-400 text-sm mb-4">
            Watch ongoing games as a spectator. Learn strategies and enjoy the action!
          </p>
          
          {/* Search bar */}
          <div className="mb-4">
            <input
              type="text"
              className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
              placeholder="🔍 Search for a room to spectate..."
              value={spectateSearch}
              onChange={(e) => setSpectateSearch(e.target.value)}
            />
          </div>

          {filteredSpectatorRooms.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3 opacity-50">🎬</div>
              <p className="text-gray-400">
                {spectateSearch.trim() 
                  ? "No matching games found" 
                  : "No games available to spectate"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Games with spectators enabled will appear here when in progress
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSpectatorRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between rounded-xl p-4 transition-all hover:scale-[1.02]"
                  style={{
                    background: "linear-gradient(135deg, rgba(55, 65, 81, 0.5) 0%, rgba(31, 41, 55, 0.5) 100%)",
                    border: "1px solid rgba(75, 85, 99, 0.3)",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl relative"
                      style={{
                        background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                        boxShadow: "0 4px 15px rgba(168, 85, 247, 0.3)",
                      }}
                    >
                      🎰
                      <span className="absolute -top-1 -right-1 bg-green-500 w-3 h-3 rounded-full animate-pulse" title="Live"></span>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white flex items-center gap-2">
                        {room.id}
                        {room.isPrivate && (
                          <span className="text-yellow-500" title="Password protected">🔒</span>
                        )}
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                          LIVE
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <span>👥</span>
                          {room.playerCount} player{room.playerCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1 text-purple-400">
                          <span>👁️</span>
                          {room.spectatorCount ?? 0} watching
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="px-6 py-2 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: playerName
                        ? "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)"
                        : "rgba(168, 85, 247, 0.3)",
                      boxShadow: playerName 
                        ? "0 4px 15px rgba(168, 85, 247, 0.4)" 
                        : "none",
                    }}
                    onClick={() => handleSpectateRoom(room.id)}
                    disabled={!playerName || spectating}
                  >
                    {spectating ? "⏳..." : "👁️ Watch"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <a 
            href="/" 
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, rgba(75, 85, 99, 0.3) 0%, rgba(55, 65, 81, 0.3) 100%)",
              border: "1px solid rgba(75, 85, 99, 0.3)",
            }}
          >
            <span>←</span>
            <span>Back to Home</span>
          </a>
        </div>
      </div>

      {/* Create Room Dialog */}
      <CreateRoomDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
      
      {/* Password Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 w-full max-w-md text-white relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f1922 100%)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🔐</span>
              <h2 
                className="text-xl font-bold"
                style={{
                  background: "linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Private Room
              </h2>
            </div>
            
            <p className="text-gray-400 mb-4">
              Room <span className="text-white font-semibold">{passwordModalRoomId}</span> is password protected.
            </p>
            
            {passwordError && (
              <div 
                className="rounded-xl p-3 mb-4 text-sm flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.1) 100%)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <span>⚠️</span>
                <span className="text-red-400">{passwordError}</span>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-300">
                <span className="flex items-center gap-2">
                  <span>🔑</span>
                  Enter Password
                </span>
              </label>
              <input
                type="password"
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                placeholder="Room password..."
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                autoFocus
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                className="px-5 py-2.5 rounded-xl font-medium transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, rgba(75, 85, 99, 0.5) 0%, rgba(55, 65, 81, 0.5) 100%)",
                  border: "1px solid rgba(75, 85, 99, 0.3)",
                }}
                onClick={() => {
                  setPasswordModalOpen(false);
                  setPasswordInput("");
                  setPasswordError(null);
                }}
                disabled={joining}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2.5 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  background: passwordInput.trim() 
                    ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                    : "rgba(59, 130, 246, 0.3)",
                  boxShadow: passwordInput.trim() ? "0 4px 15px rgba(59, 130, 246, 0.4)" : "none",
                }}
                onClick={handlePasswordSubmit}
                disabled={joining || !passwordInput.trim()}
              >
                {joining ? "⏳ Joining..." : "🚪 Join Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
