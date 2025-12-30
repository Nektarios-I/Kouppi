"use client";

import { useState } from "react";
import { AVATAR_CATEGORIES, AVATAR_COLORS, type AvatarConfig } from "@/lib/avatars";

interface AvatarPickerProps {
  currentAvatar: AvatarConfig | null;
  onSelect: (avatar: AvatarConfig) => void;
  compact?: boolean;
}

export default function AvatarPicker({ currentAvatar, onSelect, compact = false }: AvatarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(currentAvatar?.emoji || "😎");
  const [selectedColor, setSelectedColor] = useState(
    AVATAR_COLORS.find(c => c.value === currentAvatar?.color) || AVATAR_COLORS[0]
  );
  const [activeCategory, setActiveCategory] = useState<keyof typeof AVATAR_CATEGORIES>("Faces");

  const handleSelect = () => {
    const avatar: AvatarConfig = {
      emoji: selectedEmoji,
      color: selectedColor.value,
      borderColor: selectedColor.border,
    };
    onSelect(avatar);
    setIsOpen(false);
  };

  // Current avatar display (clickable to open picker)
  const AvatarDisplay = () => (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={`
        relative rounded-full flex items-center justify-center transition-all
        hover:scale-105 hover:ring-2 hover:ring-white/50
        ${compact ? "w-10 h-10 text-xl" : "w-14 h-14 text-2xl"}
      `}
      style={{
        backgroundColor: currentAvatar?.color || selectedColor.value,
        borderColor: currentAvatar?.borderColor || selectedColor.border,
        borderWidth: "3px",
      }}
      title="Click to change avatar"
    >
      {currentAvatar?.emoji || selectedEmoji}
      <span className="absolute -bottom-1 -right-1 text-xs bg-gray-700 rounded-full w-5 h-5 flex items-center justify-center border border-gray-500">
        ✏️
      </span>
    </button>
  );

  if (!isOpen) {
    return <AvatarDisplay />;
  }

  return (
    <div className="relative">
      <AvatarDisplay />
      
      {/* Picker Modal */}
      <div className="absolute z-50 top-full mt-2 left-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4 min-w-[300px]">
        {/* Preview */}
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-700">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl border-4"
            style={{
              backgroundColor: selectedColor.value,
              borderColor: selectedColor.border,
            }}
          >
            {selectedEmoji}
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-400">Preview</div>
            <div className="font-medium">Your Avatar</div>
          </div>
          <button
            onClick={handleSelect}
            className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Save
          </button>
        </div>

        {/* Color Selection */}
        <div className="mb-4">
          <div className="text-sm text-gray-400 mb-2">Background Color</div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => setSelectedColor(color)}
                className={`
                  w-8 h-8 rounded-full transition-all border-2
                  ${selectedColor.name === color.name ? "ring-2 ring-white scale-110" : "hover:scale-105"}
                `}
                style={{
                  backgroundColor: color.value,
                  borderColor: color.border,
                }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-3">
          <div className="text-sm text-gray-400 mb-2">Choose Avatar</div>
          <div className="flex flex-wrap gap-1 text-xs">
            {Object.keys(AVATAR_CATEGORIES).map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category as keyof typeof AVATAR_CATEGORIES)}
                className={`
                  px-2 py-1 rounded transition-colors
                  ${activeCategory === category 
                    ? "bg-blue-600 text-white" 
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }
                `}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Avatar Grid */}
        <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto">
          {AVATAR_CATEGORIES[activeCategory].map((emoji) => (
            <button
              key={emoji}
              onClick={() => setSelectedEmoji(emoji)}
              className={`
                w-10 h-10 text-xl rounded-lg flex items-center justify-center
                transition-all
                ${selectedEmoji === emoji 
                  ? "bg-blue-600 ring-2 ring-blue-400 scale-110" 
                  : "bg-gray-700 hover:bg-gray-600 hover:scale-105"
                }
              `}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="mt-4 w-full text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Simple avatar display component (no picker, just shows the avatar)
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
  // If no avatar provided but we want to show default, generate from playerId
  let displayAvatar = avatar;
  if (!displayAvatar && showDefault && playerId) {
    // Dynamic import would be better but this works for now
    displayAvatar = undefined;
  }

  const sizeClasses = {
    sm: "w-8 h-8 text-lg",
    md: "w-10 h-10 text-xl", 
    lg: "w-14 h-14 text-2xl",
  };

  const borderWidth = {
    sm: "2px",
    md: "2px",
    lg: "3px",
  };

  if (!displayAvatar) {
    // Default avatar (grey with person icon)
    return (
      <div
        className={`
          ${sizeClasses[size]} rounded-full flex items-center justify-center
          bg-gray-600 border-2 border-gray-500
        `}
      >
        👤
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center`}
      style={{
        backgroundColor: displayAvatar.color,
        borderColor: displayAvatar.borderColor,
        borderWidth: borderWidth[size],
        borderStyle: "solid",
      }}
    >
      {displayAvatar.emoji}
    </div>
  );
}
