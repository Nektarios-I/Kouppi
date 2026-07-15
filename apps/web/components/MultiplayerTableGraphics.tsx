"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import type { GameState } from "@kouppi/game-core";
import { PokerTable } from "./PokerTable";
import { useGameSounds } from "@/hooks/useSounds";
import { Celebration } from "./Confetti";
import { ChipFlyAnimation } from "./ChipAnimation";
import CenterCards from "./game/CenterCards";
import { useCenterCardsPresentation } from "./game/useCenterCardsPresentation";
import GameHUD, { GameResultBanner, GameStatusBanner } from "./game/GameHUD";
import GameActionPanel from "./game/GameActionPanel";
import { GameLog, RoundEndPanel } from "./game/GamePanels";
import { HudButton } from "./game/HudButton";
import CasinoBackground from "./game/CasinoBackground";
import TableThemeSelector from "./game/TableThemeSelector";
import ConnectionStatusBanner from "./game/ConnectionStatusBanner";
import { useTableTheme } from "@/hooks/useTableTheme";

export default function MultiplayerTableGraphics() {
  const router = useRouter();
  const {
    state,
    playerId,
    roomId,
    isSpectator,
    turnTimer,
    roundEnded,
    roundDecision,
    playerTimeout,
    playersInRoom,
    spectatorsInRoom,
    isHost,
    sendIntent,
    leaveRoom,
    leaveSpectator,
    decideStay,
    decideLeave,
    requestNewRound,
  } = useRemoteGameStore();
  const { theme } = useTableTheme();

  const [bet, setBet] = useState<number>(10);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<"win" | "kouppi" | "shistri">("win");
  const [showChipFly, setShowChipFly] = useState(false);
  const [chipFlyAmount, setChipFlyAmount] = useState(0);
  const [startingRound, setStartingRound] = useState(false);

  const sounds = useGameSounds();
  const prevIsMyTurn = useRef<boolean>(false);
  const prevResolution = useRef<unknown>(null);
  const prevTimerLow = useRef<boolean>(false);

  const gameState = state as GameState | null;

  const avatarMap = useMemo(() => {
    const map: Record<string, { emoji: string; color: string; borderColor: string }> = {};
    for (const p of playersInRoom) {
      if (p.avatar) map[p.id] = p.avatar;
    }
    return map;
  }, [playersInRoom]);

  const currentPlayer = gameState?.players[gameState?.currentIndex ?? 0];
  const isMyTurn = currentPlayer?.id === playerId;
  const lastResolution = gameState?.lastResolution as
    | {
        kind: "bet" | "kouppi" | "shistri" | "pass";
        playerId: string;
        upcards: { a: { rank: number; suit: string }; b: { rank: number; suit: string } };
        reveal?: { rank: number; suit: string };
        amount?: number;
        win?: boolean;
      }
    | null
    | undefined;

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) {
      sounds.yourTurn();
      sounds.deal();
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, sounds]);

  useEffect(() => {
    if (lastResolution && lastResolution !== prevResolution.current) {
      if (lastResolution.reveal) {
        sounds.flip();
        setTimeout(() => {
          if (lastResolution.win) {
            sounds.win();
            if (lastResolution.playerId === playerId) {
              setCelebrationType(
                lastResolution.kind === "kouppi"
                  ? "kouppi"
                  : lastResolution.kind === "shistri"
                    ? "shistri"
                    : "win"
              );
              setShowCelebration(true);
              setTimeout(() => setShowCelebration(false), 4000);
            }
          } else {
            sounds.lose();
          }
        }, 600);
      }
      prevResolution.current = lastResolution;
    }
  }, [lastResolution, sounds, playerId]);

  useEffect(() => {
    return () => {
      setShowCelebration(false);
      setShowChipFly(false);
    };
  }, []);

  useEffect(() => {
    const isLow = turnTimer && turnTimer.remaining <= 5 && turnTimer.remaining > 0;
    if (isLow && !prevTimerLow.current && isMyTurn) {
      sounds.timerTick();
    }
    prevTimerLow.current = !!isLow;
  }, [turnTimer, isMyTurn, sounds]);

  const me = gameState?.players.find((p) => p.id === playerId);
  const currentBankrupt = (currentPlayer?.bankroll ?? 0) <= 0;
  const up = gameState?.turn?.upcards;
  const reveal = gameState?.turn?.reveal;
  const minBet =
    gameState?.config.minBetPolicy.type === "fixed"
      ? Math.min(gameState.config.minBetPolicy.value, gameState.round.pot)
      : 1;
  const maxBet = me && gameState ? Math.min(me.bankroll, gameState.round.pot) : 0;
  const canKouppi =
    me && gameState && me.bankroll >= gameState.round.pot && gameState.round.pot > 0;

  const canShistriCheck = (upcards: typeof up) => {
    if (!upcards || !gameState?.config.shistri.enabled) return false;
    const { a, b } = upcards;
    return Math.abs(a.rank - b.rank) >= 6;
  };
  const shistriEligible = !!(up && canShistriCheck(up));
  const shistriBetAmount = shistriEligible && gameState
    ? Math.min(
        me?.bankroll || 0,
        Math.min(
          gameState.round.pot,
          Math.max(
            gameState.config.shistri.minChip,
            Math.floor((gameState.round.pot * gameState.config.shistri.percent) / 100)
          )
        )
      )
    : 0;

  const awaitingNext = !!gameState?.awaitNext;

  const centerCards = useCenterCardsPresentation({
    awaitingNext,
    upcards: up ?? null,
    reveal: reveal ?? null,
    lastResolution: lastResolution ?? null,
    hideSideCards: currentBankrupt,
    waitingMessage: "Waiting for cards...",
  });

  const dealerMessage =
    awaitingNext && lastResolution
      ? lastResolution.win
        ? `${lastResolution.kind.toUpperCase()} - WIN!`
        : `${lastResolution.kind.toUpperCase()} - LOSS`
      : isMyTurn
        ? "YOUR TURN"
        : "KOUPPI";

  const handleLeave = () => {
    if (isSpectator) leaveSpectator();
    else leaveRoom();
    router.push("/lobby");
  };

  const handleStartNewRound = async () => {
    setStartingRound(true);
    await requestNewRound();
    setStartingRound(false);
  };

  if (!gameState) return null;

  if ((roundEnded || gameState.phase === "RoundEnd") && roundDecision?.active) {
    const myChoice = roundDecision.choices[playerId || ""] || null;
    return (
      <RoundEndPanel
        subtitle={
          <>
            The pot is empty. Auto-start in{" "}
            <strong className="text-gold-light">{roundDecision.remaining}s</strong>
          </>
        }
        standings={gameState.players.map((p) => {
          const c = roundDecision.choices[p.id];
          return {
            id: p.id,
            name: p.name,
            bankroll: p.bankroll,
            isMe: p.id === playerId,
            status: (
              <span
                className={
                  c === "stay" ? "text-success text-xs" : c === "leave" ? "text-error text-xs" : "text-gray-500 text-xs"
                }
              >
                {c === "stay" ? "Stay" : c === "leave" ? "Leave" : "…"}
              </span>
            ),
          };
        })}
      >
        <HudButton variant="success" fullWidth onClick={decideStay} disabled={myChoice !== null}>
          Stay
        </HudButton>
        <HudButton variant="danger" fullWidth onClick={decideLeave} disabled={myChoice !== null}>
          Leave
        </HudButton>
      </RoundEndPanel>
    );
  }

  if (roundEnded || gameState.phase === "RoundEnd") {
    return (
      <RoundEndPanel
        title="Round Complete"
        standings={[...gameState.players]
          .sort((a, b) => b.bankroll - a.bankroll)
          .map((p) => ({
            id: p.id,
            name: p.name,
            bankroll: p.bankroll,
            isMe: p.id === playerId,
          }))}
      >
        {isHost ? (
          <HudButton
            variant="success"
            fullWidth
            onClick={handleStartNewRound}
            disabled={startingRound}
          >
            {startingRound ? "Starting…" : "Start Next Round"}
          </HudButton>
        ) : (
          <div className="flex-1 text-center text-gray-400 py-3 bg-black/25 rounded-xl font-ui text-sm border border-white/5">
            Waiting for host to start next round…
          </div>
        )}
        <HudButton variant="danger" onClick={handleLeave}>
          Leave
        </HudButton>
      </RoundEndPanel>
    );
  }

  const timeoutBanner = playerTimeout ? (
    <div className="hud-status-banner !fixed top-20 right-4 z-50 !text-left !py-2 !px-4 border-warning/40 bg-warning-muted text-warning animate-pulse max-w-xs" role="alert">
      {gameState.players.find((p) => p.id === playerTimeout.playerId)?.name || "Player"} timed out
      {playerTimeout.kicked && " (Kicked)"}
    </div>
  ) : null;

  return (
    <CasinoBackground className="text-white" theme={theme}>
      <ConnectionStatusBanner />
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
      {timeoutBanner}

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <GameHUD
          title="KOUPPI"
          badges={[
            ...(roomId
              ? [{ id: "room", label: roomId, variant: "muted" as const }]
              : []),
            { id: "phase", label: gameState.phase, variant: "default" as const },
            {
              id: "spec",
              label: `${spectatorsInRoom.length} watching`,
              variant: spectatorsInRoom.length > 0 ? ("live" as const) : ("muted" as const),
            },
          ]}
          turnTimer={
            turnTimer && !awaitingNext
              ? { remaining: turnTimer.remaining, total: turnTimer.total }
              : null
          }
          rightActions={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <TableThemeSelector compact id="mp-table-theme" />
              <HudButton
                variant="danger"
                size="sm"
                onClick={handleLeave}
                aria-label={isSpectator ? "Stop watching" : "Leave game"}
              >
                {isSpectator ? "Stop Watching" : "Leave"}
              </HudButton>
            </div>
          }
          resultBanner={
            awaitingNext && lastResolution ? (
              <GameResultBanner
                variant={
                  lastResolution.kind === "pass"
                    ? "pass"
                    : lastResolution.win
                      ? "win"
                      : "loss"
                }
              >
                {(() => {
                  const who =
                    gameState.players.find((p) => p.id === lastResolution.playerId)?.name ||
                    "Player";
                  if (lastResolution.kind === "pass") return `${who}: PASS`;
                  const status = lastResolution.win ? "WON" : "LOST";
                  const tag =
                    lastResolution.kind === "shistri"
                      ? " (SHISTRI)"
                      : lastResolution.kind === "kouppi"
                        ? " (KOUPPI)"
                        : "";
                  return `${who}: ${status} ${lastResolution.amount}${tag}`;
                })()}
              </GameResultBanner>
            ) : undefined
          }
          statusBanner={
            isMyTurn && !up && !awaitingNext && gameState.phase === "Round" && currentBankrupt ? (
              <GameStatusBanner>You have zero bankroll — auto-passing this turn.</GameStatusBanner>
            ) : !isMyTurn && gameState.phase === "Round" && !awaitingNext ? (
              <GameStatusBanner>
                Waiting for <strong className="text-white">{currentPlayer?.name}</strong>&apos;s
                move...
              </GameStatusBanner>
            ) : undefined
          }
        />

        <div className="mb-4 sm:mb-6">
          <PokerTable
            pot={gameState.round.pot}
            players={gameState.players}
            currentIndex={gameState.currentIndex}
            playerId={playerId || undefined}
            avatars={avatarMap}
            dealerMessage={dealerMessage}
          >
            <CenterCards presentation={centerCards} />
          </PokerTable>
        </div>

        {isMyTurn && up && !awaitingNext && gameState.phase === "Round" && !currentBankrupt && (
          <GameActionPanel
            bet={bet}
            onBetChange={setBet}
            minBet={minBet}
            maxBet={maxBet}
            bankroll={me?.bankroll || 0}
            pot={gameState.round.pot}
            canKouppi={!!canKouppi}
            shistriEligible={!!shistriEligible}
            shistriAmount={shistriBetAmount}
            showPairWarning={
              !!(up.a && up.b && (up.a.rank === up.b.rank || Math.abs(up.a.rank - up.b.rank) === 1))
            }
            pairIsConsecutive={!!(up.a && up.b && up.a.rank !== up.b.rank)}
            onPass={() => {
              sounds.click();
              sendIntent({ type: "pass" });
            }}
            onBet={() => {
              sounds.bet();
              setChipFlyAmount(bet);
              setShowChipFly(true);
              sendIntent({ type: "bet", amount: bet });
            }}
            onKouppi={() => {
              sounds.chips();
              setChipFlyAmount(gameState.round.pot);
              setShowChipFly(true);
              sendIntent({ type: "kouppi" });
            }}
            onShistri={() => {
              sounds.chips();
              setChipFlyAmount(shistriBetAmount);
              setShowChipFly(true);
              sendIntent({ type: "shistri" });
            }}
          />
        )}

        <GameLog entries={gameState.history} />
      </div>
    </CasinoBackground>
  );
}
