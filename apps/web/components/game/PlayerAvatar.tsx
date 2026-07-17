"use client";

import React from "react";
import type { AvatarConfig } from "@/store/remoteGameStore";
import { AVATAR_COLORS, getBotAvatar } from "@/lib/avatars";
import { seatInitials } from "@/components/game/seatLayout";

export interface PlayerAvatarProps {
  name: string;
  isBot: boolean;
  isMe: boolean;
  avatar?: AvatarConfig;
  size?: "sm" | "md" | "lg";
  playerId?: string;
  className?: string;
}

const SIZE_CLASS = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
} as const;

const BORDER_PX = { sm: 2, md: 2, lg: 2 } as const;

function hashColorIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

export default function PlayerAvatar({
  name,
  isBot,
  isMe,
  avatar,
  size = "md",
  playerId,
  className = "",
}: PlayerAvatarProps) {
  const sizeClass = SIZE_CLASS[size];
  const border = BORDER_PX[size];

  if (isBot) {
    const botAvatar = avatar ?? getBotAvatar(playerId || name);
    return (
      <div
        className={`player-avatar player-avatar--bot avatar-display ${sizeClass} ${className}`}
        style={{
          backgroundColor: botAvatar.color,
          border: `${border}px solid ${botAvatar.borderColor}`,
        }}
        aria-hidden="true"
      >
        <span className="leading-none select-none">{botAvatar.emoji}</span>
      </div>
    );
  }

  if (avatar?.emoji) {
    return (
      <div
        className={`player-avatar avatar-display ${sizeClass} ${className}`}
        style={{
          backgroundColor: avatar.color,
          border: `${border}px solid ${avatar.borderColor}`,
        }}
        aria-hidden="true"
      >
        <span className="leading-none select-none">{avatar.emoji}</span>
      </div>
    );
  }

  const color = AVATAR_COLORS[hashColorIndex(playerId || name)];
  const initials = seatInitials(name);
  const ring = isMe ? color.border : color.border;

  return (
    <div
      className={`player-avatar player-avatar--initials avatar-display ${sizeClass} ${className}`}
      style={{
        backgroundColor: color.value,
        border: `${border}px solid ${ring}`,
      }}
      aria-hidden="true"
    >
      <span className="leading-none select-none font-ui font-semibold tracking-tight text-white">
        {initials}
      </span>
    </div>
  );
}
