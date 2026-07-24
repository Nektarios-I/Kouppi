"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TableFeedbackEvent } from "@/lib/tableEventFeedback";

export type TableEventLogProps = {
  entries: TableFeedbackEvent[];
  viewportWidth: number;
};

/**
 * Layer 3 — bounded hand history.
 * Desktop: collapsible dock.
 * Mobile: 44×44 FAB above emote; bottom sheet.
 * Does not auto-scroll away from a user who scrolled up.
 */
export default function TableEventLog({ entries, viewportWidth }: TableEventLogProps) {
  const isMobile = viewportWidth < 768;
  const [open, setOpen] = useState(!isMobile);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevLen = useRef(0);

  useEffect(() => {
    // Collapse by default when switching to mobile
    if (isMobile) setOpen(false);
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
              <span className="font-ui text-sm text-gold-light">Hand history</span>
              <button
                type="button"
                className="table-event-log-close"
                aria-label="Close hand history"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            {body}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="table-event-log-desktop" data-testid="table-event-log">
      <button
        type="button"
        className="table-event-log-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Hand history</span>
        <span className="table-event-log-count">{entries.length}</span>
      </button>
      {open && body}
    </div>
  );
}
