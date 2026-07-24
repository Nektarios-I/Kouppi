/**
 * Perimeter-anchored seat layout for the shared PokerTable.
 * Coordinates are percent of the table container (0–100).
 */

export type SeatLayoutBreakpoint = "mobile" | "tablet" | "desktop";

export interface SeatAnchor {
  x: number;
  y: number;
}

export type SeatEdge =
  | "bottom"
  | "top"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface SeatSlotConfig {
  seat: SeatAnchor;
  /** Wager marker — closer to table center than bankroll stack */
  bet: SeatAnchor;
  /** Visual bankroll chip stack — in front of seat, toward center */
  bankroll: SeatAnchor;
  edge: SeatEdge;
}

export interface SeatSafeZone {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface SeatLayoutConfig {
  playerCount: number;
  viewerIndex: number;
  breakpoint: SeatLayoutBreakpoint;
  slots: SeatSlotConfig[];
  safeZone: SeatSafeZone;
}

/** Central play area reserved for dealer / pot / cards */
export const SEAT_SAFE_ZONE: SeatSafeZone = {
  cx: 50,
  cy: 42,
  rx: 28,
  ry: 26,
};

/** Tighter core that bet markers should stay outside of */
export const BET_SAFE_CORE: SeatSafeZone = {
  cx: 50,
  cy: 42,
  rx: 18,
  ry: 16,
};

const TABLE_CENTER: SeatAnchor = { x: 50, y: 42 };
/** Fraction along seat→center for bankroll chip stack (closer to seat). */
const BANKROLL_T = 0.28;
/** Fraction along seat→center for wager / bet marker. */
const BET_T = 0.55;

/** Desktop / tablet outer ring (8 slots) — pod centers near the rail */
const DESKTOP_RING: Array<{ seat: SeatAnchor; edge: SeatEdge }> = [
  { seat: { x: 50, y: 92 }, edge: "bottom" },
  { seat: { x: 12, y: 72 }, edge: "bottom-left" },
  { seat: { x: 6, y: 42 }, edge: "left" },
  { seat: { x: 18, y: 10 }, edge: "top-left" },
  { seat: { x: 50, y: 4 }, edge: "top" },
  { seat: { x: 82, y: 10 }, edge: "top-right" },
  { seat: { x: 94, y: 42 }, edge: "right" },
  { seat: { x: 88, y: 72 }, edge: "bottom-right" },
];

/** Mobile outer ring — slightly inset sides; hero lower */
const MOBILE_RING: Array<{ seat: SeatAnchor; edge: SeatEdge }> = [
  { seat: { x: 50, y: 94 }, edge: "bottom" },
  { seat: { x: 10, y: 74 }, edge: "bottom-left" },
  { seat: { x: 8, y: 42 }, edge: "left" },
  { seat: { x: 16, y: 8 }, edge: "top-left" },
  { seat: { x: 50, y: 5 }, edge: "top" },
  { seat: { x: 84, y: 8 }, edge: "top-right" },
  { seat: { x: 92, y: 42 }, edge: "right" },
  { seat: { x: 90, y: 74 }, edge: "bottom-right" },
];

/** Ring slot indices for N players after viewer rotation (adjustedIndex order) */
const SLOT_MAPS: Record<number, number[]> = {
  1: [0],
  2: [0, 4],
  3: [0, 3, 5],
  4: [0, 2, 4, 6],
  5: [0, 2, 3, 5, 6],
  6: [0, 1, 2, 4, 6, 7],
  7: [0, 1, 2, 3, 5, 6, 7],
  8: [0, 1, 2, 3, 4, 5, 6, 7],
};

export function getSeatLayoutBreakpoint(widthPx: number): SeatLayoutBreakpoint {
  if (widthPx < 640) return "mobile";
  if (widthPx < 1024) return "tablet";
  return "desktop";
}

export function betAnchor(
  seat: SeatAnchor,
  center: SeatAnchor = TABLE_CENTER,
  t: number = BET_T
): SeatAnchor {
  return {
    x: seat.x + (center.x - seat.x) * t,
    y: seat.y + (center.y - seat.y) * t,
  };
}

function ringForBreakpoint(breakpoint: SeatLayoutBreakpoint) {
  return breakpoint === "mobile" ? MOBILE_RING : DESKTOP_RING;
}

function slotIndicesForCount(playerCount: number): number[] {
  const n = Math.max(1, Math.min(8, playerCount));
  if (playerCount > 8) {
    // Theoretical game-core max; UI supports 8 slots — modulo wrap
    return Array.from({ length: playerCount }, (_, i) => i % 8);
  }
  return SLOT_MAPS[n] ?? SLOT_MAPS[8];
}

export function getSeatLayoutConfig(options: {
  playerCount: number;
  viewerIndex: number;
  breakpoint: SeatLayoutBreakpoint;
}): SeatLayoutConfig {
  const { playerCount, breakpoint } = options;
  const viewerIndex =
    playerCount <= 0
      ? 0
      : ((options.viewerIndex % playerCount) + playerCount) % playerCount;

  const ring = ringForBreakpoint(breakpoint);
  const ringSlots = slotIndicesForCount(playerCount);
  const slots: SeatSlotConfig[] = [];

  for (let index = 0; index < playerCount; index++) {
    const adjustedIndex = (index - viewerIndex + playerCount) % playerCount;
    const ringIndex = ringSlots[adjustedIndex] ?? adjustedIndex % ring.length;
    const base = ring[ringIndex] ?? ring[0];
    const seat = { ...base.seat };
    slots.push({
      seat,
      bankroll: betAnchor(seat, TABLE_CENTER, BANKROLL_T),
      bet: betAnchor(seat, TABLE_CENTER, BET_T),
      edge: base.edge,
    });
  }

  return {
    playerCount,
    viewerIndex,
    breakpoint,
    slots,
    safeZone: SEAT_SAFE_ZONE,
  };
}

/** CSS style for absolute positioning a seat/bet wrapper */
export function anchorToStyle(anchor: SeatAnchor): {
  top: string;
  left: string;
  transform: string;
} {
  return {
    top: `${anchor.y}%`,
    left: `${anchor.x}%`,
    transform: "translate(-50%, -50%)",
  };
}

/**
 * Compact bankroll / bet display for small seats.
 * < 1000 → integer; >= 1000 → 1.2K; >= 1_000_000 → 1.2M
 */
export function formatSeatAmount(value: number): string {
  const n = Math.floor(Number.isFinite(value) ? value : 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs < 1000) return `${sign}${abs}`;

  if (abs < 1_000_000) {
    const k = abs / 1000;
    const rounded = Math.round(k * 10) / 10;
    const text = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
    return `${sign}${text}K`;
  }

  const m = abs / 1_000_000;
  const rounded = Math.round(m * 10) / 10;
  const text = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return `${sign}${text}M`;
}

/** Truncate display name for compact seats */
export function truncateSeatName(name: string, maxChars: number): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  if (maxChars <= 1) return "…";
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

/** Initials from player name (1–2 letters) */
export function seatInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const w = parts[0];
    return w.slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
