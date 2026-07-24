"use client";

import React, { useState } from "react";
import type { AvatarConfig } from "@/store/remoteGameStore";
import {
  AVATAR_CATALOG,
  AVATAR_FALLBACK_SRC,
  AVATAR_RING,
  getAvatarSrc,
  normalizeAvatarConfig,
} from "@/lib/avatars";
import { HudButton } from "@/components/game/HudButton";

interface AvatarPickerProps {
  currentAvatar: AvatarConfig | null;
  onSelect: (avatar: AvatarConfig) => void;
  compact?: boolean;
}

export default function AvatarPicker({ currentAvatar, onSelect, compact = false }: AvatarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const current = normalizeAvatarConfig(currentAvatar);
  const [selectedId, setSelectedId] = useState(current.id);

  const handleSelect = () => {
    onSelect({ id: selectedId });
    setIsOpen(false);
  };

  const displayId = currentAvatar ? normalizeAvatarConfig(currentAvatar).id : selectedId;
  const sizeClass = compact ? "w-10 h-10" : "w-14 h-14";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`avatar-picker-trigger avatar-display avatar-display--portrait ${sizeClass}`}
        style={{
          backgroundColor: AVATAR_RING.fill,
          border: `3px solid ${AVATAR_RING.border}`,
        }}
        title="Change avatar"
        aria-expanded={isOpen}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getAvatarSrc(displayId)}
          alt=""
          className="avatar-display__img"
          draggable={false}
          onError={(e) => {
            e.currentTarget.src = AVATAR_FALLBACK_SRC;
          }}
        />
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-black/70 border border-gold/40 text-[10px] flex items-center justify-center">
          ✎
        </span>
      </button>

      {isOpen && (
        <div className="avatar-picker-panel left-0 sm:left-auto sm:right-0">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
            <div
              className="avatar-display avatar-display--portrait w-14 h-14"
              style={{
                backgroundColor: AVATAR_RING.fill,
                border: `3px solid ${AVATAR_RING.border}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAvatarSrc(selectedId)}
                alt=""
                className="avatar-display__img"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.src = AVATAR_FALLBACK_SRC;
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-ui uppercase tracking-wide">Preview</p>
              <p className="font-ui font-medium text-gray-200">Your look</p>
            </div>
            <HudButton variant="success" size="sm" onClick={handleSelect}>
              Save
            </HudButton>
          </div>

          <p className="text-xs text-gray-500 font-ui uppercase tracking-wide mb-2">Portrait</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-52 overflow-y-auto pr-1">
            {AVATAR_CATALOG.map((entry) => {
              const active = selectedId === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`avatar-portrait-btn ${active ? "avatar-portrait-btn--active" : ""}`}
                  title={entry.id}
                  aria-pressed={active}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getAvatarSrc(entry.id)}
                    alt=""
                    className="avatar-display__img"
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.src = AVATAR_FALLBACK_SRC;
                    }}
                  />
                </button>
              );
            })}
          </div>

          <HudButton variant="ghost" size="sm" fullWidth className="mt-3" onClick={() => setIsOpen(false)}>
            Cancel
          </HudButton>
        </div>
      )}
    </div>
  );
}

export function Avatar({
  avatar,
  size = "md",
  showDefault = true,
  frameStyle,
}: {
  avatar?: AvatarConfig | null;
  size?: "sm" | "md" | "lg";
  showDefault?: boolean;
  /** @deprecated unused — kept for call-site compat */
  playerId?: string;
  frameStyle?: { fill: string; border: string };
}) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };
  const borders = { sm: 2, md: 2, lg: 3 };
  const fill = frameStyle?.fill ?? AVATAR_RING.fill;
  const border = frameStyle?.border ?? AVATAR_RING.border;

  if (!avatar) {
    if (!showDefault) return null;
    return (
      <div
        className={`avatar-display avatar-display--portrait ${sizes[size]}`}
        style={{
          backgroundColor: fill,
          border: `${borders[size]}px solid ${border}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AVATAR_FALLBACK_SRC} alt="" className="avatar-display__img" draggable={false} />
      </div>
    );
  }

  const normalized = normalizeAvatarConfig(avatar);

  return (
    <div
      className={`avatar-display avatar-display--portrait ${sizes[size]}`}
      style={{
        backgroundColor: fill,
        border: `${borders[size]}px solid ${border}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAvatarSrc(normalized.id)}
        alt=""
        className="avatar-display__img"
        draggable={false}
        onError={(e) => {
          e.currentTarget.src = AVATAR_FALLBACK_SRC;
        }}
      />
    </div>
  );
}
