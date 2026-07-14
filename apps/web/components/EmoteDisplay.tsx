"use client";

import { useRemoteGameStore } from "@/store/remoteGameStore";

/**
 * Emote bubble anchored above a player seat (used inside PlayerSeat).
 */
export function PlayerEmote({ playerId }: { playerId: string }) {
  const activeEmotes = useRemoteGameStore((s) => s.activeEmotes);
  const playerEmotes = activeEmotes.filter((e) => e.playerId === playerId);

  if (playerEmotes.length === 0) return null;

  const latestEmote = playerEmotes[playerEmotes.length - 1];

  return (
    <div
      className="animate-emote-bounce"
      role="img"
      aria-label={`${latestEmote.playerName} sent ${latestEmote.emote}`}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/90 border border-indigo-400/40 shadow-lg backdrop-blur-sm">
        <span className="text-2xl leading-none">{latestEmote.emote}</span>
      </div>
    </div>
  );
}

/**
 * @deprecated Emotes are now anchored to PlayerSeat via PlayerEmote.
 * Kept as a no-op for backward compatibility.
 */
export default function EmoteDisplay() {
  return null;
}
