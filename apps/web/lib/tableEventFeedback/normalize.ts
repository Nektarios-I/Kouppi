import { buildResolutionCopy, resolvePlayerName } from "./copy";
import type {
  NormalizeResolutionInput,
  PhysicalFeedbackIntent,
  TableFeedbackEvent,
} from "./types";

/**
 * Build a deterministic dedupe key from genuine resolution fields.
 * Limitation: no server event id — reconnect with cleared client seen-set may re-emit.
 */
export function resolutionDedupeKey(
  resolution: NormalizeResolutionInput["resolution"],
  sequenceSalt?: string | number
): string {
  const reveal =
    resolution.reveal && resolution.reveal.rank != null
      ? `${resolution.reveal.rank}:${resolution.reveal.suit ?? ""}`
      : "none";
  const amount = resolution.amount ?? "na";
  const win = resolution.win === true ? "1" : resolution.win === false ? "0" : "x";
  const salt = sequenceSalt !== undefined ? String(sequenceSalt) : "";
  return ["res", resolution.playerId, resolution.kind, win, amount, reveal, salt].join("|");
}

/**
 * Map lastResolution → table feedback event.
 * Match/round-end major UI is separate; this never returns channel:"major".
 */
export function normalizeResolutionEvent(
  input: NormalizeResolutionInput
): TableFeedbackEvent | null {
  const { resolution, players, localPlayerId, sequenceSalt } = input;
  if (!resolution || !resolution.playerId || !resolution.kind) return null;

  const id = resolutionDedupeKey(resolution, sequenceSalt);
  const playerName = resolvePlayerName(players, resolution.playerId);
  const isLocal = !!localPlayerId && resolution.playerId === localPlayerId;
  const copy = buildResolutionCopy({ resolution, playerName, isLocal });
  const amount =
    typeof resolution.amount === "number" && Number.isFinite(resolution.amount)
      ? Math.round(resolution.amount)
      : undefined;

  const physical: PhysicalFeedbackIntent[] = [];

  if (resolution.kind === "pass") {
    return {
      id,
      createdAt: Date.now(),
      priority: "low",
      tone: copy.tone,
      ribbonText: copy.ribbonText,
      logText: copy.logText,
      ariaLive: "polite",
      physical: [],
      soundCue: "none",
      durationMs: 1400,
      channel: "table",
    };
  }

  if (resolution.kind === "shistri") {
    physical.push({
      kind: "shistri_badge",
      playerId: resolution.playerId,
      amount,
      eventId: `${id}:badge`,
      durationMs: 1500,
    });
  }

  if (resolution.win) {
    if (amount !== undefined && amount > 0) {
      physical.push({
        kind: "chip_from_pot",
        playerId: resolution.playerId,
        amount,
        eventId: `${id}:collect`,
      });
    }
    physical.push({
      kind: "seat_win_highlight",
      playerId: resolution.playerId,
      eventId: `${id}:winhl`,
      durationMs: 900,
    });
  } else {
    if (amount !== undefined && amount > 0) {
      physical.push({
        kind: "chip_to_pot",
        playerId: resolution.playerId,
        amount,
        eventId: `${id}:stake`,
      });
    }
    physical.push({
      kind: "seat_loss_dim",
      playerId: resolution.playerId,
      eventId: `${id}:losshl`,
      durationMs: 450,
    });
  }

  const isShistri = resolution.kind === "shistri";
  return {
    id,
    createdAt: Date.now(),
    priority: isShistri ? "high" : "normal",
    tone: copy.tone,
    ribbonText: copy.ribbonText,
    logText: copy.logText,
    ariaLive: "polite",
    physical,
    soundCue: resolution.win
      ? isShistri
        ? "shistri"
        : "chip_collect"
      : "chip_place",
    durationMs: isShistri ? 2100 : 1900,
    channel: "table",
  };
}

/** Local optimistic stake pulse — Layer 1 + low-priority ribbon. */
export function normalizeStakePulse(input: {
  playerId: string;
  playerName: string;
  amount: number;
  kind: "bet" | "kouppi" | "shistri";
  nonce: string;
}): TableFeedbackEvent {
  const { playerId, playerName, amount, kind, nonce } = input;
  const id = `stake|${playerId}|${kind}|${amount}|${nonce}`;
  const physical: PhysicalFeedbackIntent[] = [
    {
      kind: "chip_to_pot",
      playerId,
      amount,
      eventId: `${id}:fly`,
    },
  ];
  if (kind === "shistri") {
    physical.push({
      kind: "shistri_badge",
      playerId,
      amount,
      eventId: `${id}:badge`,
      durationMs: 1400,
    });
  }
  const ribbon =
    kind === "shistri"
      ? `${playerName} declared SHISTRI`
      : kind === "kouppi"
        ? `${playerName} KOUPPI · ${amount}`
        : `${playerName} bet ${amount}`;
  const log =
    kind === "shistri"
      ? `${playerName} declared SHISTRI · risk ${amount}`
      : ribbon;

  return {
    id,
    createdAt: Date.now(),
    priority: "low",
    tone: kind === "shistri" ? "shistri" : "action",
    ribbonText: ribbon,
    logText: log,
    ariaLive: "polite",
    physical,
    soundCue: "chip_place",
    durationMs: 1300,
    channel: "table",
  };
}

/** Classify match/round end — never feed into ordinary ribbon. */
export function classifyMatchEnd(phase: string | undefined | null): "major" | "none" {
  if (phase === "RoundEnd") return "major";
  return "none";
}
