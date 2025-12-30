/**
 * Avatar system for player visual identity
 * Players can choose from preset avatars and background colors
 */

// Preset avatars organized by category
export const AVATAR_CATEGORIES = {
  Animals: ["🐺", "🦊", "🐱", "🐶", "🐼", "🐨", "🦁", "🐯", "🐮", "🐷"],
  Faces: ["😎", "🤠", "🥳", "😈", "👻", "🤖", "👽", "🎃", "💀", "🤡"],
  Nature: ["🌸", "🌺", "🌻", "🌵", "🍀", "🌙", "⭐", "🔥", "💎", "🌈"],
  Food: ["🍕", "🍔", "🌮", "🍩", "🍪", "🍦", "🎂", "🍓", "🍉", "🥑"],
  Objects: ["🎮", "🎸", "🎯", "🏆", "👑", "💰", "🎲", "🃏", "🎪", "🚀"],
  Sports: ["⚽", "🏀", "🎾", "🏈", "⚾", "🎱", "🏓", "🥊", "🎳", "🏹"],
} as const;

// Background colors for avatar circles
export const AVATAR_COLORS = [
  { name: "Blue", value: "#3B82F6", border: "#60A5FA" },
  { name: "Purple", value: "#8B5CF6", border: "#A78BFA" },
  { name: "Pink", value: "#EC4899", border: "#F472B6" },
  { name: "Red", value: "#EF4444", border: "#F87171" },
  { name: "Orange", value: "#F97316", border: "#FB923C" },
  { name: "Yellow", value: "#EAB308", border: "#FACC15" },
  { name: "Green", value: "#22C55E", border: "#4ADE80" },
  { name: "Teal", value: "#14B8A6", border: "#2DD4BF" },
  { name: "Cyan", value: "#06B6D4", border: "#22D3EE" },
  { name: "Gray", value: "#6B7280", border: "#9CA3AF" },
] as const;

// Get all avatars as a flat list
export function getAllAvatars(): string[] {
  return Object.values(AVATAR_CATEGORIES).flat();
}

// Get a random avatar
export function getRandomAvatar(): string {
  const all = getAllAvatars();
  return all[Math.floor(Math.random() * all.length)];
}

// Get a random color
export function getRandomColor(): typeof AVATAR_COLORS[number] {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Default avatar config
export type AvatarConfig = {
  emoji: string;
  color: string;
  borderColor: string;
};

export function getDefaultAvatar(): AvatarConfig {
  const color = getRandomColor();
  return {
    emoji: getRandomAvatar(),
    color: color.value,
    borderColor: color.border,
  };
}

// Generate avatar from player ID (deterministic fallback)
export function getAvatarFromId(playerId: string): AvatarConfig {
  const all = getAllAvatars();
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = ((hash << 5) - hash + playerId.charCodeAt(i)) | 0;
  }
  const avatarIndex = Math.abs(hash) % all.length;
  const colorIndex = Math.abs(hash >> 8) % AVATAR_COLORS.length;
  const color = AVATAR_COLORS[colorIndex];
  
  return {
    emoji: all[avatarIndex],
    color: color.value,
    borderColor: color.border,
  };
}
