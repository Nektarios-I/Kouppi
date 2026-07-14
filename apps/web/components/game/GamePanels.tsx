"use client";

import React from "react";
import { HudButton } from "./HudButton";

interface StandingRow {
  id: string;
  name: string;
  bankroll: number;
  isMe?: boolean;
  status?: React.ReactNode;
}

interface RoundEndPanelProps {
  title?: string;
  subtitle?: React.ReactNode;
  standings: StandingRow[];
  children?: React.ReactNode;
}

export function RoundEndPanel({
  title = "Round Complete",
  subtitle,
  standings,
  children,
}: RoundEndPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm grid place-items-center z-50 p-4">
      <div className="game-modal-panel w-full max-w-md" role="dialog" aria-modal="true">
        <div className="game-modal-header">
          <h2 className="font-display text-2xl font-bold text-gold-light tracking-wide text-center">
            {title}
          </h2>
          {subtitle && (
            <p className="text-gray-300 text-center font-ui text-sm mt-2">{subtitle}</p>
          )}
        </div>
        <div className="game-modal-standings">
          <h3 className="font-ui text-xs uppercase tracking-widest text-gold/60 mb-3">
            Standings
          </h3>
          <div className="space-y-1.5">
            {standings.map((row, i) => (
              <div
                key={row.id}
                className={`game-modal-standing-row ${row.isMe ? "game-modal-standing-me" : ""}`}
              >
                <span className="font-ui text-sm truncate">
                  <span className="text-gold/50 mr-2">#{i + 1}</span>
                  {row.name}
                  {row.isMe && <span className="text-gold text-xs ml-1">(you)</span>}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {row.status}
                  <span className="font-mono text-gold-light tabular-nums">{row.bankroll}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        {children && <div className="game-modal-actions">{children}</div>}
      </div>
    </div>
  );
}

interface GameLogProps {
  entries: string[];
  maxVisible?: number;
}

export function GameLog({ entries, maxVisible = 15 }: GameLogProps) {
  const visible = entries.slice(-maxVisible);
  return (
    <details className="game-log-panel">
      <summary className="game-log-summary font-ui">
        <span>Game Log</span>
        <span className="game-log-count">{entries.length}</span>
      </summary>
      <div className="game-log-body font-ui">
        {visible.length === 0 ? (
          <p className="text-gray-500 text-sm">No events yet.</p>
        ) : (
          visible.map((line, i) => (
            <div key={i} className="game-log-line">
              {line}
            </div>
          ))
        )}
      </div>
    </details>
  );
}

export function NextTurnButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center mb-4">
      <HudButton variant="primary" size="lg" onClick={onClick}>
        Next Turn →
      </HudButton>
    </div>
  );
}
