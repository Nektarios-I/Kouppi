"use client";

/**
 * Emote Configuration for KOUPPI
 * 
 * This is the single source of truth for all available emotes.
 * To add new emotes, simply add them to the appropriate category below.
 * 
 * Categories help organize the emote picker UI.
 */

export type EmoteCategory = {
  id: string;
  name: string;
  icon: string;
  emotes: string[];
};

// Define all emote categories - easy to extend
export const EMOTE_CATEGORIES: EmoteCategory[] = [
  {
    id: "reactions",
    name: "Reactions",
    icon: "😀",
    emotes: ["👍", "👎", "👏", "🎉", "🔥", "💪", "🙌", "😮"],
  },
  {
    id: "emotions",
    name: "Emotions",
    icon: "😊",
    emotes: ["😀", "😂", "😅", "🤔", "😎", "😢", "😡", "🥳"],
  },
  {
    id: "game",
    name: "Game",
    icon: "🎰",
    emotes: ["🃏", "💰", "💵", "💎", "🏆", "🎲", "♠️", "♥️"],
  },
  {
    id: "taunts",
    name: "Taunts",
    icon: "😈",
    emotes: ["😏", "🤑", "😈", "👀", "🙈", "💀", "🤡", "👋"],
  },
  {
    id: "luck",
    name: "Luck",
    icon: "🍀",
    emotes: ["🍀", "🌟", "✨", "🔮", "🎯", "⭐", "💫", "🤞"],
  },
];

// Flatten all emotes for quick access
export const ALL_EMOTES: string[] = EMOTE_CATEGORIES.flatMap(cat => cat.emotes);

// Quick emotes shown at the top of the picker (most used)
export const QUICK_EMOTES: string[] = ["👍", "👎", "😂", "🔥", "🎉", "💰", "😏", "👋"];

/**
 * Validate if an emote is in the allowed list
 */
export function isValidEmote(emote: string): boolean {
  return ALL_EMOTES.includes(emote) || QUICK_EMOTES.includes(emote);
}

/**
 * Get the category for an emote
 */
export function getEmoteCategory(emote: string): EmoteCategory | undefined {
  return EMOTE_CATEGORIES.find(cat => cat.emotes.includes(emote));
}
