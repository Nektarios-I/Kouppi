"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import type { GameState } from "@kouppi/game-core";

function rankStr(r: number) {
  if (r === 1) return "A";
  if (r === 11) return "J";
  if (r === 12) return "Q";
  if (r === 13) return "K";
  return String(r);
}

function CardView({
  rank,
  suit,
  highlight = false,
}: {
  rank: number;
  suit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`w-16 h-24 rounded-lg bg-white text-black grid place-items-center font-bold shadow transition
      ${highlight ? "ring-4 ring-yellow-400 scale-105" : ""}`}
    >
      <div>
        {rankStr(rank)}
        <span className="text-xs ml-1">{suit}</span>
      </div>
    </div>
  );
}

function TurnTimer({ remaining, total }: { remaining: number; total: number }) {
  const percentage = (remaining / total) * 100;
  const isLow = remaining <= 10;
  
  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className={isLow ? "text-red-400 font-bold animate-pulse" : "text-gray-400"}>
          ⏱️ {remaining}s
        </span>
        <span className="text-gray-500">Turn Timer</span>
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

export default function MultiplayerTable() {
  const router = useRouter();
  const {
    state,
    playerId,
    isHost,
    turnTimer,
    roundEnded,
    roundDecision,
    playerTimeout,
    sendIntent,
    requestNewRound,
    leaveRoom,
    decideStay,
    decideLeave,
  } = useRemoteGameStore();
  
  const [bet, setBet] = useState<number>(10);
  const [startingNewRound, setStartingNewRound] = useState(false);

  // Type guard for state
  const gameState = state as GameState | null;
  if (!gameState) return null;

  const currentPlayer = gameState.players[gameState.currentIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const me = gameState.players.find(p => p.id === playerId);
  const currentBankrupt = (currentPlayer?.bankroll ?? 0) <= 0;
  
  const up = gameState.turn?.upcards;
  const reveal = gameState.turn?.reveal;
  const lastResolution = gameState.lastResolution as any;
  
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
    return diff >= 6; // Wide enough gap for shistri
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

  const handleNewRound = async () => {
    setStartingNewRound(true);
    await requestNewRound();
    setStartingNewRound(false);
  };

  const handleLeave = () => {
    leaveRoom();
    router.push("/lobby");
  };

  // Round Decision Modal (takes precedence at round end)
  if ((roundEnded || gameState.phase === "RoundEnd") && roundDecision?.active) {
    const myChoice = roundDecision.choices[playerId || ""] || null;
    return (
      <div className="fixed inset-0 bg-black/60 grid place-items-center z-50">
        <div className="w-full max-w-md bg-gray-800 rounded-xl p-6 text-white">
          <h2 className="text-2xl font-semibold mb-2">🎉 Round Complete</h2>
          <p className="text-gray-300 mb-1">The pot is empty. Decide to stay or leave.</p>
          <p className="text-gray-400 mb-4">Starting next game after all players decide or in {roundDecision.remaining}s.</p>

          <div className="bg-gray-700 rounded-lg p-3 mb-4">
            <h3 className="font-semibold mb-2">Players</h3>
            <div className="space-y-2">
              {gameState.players.map((p) => {
                const c = roundDecision.choices[p.id];
                return (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name}{p.id === playerId && " (you)"}</span>
                    <span className={c === "stay" ? "text-green-400" : c === "leave" ? "text-red-400" : "text-gray-400"}>
                      {c === "stay" ? "Stay" : c === "leave" ? "Leave" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg font-semibold disabled:opacity-50"
              onClick={decideStay}
              disabled={myChoice !== null}
            >
              ✅ Stay
            </button>
            <button
              className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg font-semibold disabled:opacity-50"
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

  // Fallback Round End Modal (no decision phase received)
  if (roundEnded || gameState.phase === "RoundEnd") {
    return (
      <div className="fixed inset-0 bg-black/60 grid place-items-center z-50">
        <div className="w-full max-w-md bg-gray-800 rounded-xl p-6 text-white">
          <h2 className="text-2xl font-semibold mb-4">🎉 Round Complete!</h2>
          <p className="text-gray-300 mb-4">
            The pot is empty. The round has ended.
          </p>
          
          {/* Final standings */}
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-2">Final Standings</h3>
            <div className="space-y-2">
              {[...gameState.players]
                .sort((a, b) => b.bankroll - a.bankroll)
                .map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      {" "}{p.name}
                      {p.id === playerId && " (you)"}
                    </span>
                    <span className="font-mono">{p.bankroll}</span>
                  </div>
                ))}
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-1 text-center text-gray-400 py-3">
              Waiting for next round...
            </div>
            <button
              className="bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg"
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
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
      {/* Player Timeout Notification */}
      {playerTimeout && (
        <div className="fixed top-4 right-4 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce z-50">
          ⏰ {gameState.players.find(p => p.id === playerTimeout.playerId)?.name || "Player"} timed out!
          {playerTimeout.kicked && " (Kicked for AFK)"}
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold">
              Pot: <span className="text-yellow-400">{gameState.round.pot}</span>
            </div>
            <div className="text-sm text-gray-400">
              Phase: {gameState.phase}
            </div>
          </div>
          <button
            className="text-red-400 hover:text-red-300 text-sm"
            onClick={handleLeave}
          >
            Leave Game
          </button>
        </div>

        {/* Turn Timer */}
        {turnTimer && !awaitingNext && (
          <div className="bg-gray-800 rounded-lg p-4">
            <TurnTimer remaining={turnTimer.remaining} total={turnTimer.total} />
          </div>
        )}

        {/* Current Turn Indicator */}
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          {isMyTurn ? (
            <div className="text-xl font-semibold text-green-400">
              🎯 It's YOUR turn!
            </div>
          ) : (
            <div className="text-lg text-gray-400">
              Waiting for <span className="font-semibold text-white">{currentPlayer?.name}</span>...
            </div>
          )}
        </div>

        {/* Players */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Players</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gameState.players.map((p, i) => (
              <div
                key={p.id}
                className={`p-3 rounded-lg ${
                  i === gameState.currentIndex
                    ? "bg-green-700/30 border-2 border-green-500"
                    : "bg-gray-700"
                } ${p.id === playerId ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">
                    {p.name}
                    {p.id === playerId && " (you)"}
                  </span>
                  {i === gameState.currentIndex && (
                    <span className="text-xs text-green-400">🎯</span>
                  )}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  💰 {p.bankroll}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cards Display */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="text-sm text-gray-400">
              {awaitingNext
                ? "Review result..."
                : isMyTurn && up
                ? "Your cards - make your move!"
                : "Table"}
            </div>

            <div className="flex items-center gap-6 justify-center">
              {awaitingNext && lastResolution ? (
                lastResolution.kind === "pass" ? (
                  <>
                    <CardView rank={lastResolution.upcards.a.rank} suit={lastResolution.upcards.a.suit} />
                    <div className="w-16 h-24 grid place-items-center">
                      <span className="text-lg font-semibold text-yellow-400">PASS</span>
                    </div>
                    <CardView rank={lastResolution.upcards.b.rank} suit={lastResolution.upcards.b.suit} />
                  </>
                ) : (
                  <>
                    <CardView rank={lastResolution.upcards.a.rank} suit={lastResolution.upcards.a.suit} />
                    {lastResolution.reveal ? (
                      <CardView rank={lastResolution.reveal.rank} suit={lastResolution.reveal.suit} highlight />
                    ) : (
                      <div className="w-16 h-24 grid place-items-center opacity-30">
                        <span className="text-xs">reveal</span>
                      </div>
                    )}
                    <CardView rank={lastResolution.upcards.b.rank} suit={lastResolution.upcards.b.suit} />
                  </>
                )
              ) : up ? (
                <>
                  {!currentBankrupt && <CardView rank={up.a.rank} suit={up.a.suit} />}
                  {reveal ? (
                    <CardView rank={reveal.rank} suit={reveal.suit} highlight />
                  ) : (
                    <div className="w-16 h-24 bg-gray-700 rounded-lg grid place-items-center">
                      <span className="text-xs text-gray-500">?</span>
                    </div>
                  )}
                  {!currentBankrupt && <CardView rank={up.b.rank} suit={up.b.suit} />}
                </>
              ) : (
                <div className="text-gray-500 py-8">Waiting for cards...</div>
              )}
            </div>

            {/* Result Display */}
            {awaitingNext && lastResolution && (
              <div
                className={`text-center font-semibold text-lg ${
                  lastResolution.kind === "pass"
                    ? "text-yellow-400"
                    : lastResolution.win
                    ? "text-green-400"
                    : "text-red-400"
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
          </div>
        </div>

        {/* Actions (only for current player with cards) */}
        {isMyTurn && up && !awaitingNext && gameState.phase === "Round" && !currentBankrupt && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Your Actions</h3>
            
            {/* Warning for pair/consecutive (losing hand) */}
            {up && up.a && up.b && (
              (up.a.rank === up.b.rank || Math.abs(up.a.rank - up.b.rank) === 1) && (
                <div className="mb-3 p-2 bg-yellow-900/50 border border-yellow-600 rounded text-yellow-300 text-sm">
                  ⚠️ {up.a.rank === up.b.rank 
                    ? "Pair! No winning card exists." 
                    : "Consecutive cards! No winning card exists."} 
                  You should Pass, but can still bet if you want to gamble.
                </div>
              )
            )}
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-medium"
                onClick={() => sendIntent({ type: "pass" })}
              >
                Pass
              </button>
              
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="text-black rounded px-3 py-2 w-24"
                  min={minBet}
                  max={maxBet}
                  value={bet}
                  onChange={(e) => setBet(parseInt(e.target.value || "0", 10))}
                />
                <button
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                  onClick={() => sendIntent({ type: "bet", amount: bet })}
                  disabled={bet < minBet || bet > maxBet}
                >
                  Bet
                </button>
              </div>
              
              <button
                className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                onClick={() => sendIntent({ type: "kouppi" })}
                disabled={!canKouppi}
                title={canKouppi ? `Bet all (${gameState.round.pot})` : "Need enough bankroll"}
              >
                KOUPPI
              </button>
              
              <button
                className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                onClick={() => sendIntent({ type: "shistri" })}
                disabled={!shistriEligible}
                title={shistriEligible ? `Small bet (${shistriBetAmount}) - win takes whole pot!` : "Cards not eligible"}
              >
                SHISTRI{shistriEligible ? ` (${shistriBetAmount})` : ""}
              </button>
            </div>
            
            <div className="mt-3 text-sm text-gray-400">
              Min bet: {minBet} | Max bet: {maxBet} | Your bankroll: {me?.bankroll || 0}
            </div>
          </div>
        )}

        {/* Waiting for cards to be dealt (edge case guard) */}
        {isMyTurn && !up && !awaitingNext && gameState.phase === "Round" && (
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            {currentBankrupt ? (
              <div className="text-yellow-400">
                💸 You have zero bankroll — auto-passing this turn.
              </div>
            ) : (
              <div className="text-yellow-400 animate-pulse">
                ⏳ Dealing cards...
              </div>
            )}
          </div>
        )}

        {/* Not your turn message */}
        {!isMyTurn && gameState.phase === "Round" && (
          <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
            Wait for your turn...
          </div>
        )}

        {/* Game Log */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Game Log</h3>
          <div className="max-h-32 overflow-auto text-sm space-y-1">
            {gameState.history.slice(-10).map((h, i) => (
              <div key={i} className="text-gray-400">
                {h}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
