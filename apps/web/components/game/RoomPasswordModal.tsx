"use client";

import { PreGameCard, LobbyInput, LobbyField, LobbyAlert } from "./LobbyUI";
import { HudButton } from "./HudButton";

export interface RoomPasswordModalProps {
  roomId: string;
  password: string;
  error: string | null;
  loading?: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
}

export default function RoomPasswordModal({
  roomId,
  password,
  error,
  loading = false,
  onPasswordChange,
  onSubmit,
  onCancel,
  title = "Private Room",
  subtitle,
}: RoomPasswordModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm grid place-items-center z-50 p-4">
      <PreGameCard
        title={title}
        subtitle={subtitle ?? `Room ${roomId} requires a password.`}
      >
        {error && <LobbyAlert variant="error">{error}</LobbyAlert>}
        <LobbyField label="Password">
          <LobbyInput
            type="password"
            placeholder="Room password…"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && password.trim() && onSubmit()}
            autoFocus
          />
        </LobbyField>
        <div className="flex justify-end gap-3 mt-5">
          <HudButton variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </HudButton>
          <HudButton variant="bet" onClick={onSubmit} disabled={loading || !password.trim()}>
            {loading ? "Joining…" : "Join"}
          </HudButton>
        </div>
      </PreGameCard>
    </div>
  );
}
