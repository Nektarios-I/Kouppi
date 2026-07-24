"use client";

import React from "react";
import { HudButton } from "./HudButton";
import { SHISTRI_DEFAULT_PERCENT } from "@kouppi/game-core";

export interface GameActionPanelProps {
  bet: number;
  onBetChange: (value: number) => void;
  minBet: number;
  maxBet: number;
  bankroll: number;
  pot: number;
  canKouppi: boolean;
  shistriEligible: boolean;
  shistriAmount: number;
  /** Table SHISTRI percent (defaults to shipped constant). */
  shistriPercent?: number;
  disabled?: boolean;
  showPairWarning?: boolean;
  pairIsConsecutive?: boolean;
  onPass: () => void;
  onBet: () => void;
  onKouppi: () => void;
  onShistri: () => void;
}

function clampBet(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ActionAmountLabel({ label, amount }: { label: string; amount: number | string }) {
  return (
    <span className="game-action-btn-stack">
      <span className="game-action-btn-label">{label}</span>
      <span className="game-action-btn-amount tabular-nums">{amount}</span>
    </span>
  );
}

export default function GameActionPanel({
  bet,
  onBetChange,
  minBet,
  maxBet,
  bankroll,
  pot,
  canKouppi,
  shistriEligible,
  shistriAmount,
  shistriPercent = SHISTRI_DEFAULT_PERCENT,
  disabled = false,
  showPairWarning = false,
  pairIsConsecutive = false,
  onPass,
  onBet,
  onKouppi,
  onShistri,
}: GameActionPanelProps) {
  const betValid = bet >= minBet && bet <= maxBet && bet > 0;
  const quickAmounts = [
    { label: "Min", value: minBet },
    { label: "½ Pot", value: Math.max(minBet, Math.floor(pot / 2)) },
    { label: "Pot", value: Math.max(minBet, Math.min(pot, maxBet)) },
    { label: "Max", value: maxBet },
  ].filter((q, i, arr) => arr.findIndex((x) => x.value === q.value) === i);

  const riskTitle = shistriEligible
    ? `SHISTRI ${shistriAmount} (${shistriPercent}% of pot)`
    : "SHISTRI not available for these cards";

  return (
    <div className="game-action-panel">
      <div className="game-action-dock-inner">
        <div className="game-action-header game-action-header--compact">
          <div className="game-action-stats font-ui">
            <span>
              Bankroll <strong className="text-gold-light tabular-nums">{bankroll}</strong>
            </span>
            <span className="text-white/20">|</span>
            <span>
              Pot <strong className="text-gold-light tabular-nums">{pot}</strong>
            </span>
          </div>
        </div>

        {showPairWarning && (
          <div className="game-action-warning font-ui" role="alert">
            {pairIsConsecutive
              ? "Consecutive cards — no winning card exists. Consider passing."
              : "Pair — no winning card exists. Consider passing."}{" "}
            <a href="/how-to-play" className="text-gold-light underline ml-1">
              Rules
            </a>
          </div>
        )}

        <div className="game-action-quick-row">
          {quickAmounts.map((q) => (
            <button
              key={q.label}
              type="button"
              className={`hud-chip-quick ${bet === q.value ? "hud-chip-quick-active" : ""}`}
              disabled={disabled || q.value > maxBet || q.value < minBet}
              onClick={() => onBetChange(clampBet(q.value, minBet, maxBet))}
              aria-label={`Set bet to ${q.value}`}
            >
              <span className="hud-chip-quick-label">{q.label}</span>
              <span className="hud-chip-quick-value tabular-nums">{q.value}</span>
            </button>
          ))}
        </div>

        <div className="game-action-bet-row">
          <label className="sr-only" htmlFor="bet-slider">
            Bet amount
          </label>
          <input
            id="bet-slider"
            type="range"
            className="game-action-slider flex-1"
            min={minBet}
            max={maxBet}
            value={clampBet(bet, minBet, maxBet)}
            disabled={disabled || maxBet < minBet}
            onChange={(e) => onBetChange(parseInt(e.target.value, 10))}
          />
          <input
            type="number"
            className="game-action-bet-input font-mono tabular-nums"
            value={bet}
            min={minBet}
            max={maxBet}
            disabled={disabled}
            onChange={(e) => onBetChange(parseInt(e.target.value || "0", 10))}
            aria-label="Bet amount"
          />
        </div>

        <div className="game-action-buttons">
          <HudButton variant="pass" onClick={onPass} disabled={disabled} aria-label="Pass turn">
            Pass
          </HudButton>

          <HudButton
            variant="bet"
            size="lg"
            onClick={onBet}
            disabled={disabled || !betValid}
            aria-label={`Bet ${bet}`}
            className="game-action-bet-main"
          >
            <ActionAmountLabel label="Bet" amount={bet} />
          </HudButton>

          <HudButton
            variant="kouppi"
            onClick={onKouppi}
            disabled={disabled || !canKouppi}
            aria-label={`KOUPPI all-in ${pot}`}
            title={canKouppi ? `Take the pot (${pot})` : "Cannot KOUPPI"}
          >
            <ActionAmountLabel label="KOUPPI" amount={pot} />
          </HudButton>

          <HudButton
            variant="shistri"
            onClick={onShistri}
            disabled={disabled || !shistriEligible}
            aria-label={
              shistriEligible
                ? `SHISTRI ${shistriAmount} chips (${shistriPercent}% of pot)`
                : "SHISTRI not available"
            }
            title={riskTitle}
            className="game-action-shistri"
          >
            {shistriEligible ? (
              <ActionAmountLabel label="SHISTRI" amount={shistriAmount} />
            ) : (
              <span className="game-action-btn-stack">
                <span className="game-action-btn-label">SHISTRI</span>
              </span>
            )}
          </HudButton>
        </div>

        <p className="game-action-hint font-ui">
          Range {minBet}–{maxBet}
        </p>
      </div>
    </div>
  );
}
