"use client";

import React from "react";
import type { AvatarConfig } from "@/store/remoteGameStore";
import AvatarPicker, { Avatar } from "@/components/AvatarPicker";
import { HudButton } from "./HudButton";
import {
  LobbyCard,
  LobbyInput,
  LobbyAlert,
  LobbyFooterLink,
} from "./LobbyUI";

interface WaitingPlayer {
  id: string;
  name: string;
  avatar?: AvatarConfig | null;
}

interface WaitingSpectator {
  id: string;
  name: string;
}

export interface WaitingRoomProps {
  roomId: string;
  hostId?: string | null;
  connected: boolean;
  isHost: boolean;
  players: WaitingPlayer[];
  spectators: WaitingSpectator[];
  playerId: string | null;
  playerAvatar: AvatarConfig | null;
  starting: boolean;
  lastError: string | null;
  onAvatarChange: (avatar: AvatarConfig) => void;
  onStartGame: () => void;
  onLeave: () => void;
  onCopyLink: () => void;
  onClearError?: () => void;
}

export default function WaitingRoom({
  roomId,
  hostId,
  connected,
  isHost,
  players,
  spectators,
  playerId,
  playerAvatar,
  starting,
  lastError,
  onAvatarChange,
  onStartGame,
  onLeave,
  onCopyLink,
}: WaitingRoomProps) {
  const roomUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header strip */}
      <header className="hud-header-strip mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 font-ui uppercase tracking-widest mb-1">
              Waiting Room
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-gold-light truncate">
              {roomId}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`hud-badge ${connected ? "hud-badge-gold !text-success" : "hud-result-loss"}`}
            >
              {connected ? "Connected" : "Offline"}
            </span>
            {isHost && <span className="hud-badge hud-badge-gold">👑 Host</span>}
          </div>
        </div>
      </header>

      {lastError && <LobbyAlert variant="error">{lastError}</LobbyAlert>}

      <LobbyCard title="Players" icon="♠" badge={<span className="hud-badge">{players.length}</span>}>
        {players.length === 0 ? (
          <p className="text-gray-500 text-center py-6 font-ui text-sm">
            Waiting for players to join…
          </p>
        ) : (
          <div className="space-y-2">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`lobby-player-row ${player.id === playerId ? "lobby-player-row-me" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar avatar={player.avatar} size="md" />
                  <span className="font-ui font-medium truncate">
                    {player.name}
                    {player.id === playerId && (
                      <span className="text-gold text-xs ml-1">(you)</span>
                    )}
                  </span>
                </div>
                {hostId && player.id === hostId && (
                  <span className="text-xs text-gold font-ui shrink-0">Host</span>
                )}
              </div>
            ))}
          </div>
        )}

        {players.length < 2 && (
          <p className="mt-4 text-xs text-center text-gray-500 font-ui hud-status-banner !py-2">
            At least 2 players required to start
          </p>
        )}
      </LobbyCard>

      {spectators.length > 0 && (
        <LobbyCard title="Spectators" icon="👁" badge={<span className="hud-badge hud-badge-live">{spectators.length}</span>}>
          <div className="flex flex-wrap gap-2">
            {spectators.map((s) => (
              <span key={s.id} className="hud-badge hud-badge-live text-xs">
                {s.name}
              </span>
            ))}
          </div>
        </LobbyCard>
      )}

      <LobbyCard title="Your Avatar" icon="◎">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400 font-ui">Choose how others see you at the table</p>
          <AvatarPicker currentAvatar={playerAvatar} onSelect={onAvatarChange} />
        </div>
      </LobbyCard>

      <LobbyCard title="Invite" icon="⛓">
        <div className="flex gap-2">
          <LobbyInput readOnly value={roomUrl} className="flex-1 text-xs sm:text-sm" />
          <HudButton variant="bet" size="sm" onClick={onCopyLink}>
            Copy
          </HudButton>
        </div>
      </LobbyCard>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2">
        {isHost ? (
          <HudButton
            variant="success"
            size="lg"
            fullWidth
            onClick={onStartGame}
            disabled={players.length < 2 || starting}
            className="sm:flex-1"
          >
            {starting ? "Starting…" : "Start Game"}
          </HudButton>
        ) : (
          <p className="text-gray-400 font-ui text-sm text-center sm:text-left flex-1 py-2">
            Waiting for host to start…
          </p>
        )}
        <HudButton variant="danger" onClick={onLeave} className="sm:w-auto">
          Leave Room
        </HudButton>
      </div>

      <LobbyFooterLink href="/lobby">← Back to Lobby</LobbyFooterLink>
    </div>
  );
}
