"use client";

import React from "react";
import { Avatar } from "@/components/AvatarPicker";
import type { AvatarConfig } from "@/store/remoteGameStore";
import { getBotAvatar, getDefaultAvatar } from "@/lib/avatars";
import { PlayerEmote } from "@/components/EmoteDisplay";

export interface SeatPlayer {
  id: string;
  name: string;
  bankroll: number;
  isBot?: boolean;
}

export interface PlayerSeatProps {
  player: SeatPlayer;
  isCurrentTurn: boolean;
  isMe: boolean;
  isBankrupt: boolean;
  avatar?: AvatarConfig;
}

export default function PlayerSeat({
  player,
  isCurrentTurn,
  isMe,
  isBankrupt,
  avatar,
}: PlayerSeatProps) {
  const displayAvatar =
    avatar ?? (player.isBot ? getBotAvatar(player.id) : isMe ? getDefaultAvatar() : undefined);

  return (
    <div className="relative flex flex-col items-center">
      {/* Emote anchor above seat */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-40 pointer-events-none min-h-[2rem]">
        <PlayerEmote playerId={player.id} />
      </div>

      <div
        className={`
          flex flex-col items-center gap-1 p-2 sm:p-2.5 rounded-xl min-w-[72px] sm:min-w-[88px]
          transition-all duration-300
          ${
            isCurrentTurn
              ? "bg-black/65 ring-2 ring-success shadow-lg shadow-success/30 scale-105 sm:scale-110 backdrop-blur-md"
              : "bg-black/55 ring-1 ring-white/15 backdrop-blur-sm shadow-md shadow-black/40"
          }
          ${isMe ? "ring-2 ring-gold/80" : ""}
          ${isBankrupt ? "opacity-50 grayscale" : ""}
        `}
        style={{
          boxShadow: isCurrentTurn
            ? "0 4px 20px rgba(0,0,0,0.5), 0 0 24px rgba(34,197,94,0.15)"
            : "0 4px 16px rgba(0,0,0,0.45)",
        }}
      >
        {displayAvatar ? (
          <Avatar avatar={displayAvatar} size="md" />
        ) : (
          <div
            className={`
              w-10 h-10 rounded-full flex items-center justify-center text-xl
              border-2 font-ui
              ${isMe ? "bg-indigo-700 border-gold/50" : "bg-gray-700 border-gray-500"}
            `}
          >
            😊
          </div>
        )}

        <div className="text-[10px] sm:text-xs font-semibold text-white truncate max-w-[76px] font-ui text-center">
          {player.name}
          {isMe && <span className="text-gold ml-0.5">(you)</span>}
        </div>

        <div
          className={`
            text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-full font-ui
            ${
              isBankrupt
                ? "bg-error-muted text-error"
                : "bg-gold/15 text-gold-light border border-gold/25"
            }
          `}
        >
          {player.bankroll}
        </div>

        {isCurrentTurn && (
          <div
            className="text-[10px] sm:text-xs text-success font-bold animate-pulse font-ui"
            aria-live="polite"
          >
            Your turn
          </div>
        )}
      </div>
    </div>
  );
}
