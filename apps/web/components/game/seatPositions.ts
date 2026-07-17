/**
 * @deprecated Prefer seatLayout.ts — kept for any legacy imports.
 * New perimeter seat geometry lives in ./seatLayout.ts
 */

import {
  getSeatLayoutConfig,
  type SeatAnchor,
  type SeatLayoutBreakpoint,
} from "./seatLayout";

export interface SeatPosition {
  top: string;
  left: string;
  transform: string;
}

/** Legacy 8-slot ring approximated from new desktop perimeter anchors */
export const PLAYER_POSITIONS: SeatPosition[] = [
  { top: "92%", left: "50%", transform: "translate(-50%, -50%)" },
  { top: "72%", left: "12%", transform: "translate(-50%, -50%)" },
  { top: "42%", left: "6%", transform: "translate(-50%, -50%)" },
  { top: "10%", left: "18%", transform: "translate(-50%, -50%)" },
  { top: "4%", left: "50%", transform: "translate(-50%, -50%)" },
  { top: "10%", left: "82%", transform: "translate(-50%, -50%)" },
  { top: "42%", left: "94%", transform: "translate(-50%, -50%)" },
  { top: "72%", left: "88%", transform: "translate(-50%, -50%)" },
];

function anchorToSeatPosition(anchor: SeatAnchor): SeatPosition {
  return {
    top: `${anchor.y}%`,
    left: `${anchor.x}%`,
    transform: "translate(-50%, -50%)",
  };
}

export function getPlayerPosition(
  index: number,
  totalPlayers: number,
  myIndex: number,
  breakpoint: SeatLayoutBreakpoint = "desktop"
): SeatPosition {
  const layout = getSeatLayoutConfig({
    playerCount: totalPlayers,
    viewerIndex: myIndex,
    breakpoint,
  });
  const slot = layout.slots[index];
  if (!slot) {
    return PLAYER_POSITIONS[0];
  }
  return anchorToSeatPosition(slot.seat);
}

export function getSeatPositionForPlayer(
  playerId: string,
  players: { id: string }[],
  viewerPlayerId?: string,
  breakpoint: SeatLayoutBreakpoint = "desktop"
): SeatPosition | null {
  const viewerIndex = players.findIndex((p) => p.id === viewerPlayerId);
  const effectiveMyIndex = viewerIndex >= 0 ? viewerIndex : 0;
  const playerIndex = players.findIndex((p) => p.id === playerId);
  if (playerIndex < 0) return null;
  return getPlayerPosition(playerIndex, players.length, effectiveMyIndex, breakpoint);
}
