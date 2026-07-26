"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TableFeedbackEvent } from "@/lib/tableEventFeedback";
import { useOverlayDialog } from "./useOverlayDialog";

export interface HistoryRoundInfo {
  phase: string;
  summary?: string | null;
  awaitingNext?: boolean;
}

export interface HistoryTableInfo {
  mode: string;
  details?: string[];
}

export interface HistoryDrawerProps {
  entries: TableFeedbackEvent[];
  liveEvent?: TableFeedbackEvent | null;
  round: HistoryRoundInfo;
  table: HistoryTableInfo;
}

type HistoryTab = "actions" | "round" | "table";

const TABS: { id: HistoryTab; label: string }[] = [
  { id: "actions", label: "Actions" },
  { id: "round", label: "Hand / Round" },
  { id: "table", label: "Table" },
];

const PANEL_GAP = 8;
const DESKTOP_PANEL_WIDTH = 320;

function isNarrowViewport() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(max-width: 639px)").matches;
  }
  return window.innerWidth <= 639;
}

export default function HistoryDrawer({
  entries,
  liveEvent = null,
  round,
  table,
}: HistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<HistoryTab>("actions");
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | undefined>(undefined);
  const [portalReady, setPortalReady] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { panelRef, triggerRef } = useOverlayDialog(open, close);
  const tabRefs = useRef<Record<HistoryTab, HTMLButtonElement | null>>({
    actions: null,
    round: null,
    table: null,
  });

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const narrow = isNarrowViewport();
    const rect = trigger.getBoundingClientRect();
    const width = narrow
      ? Math.min(window.innerWidth - PANEL_GAP * 2, window.innerWidth * 0.94)
      : Math.min(DESKTOP_PANEL_WIDTH, window.innerWidth * 0.86);

    let left = rect.left;
    if (left + width > window.innerWidth - PANEL_GAP) {
      left = Math.max(PANEL_GAP, rect.right - width);
    }
    left = Math.max(PANEL_GAP, Math.min(left, window.innerWidth - width - PANEL_GAP));

    const top = rect.bottom + PANEL_GAP;
    const maxHeight = Math.max(
      160,
      Math.min(window.innerHeight - top - PANEL_GAP, window.innerHeight * (narrow ? 0.55 : 0.72))
    );

    setPanelStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      inset: "auto",
    });
  }, [triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePanelPosition]);

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.id === tab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(index + direction + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const overlay =
    open && portalReady ? (
      <div
        className="history-drawer-layer"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <aside
          ref={panelRef}
          className="history-drawer-panel history-drawer-panel--anchored"
          style={panelStyle}
          role="dialog"
          aria-modal="true"
          aria-label="Game history"
        >
          <div className="game-overlay-header">
            <div>
              <p className="game-overlay-eyebrow font-ui">TABLE LOG</p>
              <h2 className="game-overlay-title font-display">History</h2>
            </div>
            <button
              type="button"
              className="game-overlay-close"
              aria-label="Close history"
              onClick={close}
            >
              ✕
            </button>
          </div>
          <div className="history-drawer-tabs" role="tablist" aria-label="History sections">
            {TABS.map((item) => (
              <button
                key={item.id}
                ref={(element) => {
                  tabRefs.current[item.id] = element;
                }}
                id={`history-tab-${item.id}`}
                type="button"
                role="tab"
                aria-controls="history-panel"
                aria-selected={tab === item.id}
                tabIndex={tab === item.id ? 0 : -1}
                className={
                  tab === item.id
                    ? "history-drawer-tab history-drawer-tab--active"
                    : "history-drawer-tab"
                }
                onClick={() => setTab(item.id)}
                onKeyDown={onTabKeyDown}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            id="history-panel"
            className="history-drawer-content"
            role="tabpanel"
            aria-labelledby={`history-tab-${tab}`}
          >
            {tab === "actions" ? (
              <>
                {liveEvent ? (
                  <p className="history-drawer-latest" aria-live={liveEvent.ariaLive}>
                    <span>Latest</span>
                    {liveEvent.ribbonText}
                  </p>
                ) : null}
                {entries.length ? (
                  entries.map((entry) => (
                    <p key={entry.id} className="history-drawer-entry" data-tone={entry.tone}>
                      {entry.logText}
                    </p>
                  ))
                ) : (
                  <p className="history-drawer-empty">No actions yet.</p>
                )}
              </>
            ) : null}
            {tab === "round" ? (
              <dl className="history-drawer-details">
                <div>
                  <dt>Phase</dt>
                  <dd>{round.phase}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {round.summary ||
                      (round.awaitingNext ? "Ready for next turn" : "In progress")}
                  </dd>
                </div>
              </dl>
            ) : null}
            {tab === "table" ? (
              <dl className="history-drawer-details">
                <div>
                  <dt>Mode</dt>
                  <dd>{table.mode}</dd>
                </div>
                {(table.details ?? []).map((detail) => (
                  <div key={detail}>
                    <dt>Info</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </aside>
      </div>
    ) : null;

  return (
    <div className="history-drawer-root history-drawer-root--toolbar">
      <button
        ref={triggerRef}
        type="button"
        className="history-drawer-trigger history-drawer-trigger--toolbar"
        aria-label="Open history"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">History</span>
        {entries.length ? (
          <span className="history-drawer-count">{Math.min(99, entries.length)}</span>
        ) : null}
      </button>

      {overlay ? createPortal(overlay, document.body) : null}
    </div>
  );
}
