"use client";

import React, { useMemo } from "react";
import PlayerSeat from "@/components/game/PlayerSeat";
import { getPlayerPosition } from "@/components/game/seatPositions";
import { ChipStack } from "@/components/ChipAnimation";
import type { AvatarConfig } from "@/store/remoteGameStore";
import { useTableTheme } from "@/hooks/useTableTheme";
import { useTextureImage } from "@/hooks/useTextureImage";

interface Player {
  id: string;
  name: string;
  bankroll: number;
  isBot?: boolean;
  active?: boolean;
}

export interface PokerTableProps {
  pot: number;
  players: Player[];
  currentIndex: number;
  playerId?: string;
  children?: React.ReactNode;
  dealerMessage?: string;
  avatars?: Record<string, AvatarConfig>;
}

const RAIL_STUDS = Array.from({ length: 20 }, (_, i) => i);
const CUP_HOLDERS = Array.from({ length: 8 }, (_, i) => i);

export function PokerTable({
  pot,
  players,
  currentIndex,
  playerId,
  children,
  dealerMessage = "KOUPPI",
  avatars = {},
}: PokerTableProps) {
  const { theme } = useTableTheme();
  const feltTextureState = useTextureImage(theme.tableTextureUrl);
  const railTextureState = useTextureImage(theme.railTextureUrl);

  const feltTextureReady = feltTextureState === "loaded";
  const railTextureReady = railTextureState === "loaded";

  const feltStyle = useMemo(
    () =>
      feltTextureReady
        ? {
            backgroundImage: `url(${theme.tableTextureUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : {
            background: `radial-gradient(ellipse 90% 75% at 50% 32%, ${theme.feltColorLight} 0%, ${theme.feltColor} 38%, ${theme.feltColorDark} 100%)`,
          },
    [feltTextureReady, theme]
  );

  const railCushionStyle = useMemo(
    () =>
      railTextureReady
        ? {
            backgroundImage: `url(${theme.railTextureUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : {
            background: `linear-gradient(180deg, ${theme.railColor} 0%, ${theme.railColorDark} 75%, #1a0f08 100%)`,
          },
    [railTextureReady, theme]
  );

  const myIndex = players.findIndex((p) => p.id === playerId);
  const effectiveMyIndex = myIndex >= 0 ? myIndex : 0;

  const glowStyle = theme.glowColor
    ? { boxShadow: `0 0 50px ${theme.glowColor}, 0 24px 64px rgba(0,0,0,0.75)` }
    : undefined;

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Multi-layer floor contact shadow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[60%] w-[92%] h-[32%] rounded-[50%] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 40%, transparent 70%)",
          filter: "blur(14px)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 top-[55%] w-[60%] h-[18%] rounded-[50%] pointer-events-none opacity-50"
        style={{
          background: `radial-gradient(ellipse at center, ${theme.glowColor ?? "rgba(212,175,55,0.15)"} 0%, transparent 70%)`,
          filter: "blur(20px)",
        }}
        aria-hidden="true"
      />

      <div className="table-perspective relative z-10">
        <div className="table-tilt relative w-full aspect-[16/10] select-none" style={glowStyle}>
          {/* Pedestal skirt */}
          <div
            className="absolute inset-[-5px] sm:inset-[-7px] rounded-[50%]"
            style={{
              background: `linear-gradient(180deg, ${theme.railColorDark} 0%, #120a06 60%, #0a0604 100%)`,
              boxShadow:
                "0 28px 72px rgba(0,0,0,0.8), 0 10px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
            aria-hidden="true"
          />

          {/* Outer wood rim */}
          <div
            className="absolute inset-0 rounded-[50%]"
            style={{
              background: `linear-gradient(165deg, ${theme.railColor} 0%, ${theme.railColorDark} 65%, #1a0f08 100%)`,
              boxShadow:
                "0 22px 60px rgba(0,0,0,0.75), inset 0 4px 8px rgba(255,255,255,0.1), inset 0 -10px 20px rgba(0,0,0,0.5)",
            }}
            aria-hidden="true"
          />

          {/* Rail cushion */}
          <div
            className="absolute inset-[3px] sm:inset-[5px] rounded-[50%] overflow-hidden"
            style={{
              ...railCushionStyle,
              boxShadow:
                "inset 0 5px 14px rgba(0,0,0,0.55), inset 0 -3px 8px rgba(255,255,255,0.07), 0 3px 10px rgba(0,0,0,0.35)",
            }}
          >
            {!railTextureReady && (
              <div className="absolute inset-0 table-rail-leather opacity-90" aria-hidden="true" />
            )}
            {/* Leather stitch ring */}
            <div
              className="absolute inset-[6%] rounded-[50%] pointer-events-none"
              style={{
                border: "1px dashed rgba(255,255,255,0.08)",
                boxShadow: "inset 0 0 12px rgba(0,0,0,0.2)",
              }}
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 rounded-[50%] pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, transparent 20%, transparent 76%, rgba(0,0,0,0.4) 100%)",
              }}
              aria-hidden="true"
            />
            {/* Cup holders */}
            {CUP_HOLDERS.map((i) => {
              const angle = (i / CUP_HOLDERS.length) * Math.PI * 2 - Math.PI / 2;
              const rx = 44 * Math.cos(angle);
              const ry = 44 * Math.sin(angle);
              return (
                <div
                  key={`cup-${i}`}
                  className="absolute w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full"
                  style={{
                    left: `calc(50% + ${rx}%)`,
                    top: `calc(50% + ${ry}%)`,
                    transform: "translate(-50%, -50%)",
                    background: "radial-gradient(circle at 35% 30%, #1a1008 0%, #0a0604 100%)",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.05)",
                  }}
                  aria-hidden="true"
                />
              );
            })}
            {RAIL_STUDS.map((i) => (
              <span
                key={i}
                className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full table-rail-stud"
                style={{
                  left: `${50 + 46 * Math.cos((i / RAIL_STUDS.length) * Math.PI * 2 - Math.PI / 2)}%`,
                  top: `${50 + 46 * Math.sin((i / RAIL_STUDS.length) * Math.PI * 2 - Math.PI / 2)}%`,
                  transform: "translate(-50%, -50%)",
                }}
                aria-hidden="true"
              />
            ))}
          </div>

          {/* Brass trim with theme glow */}
          <div
            className="absolute inset-[11px] sm:inset-[15px] rounded-[50%] table-brass-trim pointer-events-none"
            style={{
              boxShadow: theme.glowColor
                ? `0 0 16px ${theme.glowColor}, inset 0 0 10px rgba(0,0,0,0.35)`
                : undefined,
            }}
            aria-hidden="true"
          />

          {/* Felt surface */}
          <div
            className="absolute inset-[14px] sm:inset-[19px] rounded-[50%] overflow-hidden"
            style={{
              ...feltStyle,
              boxShadow:
                "inset 0 0 110px rgba(0,0,0,0.5), inset 0 8px 36px rgba(255,255,255,0.05), inset 0 -14px 48px rgba(0,0,0,0.4)",
            }}
          >
            {feltTextureReady && (
              <div className="absolute inset-0 table-felt-spotlight pointer-events-none opacity-80" />
            )}
            {!feltTextureReady && (
              <>
                <div className="absolute inset-0 table-felt-texture opacity-60 mix-blend-overlay pointer-events-none" />
                <div className="absolute inset-0 table-felt-nap opacity-35 pointer-events-none" />
                <div className="absolute inset-0 table-felt-spotlight pointer-events-none" />
              </>
            )}
            <div className="absolute inset-[8%] sm:inset-[10%] rounded-[50%] table-betting-line pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06]">
              <span className="font-display text-4xl sm:text-6xl font-bold tracking-[0.35em] text-white select-none">
                KOUPPI
              </span>
            </div>
            <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-[62%] h-[38%] rounded-[50%] table-action-zone pointer-events-none" />
            <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-[24%] h-[17%] rounded-[50%] table-pot-zone pointer-events-none" />
          </div>

          {/* Dealer chip tray */}
          <div
            className="absolute top-[5%] left-1/2 -translate-x-1/2 z-[5] w-[32%] pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="h-[5%] min-h-[14px] rounded-b-lg mx-auto w-full"
              style={{
                background: `linear-gradient(180deg, ${theme.railColor} 0%, ${theme.railColorDark} 100%)`,
                boxShadow: "inset 0 2px 6px rgba(255,255,255,0.1), 0 4px 14px rgba(0,0,0,0.55)",
              }}
            />
            <div className="flex justify-center gap-1 mt-0.5 opacity-60">
              {[0, 1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-gold/30"
                  style={{
                    background: n % 2 === 0 ? "#c03030" : "#f5f5f5",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="absolute top-[16%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-max max-w-[90%]">
            <div className="table-dealer-banner px-4 sm:px-6 py-1.5 sm:py-2">
              <div
                className="text-gold-light font-display font-semibold text-sm sm:text-lg tracking-[0.25em] text-center truncate drop-shadow-sm"
                aria-live="polite"
              >
                {dealerMessage}
              </div>
            </div>
          </div>

          <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1">
            <div className="relative">
              <ChipStack amount={pot} size="small" animate className="scale-90 sm:scale-100" />
            </div>
            <div className="table-pot-amount px-4 py-1 rounded-full mt-0.5">
              <span className="font-display text-xl sm:text-2xl font-bold text-gold-light tabular-nums drop-shadow-md">
                {pot}
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-gold/50 font-ui tracking-[0.3em] uppercase">
              Pot
            </span>
          </div>

          <div className="absolute top-[54%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-full flex justify-center px-2">
            {children}
          </div>

          {players.map((player, index) => {
            const position = getPlayerPosition(index, players.length, effectiveMyIndex);
            return (
              <div key={player.id} className="absolute z-30" style={position}>
                <PlayerSeat
                  player={player}
                  isCurrentTurn={index === currentIndex}
                  isMe={player.id === playerId}
                  isBankrupt={player.bankroll <= 0}
                  avatar={avatars[player.id]}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-2 sm:h-0" aria-hidden="true" />
    </div>
  );
}

export default PokerTable;
