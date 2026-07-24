"use client";

import { useState } from "react";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import { EMOTE_CATEGORIES, QUICK_EMOTES } from "@/lib/emotes";
import { useGameSounds } from "@/hooks/useSounds";
import { HudIconButton } from "@/components/game/HudButton";
import { useRewardStore } from "@/store/rewardStore";
import { getUnlockedEmoteGlyphs } from "@/lib/cosmetics";

export default function EmotePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(EMOTE_CATEGORIES[0].id);
  const sendEmote = useRemoteGameStore((s) => s.sendEmote);
  const sounds = useGameSounds();
  const catalog = useRewardStore((s) => s.state?.cosmeticsCatalog);
  const bonusEmotes = getUnlockedEmoteGlyphs(catalog ?? []);
  const quickEmotes = Array.from(new Set([...QUICK_EMOTES, ...bonusEmotes]));

  const handleEmoteClick = (emote: string) => {
    sendEmote(emote);
    sounds.click();
    setIsOpen(false);
  };

  const currentCategory =
    EMOTE_CATEGORIES.find((cat) => cat.id === activeCategory) || EMOTE_CATEGORIES[0];

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          sounds.click();
        }}
        className="emote-fab"
        title="Send Emote"
      >
        <span className="text-3xl">😀</span>
      </button>

      {isOpen && (
        <div className="emote-panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-gold-light tracking-wide">Quick Reactions</h3>
            <HudIconButton
              className="!w-8 !h-8 text-gray-400 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </HudIconButton>
          </div>

          <div className="flex flex-wrap gap-1 mb-3 pb-3 border-b border-white/10">
            {quickEmotes.map((emote) => (
              <button
                key={emote}
                type="button"
                onClick={() => handleEmoteClick(emote)}
                className="avatar-emoji-btn"
                title="Send emote"
              >
                {emote}
              </button>
            ))}
          </div>

          <div className="flex gap-1 mb-2 overflow-x-auto pb-2">
            {EMOTE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`emote-tab ${activeCategory === cat.id ? "emote-tab-active" : ""}`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-8 gap-1">
            {currentCategory.emotes.map((emote) => (
              <button
                key={emote}
                type="button"
                onClick={() => handleEmoteClick(emote)}
                className="avatar-emoji-btn !w-9 !h-9 !text-lg"
                title="Send emote"
              >
                {emote}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500 mt-3 text-center font-ui">
            Click an emote to send it to all players
          </p>
        </div>
      )}
    </div>
  );
}

export function EmoteButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="emote-fab !w-10 !h-10"
      title="Send Emote"
    >
      <span className="text-xl">😀</span>
    </button>
  );
}
