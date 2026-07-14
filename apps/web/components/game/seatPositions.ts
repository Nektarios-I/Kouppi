/** Seat position helpers shared by PokerTable and emote anchoring */

export interface SeatPosition {
  top: string;
  left: string;
  transform: string;
}

/** Player positions around an oval table (for up to 8 players) */
export const PLAYER_POSITIONS: SeatPosition[] = [
  { top: "85%", left: "50%", transform: "translate(-50%, -50%)" },
  { top: "70%", left: "15%", transform: "translate(-50%, -50%)" },
  { top: "35%", left: "5%", transform: "translate(-50%, -50%)" },
  { top: "8%", left: "20%", transform: "translate(-50%, -50%)" },
  { top: "8%", left: "50%", transform: "translate(-50%, -50%)" },
  { top: "8%", left: "80%", transform: "translate(-50%, -50%)" },
  { top: "35%", left: "95%", transform: "translate(-50%, -50%)" },
  { top: "70%", left: "85%", transform: "translate(-50%, -50%)" },
];

export function getPlayerPosition(
  index: number,
  totalPlayers: number,
  myIndex: number
): SeatPosition {
  const adjustedIndex = (index - myIndex + totalPlayers) % totalPlayers;

  if (totalPlayers <= 2) {
    const positions = [0, 4];
    return PLAYER_POSITIONS[positions[adjustedIndex]];
  }
  if (totalPlayers <= 4) {
    const positions = [0, 2, 4, 6];
    return PLAYER_POSITIONS[positions[adjustedIndex]];
  }

  return PLAYER_POSITIONS[adjustedIndex % PLAYER_POSITIONS.length];
}

export function getSeatPositionForPlayer(
  playerId: string,
  players: { id: string }[],
  viewerPlayerId?: string
): SeatPosition | null {
  const viewerIndex = players.findIndex((p) => p.id === viewerPlayerId);
  const effectiveMyIndex = viewerIndex >= 0 ? viewerIndex : 0;
  const playerIndex = players.findIndex((p) => p.id === playerId);
  if (playerIndex < 0) return null;
  return getPlayerPosition(playerIndex, players.length, effectiveMyIndex);
}
