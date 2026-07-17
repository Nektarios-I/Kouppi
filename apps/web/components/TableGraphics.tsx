"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import type { Upcards } from "@kouppi/game-core";
import {
  botChooseActionWithProfile,
  type BotProfile,
  canShistri,
  shistriBet,
} from "@kouppi/game-core";
import { PokerTable } from "./PokerTable";
import { useGameSounds } from "@/hooks/useSounds";
import { Celebration } from "./Confetti";
import { ChipFlyAnimation } from "./ChipAnimation";
import CenterCards from "./game/CenterCards";
import { useCenterCardsPresentation } from "./game/useCenterCardsPresentation";
import GameHUD, { GameResultBanner, GameStatusBanner } from "./game/GameHUD";
import GameActionPanel from "./game/GameActionPanel";
import { GameLog, NextTurnButton, RoundEndPanel } from "./game/GamePanels";
import { HudButton } from "./game/HudButton";
import { getAvatarFromId, getBotAvatar } from "@/lib/avatars";
import type { AvatarConfig } from "@/store/remoteGameStore";
import Link from "next/link";
import CasinoBackground from "./game/CasinoBackground";
import TableThemeSelector from "./game/TableThemeSelector";
import { useTableTheme } from "@/hooks/useTableTheme";

export default function SinglePlayerTableGraphics() {
  const { state, dispatch, ready, botProfiles } = useGameStore();
  const { theme } = useTableTheme();
  const [bet, setBet] = useState<number>(10);
  const [botThinking, setBotThinking] = useState(false);
  const [botPlanned, setBotPlanned] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<"win" | "kouppi" | "shistri">("win");
  const [showChipFly, setShowChipFly] = useState(false);
  const [chipFlyAmount, setChipFlyAmount] = useState(0);

  const sounds = useGameSounds();
  const prevIsMyTurn = useRef<boolean>(false);
  const prevResolution = useRef<unknown>(null);

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
  const shistriEligible = !!up && state.config.shistri.enabled && canShistri(up);
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

  const avatarMap = useMemo(() => {
    const map: Record<string, AvatarConfig> = {};
    for (const p of state.players) {
      map[p.id] = p.isBot ? getBotAvatar(p.id) : getAvatarFromId(p.id);
    }
    return map;
  }, [state.players]);

  const centerCards = useCenterCardsPresentation({
    awaitingNext,
    upcards: up ?? null,
    lastResolution: last ?? null,
    waitingMessage: botThinking ? botPlanned || "Bot is thinking..." : "Waiting for cards...",
  });

  const dealerMessage =
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
          : "KOUPPI";

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current && state.phase === "Round" && !awaitingNext) {
      sounds.yourTurn();
      sounds.deal();
    }
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn, state.phase, awaitingNext, sounds]);

  useEffect(() => {
    if (last && last !== prevResolution.current) {
      if (last.reveal) {
        sounds.flip();
        setTimeout(() => {
          if (last.win) {
            sounds.win();
            if (last.playerId === state.players[0].id) {
              setCelebrationType(
                last.kind === "kouppi" ? "kouppi" : last.kind === "shistri" ? "shistri" : "win"
              );
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
      const act = botChooseActionWithProfile(state as Parameters<typeof botChooseActionWithProfile>[0], profile);
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
        dispatch(act as Parameters<typeof dispatch>[0]);
        setBotThinking(false);
        setTimeout(() => setBotPlanned(null), 600);
      }, 900);

      return () => clearTimeout(t);
    }
  }, [state, dispatch, ready, awaitingNext, botProfiles]);

  return (
    <CasinoBackground className="text-white" theme={theme}>
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

      {atRoundEnd && (
        <RoundEndPanel
          subtitle="The pot is empty. Continue playing?"
          standings={[...state.players]
            .sort((a, b) => b.bankroll - a.bankroll)
            .map((p) => ({
              id: p.id,
              name: p.name,
              bankroll: p.bankroll,
              isMe: p.id === you.id,
            }))}
        >
          <HudButton
            variant="success"
            fullWidth
            onClick={() => {
              dispatch({ type: "nextRound" });
              dispatch({ type: "ante" });
              dispatch({ type: "startTurn" });
            }}
          >
            Refill & Continue
          </HudButton>
          <Link href="/" className="hud-btn hud-btn-danger flex-1 text-center no-underline">
            Exit
          </Link>
        </RoundEndPanel>
      )}

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <GameHUD
          title="KOUPPI"
          badges={[{ id: "mode", label: "Single Player", variant: "gold" }]}
          rightActions={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <TableThemeSelector compact id="sp-table-theme" />
              <Link
                href="/"
                className="hud-btn hud-btn-danger hud-btn-sm no-underline"
                aria-label="Exit game"
              >
                Exit
              </Link>
            </div>
          }
          resultBanner={
            awaitingNext && last ? (
              <GameResultBanner
                variant={last.kind === "pass" ? "pass" : last.win ? "win" : "loss"}
              >
                {(() => {
                  const who =
                    state.players.find((p) => p.id === last.playerId)?.name || "Player";
                  if (last.kind === "pass") return `${who}: PASS`;
                  const status = last.win ? "WON" : "LOST";
                  const tag =
                    last.kind === "shistri"
                      ? " (SHISTRI)"
                      : last.kind === "kouppi"
                        ? " (KOUPPI)"
                        : "";
                  return `${who}: ${status} ${last.amount}${tag}`;
                })()}
              </GameResultBanner>
            ) : undefined
          }
          statusBanner={
            !isMyTurn && state.phase === "Round" && !awaitingNext ? (
              <GameStatusBanner>🤖 {currentPlayer?.name} is thinking...</GameStatusBanner>
            ) : undefined
          }
        />

        <div className="mb-4 sm:mb-6">
          <PokerTable
            pot={state.round.pot}
            players={state.players}
            currentIndex={state.currentIndex}
            playerId={you.id}
            avatars={avatarMap}
            dealerMessage={dealerMessage}
            currentBetByPlayerId={
              state.turn?.betAmount && state.turn.playerId
                ? { [state.turn.playerId]: state.turn.betAmount }
                : undefined
            }
          >
            <CenterCards presentation={centerCards} />
          </PokerTable>
        </div>

        {awaitingNext && state.phase === "Round" && (
          <NextTurnButton onClick={() => dispatch({ type: "nextPlayer" })} />
        )}

        {isMyTurn && up && !awaitingNext && state.phase === "Round" && (
          <GameActionPanel
            bet={bet}
            onBetChange={setBet}
            minBet={minBet}
            maxBet={maxBet}
            bankroll={you.bankroll}
            pot={state.round.pot}
            canKouppi={canKouppi}
            shistriEligible={shistriEligible}
            shistriAmount={shistriAmount}
            disabled={!ready || state.phase !== "Round" || awaitingNext}
            showPairWarning={
              !!(up.a && up.b && (up.a.rank === up.b.rank || Math.abs(up.a.rank - up.b.rank) === 1))
            }
            pairIsConsecutive={!!(up.a && up.b && up.a.rank !== up.b.rank)}
            onPass={() => {
              sounds.click();
              dispatch({ type: "pass" });
            }}
            onBet={() => {
              sounds.bet();
              setChipFlyAmount(bet);
              setShowChipFly(true);
              dispatch({ type: "bet", amount: bet });
            }}
            onKouppi={() => {
              sounds.chips();
              setChipFlyAmount(state.round.pot);
              setShowChipFly(true);
              dispatch({ type: "kouppi" });
            }}
            onShistri={() => {
              sounds.chips();
              setChipFlyAmount(shistriAmount);
              setShowChipFly(true);
              dispatch({ type: "shistri" });
            }}
          />
        )}

        <GameLog entries={state.history} />

        <p className="mt-4 text-center text-xs text-gray-600 font-ui">
          <Link href="/3d-preview" className="text-gold/60 hover:text-gold transition-colors">
            3D preview
          </Link>
        </p>
      </div>
    </CasinoBackground>
  );
}
