/**
 * Career → multiplayer game handoff kickoff.
 *
 * `triggerGameStart` lives in careerRoomManager and must not import serverFactory
 * (circular). serverFactory registers the real kickoff (startEligibleTurn + timer)
 * when the Socket.IO server boots.
 */

type CareerGameKickoff = (gameRoomId: string) => void;

let kickoffHandler: CareerGameKickoff | null = null;

/** Registered once from createKouppiServer after turn-flow helpers exist. */
export function setCareerGameKickoff(handler: CareerGameKickoff | null): void {
  kickoffHandler = handler;
}

/**
 * Start the first eligible turn + turn timer for a Career game room.
 * Falls back to a no-op log when the full server has not registered a handler
 * (unit tests that drive careerRoomManager without Socket.IO).
 */
export function runCareerGameKickoff(gameRoomId: string): void {
  if (!kickoffHandler) {
    console.warn(
      `[Career] No game kickoff handler registered — room ${gameRoomId} will not get a turn timer`
    );
    return;
  }
  kickoffHandler(gameRoomId);
}
