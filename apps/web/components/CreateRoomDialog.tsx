"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import { HudButton } from "@/components/game/HudButton";
import { LobbyInput, LobbyField, LobbyAlert } from "@/components/game/LobbyUI";
import { ROOM_PRESETS, getRoomPreset, type RoomPresetId } from "@/lib/roomPresets";

function generateClientCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function CreateRoomDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { createRoom, playerId, playerName } = useRemoteGameStore();

  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [presetId, setPresetId] = useState<RoomPresetId>("classic");
  const [listedInLobby, setListedInLobby] = useState(true);
  const [config, setConfig] = useState(getRoomPreset("classic").config);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !roomCode) {
      setRoomCode(generateClientCode());
    }
  }, [open, roomCode]);

  useEffect(() => {
    if (password.trim()) setListedInLobby(false);
  }, [password]);

  const applyPreset = (id: RoomPresetId) => {
    setPresetId(id);
    setConfig(getRoomPreset(id).config);
  };

  if (!open) return null;

  const handleCreate = async () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Room code must be at least 4 characters");
      return;
    }
    if (!playerId || !playerName) {
      setError("Please set your name first");
      return;
    }

    setCreating(true);
    setError(null);

    const preset = getRoomPreset(presetId);
    const result = await createRoom(
      config,
      password.trim() || undefined,
      code,
      {
        listedInLobby: password.trim() ? listedInLobby : true,
        presetLabel: preset.label,
        turnTimeout: config.turnTimeout,
      }
    );

    setCreating(false);

    if (result.success) {
      onClose();
      router.push(`/room/${encodeURIComponent(result.code || code)}`);
    } else {
      setError(result.error || "Failed to create room");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm grid place-items-center z-50 p-4">
      <div className="game-modal-panel w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
        <div className="game-modal-header">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-gold-light tracking-wide">
            Create New Room
          </h2>
          <p className="text-gray-400 text-sm font-ui mt-1">Share the code with friends to join</p>
        </div>

        {error && (
          <LobbyAlert variant="error" onDismiss={() => setError(null)}>
            {error}
          </LobbyAlert>
        )}

        <div className="space-y-4">
          <LobbyField label="Table preset">
            <div className="grid grid-cols-3 gap-2">
              {ROOM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`rounded-xl border px-2 py-2 text-left font-ui text-xs transition-colors ${
                    presetId === p.id
                      ? "border-gold/50 bg-gold/10 text-gold-light"
                      : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20"
                  }`}
                >
                  <span className="block font-semibold text-sm">{p.label}</span>
                  <span className="opacity-80">{p.description}</span>
                </button>
              ))}
            </div>
          </LobbyField>

          <LobbyField label="Room code">
            <div className="flex gap-2">
              <LobbyInput
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="font-display tracking-widest text-lg"
              />
              <HudButton variant="ghost" size="sm" onClick={() => setRoomCode(generateClientCode())}>
                New
              </HudButton>
            </div>
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
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </LobbyField>

          <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer lobby-player-row">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-gold"
              checked={listedInLobby}
              disabled={!password.trim()}
              onChange={(e) => setListedInLobby(e.target.checked)}
            />
            <span className="font-ui text-sm text-gray-300">
              {password.trim()
                ? "List in public lobby (friends can still join with password)"
                : "List in public lobby browser"}
            </span>
          </label>

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

          <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer lobby-player-row">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-gold"
              checked={config.spectatorsAllowed}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  spectatorsAllowed: e.target.checked,
                }))
              }
            />
            <span className="font-ui text-sm text-gray-300">Allow spectators</span>
          </label>
        </div>

        <div className="game-modal-actions mt-6">
          <HudButton variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </HudButton>
          <HudButton variant="success" onClick={handleCreate} disabled={creating || !roomCode.trim()}>
            {creating ? "Creating…" : "Create Room"}
          </HudButton>
        </div>
      </div>
    </div>
  );
}
