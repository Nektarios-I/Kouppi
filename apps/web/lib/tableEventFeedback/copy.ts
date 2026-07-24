import type { LastResolutionLike, PlayerNameLookup } from "./types";

export function resolvePlayerName(
  players: PlayerNameLookup[],
  playerId: string,
  fallback = "Player"
): string {
  const p = players.find((x) => x.id === playerId);
  const name = p?.name?.trim();
  return name && name.length > 0 ? name : fallback;
}

export function formatAmount(amount: number | undefined | null): string | null {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return null;
  if (!Number.isFinite(amount)) return null;
  return String(Math.abs(Math.round(amount)));
}

/** Concise ribbon/log copy — never invent currency or fake amounts. */
export function buildResolutionCopy(input: {
  resolution: LastResolutionLike;
  playerName: string;
  isLocal: boolean;
}): { ribbonText: string; logText: string; tone: "neutral" | "win" | "loss" | "shistri" | "action" } {
  const { resolution, playerName, isLocal } = input;
  const amt = formatAmount(resolution.amount);

  if (resolution.kind === "pass") {
    const text = `${playerName} passed`;
    return { ribbonText: text, logText: text, tone: "action" };
  }

  if (resolution.kind === "shistri") {
    if (resolution.win) {
      if (isLocal) {
        const ribbon = amt ? `You won SHISTRI · +${amt}` : `You won SHISTRI`;
        const log = amt ? `You won SHISTRI · ${amt}` : `You won SHISTRI`;
        return { ribbonText: ribbon, logText: log, tone: "shistri" };
      }
      const ribbon = amt ? `${playerName} won SHISTRI · +${amt}` : `${playerName} won SHISTRI`;
      const log = amt ? `${playerName} won SHISTRI · ${amt}` : `${playerName} won SHISTRI`;
      return { ribbonText: ribbon, logText: log, tone: "shistri" };
    }
    if (isLocal) {
      const ribbon = amt ? `You lost SHISTRI · -${amt}` : `You lost SHISTRI`;
      const log = amt ? `You lost SHISTRI · ${amt}` : `You lost SHISTRI`;
      return { ribbonText: ribbon, logText: log, tone: "shistri" };
    }
    const ribbon = amt ? `${playerName} lost SHISTRI · -${amt}` : `${playerName} lost SHISTRI`;
    const log = amt ? `${playerName} lost SHISTRI · ${amt}` : `${playerName} lost SHISTRI`;
    return { ribbonText: ribbon, logText: log, tone: "shistri" };
  }

  // bet / kouppi
  if (resolution.win) {
    if (isLocal) {
      const ribbon = amt ? `You won ${amt}` : `You won the pot`;
      const log =
        resolution.kind === "kouppi"
          ? amt
            ? `You won ${amt} (KOUPPI)`
            : `You won (KOUPPI)`
          : amt
            ? `You won ${amt}`
            : `You won the pot`;
      return { ribbonText: ribbon, logText: log, tone: "win" };
    }
    const ribbon = amt ? `${playerName} won ${amt}` : `${playerName} won the pot`;
    const log =
      resolution.kind === "kouppi"
        ? amt
          ? `${playerName} won ${amt} (KOUPPI)`
          : `${playerName} won (KOUPPI)`
        : ribbon;
    return { ribbonText: ribbon, logText: log, tone: "win" };
  }

  if (isLocal) {
    const ribbon = amt ? `You lost ${amt}` : `You lost`;
    const log =
      resolution.kind === "kouppi"
        ? amt
          ? `You lost ${amt} (KOUPPI)`
          : `You lost (KOUPPI)`
        : ribbon;
    return { ribbonText: ribbon, logText: log, tone: "loss" };
  }
  const ribbon = amt ? `${playerName} lost ${amt}` : `${playerName} lost`;
  const log =
    resolution.kind === "kouppi"
      ? amt
        ? `${playerName} lost ${amt} (KOUPPI)`
        : `${playerName} lost (KOUPPI)`
      : ribbon;
  return { ribbonText: ribbon, logText: log, tone: "loss" };
}

export function buildActionCopy(input: {
  action: "bet" | "pass" | "folded" | "called" | "kouppi" | "shistri_declare";
  playerName: string;
  amount?: number;
}): { ribbonText: string; logText: string } {
  const amt = formatAmount(input.amount);
  switch (input.action) {
    case "bet": {
      const text = amt ? `${input.playerName} bet ${amt}` : `${input.playerName} bet`;
      return { ribbonText: text, logText: text };
    }
    case "called": {
      const text = `${input.playerName} called`;
      return { ribbonText: text, logText: text };
    }
    case "pass": {
      const text = `${input.playerName} passed`;
      return { ribbonText: text, logText: text };
    }
    case "folded": {
      const text = `${input.playerName} folded`;
      return { ribbonText: text, logText: text };
    }
    case "kouppi": {
      const text = amt ? `${input.playerName} KOUPPI · ${amt}` : `${input.playerName} KOUPPI`;
      return { ribbonText: text, logText: text };
    }
    case "shistri_declare": {
      const ribbon = amt
        ? `${input.playerName} declared SHISTRI`
        : `${input.playerName} declared SHISTRI`;
      const log = amt
        ? `${input.playerName} declared SHISTRI · risk ${amt}`
        : `${input.playerName} declared SHISTRI`;
      return { ribbonText: ribbon, logText: log };
    }
  }
}

/** Calm dealer banner — no giant WIN!/LOSS. */
export function calmDealerMessage(input: {
  awaitingNext: boolean;
  resolution: LastResolutionLike | null | undefined;
  isMyTurn: boolean;
  botThinking?: boolean;
}): string {
  if (input.botThinking) return "WAITING";
  if (input.awaitingNext && input.resolution) {
    if (input.resolution.kind === "pass") return "PASS";
    if (input.resolution.kind === "shistri") return "SHISTRI";
    if (input.resolution.kind === "kouppi") return "KOUPPI";
    return "RESOLVED";
  }
  if (input.isMyTurn) return "YOUR TURN";
  return "KOUPPI";
}
