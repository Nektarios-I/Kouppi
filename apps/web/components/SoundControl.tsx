"use client";

import { useState } from "react";
import { useSounds } from "@/hooks/useSounds";
import { HudButton } from "@/components/game/HudButton";
import { useTableEffectsStore } from "@/store/tableEffectsStore";
import type { TableEffectsLevel, TableSoundPreference } from "@/lib/tableEventFeedback/types";

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

  const effects = useTableEffectsStore((s) => s.effects);
  const tableSound = useTableEffectsStore((s) => s.sound);
  const setEffects = useTableEffectsStore((s) => s.setEffects);
  const setTableSound = useTableEffectsStore((s) => s.setSound);

  const [isOpen, setIsOpen] = useState(false);

  const handleToggleMusic = () => {
    if (isMusicPlaying) stopBackgroundMusic();
    else playBackgroundMusic();
  };

  const effectOptions: { id: TableEffectsLevel; label: string }[] = [
    { id: "full", label: "Full" },
    { id: "reduced", label: "Reduced" },
    { id: "off", label: "Off" },
  ];
  const soundOptions: { id: TableSoundPreference; label: string }[] = [
    { id: "on", label: "On" },
    { id: "off", label: "Off" },
  ];

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          sounds.click();
        }}
        className="sound-fab"
        title="Sound Settings"
        aria-label="Sound settings"
        aria-expanded={isOpen}
      >
        <span className="text-xl">{isMuted ? "🔇" : "🔊"}</span>
      </button>

      {isOpen && (
        <div className="sound-panel absolute top-14 right-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-gold-light tracking-wide">Sound</h3>
            <HudButton variant="ghost" size="sm" onClick={() => setIsOpen(false)} aria-label="Close">
              ✕
            </HudButton>
          </div>

          <div className="flex items-center justify-between mb-4 p-2.5 rounded-lg bg-black/35 border border-white/5">
            <span className="font-ui text-sm">Master</span>
            <HudButton
              variant={isMuted ? "danger" : "success"}
              size="sm"
              onClick={() => {
                toggleMute();
                sounds.click();
              }}
            >
              {isMuted ? "OFF" : "ON"}
            </HudButton>
          </div>

          {[
            { label: "Master Volume", value: masterVolume, set: setMasterVolume },
            { label: "Sound Effects", value: sfxVolume, set: setSfxVolume },
            { label: "Music", value: musicVolume, set: setMusicVolume },
          ].map((row) => (
            <div key={row.label} className="mb-4">
              <div className="flex items-center justify-between mb-1 font-ui text-xs text-gray-400">
                <span>{row.label}</span>
                <span>{Math.round(row.value * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={row.value * 100}
                onChange={(e) => row.set(Number(e.target.value) / 100)}
                className="game-action-slider w-full"
              />
            </div>
          ))}

          <div className="flex items-center gap-2 mb-4">
            <HudButton
              variant={isMusicPlaying ? "success" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={handleToggleMusic}
            >
              {isMusicPlaying ? "Music On" : "Play Music"}
            </HudButton>
            <HudButton
              variant={isMusicMuted ? "danger" : "ghost"}
              size="sm"
              onClick={() => {
                toggleMusicMute();
                sounds.click();
              }}
            >
              {isMusicMuted ? "🔇" : "🔊"}
            </HudButton>
          </div>

          <div className="table-effects-row" data-testid="table-effects-settings">
            <span className="table-effects-label">Table effects</span>
            <div className="table-effects-options" role="group" aria-label="Table effects">
              {effectOptions.map((opt) => (
                <HudButton
                  key={opt.id}
                  variant={effects === opt.id ? "success" : "ghost"}
                  size="sm"
                  aria-pressed={effects === opt.id}
                  onClick={() => {
                    setEffects(opt.id);
                    sounds.click();
                  }}
                >
                  {opt.label}
                </HudButton>
              ))}
            </div>
            <span className="table-effects-label">Table sound</span>
            <div className="table-effects-options" role="group" aria-label="Table sound">
              {soundOptions.map((opt) => (
                <HudButton
                  key={opt.id}
                  variant={tableSound === opt.id ? "success" : "ghost"}
                  size="sm"
                  aria-pressed={tableSound === opt.id}
                  onClick={() => {
                    setTableSound(opt.id);
                    sounds.click();
                  }}
                >
                  {opt.label}
                </HudButton>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-white/10">
            <p className="text-[10px] text-gray-500 mb-2 font-ui uppercase tracking-wider">Test</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Deal", fn: sounds.deal },
                { label: "Bet", fn: sounds.bet },
                { label: "Win", fn: sounds.win },
                { label: "Turn", fn: sounds.yourTurn },
              ].map((t) => (
                <button key={t.label} type="button" className="sound-panel-btn" onClick={() => t.fn()}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SoundToggle() {
  const { isMuted, toggleMute, sounds } = useSounds();

  return (
    <button
      onClick={() => {
        toggleMute();
        if (isMuted) sounds.click();
      }}
      className="sound-fab w-10 h-10"
      title={isMuted ? "Unmute" : "Mute"}
    >
      <span className="text-lg">{isMuted ? "🔇" : "🔊"}</span>
    </button>
  );
}
