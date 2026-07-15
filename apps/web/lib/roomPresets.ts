import type { RoomConfig } from "@/store/remoteGameStore";

export type RoomPresetId = "quick" | "classic" | "highStakes";

export type RoomPreset = {
  id: RoomPresetId;
  label: string;
  description: string;
  config: Partial<RoomConfig> & { turnTimeout?: number };
};

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: "quick",
    label: "Quick",
    description: "Fast tables, smaller stakes",
    config: {
      ante: 5,
      startingBankroll: 50,
      maxPlayers: 4,
      turnTimeout: 20,
      shistri: { enabled: true, percent: 5, minChip: 1 },
      spectatorsAllowed: true,
    },
  },
  {
    id: "classic",
    label: "Classic",
    description: "Default KOUPPI experience",
    config: {
      ante: 10,
      startingBankroll: 100,
      maxPlayers: 8,
      turnTimeout: 30,
      shistri: { enabled: true, percent: 5, minChip: 1 },
      spectatorsAllowed: true,
    },
  },
  {
    id: "highStakes",
    label: "High Stakes",
    description: "Bigger antes and bankrolls",
    config: {
      ante: 25,
      startingBankroll: 500,
      maxPlayers: 6,
      turnTimeout: 45,
      shistri: { enabled: true, percent: 5, minChip: 1 },
      spectatorsAllowed: true,
    },
  },
];

export function getRoomPreset(id: RoomPresetId): RoomPreset {
  return ROOM_PRESETS.find((p) => p.id === id) ?? ROOM_PRESETS[1];
}
