import type { Room } from "../types.js";

/** Fields that cannot be serialized to Redis (timers, intervals). */
const RUNTIME_ONLY_KEYS = new Set([
  "turnTimer",
  "flowTimer",
  "timerIntervalId",
  "graceTickInterval",
  "autoRoundTimer",
  "pendingRemovalTimer",
]);

/** Strip runtime handles from player/spectator sessions before persistence. */
export function toRoomSnapshot(room: Room): Room {
  const snapshot: Room = {
    ...room,
    turnTimer: undefined,
    flowTimer: undefined,
    timerIntervalId: undefined,
    graceTickInterval: undefined,
    autoRoundTimer: undefined,
    decision: room.decision
      ? {
          ...room.decision,
          timer: undefined,
          interval: undefined,
        }
      : undefined,
    players: room.players.map((p) => ({
      ...p,
      pendingRemovalTimer: undefined,
    })),
    spectators: room.spectators?.map((s) => ({
      ...s,
      pendingRemovalTimer: undefined,
    })),
  };
  return snapshot;
}

/** Merge a Redis snapshot into an existing in-memory room, preserving runtime handles. */
export function mergeRoomSnapshot(existing: Room | undefined, snapshot: Room): Room {
  if (!existing) return { ...snapshot };

  const merged: Room = {
    ...snapshot,
    turnTimer: existing.turnTimer,
    flowTimer: existing.flowTimer,
    timerIntervalId: existing.timerIntervalId,
    graceTickInterval: existing.graceTickInterval,
    autoRoundTimer: existing.autoRoundTimer,
    decision: snapshot.decision
      ? {
          ...snapshot.decision,
          timer: existing.decision?.timer,
          interval: existing.decision?.interval,
        }
      : existing.decision,
    players: snapshot.players.map((p) => {
      const prev = existing.players.find((ep) => ep.id === p.id);
      return {
        ...p,
        pendingRemovalTimer: prev?.pendingRemovalTimer,
        socketId: prev?.socketId ?? p.socketId,
      };
    }),
    spectators: snapshot.spectators?.map((s) => {
      const prev = existing.spectators?.find((es) => es.id === s.id);
      return {
        ...s,
        pendingRemovalTimer: prev?.pendingRemovalTimer,
        socketId: prev?.socketId ?? s.socketId,
      };
    }),
  };
  return merged;
}

export function serializeRoom(room: Room): string {
  return JSON.stringify(toRoomSnapshot(room));
}

export function deserializeRoom(json: string): Room {
  return JSON.parse(json) as Room;
}

export function isRuntimeOnlyKey(key: string): boolean {
  return RUNTIME_ONLY_KEYS.has(key);
}
