"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getSoundState,
  subscribeToSoundState,
  setMasterVolume,
  setSfxVolume,
  setMusicVolume,
  toggleMute,
  setMuted,
  toggleMusicMute,
  playSound,
  playBackgroundMusic,
  stopBackgroundMusic,
  pauseBackgroundMusic,
  resumeBackgroundMusic,
  preloadSounds,
  GameSounds,
  type SoundName,
} from "@/lib/sounds";

/**
 * React hook for sound system
 * Provides reactive state and control methods
 */
export function useSounds() {
  const [state, setState] = useState(getSoundState);

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = subscribeToSoundState(() => {
      setState(getSoundState());
    });

    // Preload sounds on mount
    preloadSounds();

    return unsubscribe;
  }, []);

  const play = useCallback((name: SoundName, options?: { volume?: number }) => {
    playSound(name, options);
  }, []);

  return {
    // State
    ...state,
    
    // Volume controls
    setMasterVolume,
    setSfxVolume,
    setMusicVolume,
    
    // Mute controls
    toggleMute,
    setMuted,
    toggleMusicMute,
    
    // Playback
    play,
    playBackgroundMusic,
    stopBackgroundMusic,
    pauseBackgroundMusic,
    resumeBackgroundMusic,
    
    // Convenience sounds
    sounds: GameSounds,
  };
}

/**
 * Simple hook to just play sounds without state
 * Useful for components that don't need to control volume
 */
export function useGameSounds() {
  useEffect(() => {
    preloadSounds();
  }, []);

  return GameSounds;
}
