"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AvatarConfig } from "@/store/remoteGameStore";
import {
  AVATAR_CATALOG,
  AVATAR_FALLBACK_SRC,
  AVATAR_RING,
  getAvatarSrc,
  normalizeAvatarConfig,
} from "@/lib/avatars";
import { HudButton } from "@/components/game/HudButton";

/** How many portraits to mount at once — scales past 100 without virtualizing libs. */
const GRID_PAGE_SIZE = 48;

interface AvatarPickerProps {
  currentAvatar: AvatarConfig | null;
  onSelect: (avatar: AvatarConfig) => void;
  compact?: boolean;
  /** Inline grid for Settings / profile panels (no popover trigger). */
  variant?: "popover" | "inline";
}

function avatarMatchesQuery(id: string, query: string) {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return id.toLowerCase().includes(normalized) || id.replace(/-/g, " ").includes(normalized);
}

function AvatarGrid({
  selectedId,
  onPick,
  query,
}: {
  selectedId: string;
  onPick: (id: string) => void;
  query: string;
}) {
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE_SIZE);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => AVATAR_CATALOG.filter((entry) => avatarMatchesQuery(entry.id, query)),
    [query]
  );

  useEffect(() => {
    setVisibleCount(GRID_PAGE_SIZE);
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [query]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const onScroll = () => {
    const node = scrollerRef.current;
    if (!node || !hasMore) return;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 48) {
      setVisibleCount((count) => Math.min(filtered.length, count + GRID_PAGE_SIZE));
    }
  };

  if (filtered.length === 0) {
    return <p className="avatar-picker-empty font-ui">No portraits match “{query.trim()}”.</p>;
  }

  return (
    <>
      <div ref={scrollerRef} className="avatar-picker-grid" onScroll={onScroll}>
        {visible.map((entry) => {
          const active = selectedId === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry.id)}
              className={`avatar-portrait-btn ${active ? "avatar-portrait-btn--active" : ""}`}
              title={entry.id}
              aria-label={entry.id}
              aria-pressed={active}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAvatarSrc(entry.id)}
                alt=""
                className="avatar-display__img"
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.src = AVATAR_FALLBACK_SRC;
                }}
              />
            </button>
          );
        })}
      </div>
      <p className="avatar-picker-meta font-ui">
        Showing {visible.length} of {filtered.length}
        {query.trim() ? " match" : " portraits"}
        {hasMore ? " · scroll for more" : ""}
      </p>
    </>
  );
}

export default function AvatarPicker({
  currentAvatar,
  onSelect,
  compact = false,
  variant = "popover",
}: AvatarPickerProps) {
  const [isOpen, setIsOpen] = useState(variant === "inline");
  const current = normalizeAvatarConfig(currentAvatar);
  const [selectedId, setSelectedId] = useState(current.id);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setSelectedId(normalizeAvatarConfig(currentAvatar).id);
  }, [currentAvatar]);

  const handleSelect = () => {
    onSelect({ id: selectedId });
    if (variant === "popover") setIsOpen(false);
  };

  const displayId = currentAvatar ? normalizeAvatarConfig(currentAvatar).id : selectedId;
  const sizeClass = compact ? "w-10 h-10" : "w-14 h-14";

  const panel = (
    <div
      className={
        variant === "inline" ? "avatar-picker-panel avatar-picker-panel--inline" : "avatar-picker-panel left-0 sm:left-auto sm:right-0"
      }
    >
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
        <div
          className="avatar-display avatar-display--portrait w-14 h-14"
          style={{
            backgroundColor: AVATAR_RING.fill,
            border: `3px solid ${AVATAR_RING.border}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getAvatarSrc(selectedId)}
            alt=""
            className="avatar-display__img"
            draggable={false}
            onError={(e) => {
              e.currentTarget.src = AVATAR_FALLBACK_SRC;
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-ui uppercase tracking-wide">Preview</p>
          <p className="font-ui font-medium text-gray-200 truncate">{selectedId}</p>
        </div>
        <HudButton variant="success" size="sm" onClick={handleSelect}>
          Save
        </HudButton>
      </div>

      <label className="sr-only" htmlFor="avatar-picker-search">
        Search portraits
      </label>
      <input
        id="avatar-picker-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search portraits…"
        className="avatar-picker-search font-ui"
        autoComplete="off"
      />

      <p className="text-xs text-gray-500 font-ui uppercase tracking-wide mb-2">Portrait</p>
      <AvatarGrid selectedId={selectedId} onPick={setSelectedId} query={query} />

      {variant === "popover" ? (
        <HudButton variant="ghost" size="sm" fullWidth className="mt-3" onClick={() => setIsOpen(false)}>
          Cancel
        </HudButton>
      ) : null}
    </div>
  );

  if (variant === "inline") {
    return <div className="avatar-picker-inline">{panel}</div>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`avatar-picker-trigger avatar-display avatar-display--portrait ${sizeClass}`}
        style={{
          backgroundColor: AVATAR_RING.fill,
          border: `3px solid ${AVATAR_RING.border}`,
        }}
        title="Change avatar"
        aria-expanded={isOpen}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getAvatarSrc(displayId)}
          alt=""
          className="avatar-display__img"
          draggable={false}
          onError={(e) => {
            e.currentTarget.src = AVATAR_FALLBACK_SRC;
          }}
        />
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-black/70 border border-gold/40 text-[10px] flex items-center justify-center">
          ✎
        </span>
      </button>

      {isOpen ? panel : null}
    </div>
  );
}

export function Avatar({
  avatar,
  size = "md",
  showDefault = true,
  frameStyle,
}: {
  avatar?: AvatarConfig | null;
  size?: "sm" | "md" | "lg";
  showDefault?: boolean;
  /** @deprecated unused — kept for call-site compat */
  playerId?: string;
  frameStyle?: { fill: string; border: string };
}) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };
  const borders = { sm: 2, md: 2, lg: 3 };
  const fill = frameStyle?.fill ?? AVATAR_RING.fill;
  const border = frameStyle?.border ?? AVATAR_RING.border;

  if (!avatar) {
    if (!showDefault) return null;
    return (
      <div
        className={`avatar-display avatar-display--portrait ${sizes[size]}`}
        style={{
          backgroundColor: fill,
          border: `${borders[size]}px solid ${border}`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AVATAR_FALLBACK_SRC} alt="" className="avatar-display__img" draggable={false} />
      </div>
    );
  }

  const normalized = normalizeAvatarConfig(avatar);

  return (
    <div
      className={`avatar-display avatar-display--portrait ${sizes[size]}`}
      style={{
        backgroundColor: fill,
        border: `${borders[size]}px solid ${border}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAvatarSrc(normalized.id)}
        alt=""
        className="avatar-display__img"
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={(e) => {
          e.currentTarget.src = AVATAR_FALLBACK_SRC;
        }}
      />
    </div>
  );
}
