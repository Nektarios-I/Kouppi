import { z } from "zod";
import { resolveAvatarId } from "./avatars.js";

// Avatar configuration — catalog id only (fixed premium ring in UI)
export const AvatarConfig = z
  .object({
    id: z.string().min(1).max(64),
  })
  .transform((v) => ({ id: resolveAvatarId(v.id) }));
export type AvatarConfig = { id: string };

/** Identity cosmetics visible to other players at the table / lobby */
export const PlayerCosmetics = z.object({
  titleId: z.string().nullable().optional(),
  badgeId: z.string().nullable().optional(),
  frameId: z.string().nullable().optional(),
  seatRingId: z.string().nullable().optional(),
});
export type PlayerCosmetics = z.infer<typeof PlayerCosmetics>;

// Player identity
export const PlayerIdentity = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatar: AvatarConfig.optional(),
  cosmetics: PlayerCosmetics.optional(),
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
  roomId: z.string().min(3).optional(),
  /** Optional 6-char public code; server generates if omitted */
  code: z.string().min(4).max(8).optional(),
  creator: PlayerIdentity,
  config: RoomConfig.partial().default({}),
  password: z.string().optional(),
  listedInLobby: z.boolean().optional(),
  presetLabel: z.string().max(32).optional(),
  /** Optional JWT — binds host seat to logged-in account */
  authToken: z.string().optional(),
});
export type CreateRoomPayload = z.infer<typeof CreateRoomPayload>;

export const SetReadyPayload = z.object({
  roomId: z.string().min(1),
  ready: z.boolean(),
});
export type SetReadyPayload = z.infer<typeof SetReadyPayload>;

export const TransferHostPayload = z.object({
  roomId: z.string().min(1),
  targetId: z.string().min(1),
});
export type TransferHostPayload = z.infer<typeof TransferHostPayload>;

export const CloseRoomPayload = z.object({
  roomId: z.string().min(1),
});
export type CloseRoomPayload = z.infer<typeof CloseRoomPayload>;

export const RoomPlayerInfo = z.object({
  id: z.string(),
  name: z.string(),
  avatar: AvatarConfig.optional(),
  cosmetics: PlayerCosmetics.optional(),
  ready: z.boolean().optional(),
  connected: z.boolean().optional(),
  reconnectRemainingSec: z.number().int().nullable().optional(),
});
export type RoomPlayerInfo = z.infer<typeof RoomPlayerInfo>;

export const RoomUpdatePayload = z.object({
  roomId: z.string(),
  code: z.string(),
  version: z.number().int(),
  players: z.array(RoomPlayerInfo),
  spectators: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      avatar: AvatarConfig.optional(),
      connected: z.boolean().optional(),
      reconnectRemainingSec: z.number().int().nullable().optional(),
    })
  ),
  hostId: z.string().optional(),
  chatMutedAll: z.boolean().optional(),
  chatMutedPlayerIds: z.array(z.string()).optional(),
});
export type RoomUpdatePayload = z.infer<typeof RoomUpdatePayload>;

/** Join/create ack includes a per-seat secret for reconnect (not broadcast to other clients). */
export const RoomJoinAck = RoomUpdatePayload.extend({
  joinSessionToken: z.string().min(16).optional(),
});
export type RoomJoinAck = z.infer<typeof RoomJoinAck>;

export const JoinRoomPayload = z.object({
  roomId: z.string().min(1), // Room id or public code (case-insensitive)
  player: PlayerIdentity,
  password: z.string().optional(),
  /** Required to reclaim an existing seat after disconnect grace */
  joinSessionToken: z.string().min(16).optional(),
  /** Optional JWT — binds seat to logged-in account */
  authToken: z.string().optional(),
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

/** Gameplay intents clients may send */
export const ClientIntent = z.union([
  BetIntent,
  KouppiIntent,
  ShistriIntent,
  PassIntent,
]);
export type ClientIntent = z.infer<typeof ClientIntent>;

/** Full intent union (includes server-only system intents) */
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

export const JoinAsSpectatorPayload = z.object({
  roomId: z.string().min(3),
  spectator: PlayerIdentity,
  password: z.string().optional(),
  joinSessionToken: z.string().min(16).optional(),
  authToken: z.string().optional(),
});
export type JoinAsSpectatorPayload = z.infer<typeof JoinAsSpectatorPayload>;

// Socket events
export const ServerEvents = {
  state: z.any(), // opaque snapshot from server using @kouppi/game-core types
  error: z.object({ code: z.string(), message: z.string() }),
};

export const ClientEvents = {
  createRoom: CreateRoomPayload,
  joinRoom: JoinRoomPayload,
  intent: z.object({ roomId: z.string(), playerId: z.string().optional(), intent: ClientIntent }),
  startRoom: StartRoomPayload,
  joinAsSpectator: JoinAsSpectatorPayload,
};

export const RoomsListItem = z.object({
  id: z.string(),
  code: z.string(),
  playerCount: z.number().int(),
  maxPlayers: z.number().int(),
  started: z.boolean(),
  hostId: z.string().optional(),
  isPrivate: z.boolean().optional(),
  spectatorsAllowed: z.boolean().optional(),
  spectatorCount: z.number().int().optional(),
  listedInLobby: z.boolean().optional(),
  seatsOpen: z.boolean().optional(),
  createdAt: z.number().optional(),
  presetLabel: z.string().optional(),
});
export type RoomsListItem = z.infer<typeof RoomsListItem>;

// Friends system
export const FriendProfile = z.object({
  id: z.string(),
  username: z.string(),
  avatarId: z.string(),
  friendsSince: z.number(),
});
export type FriendProfile = z.infer<typeof FriendProfile>;

export const FriendRequestInfo = z.object({
  id: z.string(),
  fromUserId: z.string(),
  toUserId: z.string(),
  status: z.enum(["pending", "accepted", "declined", "cancelled"]),
  createdAt: z.number(),
  respondedAt: z.number().nullable(),
  fromUsername: z.string().optional(),
  toUsername: z.string().optional(),
});
export type FriendRequestInfo = z.infer<typeof FriendRequestInfo>;

export const PresenceStatus = z.enum([
  "offline",
  "lobby",
  "in_room",
  "in_game",
  "career_queue",
  "career_room",
]);
export type PresenceStatus = z.infer<typeof PresenceStatus>;

export const UserPresence = z.object({
  userId: z.string(),
  status: PresenceStatus,
  roomCode: z.string().optional(),
  roomId: z.string().optional(),
  lastSeen: z.number(),
});
export type UserPresence = z.infer<typeof UserPresence>;

export const FriendsAuthPayload = z.object({
  token: z.string().min(1),
});
export type FriendsAuthPayload = z.infer<typeof FriendsAuthPayload>;

export const FriendsInvitePayload = z.object({
  friendId: z.string(),
  roomCode: z.string(),
  roomId: z.string(),
});
export type FriendsInvitePayload = z.infer<typeof FriendsInvitePayload>;

export const FriendsGameInvite = z.object({
  fromUserId: z.string(),
  fromUsername: z.string(),
  roomCode: z.string(),
  roomId: z.string(),
  timestamp: z.number(),
});
export type FriendsGameInvite = z.infer<typeof FriendsGameInvite>;
