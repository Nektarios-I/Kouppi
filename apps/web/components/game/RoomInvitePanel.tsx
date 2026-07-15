"use client";

import { useMemo } from "react";
import { HudButton } from "./HudButton";
import { LobbyInput } from "./LobbyUI";

export default function RoomInvitePanel({
  roomCode,
  onCopyLink,
}: {
  roomCode: string;
  onCopyLink: () => void;
}) {
  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join?code=${encodeURIComponent(roomCode)}`;
  }, [roomCode]);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join my KOUPPI game",
          text: `Join room ${roomCode}`,
          url: joinUrl,
        });
        return;
      } catch {
        // fall through to copy
      }
    }
    onCopyLink();
  };

  return (
    <div className="space-y-3">
      <div className="text-center py-3 rounded-xl bg-black/30 border border-gold/20">
        <p className="text-xs text-gray-500 font-ui uppercase tracking-widest mb-1">Room Code</p>
        <p className="font-display text-3xl sm:text-4xl font-bold text-gold-light tracking-[0.35em]">
          {roomCode}
        </p>
      </div>
      <div className="flex gap-2">
        <LobbyInput readOnly value={joinUrl} className="flex-1 text-xs sm:text-sm" />
        <HudButton variant="bet" size="sm" onClick={onCopyLink}>
          Copy
        </HudButton>
      </div>
      <HudButton variant="ghost" size="sm" fullWidth onClick={handleShare}>
        Share invite
      </HudButton>
    </div>
  );
}
