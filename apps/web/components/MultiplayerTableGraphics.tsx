"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import type { GameState } from "@kouppi/game-core";
import { PlayingCard, HiddenCard, FlipCard } from "./PlayingCard";
import { PokerTable } from "./PokerTable";
import { useGameSounds } from "@/hooks/useSounds";
import { Celebration } from "./Confetti";
import { ChipFlyAnimation } from "./ChipAnimation";

function TurnTimer({ remaining, total }: { remaining: number; total: number }) {
  const percentage = (remaining / total) * 100;
  const isLow = remaining <= 10;
  
  return (
    <div className="w-full max-w-xs">
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className={isLow ? "text-red-400 font-bold animate-pulse" : "text-gray-300"}>
          ⏱️ {remaining}s
        </span>
        <span className="text-gray-400 text-xs">Turn Timer</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${isLow ? "bg-red-500" : "bg-green-500"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function MultiplayerTableGraphics() {
  const router = useRouter();
  const {
    state,
    playerId,
    roomId,
    isHost,
    isSpectator,
    turnTimer,
    roundEnded,
    roundDecision,
    playerTimeout,
    playersInRoom,
    spectatorsInRoom,
    sendIntent,
    requestNewRound,
    leaveRoom,
    leaveSpectator,
    decideStay,
    decideLeave,
  } = useRemoteGameStore();
  
  const [bet, setBet] = useState<number>(10);
  const [startingNewRound, setStartingNewRound] = useState(false);
  
  // Animation state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<"win" | "kouppi" | "shistri">("win");
  const [showChipFly, setShowChipFly] = useState(false);
  const [chipFlyAmount, setChipFlyAmount] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);
  
  // Sound hooks
  const sounds = useGameSounds();
  const prevIsMyTurn = useRef<boolean>(false);
  const prevResolution = useRef<any>(null);
  const prevTimerLow = useRef<boolean>(false);

  // Type guard for state
  const gameState = state as GameState | null;
  
  // Build avatar lookup map from playersInRoom
  const avatarMap = React.useMemo(() => {
    const map: Record<string, { emoji: string; color: string; borderColor: string }> = {};
    for (const p of playersInRoom) {
      if (p.avatar) {
        map[p.id] = p.avatar;
      }
    }
    return map;
  }, [playersInRoom]);
  
  const currentPlayer = gameState?.players[gameState?.currentIndex ?? 0];
  const isMyTurn = currentPlayer?.id === playerId;
  const lastResolution = gameState?.lastResolution as any;
  
  // Sound effect: Your turn notification
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) {
      sounds.yourTurn();
      sounds.deal(); // Card deal sound when it's your turn
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, sounds]);
  
  // Sound effect & Animation: Win/Lose on resolution
  useEffect(() => {
    if (lastResolution && lastResolution !== prevResolution.current) {
      // Only play if there's a reveal (actual bet, not pass)
      if (lastResolution.reveal) {
        setCardRevealed(true);
        sounds.flip(); // Card flip sound
        
        // Small delay for flip animation before win/lose
        setTimeout(() => {
          if (lastResolution.win) {
            sounds.win();
            // Show celebration animation for wins
            const isMe = lastResolution.playerId === playerId;
            if (isMe) {
              if (lastResolution.kind === "kouppi") {
                setCelebrationType("kouppi");
              } else if (lastResolution.kind === "shistri") {
                setCelebrationType("shistri");
              } else {
                setCelebrationType("win");
              }
              setShowCelebration(true);
              // Safety timeout: force hide celebration after 4 seconds
              setTimeout(() => setShowCelebration(false), 4000);
            }
          } else {
            sounds.lose();
          }
        }, 600); // After flip animation completes
        
        // Reset card revealed state
        setTimeout(() => setCardRevealed(false), 2000);
      }
      prevResolution.current = lastResolution;
    }
  }, [lastResolution, sounds, playerId]);
  
  // Cleanup: reset animation state on unmount
  useEffect(() => {
    return () => {
      setShowCelebration(false);
      setShowChipFly(false);
      setCardRevealed(false);
    };
  }, []);
  
  // Sound effect: Timer warning
  useEffect(() => {
    const isLow = turnTimer && turnTimer.remaining <= 5 && turnTimer.remaining > 0;
    if (isLow && !prevTimerLow.current && isMyTurn) {
      sounds.timerTick();
    }
    prevTimerLow.current = !!isLow;
  }, [turnTimer, isMyTurn, sounds]);
  
  if (!gameState) return null;
  
  // Re-declare variables after null check (for proper typing)
  const me = gameState.players.find(p => p.id === playerId);
  const currentBankrupt = (currentPlayer?.bankroll ?? 0) <= 0;
  const up = gameState.turn?.upcards;
  const reveal = gameState.turn?.reveal;
  
  // Calculate bet limits
  const minBet = gameState.config.minBetPolicy.type === "fixed"
    ? Math.min(gameState.config.minBetPolicy.value, gameState.round.pot)
    : 1;
  const maxBet = me ? Math.min(me.bankroll, gameState.round.pot) : 0;
  const canKouppi = me && me.bankroll >= gameState.round.pot && gameState.round.pot > 0;
  
  // Check shistri eligibility
  const canShistriCheck = (upcards: any) => {
    if (!upcards || !gameState.config.shistri.enabled) return false;
    const { a, b } = upcards;
    const diff = Math.abs(a.rank - b.rank);
    return diff >= 6;
  };
  const shistriEligible = up && canShistriCheck(up);
  const shistriBetAmount = shistriEligible
    ? Math.min(
        me?.bankroll || 0,
        Math.min(
          gameState.round.pot,
          Math.max(gameState.config.shistri.minChip, Math.floor(gameState.round.pot * gameState.config.shistri.percent / 100))
        )
      )
    : 0;

  const awaitingNext = !!gameState.awaitNext;

  const handleLeave = () => {
    if (isSpectator) {
      leaveSpectator();
    } else {
      leaveRoom();
    }
    router.push("/lobby");
  };

  // Cards display component for the center of the table
  const renderCenterCards = () => {
    if (awaitingNext && lastResolution) {
      if (lastResolution.kind === "pass") {
        return (
          <div className="flex items-center gap-4">
            <PlayingCard rank={lastResolution.upcards.a.rank} suit={lastResolution.upcards.a.suit} size="medium" animate="deal" />
            <div className="flex flex-col items-center px-2">
              <span className="text-yellow-400 font-bold text-lg">PASS</span>
            </div>
            <PlayingCard rank={lastResolution.upcards.b.rank} suit={lastResolution.upcards.b.suit} size="medium" animate="deal" />
          </div>
        );
      } else {
        return (
          <div className="flex items-center gap-3">
            <PlayingCard rank={lastResolution.upcards.a.rank} suit={lastResolution.upcards.a.suit} size="medium" animate="deal" />
            {lastResolution.reveal ? (
              <FlipCard 
                rank={lastResolution.reveal.rank} 
                suit={lastResolution.reveal.suit} 
                revealed={true}
                highlight 
                size="medium" 
              />
            ) : (
              <HiddenCard size="medium" />
            )}
            <PlayingCard rank={lastResolution.upcards.b.rank} suit={lastResolution.upcards.b.suit} size="medium" animate="deal" />
          </div>
        );
      }
    }
    
    if (up) {
      return (
        <div className="flex items-center gap-3">
          {!currentBankrupt ? (
            <PlayingCard rank={up.a.rank} suit={up.a.suit} size="medium" animate="deal" />
          ) : (
            <HiddenCard size="medium" />
          )}
          {reveal ? (
            <FlipCard rank={reveal.rank} suit={reveal.suit} revealed={true} highlight size="medium" />
          ) : (
            <HiddenCard size="medium" />
          )}
          {!currentBankrupt ? (
            <PlayingCard rank={up.b.rank} suit={up.b.suit} size="medium" animate="deal" />
          ) : (
            <HiddenCard size="medium" />
          )}
        </div>
      );
    }
    
    return (
      <div className="text-gray-400 text-sm py-4">Waiting for cards...</div>
    );
  };

  // Round Decision Modal
  if ((roundEnded || gameState.phase === "RoundEnd") && roundDecision?.active) {
    const myChoice = roundDecision.choices[playerId || ""] || null;
    return (
      <div className="fixed inset-0 bg-black/80 grid place-items-center z-50">
        <div 
          className="w-full max-w-md rounded-xl p-6 text-white"
          style={{
            background: "linear-gradient(135deg, #1a5f2a 0%, #0d3d1a 100%)",
            boxShadow: "0 0 0 4px #5c3d1e, 0 8px 32px rgba(0, 0, 0, 0.7)",
          }}
        >
          <h2 className="text-2xl font-bold text-yellow-400 mb-2 text-center">
            🎰 Round Complete
          </h2>
          <p className="text-gray-200 mb-1 text-center">
            The pot is empty. Continue playing?
          </p>
          <p className="text-gray-400 mb-4 text-center text-sm">
            Auto-start in {roundDecision.remaining}s
          </p>

          <div className="bg-black/30 rounded-lg p-3 mb-4">
            <h3 className="font-semibold mb-2 text-yellow-300">Players</h3>
            <div className="space-y-2">
              {gameState.players.map((p) => {
                const c = roundDecision.choices[p.id];
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span>{p.isBot ? "🤖" : "👤"}</span>
                      {p.name}
                      {p.id === playerId && <span className="text-blue-400">(you)</span>}
                    </span>
                    <span className={c === "stay" ? "text-green-400" : c === "leave" ? "text-red-400" : "text-gray-400"}>
                      {c === "stay" ? "✅ Stay" : c === "leave" ? "🚪 Leave" : "⏳ Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 bg-green-600 hover:bg-green-500 px-4 py-3 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={decideStay}
              disabled={myChoice !== null}
            >
              ✅ Stay
            </button>
            <button
              className="flex-1 bg-red-600 hover:bg-red-500 px-4 py-3 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={decideLeave}
              disabled={myChoice !== null}
            >
              🚪 Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback Round End Modal
  if (roundEnded || gameState.phase === "RoundEnd") {
    return (
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
          
          <div className="bg-black/30 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-yellow-300">Final Standings</h3>
            <div className="space-y-2">
              {[...gameState.players]
                .sort((a, b) => b.bankroll - a.bankroll)
                .map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between bg-black/20 p-2 rounded">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      {p.name}
                      {p.id === playerId && <span className="text-blue-400 text-xs">(you)</span>}
                    </span>
                    <span className="font-mono text-yellow-300">💰 {p.bankroll}</span>
                  </div>
                ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1 text-center text-gray-300 py-3 bg-black/20 rounded-lg">
              ⏳ Waiting for next round...
            </div>
            <button
              className="bg-red-600 hover:bg-red-500 px-4 py-3 rounded-lg font-bold transition-colors"
              onClick={handleLeave}
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main 
      className="min-h-screen text-white"
      style={{
        background: `
          linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)
        `,
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
      
      {/* Player Timeout Notification */}
      {playerTimeout && (
        <div className="fixed top-4 right-4 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce z-50">
          ⏰ {gameState.players.find(p => p.id === playerTimeout.playerId)?.name || "Player"} timed out!
          {playerTimeout.kicked && " (Kicked for AFK)"}
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-yellow-400">🎰 KOUPPI</h1>
            {/* Room name badge */}
            {roomId && (
              <span className="text-gray-200 text-sm bg-gray-800/80 px-3 py-1 rounded border border-gray-600">
                🏠 {roomId}
              </span>
            )}
            <span className="text-gray-400 text-sm">
              Phase: {gameState.phase}
            </span>
            {/* Spectator count - always visible */}
            <span className={`text-sm px-2 py-0.5 rounded ${spectatorsInRoom.length > 0 ? 'text-purple-400 bg-purple-900/30' : 'text-gray-500 bg-gray-800/30'}`}>
              👁️ {spectatorsInRoom.length} spectator{spectatorsInRoom.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Turn Timer (compact) */}
            {turnTimer && !awaitingNext && (
              <TurnTimer remaining={turnTimer.remaining} total={turnTimer.total} />
            )}
            <button
              className="text-red-400 hover:text-red-300 text-sm bg-red-900/30 px-3 py-1 rounded"
              onClick={handleLeave}
            >
              {isSpectator ? "Stop Watching" : "Leave Game"}
            </button>
          </div>
        </div>

        {/* Main Game Table */}
        <div className="mb-6">
          <PokerTable
            pot={gameState.round.pot}
            players={gameState.players}
            currentIndex={gameState.currentIndex}
            playerId={playerId || undefined}
            avatars={avatarMap}
            dealerMessage={
              awaitingNext && lastResolution
                ? lastResolution.win 
                  ? `${lastResolution.kind.toUpperCase()} - WIN!`
                  : `${lastResolution.kind.toUpperCase()} - LOSS`
                : isMyTurn
                ? "YOUR TURN"
                : "KOUPPI"
            }
          >
            {renderCenterCards()}
          </PokerTable>
        </div>

        {/* Result Display (below table) */}
        {awaitingNext && lastResolution && (
          <div 
            className={`text-center font-bold text-xl mb-4 py-3 rounded-lg ${
              lastResolution.kind === "pass"
                ? "bg-yellow-900/30 text-yellow-400"
                : lastResolution.win
                ? "bg-green-900/30 text-green-400"
                : "bg-red-900/30 text-red-400"
            }`}
          >
            {(() => {
              const who = gameState.players.find(p => p.id === lastResolution.playerId)?.name || "Player";
              if (lastResolution.kind === "pass") return `${who}: PASS`;
              const status = lastResolution.win ? "WON" : "LOST";
              const tag = lastResolution.kind === "shistri" ? " (SHISTRI)" 
                : lastResolution.kind === "kouppi" ? " (KOUPPI)" : "";
              return `${who}: ${status} ${lastResolution.amount}${tag}`;
            })()}
          </div>
        )}

        {/* Actions Panel (only for current player) */}
        {isMyTurn && up && !awaitingNext && gameState.phase === "Round" && !currentBankrupt && (
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
                className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-bold transition-colors"
                onClick={() => {
                  sounds.click();
                  sendIntent({ type: "pass" });
                }}
              >
                Pass
              </button>
              
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="text-black rounded px-3 py-3 w-24 font-mono text-center"
                  min={minBet}
                  max={maxBet}
                  value={bet}
                  onChange={(e) => setBet(parseInt(e.target.value || "0", 10))}
                />
                <button
                  className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                  onClick={() => {
                    sounds.bet();
                    setChipFlyAmount(bet);
                    setShowChipFly(true);
                    sendIntent({ type: "bet", amount: bet });
                  }}
                  disabled={bet < minBet || bet > maxBet}
                >
                  Bet
                </button>
              </div>
              
              <button
                className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                onClick={() => {
                  sounds.chips();
                  setChipFlyAmount(gameState.round.pot);
                  setShowChipFly(true);
                  sendIntent({ type: "kouppi" });
                }}
                disabled={!canKouppi}
                title={canKouppi ? `Bet all (${gameState.round.pot})` : "Need enough bankroll"}
              >
                KOUPPI
              </button>
              
              <button
                className="bg-orange-600 hover:bg-orange-500 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                onClick={() => {
                  sounds.chips();
                  setChipFlyAmount(shistriBetAmount);
                  setShowChipFly(true);
                  sendIntent({ type: "shistri" });
                }}
                disabled={!shistriEligible}
                title={shistriEligible ? `Win takes whole pot!` : "Cards not eligible"}
              >
                SHISTRI {shistriEligible ? `(${shistriBetAmount})` : ""}
              </button>
            </div>
            
            <div className="mt-3 text-sm text-gray-300 text-center">
              Min: {minBet} | Max: {maxBet} | Your bankroll: 💰 {me?.bankroll || 0}
            </div>
          </div>
        )}

        {/* Auto-pass notification for bankrupt */}
        {isMyTurn && !up && !awaitingNext && gameState.phase === "Round" && currentBankrupt && (
          <div className="text-center py-4 bg-yellow-900/30 rounded-lg text-yellow-400 mb-4">
            💸 You have zero bankroll — auto-passing this turn.
          </div>
        )}

        {/* Waiting message */}
        {!isMyTurn && gameState.phase === "Round" && !awaitingNext && (
          <div className="text-center py-4 bg-gray-800/50 rounded-lg text-gray-400 mb-4">
            ⏳ Waiting for <span className="text-white font-semibold">{currentPlayer?.name}</span>'s move...
          </div>
        )}

        {/* Game Log (collapsible) */}
        <details className="bg-gray-800/50 rounded-lg">
          <summary className="p-3 cursor-pointer text-gray-400 hover:text-gray-300">
            📜 Game Log ({gameState.history.length} events)
          </summary>
          <div className="px-3 pb-3 max-h-40 overflow-auto text-sm space-y-1">
            {gameState.history.slice(-15).map((h, i) => (
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
