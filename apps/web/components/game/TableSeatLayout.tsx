"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { AvatarConfig } from "@/store/remoteGameStore";
import PlayerSeat, { type SeatPlayerView } from "@/components/game/PlayerSeat";
import { useRewardStore } from "@/store/rewardStore";
import { getBadgeLabel, getTitleLabel } from "@/lib/cosmetics";
import PlayerBetMarker from "@/components/game/PlayerBetMarker";
import PlayerChipStack from "@/components/chips/PlayerChipStack";
import {
  anchorToStyle,
  getSeatLayoutBreakpoint,
  getSeatLayoutConfig,
  type SeatLayoutBreakpoint,
} from "@/components/game/seatLayout";

export interface TableSeatPlayer {
  id: string;
  name: string;
  bankroll: number;
  isBot?: boolean;
  active?: boolean;
}

export interface TableSeatLayoutProps {
  players: TableSeatPlayer[];
  currentIndex: number;
  playerId?: string;
  avatars?: Record<string, AvatarConfig>;
  cosmeticsByPlayerId?: Record<
    string,
    {
      titleId?: string | null;
      badgeId?: string | null;
      frameId?: string | null;
      seatRingId?: string | null;
    }
  >;
  connectionByPlayerId?: Record<
    string,
    { connected?: boolean; reconnectRemainingSec?: number | null }
  >;
  currentBetByPlayerId?: Record<string, number>;
  turnRemainingSec?: number | null;
  /** Optional: parent provides measured table width; otherwise observe container */
  containerRef?: React.RefObject<HTMLElement | null>;
}

function useTableBreakpoint(
  containerRef?: React.RefObject<HTMLElement | null>
): SeatLayoutBreakpoint {
  const [breakpoint, setBreakpoint] = useState<SeatLayoutBreakpoint>("desktop");

  useEffect(() => {
    const el = containerRef?.current;
    const update = (width: number) => {
      setBreakpoint(getSeatLayoutBreakpoint(width));
    };

    if (el) {
      update(el.getBoundingClientRect().width);
      if (typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width;
        if (typeof w === "number") update(w);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }

    // Fallback: viewport width
    const onResize = () => update(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [containerRef]);

  return breakpoint;
}

export default function TableSeatLayout({
  players,
  currentIndex,
  playerId,
  avatars = {},
  cosmeticsByPlayerId = {},
  connectionByPlayerId = {},
  currentBetByPlayerId = {},
  turnRemainingSec = null,
  containerRef,
}: TableSeatLayoutProps) {
  const breakpoint = useTableBreakpoint(containerRef);

  const myIndex = players.findIndex((p) => p.id === playerId);
  const viewerIndex = myIndex >= 0 ? myIndex : 0;

  const layout = useMemo(
    () =>
      getSeatLayoutConfig({
        playerCount: players.length,
        viewerIndex,
        breakpoint,
      }),
    [players.length, viewerIndex, breakpoint]
  );

  const equipped = useRewardStore((s) => s.state?.equipped);

  const seatViews: SeatPlayerView[] = useMemo(
    () =>
      players.map((p, index) => {
        const conn = connectionByPlayerId[p.id];
        const bankroll = p.bankroll;
        const isBankrupt = bankroll <= 0 || p.active === false;
        const isMe = p.id === playerId;
        const remote = cosmeticsByPlayerId[p.id];
        const titleId = isMe ? equipped?.titleId ?? remote?.titleId : remote?.titleId;
        const badgeId = isMe ? equipped?.badgeId ?? remote?.badgeId : remote?.badgeId;
        const frameId = isMe ? equipped?.frameId ?? remote?.frameId : remote?.frameId;
        const seatRingId = isMe ? equipped?.seatRingId ?? remote?.seatRingId : remote?.seatRingId;
        return {
          id: p.id,
          name: p.name,
          bankroll,
          isBot: !!p.isBot,
          isActive: p.active !== false && !isBankrupt,
          isBankrupt,
          isMe,
          isCurrentTurn: index === currentIndex,
          avatar: avatars[p.id],
          currentBet: currentBetByPlayerId[p.id],
          connected: conn?.connected,
          reconnectRemainingSec: conn?.reconnectRemainingSec ?? null,
          title: getTitleLabel(titleId),
          badge: getBadgeLabel(badgeId),
          frameId: frameId ?? null,
          seatRingId: seatRingId ?? null,
        };
      }),
    [
      players,
      currentIndex,
      playerId,
      avatars,
      cosmeticsByPlayerId,
      connectionByPlayerId,
      currentBetByPlayerId,
      equipped?.titleId,
      equipped?.badgeId,
      equipped?.frameId,
      equipped?.seatRingId,
    ]
  );

  return (
    <>
      {/* Bankroll chip stacks (z-14) — visual only; exact amount stays on PlayerSeat */}
      {seatViews.map((player, index) => {
        const slot = layout.slots[index];
        if (!slot) return null;
        if (!Number.isFinite(player.bankroll) || player.bankroll <= 0) return null;
        return (
          <div
            key={`bankroll-${player.id}`}
            className="absolute z-[14] pointer-events-none"
            style={anchorToStyle(slot.bankroll)}
            data-bankroll-anchor={player.id}
            data-bankroll-pos={`${slot.bankroll.x},${slot.bankroll.y}`}
          >
            <PlayerChipStack
              amount={player.bankroll}
              playerId={player.id}
              breakpoint={breakpoint}
              isLocal={player.isMe}
            />
          </div>
        );
      })}

      {/* Bet / wager layer (z-15) — only when authoritative per-seat bet exists */}
      {seatViews.map((player, index) => {
        const slot = layout.slots[index];
        if (!slot) return null;
        const amount = player.currentBet ?? 0;
        if (amount <= 0) return null;
        return (
          <div
            key={`bet-${player.id}`}
            className="absolute z-[15] pointer-events-none"
            style={anchorToStyle(slot.bet)}
            data-bet-anchor={`${slot.bet.x},${slot.bet.y}`}
          >
            <PlayerBetMarker
              amount={amount}
              isCurrentTurn={player.isCurrentTurn}
              compact={breakpoint === "mobile"}
            />
          </div>
        );
      })}

      {/* Seat layer (z-25) */}
      {seatViews.map((player, index) => {
        const slot = layout.slots[index];
        if (!slot) return null;
        return (
          <div
            key={`seat-${player.id}`}
            className="absolute z-[25] overflow-visible"
            style={anchorToStyle(slot.seat)}
            data-seat-id={player.id}
            data-seat-anchor={`${slot.seat.x},${slot.seat.y}`}
            data-seat-edge={slot.edge}
          >
            <PlayerSeat
              player={player}
              breakpoint={breakpoint}
              edge={slot.edge}
              turnRemainingSec={
                player.isMe && player.isCurrentTurn ? turnRemainingSec : null
              }
            />
          </div>
        );
      })}
    </>
  );
}
