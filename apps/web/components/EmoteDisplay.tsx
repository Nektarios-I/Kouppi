"use client";

import { useRemoteGameStore, EmoteEvent } from "@/store/remoteGameStore";

/**
 * EmoteDisplay - Shows active emotes floating above the game
 * Emotes appear when players send them and fade out after 3 seconds
 */
export default function EmoteDisplay() {
  const activeEmotes = useRemoteGameStore(s => s.activeEmotes);
  const playersInRoom = useRemoteGameStore(s => s.playersInRoom);
  
  if (activeEmotes.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {activeEmotes.map((emote, index) => {
        const playerIndex = playersInRoom.findIndex(p => p.id === emote.playerId);
        // Position emotes based on player index, with some offset to stack
        const horizontalOffset = ((playerIndex % 4) * 25) + 10;
        const verticalOffset = 20 + (index % 3) * 20;
        
        return (
          <EmoteBubble
            key={emote.id}
            emote={emote}
            style={{
              left: `${horizontalOffset}%`,
              top: `${verticalOffset}%`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Single emote bubble with animation
 */
function EmoteBubble({ emote, style }: { emote: EmoteEvent; style: React.CSSProperties }) {
  return (
    <div
      className="absolute animate-emote-float"
      style={{
        ...style,
        animation: "emote-float 3s ease-out forwards",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-full shadow-lg"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(79, 70, 229, 0.95) 100%)",
          boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)",
        }}
      >
        <span className="text-3xl">{emote.emote}</span>
        <span className="text-white text-sm font-medium max-w-24 truncate">
          {emote.playerName}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact emote display that appears above a specific player's area
 * Use this for the poker table to show emotes near each player
 */
export function PlayerEmote({ playerId }: { playerId: string }) {
  const activeEmotes = useRemoteGameStore(s => s.activeEmotes);
  const playerEmotes = activeEmotes.filter(e => e.playerId === playerId);
  
  if (playerEmotes.length === 0) return null;
  
  // Show only the most recent emote
  const latestEmote = playerEmotes[playerEmotes.length - 1];
  
  return (
    <div
      className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-10"
      style={{
        animation: "emote-bounce 0.5s ease-out",
      }}
    >
      <span className="text-3xl drop-shadow-lg">{latestEmote.emote}</span>
    </div>
  );
}
