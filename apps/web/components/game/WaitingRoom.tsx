"use client";

import React from "react";
import type { AvatarConfig, PlayerInfo } from "@/store/remoteGameStore";
import AvatarPicker, { Avatar } from "@/components/AvatarPicker";
import { HudButton } from "./HudButton";
import RoomInvitePanel from "./RoomInvitePanel";
import PlayerModerationMenu, { type ReportReason } from "./PlayerModerationMenu";
import {
  LobbyCard,
  LobbyAlert,
  LobbyFooterLink,
} from "./LobbyUI";

export interface WaitingRoomProps {
  roomCode: string;
  hostId?: string | null;
  connected: boolean;
  isHost: boolean;
  players: PlayerInfo[];
  spectators: Array<{ id: string; name: string }>;
  playerId: string | null;
  playerAvatar: AvatarConfig | null;
  starting: boolean;
  lastError: string | null;
  onAvatarChange: (avatar: AvatarConfig) => void;
  onStartGame: () => void;
  onLeave: () => void;
  onCopyLink: () => void;
  onSetReady: (ready: boolean) => void;
  onKickPlayer: (targetId: string) => void;
  onTransferHost: (targetId: string) => void;
  onCloseRoom: () => void;
  onClearError?: () => void;
  onReportPlayer?: (targetId: string, reason: ReportReason) => void;
  onBanPlayer?: (targetId: string) => void;
  onMutePlayerChat?: (targetId: string, muted: boolean) => void;
  onToggleRoomChatMuted?: (muted: boolean) => void;
  chatMutedAll?: boolean;
  chatMutedPlayerIds?: string[];
}

export default function WaitingRoom({
  roomCode,
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
  onSetReady,
  onKickPlayer,
  onTransferHost,
  onCloseRoom,
  onClearError,
  onReportPlayer,
  onBanPlayer,
  onMutePlayerChat,
  onToggleRoomChatMuted,
  chatMutedAll,
  chatMutedPlayerIds = [],
}: WaitingRoomProps) {
  const me = players.find((p) => p.id === playerId);
  const allReady = players.length >= 2 && players.every((p) => p.ready && p.connected !== false);
  const readyCount = players.filter((p) => p.ready).length;

  return (
    <div className="max-w-2xl mx-auto">
      {lastError && (
        <LobbyAlert variant="error" onDismiss={onClearError}>
          {lastError}
        </LobbyAlert>
      )}

      <header className="hud-header-strip mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 font-ui uppercase tracking-widest mb-1">
              Waiting Room
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-gold-light tracking-widest">
              {roomCode}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`hud-badge ${connected ? "hud-badge-gold !text-success" : "hud-result-loss"}`}
            >
              {connected ? "Connected" : "Offline"}
            </span>
            {isHost && <span className="hud-badge hud-badge-gold">👑 Host</span>}
            <span className="hud-badge hud-badge-live">{readyCount}/{players.length} ready</span>
          </div>
        </div>
      </header>

      <LobbyCard title="Players" icon="♠" badge={<span className="hud-badge">{players.length}</span>}>
        {players.length === 0 ? (
          <p className="text-gray-500 text-center py-6 font-ui text-sm">
            Waiting for players to join…
          </p>
        ) : (
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className={`lobby-player-row ${player.id === playerId ? "lobby-player-row-me" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar avatar={player.avatar} size="md" />
                  <div className="min-w-0">
                    <span className="font-ui font-medium truncate block">
                      {player.name}
                      {player.id === playerId && (
                        <span className="text-gold text-xs ml-1">(you)</span>
                      )}
                    </span>
                    {player.connected === false && player.reconnectRemainingSec != null && (
                      <span className="text-warning text-xs font-ui">
                        Reconnecting… {player.reconnectRemainingSec}s
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hostId && player.id === hostId && (
                    <span className="text-xs text-gold font-ui">Host</span>
                  )}
                  <span
                    className={`text-xs font-ui ${player.ready ? "text-success" : "text-gray-500"}`}
                  >
                    {player.ready ? "Ready" : "Not ready"}
                  </span>
                  {isHost && player.id !== playerId && player.id !== hostId && (
                    <>
                      <HudButton variant="ghost" size="sm" onClick={() => onTransferHost(player.id)}>
                        Make Host
                      </HudButton>
                      <HudButton variant="danger" size="sm" onClick={() => onKickPlayer(player.id)}>
                        Kick
                      </HudButton>
                    </>
                  )}
                  {player.id !== playerId && onReportPlayer && (
                    <PlayerModerationMenu
                      playerId={player.id}
                      playerName={player.name}
                      isHost={isHost}
                      onReport={onReportPlayer}
                      onBan={isHost ? onBanPlayer : undefined}
                      onMuteChat={isHost ? onMutePlayerChat : undefined}
                      chatMutedByHost={chatMutedPlayerIds.includes(player.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {players.length < 2 && (
          <p className="mt-4 text-xs text-center text-gray-500 font-ui hud-status-banner !py-2">
            At least 2 players required to start
          </p>
        )}
        {!allReady && players.length >= 2 && (
          <p className="mt-4 text-xs text-center text-gray-500 font-ui hud-status-banner !py-2">
            Waiting for all players to ready up…
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

      <LobbyCard title="Invite Friends" icon="⛓">
        <RoomInvitePanel roomCode={roomCode} onCopyLink={onCopyLink} />
      </LobbyCard>

      {isHost && onToggleRoomChatMuted && (
        <LobbyCard title="Chat Controls" icon="🔇">
          <HudButton
            variant={chatMutedAll ? "success" : "ghost"}
            fullWidth
            onClick={() => onToggleRoomChatMuted(!chatMutedAll)}
          >
            {chatMutedAll ? "Unmute chat for everyone" : "Mute chat for everyone"}
          </HudButton>
        </LobbyCard>
      )}

      <div className="flex flex-col gap-3 mt-2">
        {me && (
          <HudButton
            variant={me.ready ? "ghost" : "success"}
            fullWidth
            onClick={() => onSetReady(!me.ready)}
          >
            {me.ready ? "Not Ready" : "Ready Up"}
          </HudButton>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isHost ? (
            <HudButton
              variant="success"
              size="lg"
              fullWidth
              onClick={onStartGame}
              disabled={!allReady || starting}
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
          {isHost && (
            <HudButton variant="ghost" onClick={onCloseRoom} className="sm:w-auto">
              Close Room
            </HudButton>
          )}
        </div>
      </div>

      <LobbyFooterLink href="/lobby">← Back to Lobby</LobbyFooterLink>
      <p className="text-center mt-3">
        <a href="/how-to-play" className="text-sm text-gray-400 hover:text-gold-light font-ui underline">
          How to Play KOUPPI
        </a>
      </p>
    </div>
  );
}
