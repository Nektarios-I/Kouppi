"use client";

import React, { useState } from "react";
import type { AvatarConfig } from "@/store/remoteGameStore";
import {
  AVATAR_FALLBACK_SRC,
  getAvatarSrc,
  getBotAvatar,
  normalizeAvatarConfig,
} from "@/lib/avatars";
import { seatInitials } from "@/components/game/seatLayout";
import { getFrameStyle, getSeatRingClass } from "@/lib/cosmetics";
import { useRewardStore } from "@/store/rewardStore";

export interface PlayerAvatarProps {
  name: string;
  isBot: boolean;
  isMe: boolean;
  avatar?: AvatarConfig;
  size?: "sm" | "md" | "lg";
  playerId?: string;
  className?: string;
  /** Override frame cosmetic (otherwise uses equipped for isMe) */
  frameId?: string | null;
  seatRingId?: string | null;
}

const SIZE_CLASS = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
} as const;

const BORDER_PX = { sm: 2, md: 2, lg: 2 } as const;

export default function PlayerAvatar({
  name,
  isBot,
  isMe,
  avatar,
  size = "md",
  playerId,
  className = "",
  frameId,
  seatRingId,
}: PlayerAvatarProps) {
  const sizeClass = SIZE_CLASS[size];
  const border = BORDER_PX[size];
  const [broken, setBroken] = useState(false);
  const equipped = useRewardStore((s) => s.state?.equipped);
  const resolvedFrame =
    frameId ?? (isMe ? equipped?.frameId : null) ?? "frame_default";
  const resolvedRing =
    seatRingId ?? (isMe ? equipped?.seatRingId : null) ?? "seat_ring_default";
  const ring = getFrameStyle(resolvedFrame);
  const ringClass = getSeatRingClass(resolvedRing);

  const resolved = isBot
    ? normalizeAvatarConfig(avatar ?? getBotAvatar(playerId || name))
    : avatar
      ? normalizeAvatarConfig(avatar)
      : null;

  if (resolved && !broken) {
    return (
      <div
        className={`player-avatar player-avatar--portrait avatar-display avatar-display--portrait ${ringClass} ${sizeClass} ${className}`}
        style={{
          backgroundColor: ring.fill,
          border: `${border}px solid ${ring.border}`,
        }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getAvatarSrc(resolved.id)}
          alt=""
          className="avatar-display__img"
          draggable={false}
          onError={() => setBroken(true)}
        />
      </div>
    );
  }

  if (broken && resolved) {
    return (
      <div
        className={`player-avatar player-avatar--portrait avatar-display avatar-display--portrait ${ringClass} ${sizeClass} ${className}`}
        style={{
          backgroundColor: ring.fill,
          border: `${border}px solid ${ring.border}`,
        }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AVATAR_FALLBACK_SRC} alt="" className="avatar-display__img" draggable={false} />
      </div>
    );
  }

  const initials = seatInitials(name);

  return (
    <div
      className={`player-avatar player-avatar--initials avatar-display ${ringClass} ${sizeClass} ${className}`}
      style={{
        backgroundColor: ring.fill,
        border: `${border}px solid ${ring.border}`,
      }}
      aria-hidden="true"
    >
      <span className="leading-none select-none font-ui font-semibold tracking-tight text-white/85">
        {initials}
      </span>
    </div>
  );
}
