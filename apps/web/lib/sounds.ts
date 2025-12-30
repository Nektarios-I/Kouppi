"use client";

/**
 * Sound System for KOUPPI
 * 
 * This module provides a centralized, bulletproof sound management system.
 * All sounds are loaded lazily and errors are handled gracefully - 
 * the game will continue to work even if sounds fail to load/play.
 * 
 * To change sounds in the future, simply update the URLs in SOUND_URLS.
 */

// Sound URLs - Using royalty-free sounds from CDNs
// These can be easily replaced with custom sounds later
const SOUND_URLS = {
  // Card sounds
  cardDeal: "https://cdn.freesound.org/previews/240/240776_4107740-lq.mp3",
  cardFlip: "https://cdn.freesound.org/previews/240/240777_4107740-lq.mp3",
  cardShuffle: "https://cdn.freesound.org/previews/394/394724_7490645-lq.mp3",
  
  // Chip/betting sounds
  chipBet: "https://cdn.freesound.org/previews/265/265115_4819806-lq.mp3",
  chipStack: "https://cdn.freesound.org/previews/341/341695_1375639-lq.mp3",
  
  // Game events
  win: "https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3",
  lose: "https://cdn.freesound.org/previews/159/159408_2538033-lq.mp3",
  yourTurn: "https://cdn.freesound.org/previews/352/352661_4019029-lq.mp3",
  timer: "https://cdn.freesound.org/previews/254/254316_4486188-lq.mp3",
  
  // UI sounds
  buttonClick: "https://cdn.freesound.org/previews/242/242501_4284968-lq.mp3",
  notification: "https://cdn.freesound.org/previews/352/352661_4019029-lq.mp3",
  error: "https://cdn.freesound.org/previews/142/142608_1840739-lq.mp3",
  
  // Background music (loopable casino ambiance)
  bgMusic: "https://cdn.freesound.org/previews/456/456965_9159316-lq.mp3",
} as const;

export type SoundName = keyof typeof SOUND_URLS;

// Audio cache to avoid reloading sounds
const audioCache: Map<SoundName, HTMLAudioElement> = new Map();

// Sound state
let masterVolume = 0.5;
let sfxVolume = 0.7;
let musicVolume = 0.3;
let isMuted = false;
let isMusicMuted = false;
let bgMusicElement: HTMLAudioElement | null = null;

// Listeners for state changes
type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("[Sound] Listener error:", e);
    }
  });
}

/**
 * Subscribe to sound state changes
 */
export function subscribeToSoundState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Get current sound state
 */
export function getSoundState() {
  return {
    masterVolume,
    sfxVolume,
    musicVolume,
    isMuted,
    isMusicMuted,
    isMusicPlaying: bgMusicElement ? !bgMusicElement.paused : false,
  };
}

/**
 * Set master volume (0-1)
 */
export function setMasterVolume(volume: number) {
  masterVolume = Math.max(0, Math.min(1, volume));
  if (bgMusicElement) {
    bgMusicElement.volume = masterVolume * musicVolume;
  }
  notifyListeners();
}

/**
 * Set SFX volume (0-1)
 */
export function setSfxVolume(volume: number) {
  sfxVolume = Math.max(0, Math.min(1, volume));
  notifyListeners();
}

/**
 * Set music volume (0-1)
 */
export function setMusicVolume(volume: number) {
  musicVolume = Math.max(0, Math.min(1, volume));
  if (bgMusicElement) {
    bgMusicElement.volume = masterVolume * musicVolume;
  }
  notifyListeners();
}

/**
 * Toggle mute all sounds
 */
export function toggleMute(): boolean {
  isMuted = !isMuted;
  if (isMuted && bgMusicElement) {
    bgMusicElement.pause();
  } else if (!isMuted && !isMusicMuted && bgMusicElement) {
    bgMusicElement.play().catch(() => {});
  }
  notifyListeners();
  return isMuted;
}

/**
 * Set mute state
 */
export function setMuted(muted: boolean) {
  isMuted = muted;
  if (isMuted && bgMusicElement) {
    bgMusicElement.pause();
  } else if (!isMuted && !isMusicMuted && bgMusicElement) {
    bgMusicElement.play().catch(() => {});
  }
  notifyListeners();
}

/**
 * Toggle music mute
 */
export function toggleMusicMute(): boolean {
  isMusicMuted = !isMusicMuted;
  if (isMusicMuted && bgMusicElement) {
    bgMusicElement.pause();
  } else if (!isMusicMuted && !isMuted && bgMusicElement) {
    bgMusicElement.play().catch(() => {});
  }
  notifyListeners();
  return isMusicMuted;
}

/**
 * Load and cache an audio element
 */
function loadSound(name: SoundName): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  
  try {
    if (audioCache.has(name)) {
      return audioCache.get(name)!;
    }
    
    const url = SOUND_URLS[name];
    const audio = new Audio(url);
    audio.preload = "auto";
    
    // Add error handling
    audio.onerror = () => {
      console.warn(`[Sound] Failed to load: ${name}`);
    };
    
    audioCache.set(name, audio);
    return audio;
  } catch (e) {
    console.warn(`[Sound] Error creating audio for ${name}:`, e);
    return null;
  }
}

/**
 * Play a sound effect
 * This is safe to call - will not throw or break the game if sound fails
 */
export function playSound(name: SoundName, options?: { volume?: number; loop?: boolean }): void {
  if (typeof window === "undefined") return;
  if (isMuted) return;
  if (name === "bgMusic") return; // Use playBackgroundMusic for music
  
  try {
    const cached = loadSound(name);
    if (!cached) return;
    
    // Clone for overlapping sounds
    const audio = cached.cloneNode(true) as HTMLAudioElement;
    audio.volume = masterVolume * sfxVolume * (options?.volume ?? 1);
    audio.loop = options?.loop ?? false;
    
    // Auto-cleanup after playing
    audio.onended = () => {
      audio.remove();
    };
    
    audio.play().catch((e) => {
      // Common on mobile - user hasn't interacted yet
      console.debug(`[Sound] Playback blocked for ${name}:`, e.message);
    });
  } catch (e) {
    // Fail silently - sound is not critical
    console.debug(`[Sound] Error playing ${name}:`, e);
  }
}

/**
 * Start background music
 */
export function playBackgroundMusic(): void {
  if (typeof window === "undefined") return;
  if (isMuted || isMusicMuted) return;
  
  try {
    if (!bgMusicElement) {
      bgMusicElement = new Audio(SOUND_URLS.bgMusic);
      bgMusicElement.loop = true;
      bgMusicElement.volume = masterVolume * musicVolume;
      
      bgMusicElement.onerror = () => {
        console.warn("[Sound] Failed to load background music");
        bgMusicElement = null;
      };
      
      bgMusicElement.onended = () => {
        // Restart if loop somehow fails
        if (!isMuted && !isMusicMuted) {
          bgMusicElement?.play().catch(() => {});
        }
      };
    }
    
    bgMusicElement.play().catch((e) => {
      console.debug("[Sound] Music playback blocked:", e.message);
    });
    notifyListeners();
  } catch (e) {
    console.debug("[Sound] Error starting music:", e);
  }
}

/**
 * Stop background music
 */
export function stopBackgroundMusic(): void {
  if (bgMusicElement) {
    bgMusicElement.pause();
    bgMusicElement.currentTime = 0;
    notifyListeners();
  }
}

/**
 * Pause background music
 */
export function pauseBackgroundMusic(): void {
  if (bgMusicElement) {
    bgMusicElement.pause();
    notifyListeners();
  }
}

/**
 * Resume background music
 */
export function resumeBackgroundMusic(): void {
  if (!isMuted && !isMusicMuted && bgMusicElement) {
    bgMusicElement.play().catch(() => {});
    notifyListeners();
  }
}

/**
 * Preload common sounds for better responsiveness
 */
export function preloadSounds(): void {
  if (typeof window === "undefined") return;
  
  const toPreload: SoundName[] = [
    "cardDeal",
    "cardFlip",
    "chipBet",
    "yourTurn",
    "buttonClick",
  ];
  
  toPreload.forEach((name) => {
    try {
      loadSound(name);
    } catch (e) {
      // Ignore preload errors
    }
  });
}

/**
 * Helper sounds for common game events
 */
export const GameSounds = {
  deal: () => playSound("cardDeal"),
  flip: () => playSound("cardFlip"),
  shuffle: () => playSound("cardShuffle"),
  bet: () => playSound("chipBet"),
  chips: () => playSound("chipStack"),
  win: () => playSound("win"),
  lose: () => playSound("lose"),
  yourTurn: () => playSound("yourTurn"),
  timerTick: () => playSound("timer", { volume: 0.3 }),
  click: () => playSound("buttonClick", { volume: 0.5 }),
  notify: () => playSound("notification"),
  error: () => playSound("error"),
};
