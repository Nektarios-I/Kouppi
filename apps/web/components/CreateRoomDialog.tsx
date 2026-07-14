"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRemoteGameStore, RoomConfig } from "@/store/remoteGameStore";
import { HudButton } from "@/components/game/HudButton";
import { LobbyInput, LobbyField, LobbyAlert } from "@/components/game/LobbyUI";

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
    spectatorsAllowed: true,
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm grid place-items-center z-50 p-4">
      <div className="game-modal-panel w-full max-w-lg relative">
        <div className="game-modal-header">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-gold-light tracking-wide">
            Create New Room
          </h2>
          <p className="text-gray-400 text-sm font-ui mt-1">Set up a table for your friends</p>
        </div>

        {error && (
          <LobbyAlert variant="error" onDismiss={() => setError(null)}>
            {error}
          </LobbyAlert>
        )}

        <div className="space-y-4">
          <LobbyField label="Room name">
            <LobbyInput
              placeholder="my-cool-room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1.5 font-ui">
              Other players will use this to find your room
            </p>
          </LobbyField>

          <LobbyField label="Password (optional)">
            <div className="relative">
              <LobbyInput
                type={showPassword ? "text" : "password"}
                placeholder="Leave empty for public room"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-sm"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 font-ui">
              {password.trim() ? "This room will be private" : "Public room — anyone can join"}
            </p>
          </LobbyField>

          <div className="grid grid-cols-2 gap-4">
            <LobbyField label="Max players">
              <LobbyInput
                type="number"
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
            </LobbyField>
            <LobbyField label="Ante">
              <LobbyInput
                type="number"
                min={1}
                value={config.ante}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    ante: Math.max(1, Number(e.target.value)),
                  }))
                }
              />
            </LobbyField>
          </div>

          <LobbyField label="Starting bankroll">
            <LobbyInput
              type="number"
              min={10}
              value={config.startingBankroll}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  startingBankroll: Math.max(10, Number(e.target.value)),
                }))
              }
            />
          </LobbyField>

          <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer lobby-player-row">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-gold"
              checked={config.spectatorsAllowed ?? true}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  spectatorsAllowed: e.target.checked,
                }))
              }
            />
            <span className="font-ui text-sm text-gray-300">Allow spectators</span>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer lobby-player-row">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-gold"
              checked={config.shistri?.enabled ?? true}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  shistri: { ...(c.shistri || { percent: 5, minChip: 1 }), enabled: e.target.checked },
                }))
              }
            />
            <span className="font-ui text-sm text-gray-300">Enable SHISTRI</span>
          </label>
        </div>

        <div className="game-modal-actions mt-6">
          <HudButton variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </HudButton>
          <HudButton
            variant="success"
            onClick={handleCreate}
            disabled={creating || !roomId.trim()}
          >
            {creating ? "Creating…" : "Create Room"}
          </HudButton>
        </div>
      </div>
    </div>
  );
}
