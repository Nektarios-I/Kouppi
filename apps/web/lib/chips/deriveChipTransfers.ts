import type { LastResolutionLike } from "@/lib/tableEventFeedback/types";
import type { ChipTransfer, ChipTransferKind } from "./types";

export type DeriveChipTransfersInput = {
  resolution: LastResolutionLike | null | undefined;
  /** Extra salt (history length, gameStateVersion, etc.) */
  sequenceSalt?: string | number;
  /** Override clock for tests */
  now?: number;
};

const TRANSFER_DURATION = {
  normal: 500,
  shistri: 700,
} as const;

/**
 * Stable transfer id from genuine resolution fields (no React render ids).
 * Limitation: no server event id — reconnect with cleared dedupe may re-emit.
 */
export function chipTransferDedupeKey(
  resolution: LastResolutionLike,
  sequenceSalt?: string | number
): string {
  const reveal =
    resolution.reveal && resolution.reveal.rank != null
      ? `${resolution.reveal.rank}:${resolution.reveal.suit ?? ""}`
      : "none";
  const amount = resolution.amount ?? "na";
  const win = resolution.win === true ? "1" : resolution.win === false ? "0" : "x";
  const salt = sequenceSalt !== undefined ? String(sequenceSalt) : "";
  return ["chip", resolution.playerId, resolution.kind, win, amount, reveal, salt].join(
    "|"
  );
}

function durationFor(kind: ChipTransferKind): number {
  if (kind === "shistri-win" || kind === "shistri-loss") {
    return TRANSFER_DURATION.shistri;
  }
  return TRANSFER_DURATION.normal;
}

/**
 * Derive chip transfer events from authoritative `lastResolution`.
 * - Loss / stake into pot → seat bankroll → pot
 * - Win / collect from pot → pot → seat bankroll
 * - SHISTRI uses same amount semantics as game-core (win = full pot, loss = stake)
 * - Pass / zero / invalid → no transfers
 * - Split pots: not supported (game-core has single winner per resolution)
 */
export function deriveChipTransfersFromResolution(
  input: DeriveChipTransfersInput
): ChipTransfer[] {
  const { resolution, sequenceSalt, now = Date.now() } = input;
  if (!resolution || !resolution.playerId || !resolution.kind) return [];
  if (resolution.kind === "pass") return [];

  const amount =
    typeof resolution.amount === "number" && Number.isFinite(resolution.amount)
      ? Math.floor(resolution.amount)
      : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return [];

  const baseId = chipTransferDedupeKey(resolution, sequenceSalt);
  const playerId = resolution.playerId;
  const isShistri = resolution.kind === "shistri";

  if (resolution.win === true) {
    const kind: ChipTransferKind = isShistri ? "shistri-win" : "pot-to-winner";
    return [
      {
        id: `${baseId}:collect`,
        kind,
        amount,
        from: { type: "pot" },
        to: { type: "player-bankroll", playerId },
        targetPlayerId: playerId,
        sourceStateRevision: sequenceSalt,
        durationMs: durationFor(kind),
        timestamp: now,
      },
    ];
  }

  if (resolution.win === false) {
    const kind: ChipTransferKind = isShistri
      ? "shistri-loss"
      : resolution.kind === "kouppi"
        ? "stake-to-pot"
        : "bet-to-pot";
    return [
      {
        id: `${baseId}:stake`,
        kind,
        amount,
        from: { type: "player-bankroll", playerId },
        to: { type: "pot" },
        sourcePlayerId: playerId,
        sourceStateRevision: sequenceSalt,
        durationMs: durationFor(kind),
        timestamp: now,
      },
    ];
  }

  return [];
}

/**
 * Map physical feedback chip intents → ChipTransfer (shared with table feedback layer).
 */
export function chipTransferFromPhysicalIntent(input: {
  kind: "chip_to_pot" | "chip_from_pot";
  playerId: string;
  amount: number;
  eventId: string;
  resolutionKind?: LastResolutionLike["kind"];
  win?: boolean;
  now?: number;
}): ChipTransfer | null {
  const amount = Math.floor(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || !input.playerId) return null;

  const isShistri = input.resolutionKind === "shistri";
  const now = input.now ?? Date.now();

  if (input.kind === "chip_from_pot") {
    const kind: ChipTransferKind = isShistri ? "shistri-win" : "pot-to-winner";
    return {
      id: input.eventId,
      kind,
      amount,
      from: { type: "pot" },
      to: { type: "player-bankroll", playerId: input.playerId },
      targetPlayerId: input.playerId,
      durationMs: durationFor(kind),
      timestamp: now,
    };
  }

  const kind: ChipTransferKind = isShistri
    ? "shistri-loss"
    : input.resolutionKind === "kouppi"
      ? "stake-to-pot"
      : "bet-to-pot";
  return {
    id: input.eventId,
    kind,
    amount,
    from: { type: "player-bankroll", playerId: input.playerId },
    to: { type: "pot" },
    sourcePlayerId: input.playerId,
    durationMs: durationFor(kind),
    timestamp: now,
  };
}
