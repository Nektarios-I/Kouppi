"use client";

import React from "react";
import Link from "next/link";
import CasinoBackground from "./CasinoBackground";
import { useTableTheme } from "@/hooks/useTableTheme";
import { HudButton } from "./HudButton";
import { DEFAULT_TABLE_THEME_ID, getTableThemeById } from "@/lib/tableThemes";

/* ── Shell ── */
export function LobbyShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTableTheme();
  return (
    <CasinoBackground theme={theme} className={`text-white min-h-screen ${className}`}>
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</div>
    </CasinoBackground>
  );
}

/** Static shell when theme hook isn't needed (e.g. loading states) */
export function PreGameShell({ children }: { children: React.ReactNode }) {
  const theme = getTableThemeById(DEFAULT_TABLE_THEME_ID);
  return (
    <CasinoBackground theme={theme} className="text-white min-h-screen">
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
        {children}
      </div>
    </CasinoBackground>
  );
}

/* ── Header ── */
export function LobbyHeader({
  title = "KOUPPI",
  subtitle = "Multiplayer Lobby",
  connected,
  onRefresh,
}: {
  title?: string;
  subtitle?: string;
  connected?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <header className="text-center mb-8 sm:mb-10">
      <h1 className="font-display text-4xl sm:text-5xl font-bold text-gold-light tracking-[0.2em] mb-2">
        {title}
      </h1>
      <p className="text-gray-400 font-ui text-sm sm:text-base">{subtitle}</p>
      <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
        {connected !== undefined && (
          <span
            className={`hud-badge inline-flex items-center gap-2 ${
              connected ? "hud-badge-gold !text-success" : "hud-result-loss !bg-error-muted"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-success animate-pulse" : "bg-error"}`}
            />
            {connected ? "Connected" : "Disconnected"}
          </span>
        )}
        {onRefresh && (
          <HudButton variant="ghost" size="sm" onClick={onRefresh}>
            Refresh
          </HudButton>
        )}
      </div>
    </header>
  );
}

/* ── Card panel ── */
export function LobbyCard({
  title,
  icon,
  badge,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`lobby-card mb-5 sm:mb-6 ${className}`}>
      <div className="lobby-card-header">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-xl shrink-0 opacity-80">{icon}</span>}
          <h2 className="font-display text-lg sm:text-xl font-bold text-gold-light tracking-wide truncate">
            {title}
          </h2>
        </div>
        {badge}
      </div>
      <div className="lobby-card-body">{children}</div>
    </section>
  );
}

/* ── Form controls ── */
export function LobbyInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`lobby-input font-ui ${className}`} {...props} />;
}

export function LobbyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 font-ui">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

/* ── Room row ── */
export interface RoomRowData {
  id: string;
  code?: string;
  playerCount: number;
  maxPlayers: number;
  isPrivate?: boolean;
  hostId?: string;
  spectatorCount?: number;
  live?: boolean;
}

export function RoomRow({
  room,
  actionLabel,
  actionVariant = "bet",
  disabled,
  loading,
  onAction,
}: {
  room: RoomRowData;
  actionLabel: string;
  actionVariant?: "bet" | "kouppi" | "primary";
  disabled?: boolean;
  loading?: boolean;
  onAction: () => void;
}) {
  const full = room.playerCount >= room.maxPlayers;

  return (
    <div className="lobby-room-row">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div className={`lobby-room-icon ${room.live ? "lobby-room-icon-live" : ""}`}>
          {room.live ? "●" : "♠"}
        </div>
        <div className="min-w-0">
          <div className="font-ui font-semibold text-white truncate flex items-center gap-2">
            {room.code || room.id}
            {room.isPrivate && (
              <span className="text-gold text-xs" title="Private">
                🔒
              </span>
            )}
            {room.live && (
              <span className="hud-badge hud-badge-live text-[10px] py-0">LIVE</span>
            )}
          </div>
          <div className="text-xs sm:text-sm text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <span>
              {room.playerCount}/{room.maxPlayers} players
            </span>
            {room.spectatorCount !== undefined && room.spectatorCount > 0 && (
              <span className="text-purple-300">{room.spectatorCount} watching</span>
            )}
            {room.hostId && (
              <span className="text-gray-500 truncate max-w-[120px]">
                Host {room.hostId.slice(0, 8)}…
              </span>
            )}
          </div>
        </div>
      </div>
      <HudButton
        variant={full ? "ghost" : actionVariant}
        size="sm"
        onClick={onAction}
        disabled={disabled || full || loading}
        className="shrink-0"
      >
        {loading ? "…" : full ? "Full" : actionLabel}
      </HudButton>
    </div>
  );
}

export function LobbyEmpty({
  icon = "♠",
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="text-center py-10 sm:py-12">
      <div className="text-5xl mb-3 opacity-30 font-display">{icon}</div>
      <p className="text-gray-400 font-ui">{title}</p>
      {hint && <p className="text-sm text-gray-500 mt-1 font-ui">{hint}</p>}
    </div>
  );
}

export function LobbyAlert({
  variant = "error",
  children,
  onDismiss,
}: {
  variant?: "error" | "warning" | "info";
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const cls =
    variant === "error"
      ? "hud-result-loss"
      : variant === "warning"
        ? "hud-result-pass"
        : "hud-status-banner";
  return (
    <div className={`${cls} flex items-center justify-between gap-3 mb-5 font-ui text-sm`} role="alert">
      <span>{children}</span>
      {onDismiss && (
        <HudButton variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </HudButton>
      )}
    </div>
  );
}

export function LobbyFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 text-center">
      <Link href={href} className="hud-btn hud-btn-ghost inline-flex no-underline text-sm">
        {children}
      </Link>
    </div>
  );
}

/* ── Pre-game modal card (centered) ── */
export function PreGameCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`game-modal-panel w-full max-w-md ${className}`}>
      <div className="game-modal-header !mb-4 !pb-3">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-gold-light tracking-wide">
          {title}
        </h2>
        {subtitle && <p className="text-gray-400 text-sm font-ui mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function PreGameLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <PreGameCard title="Please wait" subtitle={message}>
      <div className="flex justify-center py-6">
        <div className="hud-timer-ring w-12 h-12 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        </div>
      </div>
    </PreGameCard>
  );
}
