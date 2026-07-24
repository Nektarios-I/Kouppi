"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TableEffectsLevel, TableSoundPreference } from "@/lib/tableEventFeedback/types";

interface TableEffectsStore {
  effects: TableEffectsLevel;
  sound: TableSoundPreference;
  setEffects: (effects: TableEffectsLevel) => void;
  setSound: (sound: TableSoundPreference) => void;
}

/**
 * Table effects + table sound preferences.
 * Persisted with the same zustand pattern as uiThemeStore.
 * Defaults are conservative: Full effects, sound On (master mute still applies).
 */
export const useTableEffectsStore = create<TableEffectsStore>()(
  persist(
    (set) => ({
      effects: "full",
      sound: "on",
      setEffects: (effects) => set({ effects }),
      setSound: (sound) => set({ sound }),
    }),
    { name: "kouppi-table-effects" }
  )
);

/** Effective visual level after prefers-reduced-motion. */
export function effectiveEffectsLevel(
  user: TableEffectsLevel,
  prefersReducedMotion: boolean
): TableEffectsLevel {
  if (user === "off") return "off";
  if (prefersReducedMotion) return "reduced";
  return user;
}
