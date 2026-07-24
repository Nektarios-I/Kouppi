"use client";

import type { ReactNode } from "react";

export interface GameScreenProps {
  utility: ReactNode;
  table: ReactNode;
  dock: ReactNode;
  /** @deprecated History now lives in the utility bar; kept optional for adapters. */
  history?: ReactNode;
  className?: string;
}

export default function GameScreen({
  utility,
  history = null,
  table,
  dock,
  className = "",
}: GameScreenProps) {
  return (
    <div className={`game-screen ${className}`.trim()} data-testid="game-screen">
      <div className="game-screen-utility">{utility}</div>
      <main className="game-screen-main" data-testid="game-screen-main">
        {history}
        <div className="game-screen-table-region game-stage-table-region">{table}</div>
      </main>
      <div className="game-screen-dock" data-testid="game-screen-dock">
        {dock}
      </div>
    </div>
  );
}
