"use client";

import React, { useState } from "react";
import { HudButton } from "./HudButton";
import { isPlayerMuted, mutePlayer, unmutePlayer } from "@/lib/mutedPlayers";

export type ReportReason = "harassment" | "spam" | "inappropriate" | "cheating" | "other";

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "harassment", label: "Harassment" },
  { id: "spam", label: "Spam" },
  { id: "inappropriate", label: "Inappropriate name/chat" },
  { id: "cheating", label: "Cheating / abuse" },
  { id: "other", label: "Other" },
];

export interface PlayerModerationMenuProps {
  playerId: string;
  playerName: string;
  isHost: boolean;
  onReport: (targetId: string, reason: ReportReason) => void;
  onBan?: (targetId: string) => void;
  onMuteChat?: (targetId: string, muted: boolean) => void;
  chatMutedByHost?: boolean;
}

export default function PlayerModerationMenu({
  playerId,
  playerName,
  isHost,
  onReport,
  onBan,
  onMuteChat,
  chatMutedByHost,
}: PlayerModerationMenuProps) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const locallyMuted = isPlayerMuted(playerId);

  const handleLocalMute = () => {
    if (locallyMuted) unmutePlayer(playerId);
    else mutePlayer(playerId);
    setOpen(false);
  };

  return (
    <div className="relative">
      <HudButton variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-label={`Actions for ${playerName}`}>
        ⋯
      </HudButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-xl border border-white/10 bg-bg-casino-mid shadow-lg p-2 flex flex-col gap-1">
          <HudButton variant="ghost" size="sm" onClick={handleLocalMute}>
            {locallyMuted ? "Unmute (you)" : "Mute (you)"}
          </HudButton>
          {!reporting ? (
            <HudButton variant="ghost" size="sm" onClick={() => setReporting(true)}>
              Report
            </HudButton>
          ) : (
            REPORT_REASONS.map((r) => (
              <HudButton
                key={r.id}
                variant="ghost"
                size="sm"
                onClick={() => {
                  onReport(playerId, r.id);
                  setReporting(false);
                  setOpen(false);
                }}
              >
                {r.label}
              </HudButton>
            ))
          )}
          {isHost && onMuteChat && (
            <HudButton
              variant="ghost"
              size="sm"
              onClick={() => {
                onMuteChat(playerId, !chatMutedByHost);
                setOpen(false);
              }}
            >
              {chatMutedByHost ? "Unmute chat (host)" : "Mute chat (host)"}
            </HudButton>
          )}
          {isHost && onBan && (
            <HudButton
              variant="danger"
              size="sm"
              onClick={() => {
                onBan(playerId);
                setOpen(false);
              }}
            >
              Ban from room
            </HudButton>
          )}
        </div>
      )}
    </div>
  );
}
