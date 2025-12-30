"use client";

import { useState } from "react";
import { useSounds } from "@/hooks/useSounds";

/**
 * Sound control button with popup panel
 * Can be placed anywhere in the UI
 */
export default function SoundControl() {
  const {
    masterVolume,
    sfxVolume,
    musicVolume,
    isMuted,
    isMusicMuted,
    isMusicPlaying,
    setMasterVolume,
    setSfxVolume,
    setMusicVolume,
    toggleMute,
    toggleMusicMute,
    playBackgroundMusic,
    stopBackgroundMusic,
    sounds,
  } = useSounds();

  const [isOpen, setIsOpen] = useState(false);

  const handleToggleMusic = () => {
    if (isMusicPlaying) {
      stopBackgroundMusic();
    } else {
      playBackgroundMusic();
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Main button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          sounds.click();
        }}
        className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(79, 70, 229, 0.9) 100%)",
          boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)",
        }}
        title="Sound Settings"
      >
        <span className="text-2xl">{isMuted ? "🔇" : "🔊"}</span>
      </button>

      {/* Control panel */}
      {isOpen && (
        <div
          className="absolute top-14 right-0 w-72 rounded-xl p-4 text-white"
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-indigo-400">🔊 Sound Settings</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Master mute */}
          <div className="flex items-center justify-between mb-4 p-2 rounded-lg bg-gray-800/50">
            <span>Master Sound</span>
            <button
              onClick={() => {
                toggleMute();
                sounds.click();
              }}
              className={`px-3 py-1 rounded-lg transition-all ${
                isMuted 
                  ? "bg-red-500/20 text-red-400" 
                  : "bg-green-500/20 text-green-400"
              }`}
            >
              {isMuted ? "OFF" : "ON"}
            </button>
          </div>

          {/* Master volume */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">Master Volume</span>
              <span className="text-sm text-gray-400">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume * 100}
              onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* SFX volume */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">🎮 Sound Effects</span>
              <span className="text-sm text-gray-400">{Math.round(sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVolume * 100}
              onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Music volume */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">🎵 Music</span>
              <span className="text-sm text-gray-400">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume * 100}
              onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Music controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMusic}
              className={`flex-1 py-2 rounded-lg transition-all ${
                isMusicPlaying
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
              }`}
            >
              {isMusicPlaying ? "🎵 Music Playing" : "▶️ Play Music"}
            </button>
            <button
              onClick={() => {
                toggleMusicMute();
                sounds.click();
              }}
              className={`px-3 py-2 rounded-lg transition-all ${
                isMusicMuted
                  ? "bg-red-500/20 text-red-400"
                  : "bg-gray-700/50 text-gray-400"
              }`}
              title={isMusicMuted ? "Unmute Music" : "Mute Music"}
            >
              {isMusicMuted ? "🔇" : "🔊"}
            </button>
          </div>

          {/* Test sounds */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-2">Test sounds:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => sounds.deal()}
                className="px-2 py-1 text-xs bg-gray-700/50 rounded hover:bg-gray-600/50"
              >
                🃏 Deal
              </button>
              <button
                onClick={() => sounds.bet()}
                className="px-2 py-1 text-xs bg-gray-700/50 rounded hover:bg-gray-600/50"
              >
                💰 Bet
              </button>
              <button
                onClick={() => sounds.win()}
                className="px-2 py-1 text-xs bg-gray-700/50 rounded hover:bg-gray-600/50"
              >
                🎉 Win
              </button>
              <button
                onClick={() => sounds.yourTurn()}
                className="px-2 py-1 text-xs bg-gray-700/50 rounded hover:bg-gray-600/50"
              >
                🔔 Turn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Minimal sound toggle button (just mute/unmute)
 */
export function SoundToggle() {
  const { isMuted, toggleMute, sounds } = useSounds();

  return (
    <button
      onClick={() => {
        toggleMute();
        if (isMuted) sounds.click(); // Play click when unmuting
      }}
      className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
      style={{
        background: isMuted
          ? "rgba(239, 68, 68, 0.2)"
          : "rgba(34, 197, 94, 0.2)",
        border: `1px solid ${isMuted ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
      }}
      title={isMuted ? "Unmute" : "Mute"}
    >
      <span className="text-lg">{isMuted ? "🔇" : "🔊"}</span>
    </button>
  );
}
