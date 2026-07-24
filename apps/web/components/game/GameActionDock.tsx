"use client";

import type { ReactNode } from "react";

export type GameActionDockState = "waiting" | "active" | "next" | "spectator" | "disabled";

export interface GameActionDockProps {
  state: GameActionDockState;
  children?: ReactNode;
  waitingFor?: string | null;
  disabledMessage?: string;
}

export default function GameActionDock({
  state,
  children,
  waitingFor,
  disabledMessage = "Actions unavailable",
}: GameActionDockProps) {
  let message: string | null = null;
  if (state === "waiting") message = waitingFor ? `Waiting for ${waitingFor}…` : "Waiting for the next action…";
  if (state === "spectator") message = "Spectating — read-only";
  if (state === "disabled") message = disabledMessage;

  return (
    <section
      className={`game-action-shell game-action-shell--${state}`}
      role="region"
      aria-label="Game actions"
      data-state={state}
    >
      {state === "active" && (
        <p className="game-action-shell-helper font-ui">Your turn — choose an action</p>
      )}
      {message ? (
        <p className="game-action-shell-status font-ui" role="status">{message}</p>
      ) : (
        children
      )}
    </section>
  );
}
