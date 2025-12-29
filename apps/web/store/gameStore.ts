"use client";
import { create } from "zustand";
import type { GameState } from "@kouppi/game-core";
import { initGame, applyAction } from "@kouppi/game-core";
import type { BotProfile } from "@kouppi/game-core";
import type { TableSettings } from "@/components/SettingsDialog";

type GameStore = {
  state: GameState;
  ready: boolean; // gate to start the round
  botProfiles: Record<string, BotProfile>; // per-bot id
  dispatch: (action: Parameters<typeof applyAction>[1]) => void;
  startRound: () => void;
  step: () => void; // convenience: startTurn
  configureSinglePlayer: (s: TableSettings) => void;
};

export const useGameStore = create<GameStore>((set, get) => {
  // bootstrap with a placeholder game; ready=false prevents auto-start
  const bootstrap = initGame({
    players: [{ id: "you", name: "You" }, { id: "bot1", name: "Bot 1", isBot: true }],
    seed: 1234,
    config: {
      ante: 10,
      startingBankroll: 100,
      minBetPolicy: { type: "fixed", value: 10 },
      shistri: { enabled: true, percent: 5, minChip: 1 },
      deckPolicy: "single_no_reshuffle_until_empty",
      language: "en",
      maxPlayers: 8,
      allowKouppi: true,
      spectatorsAllowed: false,
    }
  });

  return {
    state: bootstrap,
    ready: false,
    botProfiles: {},

    dispatch: (action) => set(s => ({ state: applyAction(s.state, action) })),

    startRound: () => set(s => ({ state: applyAction(s.state, { type: "startRound" }) })),
    step: () => set(s => ({ state: applyAction(s.state, { type: "startTurn" }) })),

    configureSinglePlayer: (ts: TableSettings) => {
      // Build players: You + N bots
      const players = [{ id: "you", name: "You" }, ...Array.from({ length: ts.numberBots }, (_, i) => ({
        id: `bot${i + 1}`,
        name: `Bot ${i + 1}`,
        isBot: true,
      }))];

      // Prepare config
      const config = {
        ante: ts.ante,
        startingBankroll: ts.startingBankroll,
        minBetPolicy: { type: "fixed", value: 10 } as const, // can expose later
        shistri: { enabled: ts.shistri, percent: 5, minChip: 1 },
        deckPolicy: "single_no_reshuffle_until_empty" as const,
        language: "en" as const,
        maxPlayers: Math.max(2, players.length),
        allowKouppi: true as const,
        spectatorsAllowed: false as const,
      };

      // Re-init game
      const newState = initGame({
        players,
        seed: Math.floor(Math.random() * 1e9), // new seed per table
        config
      });

      // Set a single profile for all bots for now (can make per-bot later)
      const profile: BotProfile = { mode: ts.botMode, difficulty: ts.botDifficulty };
      const profiles: Record<string, BotProfile> = {};
      players.forEach(p => { if ((p as any).isBot) profiles[p.id] = profile; });

      set({
        state: newState,
        ready: true,
        botProfiles: profiles,
      });
    },
  };
});
