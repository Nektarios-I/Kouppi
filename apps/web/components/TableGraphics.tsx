"use client";

import { useEffect, useState, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import type { Upcards } from "@kouppi/game-core";
import {
  botChooseActionWithProfile,
  type BotProfile,
  canShistri,
  shistriBet,
} from "@kouppi/game-core";
import { PlayingCard, HiddenCard, FlipCard } from "./PlayingCard";
import { PokerTable } from "./PokerTable";
import { useGameSounds } from "@/hooks/useSounds";
import { Celebration } from "./Confetti";
import { ChipFlyAnimation } from "./ChipAnimation";

export default function SinglePlayerTableGraphics() {
  const { state, dispatch, ready, botProfiles } = useGameStore();
  const [bet, setBet] = useState<number>(10);

  const [botThinking, setBotThinking] = useState(false);
  const [botPlanned, setBotPlanned] = useState<string | null>(null);
  
  // Animation state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<"win" | "kouppi" | "shistri">("win");
  const [showChipFly, setShowChipFly] = useState(false);
  const [chipFlyAmount, setChipFlyAmount] = useState(0);
  
  // Sound hooks
  const sounds = useGameSounds();
  const prevIsMyTurn = useRef<boolean>(false);
  const prevResolution = useRef<any>(null);

  const atRoundEnd = state.phase === "RoundEnd";
  const awaitingNext = !!state.awaitNext;

  const up = state.turn?.upcards as Upcards | undefined;

  const you = state.players[0];
  const canKouppi = you.bankroll >= state.round.pot && state.round.pot > 0;
  const minBet =
    state.config.minBetPolicy.type === "fixed"
      ? Math.min(state.config.minBetPolicy.value, state.round.pot)
      : 1;
  const maxBet = Math.min(you.bankroll, state.round.pot);

  const shistriEligible =
    !!up && state.config.shistri.enabled && canShistri(up);
  const shistriAmount = shistriEligible
    ? Math.min(
        you.bankroll,
        Math.min(
          state.round.pot,
          shistriBet(state.round.pot, state.config.shistri.percent, state.config.shistri.minChip)
        )
      )
    : 0;

  const last = state.lastResolution as
    | {
        kind: "bet" | "kouppi" | "shistri" | "pass";
        playerId: string;
        upcards: Upcards;
        reveal?: { rank: number; suit: string };
        amount?: number;
        win?: boolean;
      }
    | null
    | undefined;

  const currentPlayer = state.players[state.currentIndex];
  const isMyTurn = state.currentIndex === 0;
  
  // Sound effect: Your turn notification
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current && state.phase === "Round" && !awaitingNext) {
      sounds.yourTurn();
      sounds.deal();
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, state.phase, awaitingNext, sounds]);
  
  // Sound effect & Animation: Win/Lose on resolution
  useEffect(() => {
    if (last && last !== prevResolution.current) {
      if (last.reveal) {
        sounds.flip();
        setTimeout(() => {
          if (last.win) {
            sounds.win();
            // Show celebration for player's wins
            if (last.playerId === state.players[0].id) {
              if (last.kind === "kouppi") {
                setCelebrationType("kouppi");
              } else if (last.kind === "shistri") {
                setCelebrationType("shistri");
              } else {
                setCelebrationType("win");
              }
              setShowCelebration(true);
            }
          } else {
            sounds.lose();
          }
        }, 600);
      }
      prevResolution.current = last;
    }
  }, [last, sounds, state.players]);

  // AUTO FLOW (respect awaitingNext so it pauses)
  useEffect(() => {
    if (!ready) return;

    if (state.phase === "Lobby") {
      dispatch({ type: "startRound" });
      dispatch({ type: "ante" });
      dispatch({ type: "determineStarter" });
      return;
    }
    if (state.phase === "RoundEnd") return;
    if (awaitingNext) return;

    const turn = state.turn;
    const current = state.players[state.currentIndex];

    if (state.phase === "Round" && (!turn || !turn.upcards)) {
      dispatch({ type: "startTurn" });
      return;
    }

    if (turn && current.isBot) {
      const profile: BotProfile =
        botProfiles[current.id] ?? { mode: "deterministic", difficulty: "normal" };
      const act = botChooseActionWithProfile(state as any, profile);
      const actText =
        act.type === "pass"
          ? "Pass"
          : act.type === "kouppi"
          ? "KOUPPI"
          : act.type === "shistri"
          ? "SHISTRI"
          : `Bet ${act.amount}`;

      setBotThinking(true);
      setBotPlanned(`${current.name}: ${actText}`);

      const t = setTimeout(() => {
        (window as any).dispatch?.(act);
        dispatch(act as any);
        setBotThinking(false);
        const t2 = setTimeout(() => setBotPlanned(null), 600);
        return () => clearTimeout(t2);
      }, 900);

      return () => clearTimeout(t);
    }
  }, [state, dispatch, ready, awaitingNext, botProfiles]);

  useEffect(() => {
    (window as any).dispatch = dispatch;
  }, [dispatch]);

  // Render center cards
  const renderCenterCards = () => {
    if (awaitingNext && last) {
      if (last.kind === "pass") {
        return (
          <div className="flex items-center gap-4">
            <PlayingCard rank={last.upcards.a.rank} suit={last.upcards.a.suit} size="medium" animate="deal" />
            <div className="flex flex-col items-center px-2">
              <span className="text-yellow-400 font-bold text-lg">PASS</span>
            </div>
            <PlayingCard rank={last.upcards.b.rank} suit={last.upcards.b.suit} size="medium" animate="deal" />
          </div>
        );
      } else {
        return (
          <div className="flex items-center gap-3">
            <PlayingCard rank={last.upcards.a.rank} suit={last.upcards.a.suit} size="medium" animate="deal" />
            {last.reveal ? (
              <FlipCard 
                rank={last.reveal.rank} 
                suit={last.reveal.suit} 
                revealed={true}
                highlight 
                size="medium" 
              />
            ) : (
              <HiddenCard size="medium" />
            )}
            <PlayingCard rank={last.upcards.b.rank} suit={last.upcards.b.suit} size="medium" animate="deal" />
          </div>
        );
      }
    }
    
    if (up) {
      return (
        <div className="flex items-center gap-3">
          <PlayingCard rank={up.a.rank} suit={up.a.suit} size="medium" animate="deal" />
          <HiddenCard size="medium" />
          <PlayingCard rank={up.b.rank} suit={up.b.suit} size="medium" animate="deal" />
        </div>
      );
    }
    
    return (
      <div className="text-gray-400 text-sm py-4">
        {botThinking ? `${botPlanned || "Bot is thinking..."}` : "Waiting for cards..."}
      </div>
    );
  };

  return (
    <main 
      className="min-h-screen text-white"
      style={{
        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)",
      }}
    >
      {/* Animation overlays */}
      <Celebration 
        active={showCelebration} 
        type={celebrationType}
        onComplete={() => setShowCelebration(false)} 
      />
      <ChipFlyAnimation 
        active={showChipFly} 
        amount={chipFlyAmount}
        onComplete={() => setShowChipFly(false)} 
      />
      
      {/* Round End Modal */}
      {atRoundEnd && (
        <div className="fixed inset-0 bg-black/80 grid place-items-center z-50">
          <div 
            className="w-full max-w-md rounded-xl p-6 text-white"
            style={{
              background: "linear-gradient(135deg, #1a5f2a 0%, #0d3d1a 100%)",
              boxShadow: "0 0 0 4px #5c3d1e, 0 8px 32px rgba(0, 0, 0, 0.7)",
            }}
          >
            <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center">
              🏆 Round Complete!
            </h2>
            <p className="text-gray-200 mb-4 text-center">
              The pot is empty. Continue playing?
            </p>
            
            <div className="bg-black/30 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2 text-yellow-300">Standings</h3>
              {[...state.players]
                .sort((a, b) => b.bankroll - a.bankroll)
                .map((p, i) => (
                  <div key={p.id} className="flex justify-between py-1">
                    <span>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`} {p.name}
                    </span>
                    <span className="text-yellow-300">💰 {p.bankroll}</span>
                  </div>
                ))}
            </div>
            
            <div className="flex gap-3">
              <button
                className="flex-1 bg-green-600 hover:bg-green-500 px-4 py-3 rounded-lg font-bold transition-colors"
                onClick={() => {
                  dispatch({ type: "nextRound" });
                  dispatch({ type: "ante" });
                  dispatch({ type: "startTurn" });
                }}
              >
                Refill & Continue
              </button>
              <button 
                className="bg-red-600 hover:bg-red-500 px-4 py-3 rounded-lg font-bold transition-colors"
                onClick={() => (window.location.href = "/")}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-yellow-400">🎰 KOUPPI - Single Player</h1>
          <a href="/" className="text-red-400 hover:text-red-300 text-sm">
            Exit Game
          </a>
        </div>

        {/* Main Game Table */}
        <div className="mb-6">
          <PokerTable
            pot={state.round.pot}
            players={state.players}
            currentIndex={state.currentIndex}
            playerId={you.id}
            dealerMessage={
              awaitingNext && last
                ? last.win 
                  ? `${last.kind.toUpperCase()} - WIN!`
                  : last.kind === "pass"
                  ? "PASS"
                  : `${last.kind.toUpperCase()} - LOSS`
                : botThinking
                ? "BOT THINKING..."
                : isMyTurn
                ? "YOUR TURN"
                : "KOUPPI"
            }
          >
            {renderCenterCards()}
          </PokerTable>
        </div>

        {/* Result Display */}
        {awaitingNext && last && (
          <div 
            className={`text-center font-bold text-xl mb-4 py-3 rounded-lg ${
              last.kind === "pass"
                ? "bg-yellow-900/30 text-yellow-400"
                : last.win
                ? "bg-green-900/30 text-green-400"
                : "bg-red-900/30 text-red-400"
            }`}
          >
            {(() => {
              const who = state.players.find(p => p.id === last.playerId)?.name || "Player";
              if (last.kind === "pass") return `${who}: PASS`;
              const status = last.win ? "WON" : "LOST";
              const tag = last.kind === "shistri" ? " (SHISTRI)" 
                : last.kind === "kouppi" ? " (KOUPPI)" : "";
              return `${who}: ${status} ${last.amount}${tag}`;
            })()}
          </div>
        )}

        {/* Next Turn Button (when awaiting) */}
        {awaitingNext && state.phase === "Round" && (
          <div className="text-center mb-4">
            <button 
              className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-lg font-bold text-lg transition-colors"
              onClick={() => dispatch({ type: "nextPlayer" })}
            >
              Next Turn →
            </button>
          </div>
        )}

        {/* Actions Panel (for human player) */}
        {isMyTurn && up && !awaitingNext && state.phase === "Round" && (
          <div 
            className="rounded-xl p-4 mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(26, 95, 42, 0.8) 0%, rgba(13, 61, 26, 0.8) 100%)",
              boxShadow: "0 0 0 2px rgba(212, 175, 55, 0.3)",
            }}
          >
            <h3 className="font-bold text-yellow-400 mb-3 text-center">🎯 YOUR MOVE</h3>
            
            {/* Warning for pair/consecutive */}
            {up && up.a && up.b && (
              (up.a.rank === up.b.rank || Math.abs(up.a.rank - up.b.rank) === 1) && (
                <div className="mb-3 p-2 bg-yellow-900/50 border border-yellow-600 rounded text-yellow-300 text-sm text-center">
                  ⚠️ {up.a.rank === up.b.rank 
                    ? "Pair! No winning card exists." 
                    : "Consecutive cards! No winning card exists."} 
                  Consider passing!
                </div>
              )
            )}
            
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                onClick={() => {
                  sounds.click();
                  dispatch({ type: "pass" });
                }}
                disabled={!ready || state.phase !== "Round" || awaitingNext}
              >
                Pass
              </button>
              
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="text-black rounded px-3 py-3 w-24 font-mono text-center"
                  value={bet}
                  min={1}
                  max={maxBet}
                  onChange={(e) => setBet(parseInt(e.target.value || "0", 10))}
                  disabled={!ready || state.phase !== "Round" || awaitingNext}
                />
                <button
                  className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                  onClick={() => {
                    sounds.bet();
                    setChipFlyAmount(bet);
                    setShowChipFly(true);
                    dispatch({ type: "bet", amount: bet });
                  }}
                  disabled={
                    !ready ||
                    state.phase !== "Round" ||
                    awaitingNext ||
                    bet <= 0 ||
                    bet > maxBet
                  }
                >
                  Bet
                </button>
              </div>
              
              <button
                className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                onClick={() => {
                  sounds.chips();
                  setChipFlyAmount(state.round.pot);
                  setShowChipFly(true);
                  dispatch({ type: "kouppi" });
                }}
                disabled={!ready || state.phase !== "Round" || awaitingNext || !canKouppi}
              >
                KOUPPI
              </button>
              
              <button
                className="bg-orange-600 hover:bg-orange-500 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                onClick={() => {
                  sounds.chips();
                  setChipFlyAmount(shistriAmount);
                  setShowChipFly(true);
                  dispatch({ type: "shistri" });
                }}
                disabled={!ready || state.phase !== "Round" || awaitingNext || !shistriEligible}
                title={shistriEligible ? `Bet ${shistriAmount}` : "Not eligible"}
              >
                SHISTRI{shistriEligible ? ` (${shistriAmount})` : ""}
              </button>
            </div>
            
            <div className="mt-3 text-sm text-gray-300 text-center">
              Min: {minBet} | Max: {maxBet} | Your bankroll: 💰 {you.bankroll}
            </div>
          </div>
        )}

        {/* Waiting for bot */}
        {!isMyTurn && state.phase === "Round" && !awaitingNext && (
          <div className="text-center py-4 bg-gray-800/50 rounded-lg text-gray-400 mb-4">
            🤖 {currentPlayer?.name} is thinking...
          </div>
        )}

        {/* Game Log (collapsible) */}
        <details className="bg-gray-800/50 rounded-lg">
          <summary className="p-3 cursor-pointer text-gray-400 hover:text-gray-300">
            📜 Game Log ({state.history.length} events)
          </summary>
          <div className="px-3 pb-3 max-h-40 overflow-auto text-sm space-y-1">
            {state.history.slice(-15).map((h, i) => (
              <div key={i} className="text-gray-500">
                {h}
              </div>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}
