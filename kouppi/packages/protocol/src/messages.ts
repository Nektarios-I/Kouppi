import { z } from "zod";

// Player identity
export const PlayerIdentity = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type PlayerIdentity = z.infer<typeof PlayerIdentity>;

// Room lifecycle
// Room config (subset of TableConfig) as partial overrides
const MinBetPolicy = z.object({ type: z.literal("fixed"), value: z.number().int().min(1) });
const ShistriConfig = z.object({ enabled: z.boolean(), percent: z.number().int().min(1).max(100), minChip: z.number().int().min(1) });
export const RoomConfig = z.object({
  ante: z.number().int().min(1),
  startingBankroll: z.number().int().min(1),
  minBetPolicy: MinBetPolicy,
  shistri: ShistriConfig,
  maxPlayers: z.number().int().min(2).max(20),
  deckPolicy: z.enum(["single_no_reshuffle_until_empty"]),
  allowKouppi: z.boolean(),
  spectatorsAllowed: z.boolean(),
  language: z.enum(["en"]),
});

export const CreateRoomPayload = z.object({
  roomId: z.string().min(3),
  creator: PlayerIdentity,
  config: RoomConfig.partial().default({}),
});
export type CreateRoomPayload = z.infer<typeof CreateRoomPayload>;

export const JoinRoomPayload = z.object({
  roomId: z.string().min(3),
  player: PlayerIdentity,
});
export type JoinRoomPayload = z.infer<typeof JoinRoomPayload>;

export const StartRoomPayload = z.object({ roomId: z.string().min(3), by: z.string().min(1) });
export type StartRoomPayload = z.infer<typeof StartRoomPayload>;

// Game intents (proxy to game-core Action)
export const BetIntent = z.object({ type: z.literal("bet"), amount: z.number().int().min(1) });
export const KouppiIntent = z.object({ type: z.literal("kouppi") });
export const ShistriIntent = z.object({ type: z.literal("shistri") });
export const PassIntent = z.object({ type: z.literal("pass") });
export const StartRoundIntent = z.object({ type: z.literal("startRound") });
export const AnteIntent = z.object({ type: z.literal("ante") });
export const DetermineStarterIntent = z.object({ type: z.literal("determineStarter") });
export const StartTurnIntent = z.object({ type: z.literal("startTurn") });
export const NextPlayerIntent = z.object({ type: z.literal("nextPlayer") });
export const NextRoundIntent = z.object({ type: z.literal("nextRound") });

export const Intent = z.union([
  BetIntent,
  KouppiIntent,
  ShistriIntent,
  PassIntent,
  StartRoundIntent,
  AnteIntent,
  DetermineStarterIntent,
  StartTurnIntent,
  NextPlayerIntent,
  NextRoundIntent,
]);
export type Intent = z.infer<typeof Intent>;

// Socket events
export const ServerEvents = {
  state: z.any(), // opaque snapshot from server using @kouppi/game-core types
  error: z.object({ code: z.string(), message: z.string() }),
};

export const ClientEvents = {
  createRoom: CreateRoomPayload,
  joinRoom: JoinRoomPayload,
  intent: z.object({ roomId: z.string(), playerId: z.string(), intent: Intent }),
  startRoom: StartRoomPayload,
};

export const RoomsListItem = z.object({
  id: z.string(),
  playerCount: z.number().int(),
  maxPlayers: z.number().int(),
  started: z.boolean(),
  hostId: z.string(),
});
export type RoomsListItem = z.infer<typeof RoomsListItem>;
