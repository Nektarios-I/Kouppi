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
import ConfirmDialog from "./game/ConfirmDialog";
import { useTableTheme } from "@/hooks/useTableTheme";

type PendingConfirm =
  | { type: "closeRoom" }
  | { type: "kouppi" }
  | { type: "shistri"; amount: number }
  | { type: "kick"; targetId: string; targetName: string }
  | null;

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
    kickPlayer,
    closeRoomAsHost,
    decideStay,
    decideLeave,
    requestNewRound,
    pendingIntent,
  } = useRemoteGameStore();
  const { theme } = useTableTheme();

  const [bet, setBet] = useState<number>(10);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<"win" | "kouppi" | "shistri">("win");
  const [showChipFly, setShowChipFly] = useState(false);
  const [chipFlyAmount, setChipFlyAmount] = useState(0);
  const [startingRound, setStartingRound] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [hostActionError, setHostActionError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

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

  const handleLeave = async () => {
    setLeaveError(null);
    if (isSpectator) {
      leaveSpectator();
      router.push("/lobby");
      return;
    }
    const result = await leaveRoom();
    if (!result.success) {
      setLeaveError(result.error || "Cannot leave right now");
      return;
    }
    router.push("/lobby");
  };

  const handleKickPlayer = async (targetId: string) => {
    const target = playersInRoom.find((p) => p.id === targetId);
    setPendingConfirm({
      type: "kick",
      targetId,
      targetName: target?.name || "this player",
    });
  };

  const runKickPlayer = async (targetId: string) => {
    setHostActionError(null);
    const result = await kickPlayer(targetId);
    if (!result.success) {
      const message =
        result.code === "cannot_kick_current_player"
          ? "Cannot kick the player whose turn it is"
          : result.error || "Could not kick player";
      setHostActionError(message);
    }
  };

  const handleCloseRoom = () => {
    setPendingConfirm({ type: "closeRoom" });
  };

  const runCloseRoom = async () => {
    setHostActionError(null);
    const result = await closeRoomAsHost();
    if (!result.success) {
      setHostActionError(result.error || "Could not close room");
      return;
    }
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
    if (isSpectator) {
      return (
        <RoundEndPanel
          title="Round Ending"
          subtitle={
            <>
              Players are deciding whether to stay. Auto-start in{" "}
              <strong className="text-gold-light">{roundDecision.remaining}s</strong>
            </>
          }
          standings={gameState.players.map((p) => {
            const c = roundDecision.choices[p.id];
            return {
              id: p.id,
              name: p.name,
              bankroll: p.bankroll,
              isMe: false,
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
          <HudButton variant="ghost" fullWidth onClick={handleLeave}>
            Stop Watching
          </HudButton>
        </RoundEndPanel>
      );
    }
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
    if (isSpectator) {
      return (
        <RoundEndPanel
          title="Round Complete"
          subtitle="Spectating"
          standings={[...gameState.players]
            .sort((a, b) => b.bankroll - a.bankroll)
            .map((p) => ({
              id: p.id,
              name: p.name,
              bankroll: p.bankroll,
              isMe: false,
            }))}
        >
          <HudButton variant="ghost" fullWidth onClick={handleLeave}>
            Stop Watching
          </HudButton>
        </RoundEndPanel>
      );
    }
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

  const leaveErrorBanner = leaveError ? (
    <div className="hud-status-banner !fixed top-20 left-1/2 -translate-x-1/2 z-50 !text-center !py-2 !px-4 border-error/40 bg-error/10 text-error max-w-md" role="alert">
      {leaveError}
      <button type="button" className="ml-2 underline text-sm" onClick={() => setLeaveError(null)}>
        Dismiss
      </button>
    </div>
  ) : null;

  const currentTurnPlayerId = gameState.players[gameState.currentIndex]?.id;

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
      {leaveErrorBanner}

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {isSpectator && (
          <div className="mb-3 flex justify-center">
            <span className="hud-badge hud-badge-live text-sm px-4 py-2">Spectating — read-only</span>
          </div>
        )}
        {hostActionError && isHost && !isSpectator && (
          <div className="mb-3 hud-status-banner !text-center text-warning text-sm" role="alert">
            {hostActionError}
            <button type="button" className="ml-2 underline" onClick={() => setHostActionError(null)}>
              Dismiss
            </button>
          </div>
        )}
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
              {isHost && !isSpectator && (
                <HudButton variant="ghost" size="sm" onClick={handleCloseRoom}>
                  Close Room
                </HudButton>
              )}
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

        {isHost && !isSpectator && playersInRoom.length > 1 && (
          <div className="mb-4 p-3 rounded-xl border border-white/10 bg-black/25">
            <p className="text-xs text-gray-400 font-ui uppercase tracking-wider mb-2">Host Controls</p>
            <div className="flex flex-wrap gap-2">
              {playersInRoom
                .filter((p) => p.id !== playerId)
                .map((p) => (
                  <HudButton
                    key={p.id}
                    variant="danger"
                    size="sm"
                    disabled={currentTurnPlayerId === p.id}
                    onClick={() => handleKickPlayer(p.id)}
                    title={
                      currentTurnPlayerId === p.id
                        ? "Cannot kick during their turn"
                        : `Remove ${p.name}`
                    }
                  >
                    Kick {p.name}
                  </HudButton>
                ))}
            </div>
          </div>
        )}

        {isMyTurn && up && !awaitingNext && gameState.phase === "Round" && !currentBankrupt && !isSpectator && (
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
            disabled={!!pendingIntent}
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
              setPendingConfirm({ type: "kouppi" });
            }}
            onShistri={() => {
              setPendingConfirm({ type: "shistri", amount: shistriBetAmount });
            }}
          />
        )}

        <GameLog entries={gameState.history} />
      </div>

      {pendingConfirm?.type === "closeRoom" && (
        <ConfirmDialog
          title="Close Room?"
          message="This will end the session for everyone in the room."
          confirmLabel="Close Room"
          onConfirm={() => {
            setPendingConfirm(null);
            void runCloseRoom();
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
      {pendingConfirm?.type === "kouppi" && (
        <ConfirmDialog
          title="KOUPPI — All In"
          message={`Bet the full pot (${gameState.round.pot})? You cannot undo this.`}
          confirmLabel="KOUPPI"
          confirmVariant="kouppi"
          onConfirm={() => {
            setPendingConfirm(null);
            sounds.chips();
            setChipFlyAmount(gameState.round.pot);
            setShowChipFly(true);
            sendIntent({ type: "kouppi" });
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
      {pendingConfirm?.type === "shistri" && (
        <ConfirmDialog
          title="SHISTRI"
          message={`Place a SHISTRI bet of ${pendingConfirm.amount}?`}
          confirmLabel="SHISTRI"
          confirmVariant="shistri"
          onConfirm={() => {
            const amount = pendingConfirm.amount;
            setPendingConfirm(null);
            sounds.chips();
            setChipFlyAmount(amount);
            setShowChipFly(true);
            sendIntent({ type: "shistri" });
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
      {pendingConfirm?.type === "kick" && (
        <ConfirmDialog
          title="Kick Player?"
          message={`Remove ${pendingConfirm.targetName} from the room?`}
          confirmLabel="Kick"
          onConfirm={() => {
            const targetId = pendingConfirm.targetId;
            setPendingConfirm(null);
            void runKickPlayer(targetId);
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </CasinoBackground>
  );
}
