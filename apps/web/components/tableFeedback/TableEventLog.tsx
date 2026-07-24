"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TableFeedbackEvent } from "@/lib/tableEventFeedback";

export type TableEventLogProps = {
  entries: TableFeedbackEvent[];
  /** Ephemeral latest result (formerly center ribbon) — shown in panel only. */
  liveEvent?: TableFeedbackEvent | null;
  viewportWidth: number;
};

const TONE_CLASS: Record<TableFeedbackEvent["tone"], string> = {
  neutral: "table-info-live--neutral",
  win: "table-info-live--win",
  loss: "table-info-live--loss",
  shistri: "table-info-live--shistri",
  action: "table-info-live--action",
};

/**
 * Layer 3 — hand history + live status (panel-only; not center-felt).
 * Desktop: left info rail.
 * Mobile: 44×44 FAB + bottom sheet.
 */
export default function TableEventLog({
  entries,
  liveEvent = null,
  viewportWidth,
}: TableEventLogProps) {
  // Match `.game-stage-side` (≥1024): rail on desktop, FAB below that.
  const isMobile = viewportWidth < 1024;
  const [open, setOpen] = useState(!isMobile);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevLen = useRef(0);

  useEffect(() => {
    if (isMobile) setOpen(false);
    else setOpen(true);
  }, [isMobile]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !open) return;
    if (entries.length > prevLen.current && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevLen.current = entries.length;
  }, [entries, open]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = dist < 28;
  };

  const liveStatus = liveEvent ? (
    <div
      key={liveEvent.id}
      className={`table-info-live ${TONE_CLASS[liveEvent.tone]}`}
      role="status"
      aria-live={liveEvent.ariaLive === "off" ? "off" : liveEvent.ariaLive}
      aria-atomic="true"
      data-testid="table-result-ribbon"
      data-tone={liveEvent.tone}
    >
      <span className="table-info-live-label font-ui">Latest</span>
      <span className="table-info-live-text">{liveEvent.ribbonText}</span>
    </div>
  ) : (
    <div className="table-info-live table-info-live--idle" data-testid="table-info-live-idle">
      <span className="table-info-live-label font-ui">Latest</span>
      <span className="table-info-live-text table-info-live-text--muted">Waiting for action…</span>
    </div>
  );

  const body = (
    <div
      ref={listRef}
      className="table-event-log-body"
      onScroll={onScroll}
      data-testid="table-event-log-body"
    >
      {entries.length === 0 ? (
        <p className="table-event-log-empty">No events yet.</p>
      ) : (
        entries.map((e) => (
          <div key={e.id} className="table-event-log-line" data-tone={e.tone}>
            {e.logText}
          </div>
        ))
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="table-event-log-mobile" data-testid="table-event-log">
        <button
          type="button"
          className="table-event-log-fab"
          aria-label={open ? "Close hand history" : "Open hand history"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">☰</span>
          <span className="sr-only">Hand history</span>
          {entries.length > 0 && (
            <span className="table-event-log-fab-count" aria-hidden="true">
              {Math.min(entries.length, 99)}
            </span>
          )}
        </button>
        {open && (
          <div
            className="table-event-log-sheet"
            role="dialog"
            aria-label="Hand history"
          >
            <div className="table-event-log-sheet-header">
              <span className="font-ui text-sm text-gold-light">Table info</span>
              <button
                type="button"
                className="table-event-log-close"
                aria-label="Close hand history"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            {liveStatus}
            {body}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      className="table-info-panel table-event-log-desktop"
      data-testid="table-event-log"
      aria-label="Table info and hand history"
    >
      <div className="table-info-panel-header">
        <span className="table-info-panel-title font-ui">Table info</span>
        <span className="table-event-log-count">{entries.length}</span>
      </div>
      {liveStatus}
      <button
        type="button"
        className="table-event-log-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Hand history</span>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && body}
    </aside>
  );
}
