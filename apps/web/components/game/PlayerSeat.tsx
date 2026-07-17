"use client";

import React from "react";
import type { AvatarConfig } from "@/store/remoteGameStore";
import { PlayerEmote } from "@/components/EmoteDisplay";
import PlayerAvatar from "@/components/game/PlayerAvatar";
import PlayerStatusBadge from "@/components/game/PlayerStatusBadge";
import {
  formatSeatAmount,
  truncateSeatName,
  type SeatEdge,
  type SeatLayoutBreakpoint,
} from "@/components/game/seatLayout";

export interface SeatPlayerView {
  id: string;
  name: string;
  bankroll: number;
  isBot: boolean;
  isActive: boolean;
  isBankrupt: boolean;
  isMe: boolean;
  isCurrentTurn: boolean;
  avatar?: AvatarConfig;
  currentBet?: number;
  connected?: boolean;
  reconnectRemainingSec?: number | null;
}

/** @deprecated Prefer SeatPlayerView — kept for gradual migration */
export interface SeatPlayer {
  id: string;
  name: string;
  bankroll: number;
  isBot?: boolean;
}

export interface PlayerSeatProps {
  player: SeatPlayerView;
  breakpoint: SeatLayoutBreakpoint;
  edge: SeatEdge;
  turnRemainingSec?: number | null;
}

function buildAriaLabel(player: SeatPlayerView): string {
  const parts = [
    player.name,
    `bankroll ${player.bankroll}`,
    player.isBot ? "bot" : "player",
  ];
  if (player.isMe) parts.push("you");
  if (player.isCurrentTurn) {
    parts.push(player.isMe ? "your turn" : "current turn");
  }
  if (player.isBankrupt) parts.push("bankrupt");
  if (player.connected === false) parts.push("disconnected");
  return parts.join(", ");
}

export default function PlayerSeat({
  player,
  breakpoint,
  edge,
  turnRemainingSec = null,
}: PlayerSeatProps) {
  const isMobile = breakpoint === "mobile";
  const isOpponentMobile = isMobile && !player.isMe;
  const showTimer =
    player.isMe &&
    player.isCurrentTurn &&
    turnRemainingSec != null &&
    turnRemainingSec >= 0;

  const nameMax = isOpponentMobile ? 7 : breakpoint === "desktop" ? 12 : 10;
  const displayName = truncateSeatName(player.name, nameMax);
  const bankrollText = formatSeatAmount(player.bankroll);

  const ariaLabel = buildAriaLabel(player);

  const dimmed = player.isBankrupt || player.connected === false;

  if (isOpponentMobile) {
    return (
      <div
        className={`player-seat player-seat--mobile-opponent relative flex flex-col items-center ${
          dimmed ? "player-seat--dimmed" : ""
        }`}
        data-edge={edge}
        data-seat-id={player.id}
        role="group"
        aria-label={ariaLabel}
      >
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-[30] pointer-events-none min-h-[1.5rem]">
          <PlayerEmote playerId={player.id} />
        </div>

        <div
          className={`player-seat__avatar-wrap ${
            player.isCurrentTurn ? "player-seat__avatar-wrap--turn" : ""
          } ${player.isMe ? "player-seat__avatar-wrap--me" : ""}`}
        >
          <PlayerAvatar
            name={player.name}
            isBot={player.isBot}
            isMe={player.isMe}
            avatar={player.avatar}
            playerId={player.id}
            size="sm"
          />
          {player.isCurrentTurn && (
            <span className="player-seat__turn-pip" aria-hidden="true" />
          )}
        </div>

        <div className="player-seat__mobile-meta mt-0.5 flex flex-col items-center gap-0.5 max-w-[56px]">
          <span
            className="text-[9px] font-ui font-medium text-white/90 truncate w-full text-center leading-tight"
            title={player.name}
          >
            {displayName}
          </span>
          <span
            className={`text-[9px] font-ui tabular-nums leading-none ${
              player.isBankrupt ? "text-error" : "text-gold-light"
            }`}
          >
            {bankrollText}
          </span>
          <div className="flex items-center gap-0.5 flex-wrap justify-center">
            {player.isBot && <PlayerStatusBadge kind="bot" />}
            {player.isCurrentTurn && <PlayerStatusBadge kind="turn" />}
            {player.connected === false && <PlayerStatusBadge kind="offline" />}
          </div>
        </div>
      </div>
    );
  }

  // Desktop / tablet / mobile hero — compact horizontal pod
  return (
    <div
      className={`player-seat player-seat--pod relative ${
        player.isMe ? "player-seat--hero" : ""
      } ${isMobile ? "player-seat--mobile-hero" : ""} ${dimmed ? "player-seat--dimmed" : ""}`}
      data-edge={edge}
      data-seat-id={player.id}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-[30] pointer-events-none min-h-[1.75rem]">
        <PlayerEmote playerId={player.id} />
      </div>

      <div
        className={`player-seat__pod ${
          player.isCurrentTurn ? "player-seat__pod--turn" : ""
        } ${player.isMe && !player.isCurrentTurn ? "player-seat__pod--me" : ""}`}
      >
        <div
          className={`player-seat__avatar-wrap shrink-0 ${
            player.isCurrentTurn ? "player-seat__avatar-wrap--turn" : ""
          }`}
        >
          <PlayerAvatar
            name={player.name}
            isBot={player.isBot}
            isMe={player.isMe}
            avatar={player.avatar}
            playerId={player.id}
            size={isMobile ? "sm" : breakpoint === "desktop" ? "md" : "sm"}
          />
        </div>

        <div className="player-seat__info min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className="player-seat__name font-ui truncate"
              title={player.name}
            >
              {displayName}
            </span>
            {player.isBot && <PlayerStatusBadge kind="bot" />}
            {player.isMe && !player.isBot && <PlayerStatusBadge kind="you" />}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <span
              className={`player-seat__bankroll font-ui tabular-nums ${
                player.isBankrupt ? "player-seat__bankroll--bust" : ""
              }`}
            >
              {bankrollText}
            </span>
            {player.isCurrentTurn && (
              <span className="inline-flex items-center gap-0.5 shrink-0">
                <PlayerStatusBadge kind="turn" />
                {showTimer && (
                  <span
                    className="player-seat__timer font-ui tabular-nums"
                    aria-live="polite"
                  >
                    {turnRemainingSec}
                  </span>
                )}
              </span>
            )}
            {player.connected === false && (
              <PlayerStatusBadge
                kind="offline"
                label={
                  player.reconnectRemainingSec != null
                    ? `${player.reconnectRemainingSec}s`
                    : undefined
                }
              />
            )}
          </div>
        </div>
      </div>

      {player.isCurrentTurn && player.isMe && (
        <span className="sr-only" aria-live="polite">
          Your turn
        </span>
      )}
      {player.isCurrentTurn && !player.isMe && (
        <span className="sr-only" aria-live="polite">
          {player.name}&apos;s turn
        </span>
      )}
    </div>
  );
}
