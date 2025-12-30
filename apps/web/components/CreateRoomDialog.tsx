"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRemoteGameStore, RoomConfig } from "@/store/remoteGameStore";

export default function CreateRoomDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { createRoom, playerId, playerName } = useRemoteGameStore();

  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [config, setConfig] = useState<Partial<RoomConfig>>({
    maxPlayers: 8,
    ante: 10,
    startingBankroll: 100,
    shistri: { enabled: true, percent: 5, minChip: 1 },
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = async () => {
    if (!roomId.trim()) {
      setError("Room ID is required");
      return;
    }
    if (roomId.trim().length < 3) {
      setError("Room ID must be at least 3 characters");
      return;
    }
    if (!playerId || !playerName) {
      setError("Please set your name first");
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createRoom(roomId.trim(), config, password.trim() || undefined);

    setCreating(false);

    if (result.success) {
      onClose();
      router.push(`/room/${encodeURIComponent(roomId.trim())}`);
    } else {
      setError(result.error || "Failed to create room");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-2xl p-6 w-full max-w-lg text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f1922 100%)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1)",
        }}
      >
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-4 right-4 text-4xl opacity-10">🎰</div>
          <div className="absolute bottom-4 left-4 text-3xl opacity-10">🃏</div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🎲</span>
            <h2 
              className="text-2xl font-bold"
              style={{
                background: "linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Create New Room
            </h2>
          </div>

          {error && (
            <div 
              className="rounded-xl p-3 mb-4 text-sm flex items-center gap-2"
              style={{
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.1) 100%)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              <span>⚠️</span>
              <span className="text-red-400">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Room ID */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                <span className="flex items-center gap-2">
                  <span>🏷️</span>
                  Room Name
                </span>
              </label>
              <input
                type="text"
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                placeholder="my-cool-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1.5 ml-1">
                Other players will use this to find your room
              </p>
            </div>

            {/* Password (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                <span className="flex items-center gap-2">
                  <span>🔒</span>
                  Password (Optional)
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Leave empty for public room"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 ml-1">
                {password.trim() ? "🔐 This room will be private" : "Public room - anyone can join"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Max Players */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  <span className="flex items-center gap-2">
                    <span>👥</span>
                    Max Players
                  </span>
                </label>
                <input
                  type="number"
                  className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  min={2}
                  max={20}
                  value={config.maxPlayers}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      maxPlayers: Math.max(2, Math.min(20, Number(e.target.value))),
                    }))
                  }
                />
              </div>

              {/* Ante */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  <span className="flex items-center gap-2">
                    <span>💰</span>
                    Ante
                  </span>
                </label>
                <input
                  type="number"
                  className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  min={1}
                  value={config.ante}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      ante: Math.max(1, Number(e.target.value)),
                    }))
                  }
                />
              </div>
            </div>

            {/* Starting Bankroll */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                <span className="flex items-center gap-2">
                  <span>🏦</span>
                  Starting Bankroll
                </span>
              </label>
              <input
                type="number"
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                min={10}
                value={config.startingBankroll}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    startingBankroll: Math.max(10, Number(e.target.value)),
                  }))
                }
              />
            </div>

            {/* Shistri */}
            <div 
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{
                background: "linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)",
                border: "1px solid rgba(168, 85, 247, 0.2)",
              }}
            >
              <input
                type="checkbox"
                id="shistri"
                className="w-5 h-5 rounded accent-purple-500"
                checked={config.shistri?.enabled ?? true}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    shistri: { ...(c.shistri || { percent: 5, minChip: 1 }), enabled: e.target.checked },
                  }))
                }
              />
              <label htmlFor="shistri" className="flex items-center gap-2 text-purple-300 cursor-pointer">
                <span>✨</span>
                <span>Enable SHISTRI</span>
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              className="px-5 py-2.5 rounded-xl font-medium transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(75, 85, 99, 0.5) 0%, rgba(55, 65, 81, 0.5) 100%)",
                border: "1px solid rgba(75, 85, 99, 0.3)",
              }}
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              className="px-6 py-2.5 rounded-xl font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: roomId.trim() 
                  ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                  : "rgba(34, 197, 94, 0.3)",
                boxShadow: roomId.trim() ? "0 4px 15px rgba(34, 197, 94, 0.4)" : "none",
              }}
              onClick={handleCreate}
              disabled={creating || !roomId.trim()}
            >
              {creating ? "⏳ Creating..." : "🎮 Create Room"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
