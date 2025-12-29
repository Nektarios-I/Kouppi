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

    const result = await createRoom(roomId.trim(), config);

    setCreating(false);

    if (result.success) {
      onClose();
      router.push(`/room/${encodeURIComponent(roomId.trim())}`);
    } else {
      setError(result.error || "Failed to create room");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg text-white">
        <h2 className="text-2xl font-bold mb-4">Create New Room</h2>

        {error && (
          <div className="bg-red-600/30 border border-red-500 rounded p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Room ID */}
          <div>
            <label className="block text-sm font-medium mb-1">Room Name</label>
            <input
              type="text"
              className="w-full text-black rounded px-3 py-2"
              placeholder="my-cool-room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Other players will use this to find your room
            </p>
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Max Players
            </label>
            <input
              type="number"
              className="w-full text-black rounded px-3 py-2"
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

          {/* Starting Bankroll */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Starting Bankroll
            </label>
            <input
              type="number"
              className="w-full text-black rounded px-3 py-2"
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

          {/* Ante */}
          <div>
            <label className="block text-sm font-medium mb-1">Ante</label>
            <input
              type="number"
              className="w-full text-black rounded px-3 py-2"
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

          {/* Shistri */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="shistri"
              checked={config.shistri?.enabled ?? true}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  shistri: { ...(c.shistri || { percent: 5, minChip: 1 }), enabled: e.target.checked },
                }))
              }
            />
            <label htmlFor="shistri">Enable SHISTRI</label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
            onClick={handleCreate}
            disabled={creating || !roomId.trim()}
          >
            {creating ? "Creating..." : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}
