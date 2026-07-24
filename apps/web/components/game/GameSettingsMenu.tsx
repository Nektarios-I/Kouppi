"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSounds } from "@/hooks/useSounds";
import { useTableEffectsStore } from "@/store/tableEffectsStore";
import type { TableEffectsLevel, TableSoundPreference } from "@/lib/tableEventFeedback/types";
import type { AvatarConfig } from "@/lib/avatars";
import AvatarPicker from "@/components/AvatarPicker";
import TableThemeSelector from "./TableThemeSelector";
import { HudButton } from "./HudButton";
import { useOverlayDialog } from "./useOverlayDialog";

export interface GameSettingsAvatarProps {
  currentAvatar: AvatarConfig | null;
  onChange: (avatar: AvatarConfig) => void;
}

export interface GameSettingsMenuProps {
  onRequestLeave: () => void;
  leaveLabel?: string;
  hostControls?: ReactNode;
  returnControl?: ReactNode;
  avatar?: GameSettingsAvatarProps | null;
}

type SettingsTab = "appearance" | "avatar" | "audio" | "session";

const EFFECT_OPTIONS: { id: TableEffectsLevel; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "reduced", label: "Reduced" },
  { id: "off", label: "Off" },
];

const SOUND_OPTIONS: { id: TableSoundPreference; label: string }[] = [
  { id: "on", label: "On" },
  { id: "off", label: "Off" },
];

export default function GameSettingsMenu({
  onRequestLeave,
  leaveLabel = "Leave game",
  hostControls,
  returnControl,
  avatar = null,
}: GameSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const close = useCallback(() => setOpen(false), []);
  const { masterVolume, sfxVolume, musicVolume, setMasterVolume, setSfxVolume, setMusicVolume } =
    useSounds();
  const effects = useTableEffectsStore((state) => state.effects);
  const tableSound = useTableEffectsStore((state) => state.sound);
  const setEffects = useTableEffectsStore((state) => state.setEffects);
  const setTableSound = useTableEffectsStore((state) => state.setSound);
  const { panelRef, triggerRef } = useOverlayDialog(open, close);
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  const tabs: { id: SettingsTab; label: string; hidden?: boolean }[] = [
    { id: "appearance", label: "Look" },
    { id: "avatar", label: "Avatar", hidden: !avatar },
    { id: "audio", label: "Audio" },
    { id: "session", label: "Session" },
  ];
  const visibleTabs = tabs.filter((item) => !item.hidden);

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = visibleTabs.findIndex((item) => item.id === tab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = visibleTabs[(index + direction + visibleTabs.length) % visibleTabs.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const volumeRows = [
    { label: "Master volume", value: masterVolume, set: setMasterVolume },
    { label: "Sound effects", value: sfxVolume, set: setSfxVolume },
    { label: "Music", value: musicVolume, set: setMusicVolume },
  ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="game-utility-icon"
        aria-label="Open game settings"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">⚙</span>
      </button>
      {open ? (
        <div
          className="game-overlay-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={panelRef}
            className="game-settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Game settings"
          >
            <div className="game-overlay-header">
              <div>
                <p className="game-overlay-eyebrow font-ui">KOUPPI</p>
                <h2 className="game-overlay-title font-display">Settings</h2>
              </div>
              <button
                type="button"
                className="game-overlay-close"
                aria-label="Close game settings"
                onClick={close}
              >
                ✕
              </button>
            </div>

            <div
              className="game-settings-tabs"
              style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
              role="tablist"
              aria-label="Settings sections"
            >
              {visibleTabs.map((item) => (
                <button
                  key={item.id}
                  ref={(element) => {
                    tabRefs.current[item.id] = element;
                  }}
                  id={`settings-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-controls={`settings-panel-${item.id}`}
                  aria-selected={tab === item.id}
                  tabIndex={tab === item.id ? 0 : -1}
                  className={
                    tab === item.id
                      ? "game-settings-tab game-settings-tab--active"
                      : "game-settings-tab"
                  }
                  onClick={() => setTab(item.id)}
                  onKeyDown={onTabKeyDown}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "appearance" ? (
              <section
                id="settings-panel-appearance"
                role="tabpanel"
                aria-labelledby="settings-tab-appearance"
                className="game-settings-section"
              >
                <h3>Table appearance</h3>
                <TableThemeSelector id="game-settings-table-theme" />
              </section>
            ) : null}

            {tab === "avatar" && avatar ? (
              <section
                id="settings-panel-avatar"
                role="tabpanel"
                aria-labelledby="settings-tab-avatar"
                className="game-settings-section"
              >
                <h3>Your avatar</h3>
                <AvatarPicker
                  variant="inline"
                  currentAvatar={avatar.currentAvatar}
                  onSelect={avatar.onChange}
                />
              </section>
            ) : null}

            {tab === "audio" ? (
              <section
                id="settings-panel-audio"
                role="tabpanel"
                aria-labelledby="settings-tab-audio"
                className="game-settings-section"
              >
                <h3>Audio & effects</h3>
                {volumeRows.map((row) => (
                  <label key={row.label} className="game-settings-range font-ui">
                    <span>
                      {row.label}
                      <strong>{Math.round(row.value * 100)}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={row.value * 100}
                      onChange={(event) => row.set(Number(event.target.value) / 100)}
                    />
                  </label>
                ))}
                <div className="table-effects-row">
                  <span className="table-effects-label">Table effects</span>
                  <div className="table-effects-options" role="group" aria-label="Table effects">
                    {EFFECT_OPTIONS.map((option) => (
                      <HudButton
                        key={option.id}
                        variant={effects === option.id ? "success" : "ghost"}
                        size="sm"
                        aria-pressed={effects === option.id}
                        onClick={() => setEffects(option.id)}
                      >
                        {option.label}
                      </HudButton>
                    ))}
                  </div>
                  <span className="table-effects-label">Table sound</span>
                  <div className="table-effects-options" role="group" aria-label="Table sound">
                    {SOUND_OPTIONS.map((option) => (
                      <HudButton
                        key={option.id}
                        variant={tableSound === option.id ? "success" : "ghost"}
                        size="sm"
                        aria-pressed={tableSound === option.id}
                        onClick={() => setTableSound(option.id)}
                      >
                        {option.label}
                      </HudButton>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {tab === "session" ? (
              <div
                id="settings-panel-session"
                role="tabpanel"
                aria-labelledby="settings-tab-session"
              >
                <section className="game-settings-section">
                  <h3>Rules & help</h3>
                  <Link
                    href="/how-to-play"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="game-settings-link"
                  >
                    How to play KOUPPI
                  </Link>
                </section>

                {hostControls ? (
                  <section className="game-settings-section">
                    <h3>Host tools</h3>
                    {hostControls}
                  </section>
                ) : null}

                <section className="game-settings-section game-settings-danger">
                  <h3>Session</h3>
                  {returnControl}
                  <HudButton
                    variant="danger"
                    fullWidth
                    onClick={() => {
                      close();
                      onRequestLeave();
                    }}
                  >
                    {leaveLabel}
                  </HudButton>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
