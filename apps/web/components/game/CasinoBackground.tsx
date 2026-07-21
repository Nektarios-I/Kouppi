"use client";

import React from "react";
import type { TableTheme } from "@/lib/tableThemes";
import CasinoFloor from "./CasinoFloor";
import BackgroundProps from "./BackgroundProps";

interface CasinoBackgroundProps {
  children: React.ReactNode;
  className?: string;
  theme: TableTheme;
  /**
   * When true, lock the document to one viewport (in-game table views).
   * Lobby / mode pages must leave this false so Create/Join/Career content can scroll.
   */
  lockViewport?: boolean;
}

/**
 * Full casino room: perspective floor, walls, lighting, and optional props.
 */
export default function CasinoBackground({
  children,
  className = "",
  theme,
  lockViewport = false,
}: CasinoBackgroundProps) {
  return (
    <div
      className={`relative casino-room ${
        lockViewport ? "game-viewport-shell" : "lobby-viewport-shell"
      } ${className}`}
    >
      <CasinoFloor theme={theme} />
      <BackgroundProps theme={theme} />
      <div className={`relative z-10 ${lockViewport ? "game-viewport-content" : ""}`}>
        {children}
      </div>
    </div>
  );
}
