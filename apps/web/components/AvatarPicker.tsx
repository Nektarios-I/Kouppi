"use client";

import React, { useState } from "react";
import { AVATAR_CATEGORIES, AVATAR_COLORS, type AvatarConfig } from "@/lib/avatars";
import { HudButton } from "@/components/game/HudButton";

interface AvatarPickerProps {
  currentAvatar: AvatarConfig | null;
  onSelect: (avatar: AvatarConfig) => void;
  compact?: boolean;
}

export default function AvatarPicker({ currentAvatar, onSelect, compact = false }: AvatarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(currentAvatar?.emoji || "😎");
  const [selectedColor, setSelectedColor] = useState(
    AVATAR_COLORS.find((c) => c.value === currentAvatar?.color) || AVATAR_COLORS[0]
  );
  const [activeCategory, setActiveCategory] = useState<keyof typeof AVATAR_CATEGORIES>("Faces");

  const handleSelect = () => {
    onSelect({
      emoji: selectedEmoji,
      color: selectedColor.value,
      borderColor: selectedColor.border,
    });
    setIsOpen(false);
  };

  const displayEmoji = currentAvatar?.emoji || selectedEmoji;
  const displayColor = currentAvatar?.color || selectedColor.value;
  const displayBorder = currentAvatar?.borderColor || selectedColor.border;
  const sizeClass = compact ? "w-10 h-10 text-xl" : "w-14 h-14 text-2xl";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`avatar-picker-trigger ${sizeClass}`}
        style={{
          backgroundColor: displayColor,
          border: `3px solid ${displayBorder}`,
        }}
        title="Change avatar"
        aria-expanded={isOpen}
      >
        {displayEmoji}
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-black/70 border border-gold/40 text-[10px] flex items-center justify-center">
          ✎
        </span>
      </button>

      {isOpen && (
        <div className="avatar-picker-panel left-0 sm:left-auto sm:right-0">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
            <div
              className="avatar-display w-14 h-14 text-2xl"
              style={{
                backgroundColor: selectedColor.value,
                border: `3px solid ${selectedColor.border}`,
              }}
            >
              {selectedEmoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-ui uppercase tracking-wide">Preview</p>
              <p className="font-ui font-medium text-gray-200">Your look</p>
            </div>
            <HudButton variant="success" size="sm" onClick={handleSelect}>
              Save
            </HudButton>
          </div>

          <p className="text-xs text-gray-500 font-ui uppercase tracking-wide mb-2">Color</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => setSelectedColor(color)}
                className={`avatar-swatch ${selectedColor.name === color.name ? "avatar-swatch-active" : ""}`}
                style={{ backgroundColor: color.value, borderColor: color.border }}
                title={color.name}
              />
            ))}
          </div>

          <p className="text-xs text-gray-500 font-ui uppercase tracking-wide mb-2">Avatar</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {(Object.keys(AVATAR_CATEGORIES) as (keyof typeof AVATAR_CATEGORIES)[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-1 rounded text-xs font-ui transition-colors ${
                  activeCategory === cat
                    ? "bg-gold/20 text-gold-light border border-gold/30"
                    : "bg-black/30 text-gray-400 border border-transparent hover:border-white/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-1.5 max-h-36 overflow-y-auto pr-1">
            {AVATAR_CATEGORIES[activeCategory].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                className={`avatar-emoji-btn ${selectedEmoji === emoji ? "avatar-emoji-btn-active" : ""}`}
              >
                {emoji}
              </button>
            ))}
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
  playerId,
}: {
  avatar?: AvatarConfig | null;
  size?: "sm" | "md" | "lg";
  showDefault?: boolean;
  playerId?: string;
}) {
  const sizes = {
    sm: "w-8 h-8 text-base",
    md: "w-10 h-10 text-xl",
    lg: "w-14 h-14 text-2xl",
  };
  const borders = { sm: 2, md: 2, lg: 3 };

  if (!avatar) {
    if (!showDefault) return null;
    return (
      <div
        className={`avatar-display ${sizes[size]} bg-gray-700 border-2 border-gray-500 text-gray-400`}
      >
        👤
      </div>
    );
  }

  return (
    <div
      className={`avatar-display ${sizes[size]}`}
      style={{
        backgroundColor: avatar.color,
        border: `${borders[size]}px solid ${avatar.borderColor}`,
      }}
    >
      {avatar.emoji}
    </div>
  );
}
