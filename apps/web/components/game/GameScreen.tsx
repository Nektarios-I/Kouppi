"use client";

import type { ReactNode } from "react";

export interface GameScreenProps {
  utility: ReactNode;
  history: ReactNode;
  table: ReactNode;
  dock: ReactNode;
  className?: string;
}

export default function GameScreen({
  utility,
  history,
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
