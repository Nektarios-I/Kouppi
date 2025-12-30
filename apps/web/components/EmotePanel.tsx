"use client";

import { useState } from "react";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import { EMOTE_CATEGORIES, QUICK_EMOTES } from "@/lib/emotes";
import { useGameSounds } from "@/hooks/useSounds";

/**
 * EmotePanel - A floating button that opens an emote picker
 * Players can click emotes to broadcast them to all other players
 */
export default function EmotePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(EMOTE_CATEGORIES[0].id);
  const sendEmote = useRemoteGameStore(s => s.sendEmote);
  const sounds = useGameSounds();

  const handleEmoteClick = (emote: string) => {
    sendEmote(emote);
    sounds.click();
    setIsOpen(false);
  };

  const currentCategory = EMOTE_CATEGORIES.find(cat => cat.id === activeCategory) || EMOTE_CATEGORIES[0];

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Main button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          sounds.click();
        }}
        className="w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg"
        style={{
          background: "linear-gradient(135deg, rgba(251, 191, 36, 0.9) 0%, rgba(245, 158, 11, 0.9) 100%)",
          boxShadow: "0 4px 15px rgba(251, 191, 36, 0.4)",
        }}
        title="Send Emote"
      >
        <span className="text-3xl">😀</span>
      </button>

      {/* Emote picker panel */}
      {isOpen && (
        <div
          className="absolute bottom-16 left-0 w-80 rounded-xl p-3 text-white"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-yellow-400">😀 Quick Reactions</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-lg"
            >
              ✕
            </button>
          </div>

          {/* Quick emotes row */}
          <div className="flex flex-wrap gap-1 mb-3 pb-3 border-b border-gray-700">
            {QUICK_EMOTES.map((emote) => (
              <button
                key={emote}
                onClick={() => handleEmoteClick(emote)}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl hover:bg-gray-700/50 transition-colors"
                title="Send emote"
              >
                {emote}
              </button>
            ))}
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 mb-2 overflow-x-auto pb-2">
            {EMOTE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeCategory === cat.id
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-gray-700/30 text-gray-400 hover:bg-gray-700/50"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Category emotes grid */}
          <div className="grid grid-cols-8 gap-1">
            {currentCategory.emotes.map((emote) => (
              <button
                key={emote}
                onClick={() => handleEmoteClick(emote)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xl hover:bg-gray-700/50 transition-colors"
                title="Send emote"
              >
                {emote}
              </button>
            ))}
          </div>

          {/* Tip */}
          <p className="text-xs text-gray-500 mt-3 text-center">
            Click an emote to send it to all players
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal emote button (just the toggle, no panel logic)
 * For embedding in other components
 */
export function EmoteButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-700/50 transition-colors"
      title="Send Emote"
    >
      <span className="text-xl">😀</span>
    </button>
  );
}
