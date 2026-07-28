"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import { useCareerLobbyStore } from "@/store/careerLobbyStore";
import type { AvatarConfig } from "@/store/remoteGameStore";
import type { GameState } from "@kouppi/game-core";
import { canShistri, shistriBet } from "@kouppi/game-core";
import { PokerTable } from "./PokerTable";
import { useGameSounds } from "@/hooks/useSounds";
import CenterCards from "./game/CenterCards";
import { useCenterCardsPresentation } from "./game/useCenterCardsPresentation";
import GameActionPanel from "./game/GameActionPanel";
import { RoundEndPanel } from "./game/GamePanels";
import { HudButton } from "./game/HudButton";
import CasinoBackground from "./game/CasinoBackground";
import ConnectionStatusBanner from "./game/ConnectionStatusBanner";
import ConfirmDialog from "./game/ConfirmDialog";
import { useTableTheme } from "@/hooks/useTableTheme";
import { isCareerGameRoomId, postRoomExitPath } from "@/lib/careerRoom";
import { normalizeAvatarConfig } from "@/lib/avatars";
import {
  patchProfileAvatar,
  savePlayerAvatarPreference,
} from "@/lib/playerAvatarPreference";
import { useAuthStore } from "@/store/authStore";
import { calmDealerMessage } from "@/lib/tableEventFeedback";
import {
  TableFeedbackProvider,
  TableFeedbackOverlays,
  useTableFeedback,
} from "./tableFeedback/TableEventFeedbackRoot";
import { useTableEffectsStore } from "@/store/tableEffectsStore";
import GameScreen from "./game/GameScreen";
import GameUtilityBar from "./game/GameUtilityBar";
import GameSettingsMenu from "./game/GameSettingsMenu";
import HistoryDrawer from "./game/HistoryDrawer";
import GameActionDock, { type GameActionDockState } from "./game/GameActionDock";

type PendingConfirm =
  | { type: "closeRoom" }
  | { type: "leave" }
  | { type: "kouppi" }
  | { type: "shistri"; amount: number }
  | { type: "kick"; targetId: string; targetName: string }
  | null;

export default function MultiplayerTableGraphics() {
  const { state, playerId } = useRemoteGameStore();
  const gameState = state as GameState | null;
  const lastResolution = gameState?.lastResolution as
    | {
        kind: "bet" | "kouppi" | "shistri" | "pass";
        playerId: string;
        amount?: number;
        win?: boolean;
        reveal?: { rank: number; suit: string };
      }
    | null
    | undefined;

  if (!gameState) return null;

  return (
    <TableFeedbackProvider
      lastResolution={lastResolution}
      players={gameState.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot }))}
      localPlayerId={playerId}
      sequenceSalt={gameState.history.length}
    >
      <MultiplayerTableBody />
    </TableFeedbackProvider>
  );
}

function MultiplayerTableBody() {
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
    playAgain,
    sessionSummary,
    pendingIntent,
    lastError,
    playerAvatar,
    setAvatar,
  } = useRemoteGameStore();
  const { token, isLoggedIn, refreshUser } = useAuthStore();
  const { theme } = useTableTheme();
  const tableSound = useTableEffectsStore((s) => s.sound);
  const sfx = tableSound === "on";

  const [bet, setBet] = useState<number>(10);
  const [resettingTable, setResettingTable] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [hostActionError, setHostActionError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const tableSurfaceRef = useRef<HTMLDivElement>(null);
  const feedback = useTableFeedback();

  const sounds = useGameSounds();
  const prevIsMyTurn = useRef<boolean>(false);
  const prevTimerLow = useRef<boolean>(false);
  const clearCareerGameSession = useCareerLobbyStore((s) => s.clearGameSession);

  const gameState = state as GameState | null;

  const avatarMap = useMemo(() => {
    const map: Record<string, AvatarConfig> = {};
    for (const p of playersInRoom) {
      if (p.avatar) map[p.id] = p.avatar;
    }
    if (playerId && playerAvatar) {
      map[playerId] = playerAvatar;
    }
    return map;
  }, [playersInRoom, playerId, playerAvatar]);

  const handleAvatarChange = (next: AvatarConfig) => {
    const normalized = normalizeAvatarConfig(next);
    setAvatar(normalized);
    savePlayerAvatarPreference(normalized);
    if (isLoggedIn() && token) {
      void patchProfileAvatar(token, normalized).then((ok) => {
        if (ok) void refreshUser();
      });
    }
  };

  const cosmeticsMap = useMemo(() => {
    const map: Record<
      string,
      {
        titleId?: string | null;
        badgeId?: string | null;
        frameId?: string | null;
        seatRingId?: string | null;
      }
    > = {};
    for (const p of playersInRoom) {
      if (p.cosmetics) map[p.id] = p.cosmetics;
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
      if (sfx) {
        sounds.yourTurn();
        sounds.deal();
      }
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, sounds, sfx]);

  useEffect(() => {
    const isLow = turnTimer && turnTimer.remaining <= 5 && turnTimer.remaining > 0;
    if (isLow && !prevTimerLow.current && isMyTurn && sfx) {
      sounds.timerTick();
    }
    prevTimerLow.current = !!isLow;
  }, [turnTimer, isMyTurn, sounds, sfx]);

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

  // Keep bet within table limits (Career antes often have minBet > default 10).
  useEffect(() => {
    if (!gameState || maxBet <= 0) return;
    setBet((prev) => {
      const clamped = Math.max(minBet, Math.min(maxBet, prev));
      return clamped === prev ? prev : clamped;
    });
  }, [minBet, maxBet, gameState]);

  const shistriEligible = !!(
    up &&
    gameState?.config.shistri.enabled &&
    canShistri(up)
  );
  const shistriBetAmount =
    shistriEligible && gameState
      ? Math.min(
          me?.bankroll || 0,
          Math.min(
            gameState.round.pot,
            shistriBet(
              gameState.round.pot,
              gameState.config.shistri.percent,
              gameState.config.shistri.minChip
            )
          )
        )
      : 0;

  const awaitingNext = !!gameState?.awaitNext;
  const revealPending = !!(gameState as { revealPending?: boolean } | null)?.revealPending;
  const keepResultVisible =
    revealPending ||
    ((roundEnded || gameState?.phase === "RoundEnd") && !roundDecision?.active && !!lastResolution?.reveal);

  const centerCards = useCenterCardsPresentation({
    awaitingNext,
    upcards: up ?? null,
    reveal: reveal ?? null,
    lastResolution: lastResolution ?? null,
    hideSideCards: currentBankrupt,
    waitingMessage: "Waiting for cards...",
    keepResultVisible,
  });

  const dealerMessage = calmDealerMessage({
    awaitingNext,
    resolution: lastResolution,
    isMyTurn,
  });

  const handleLeave = async () => {
    setLeaveError(null);
    const exitPath = postRoomExitPath(roomId);
    if (isSpectator) {
      leaveSpectator();
      if (isCareerGameRoomId(roomId)) clearCareerGameSession();
      router.push(exitPath);
      return;
    }
    const result = await leaveRoom();
    if (!result.success) {
      setLeaveError(result.error || "Cannot leave right now");
      return;
    }
    if (isCareerGameRoomId(roomId)) clearCareerGameSession();
    router.push(exitPath);
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
    if (isCareerGameRoomId(roomId)) clearCareerGameSession();
    router.push(postRoomExitPath(roomId));
  };

  const handlePlayAgain = async () => {
    setResettingTable(true);
    const result = await playAgain();
    setResettingTable(false);
    if (!result.success) setHostActionError(result.error || "Could not reset table");
  };

  const sessionStats = sessionSummary
    ? {
        handsPlayed: sessionSummary.handsPlayed,
        biggestPot: sessionSummary.biggestPot,
        mvpName: sessionSummary.mvp?.name,
      }
    : undefined;

  if (!gameState) return null;

  if ((roundEnded || gameState.phase === "RoundEnd") && roundDecision?.active) {
    const myChoice = roundDecision.choices[playerId || ""] || null;
    if (isSpectator) {
      return (
        <RoundEndPanel
          title="Round Ending"
          sessionStats={sessionStats}
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
        sessionStats={sessionStats}
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

  if ((roundEnded || gameState.phase === "RoundEnd") && !keepResultVisible) {
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
        sessionStats={sessionStats}
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
            variant="bet"
            fullWidth
            onClick={handlePlayAgain}
            disabled={resettingTable}
          >
            {resettingTable ? "Resetting…" : "Play Again (waiting room)"}
          </HudButton>
        ) : (
          <div className="flex-1 text-center text-gray-400 py-3 bg-black/25 rounded-xl font-ui text-sm border border-white/5">
            Waiting for host to reset the table…
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

  const actionErrorBanner =
    lastError && !leaveError ? (
      <div
        className="hud-status-banner !fixed top-20 left-1/2 -translate-x-1/2 z-50 !text-center !py-2 !px-4 border-error/40 bg-error/10 text-error max-w-md"
        role="alert"
      >
        {lastError}
      </div>
    ) : null;

  const currentTurnPlayerId = gameState.players[gameState.currentIndex]?.id;
  const actionDockState: GameActionDockState =
    isSpectator
      ? "spectator"
      : awaitingNext
        ? "disabled"
        : pendingIntent || currentBankrupt
          ? "disabled"
          : isMyTurn && !!up && !awaitingNext && gameState.phase === "Round"
            ? "active"
            : "waiting";

  const hostControls =
    isHost && !isSpectator ? (
      <div className="game-settings-host-tools">
        {playersInRoom
          .filter((player) => player.id !== playerId)
          .map((player) => (
            <HudButton
              key={player.id}
              variant="danger"
              size="sm"
              disabled={currentTurnPlayerId === player.id}
              onClick={() => handleKickPlayer(player.id)}
              title={
                currentTurnPlayerId === player.id
                  ? "Cannot kick during their turn"
                  : `Remove ${player.name}`
              }
            >
              Kick {player.name}
            </HudButton>
          ))}
        <HudButton variant="danger" size="sm" onClick={handleCloseRoom}>
          Close room
        </HudButton>
      </div>
    ) : undefined;

  return (
    <CasinoBackground className="text-white" theme={theme} lockViewport>
      <ConnectionStatusBanner />
      {timeoutBanner}
      {leaveErrorBanner}
      {actionErrorBanner}

      {hostActionError && isHost && !isSpectator ? (
        <div className="hud-status-banner !fixed top-20 right-4 z-[100] text-warning text-sm" role="alert">
          {hostActionError}
          <button type="button" className="ml-2 underline" onClick={() => setHostActionError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <GameScreen
        utility={
          <GameUtilityBar
            modeLabel={isCareerGameRoomId(roomId) ? "Career" : "Multiplayer"}
            turnTimer={turnTimer && !awaitingNext ? turnTimer : null}
            badges={
              <span className="game-utility-room font-ui">
                {roomId} · {spectatorsInRoom.length} watching
              </span>
            }
            history={
              <HistoryDrawer
                entries={feedback.logEntries}
                liveEvent={feedback.activeRibbon}
                round={{
                  phase: gameState.phase,
                  summary: awaitingNext
                    ? "Waiting for the server to advance the turn"
                    : `Current player: ${currentPlayer?.name || "Unknown"}`,
                  awaitingNext,
                }}
                table={{
                  mode: isCareerGameRoomId(roomId) ? "Career" : "Multiplayer",
                  details: [
                    `Room ${roomId}`,
                    `Ante ${gameState.config.ante}`,
                    `Minimum bet ${minBet}`,
                    `${spectatorsInRoom.length} spectators`,
                  ],
                }}
              />
            }
            settings={
              <GameSettingsMenu
                leaveLabel={isSpectator ? "Stop watching" : "Leave game"}
                onRequestLeave={() => setPendingConfirm({ type: "leave" })}
                hostControls={hostControls}
                avatar={
                  isSpectator
                    ? null
                    : {
                        currentAvatar: playerAvatar,
                        onChange: handleAvatarChange,
                      }
                }
              />
            }
          />
        }
        table={
          <div className="relative game-table-protected">
            <PokerTable
              pot={gameState.round.pot}
              players={gameState.players}
              currentIndex={gameState.currentIndex}
              playerId={playerId || undefined}
              avatars={avatarMap}
              cosmeticsByPlayerId={cosmeticsMap}
              dealerMessage={dealerMessage}
              surfaceRef={tableSurfaceRef}
              connectionByPlayerId={Object.fromEntries(
                playersInRoom.map((p) => [
                  p.id,
                  {
                    connected: p.connected,
                    reconnectRemainingSec: p.reconnectRemainingSec ?? null,
                  },
                ])
              )}
              currentBetByPlayerId={
                gameState.turn?.betAmount && gameState.turn.playerId
                  ? { [gameState.turn.playerId]: gameState.turn.betAmount }
                  : undefined
              }
              turnRemainingSec={
                turnTimer && !awaitingNext && isMyTurn ? turnTimer.remaining : null
              }
            >
              <CenterCards presentation={centerCards} />
            </PokerTable>
            <TableFeedbackOverlays tableSurfaceRef={tableSurfaceRef} />
          </div>
        }
        dock={
          <GameActionDock
            state={actionDockState}
            waitingFor={currentPlayer?.name}
            disabledMessage={
              awaitingNext
                ? "Waiting for the server to advance the turn"
                : currentBankrupt
                  ? "Zero bankroll — this turn will auto-pass"
                  : "Submitting action…"
            }
          >
            {actionDockState === "active" && up ? (
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
                shistriPercent={gameState.config.shistri.percent}
                disabled={!!pendingIntent}
                showPairWarning={
                  !!(up.a && up.b && (up.a.rank === up.b.rank || Math.abs(up.a.rank - up.b.rank) === 1))
                }
                pairIsConsecutive={!!(up.a && up.b && up.a.rank !== up.b.rank)}
                onPass={() => {
                  if (sfx) sounds.click();
                  sendIntent({ type: "pass" });
                }}
                onBet={() => sendIntent({ type: "bet", amount: bet })}
                onKouppi={() => setPendingConfirm({ type: "kouppi" })}
                onShistri={() => setPendingConfirm({ type: "shistri", amount: shistriBetAmount })}
              />
            ) : null}
          </GameActionDock>
        }
      />

      {pendingConfirm?.type === "leave" && (
        <ConfirmDialog
          title={isSpectator ? "Stop watching?" : "Leave game?"}
          message={
            isSpectator
              ? "You will return to the previous screen."
              : "Leaving now may abandon the active round."
          }
          confirmLabel={isSpectator ? "Stop watching" : "Leave game"}
          onConfirm={() => {
            setPendingConfirm(null);
            void handleLeave();
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
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
            setPendingConfirm(null);
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
