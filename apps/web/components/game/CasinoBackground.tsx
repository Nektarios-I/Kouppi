"use client";

import React from "react";
import type { TableTheme } from "@/lib/tableThemes";
import CasinoFloor from "./CasinoFloor";
import BackgroundProps from "./BackgroundProps";

interface CasinoBackgroundProps {
  children: React.ReactNode;
  className?: string;
  theme: TableTheme;
}

/**
 * Full casino room: perspective floor, walls, lighting, and optional props.
 */
export default function CasinoBackground({ children, className = "", theme }: CasinoBackgroundProps) {
  return (
    <div className={`relative min-h-screen overflow-hidden casino-room ${className}`}>
      <CasinoFloor theme={theme} />
      <BackgroundProps theme={theme} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
