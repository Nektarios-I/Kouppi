"use client";

import React from "react";
import { Avatar } from "./AvatarPicker";
import type { AvatarConfig } from "@/store/remoteGameStore";

interface Player {
  id: string;
  name: string;
  bankroll: number;
  isBot?: boolean;
  active?: boolean;
}

interface PokerTableProps {
  pot: number;
  players: Player[];
  currentIndex: number;
  playerId?: string; // Current user's player ID
  children?: React.ReactNode; // Cards in the center
  dealerMessage?: string;
  avatars?: Record<string, AvatarConfig>; // Map of playerId to avatar
}

// Player positions around an oval table (for up to 8 players)
const PLAYER_POSITIONS = [
  { top: "85%", left: "50%", transform: "translate(-50%, -50%)" },  // Bottom center (You)
  { top: "70%", left: "15%", transform: "translate(-50%, -50%)" },  // Bottom left
  { top: "35%", left: "5%", transform: "translate(-50%, -50%)" },   // Left
  { top: "8%", left: "20%", transform: "translate(-50%, -50%)" },   // Top left
  { top: "8%", left: "50%", transform: "translate(-50%, -50%)" },   // Top center
  { top: "8%", left: "80%", transform: "translate(-50%, -50%)" },   // Top right
  { top: "35%", left: "95%", transform: "translate(-50%, -50%)" },  // Right
  { top: "70%", left: "85%", transform: "translate(-50%, -50%)" },  // Bottom right
];

function getPlayerPosition(index: number, totalPlayers: number, myIndex: number) {
  // Rotate positions so the current player is always at the bottom
  const adjustedIndex = (index - myIndex + totalPlayers) % totalPlayers;
  
  // For fewer players, spread them out
  if (totalPlayers <= 2) {
    const positions = [0, 4]; // Bottom and top
    return PLAYER_POSITIONS[positions[adjustedIndex]];
  }
  if (totalPlayers <= 4) {
    const positions = [0, 2, 4, 6]; // Corners
    return PLAYER_POSITIONS[positions[adjustedIndex]];
  }
  
  return PLAYER_POSITIONS[adjustedIndex % PLAYER_POSITIONS.length];
}

export function PokerTable({
  pot,
  players,
  currentIndex,
  playerId,
  children,
  dealerMessage = "KOUPPI",
  avatars = {},
}: PokerTableProps) {
  const myIndex = players.findIndex(p => p.id === playerId);
  const effectiveMyIndex = myIndex >= 0 ? myIndex : 0;

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-[16/10] select-none">
      {/* Table background - casino green felt */}
      <div
        className="absolute inset-0 rounded-[50%] shadow-2xl overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse at center, 
              #1a5f2a 0%, 
              #145224 40%, 
              #0d3d1a 70%, 
              #082810 100%
            )
          `,
          boxShadow: `
            inset 0 0 60px rgba(0, 0, 0, 0.5),
            0 8px 32px rgba(0, 0, 0, 0.7),
            0 0 0 8px #5c3d1e,
            0 0 0 12px #4a2f15,
            0 0 0 18px #3a240f
          `,
        }}
      >
        {/* Table felt texture */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Inner table border/rail */}
        <div 
          className="absolute inset-4 rounded-[50%] border-2 border-yellow-900/30"
          style={{
            boxShadow: "inset 0 0 20px rgba(0, 0, 0, 0.3)",
          }}
        />
      </div>

      {/* Dealer/House area at top */}
      <div 
        className="absolute top-[25%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10"
      >
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-6 py-2 border border-yellow-600/50">
          <div className="text-yellow-400 font-bold text-lg tracking-wider">
            {dealerMessage}
          </div>
        </div>
      </div>

      {/* Pot display in center */}
      <div className="absolute top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="flex flex-col items-center gap-2">
          {/* Chip stack visualization */}
          <div className="relative">
            <div className="flex items-center gap-1">
              <span className="text-3xl">🪙</span>
              <span className="text-2xl font-bold text-yellow-400 drop-shadow-lg">
                {pot}
              </span>
            </div>
          </div>
          <div className="text-xs text-yellow-200/70 font-medium tracking-wide">
            POT
          </div>
        </div>
      </div>

      {/* Cards area in center */}
      <div className="absolute top-[55%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
        {children}
      </div>

      {/* Player seats */}
      {players.map((player, index) => {
        const position = getPlayerPosition(index, players.length, effectiveMyIndex);
        const isCurrentTurn = index === currentIndex;
        const isMe = player.id === playerId;
        const isBankrupt = player.bankroll <= 0;
        const avatar = avatars[player.id];

        return (
          <div
            key={player.id}
            className="absolute z-30"
            style={position}
          >
            <PlayerSeat
              player={player}
              isCurrentTurn={isCurrentTurn}
              isMe={isMe}
              isBankrupt={isBankrupt}
              avatar={avatar}
            />
          </div>
        );
      })}
    </div>
  );
}

interface PlayerSeatProps {
  player: Player;
  isCurrentTurn: boolean;
  isMe: boolean;
  isBankrupt: boolean;
  avatar?: AvatarConfig;
}

function PlayerSeat({ player, isCurrentTurn, isMe, isBankrupt, avatar }: PlayerSeatProps) {
  return (
    <div
      className={`
        flex flex-col items-center gap-1 p-2 rounded-lg min-w-[80px]
        transition-all duration-300
        ${isCurrentTurn 
          ? "bg-green-500/30 ring-2 ring-green-400 shadow-lg shadow-green-500/30 scale-110" 
          : "bg-black/40"
        }
        ${isMe ? "ring-2 ring-blue-400" : ""}
        ${isBankrupt ? "opacity-50" : ""}
      `}
    >
      {/* Player avatar */}
      {avatar ? (
        <Avatar avatar={avatar} size="md" />
      ) : (
        <div 
          className={`
            w-10 h-10 rounded-full flex items-center justify-center text-xl
            ${isMe 
              ? "bg-blue-600 border-2 border-blue-400" 
              : "bg-gray-700 border-2 border-gray-500"
            }
            ${player.isBot ? "bg-gray-600" : ""}
          `}
        >
          {player.isBot ? "🤖" : isMe ? "👤" : "😊"}
        </div>
      )}

      {/* Player name */}
      <div className="text-xs font-semibold text-white truncate max-w-[70px]">
        {player.name}
        {isMe && <span className="text-blue-400 ml-1">(you)</span>}
      </div>

      {/* Bankroll */}
      <div 
        className={`
          text-xs font-mono px-2 py-0.5 rounded-full
          ${isBankrupt 
            ? "bg-red-900/50 text-red-400" 
            : "bg-yellow-900/50 text-yellow-300"
          }
        `}
      >
        💰 {player.bankroll}
      </div>

      {/* Turn indicator */}
      {isCurrentTurn && (
        <div className="text-xs text-green-400 font-bold animate-pulse">
          🎯 Turn
        </div>
      )}
    </div>
  );
}

export default PokerTable;
