/** True when this multiplayer room id is a Career ranked game (not casual). */
export function isCareerGameRoomId(roomId: string | null | undefined): boolean {
  return !!roomId && roomId.startsWith("career-game-");
}

/** Where to send the player after leaving a room / failed career subscribe. */
export function postRoomExitPath(roomId: string | null | undefined): "/career" | "/lobby" {
  return isCareerGameRoomId(roomId) ? "/career" : "/lobby";
}
