"use client";

import React from "react";
import type { TableFeedbackEvent } from "@/lib/tableEventFeedback";

export type TableResultRibbonProps = {
  event: TableFeedbackEvent | null;
};

const TONE_CLASS: Record<TableFeedbackEvent["tone"], string> = {
  neutral: "table-result-ribbon--neutral",
  win: "table-result-ribbon--win",
  loss: "table-result-ribbon--loss",
  shistri: "table-result-ribbon--shistri",
  action: "table-result-ribbon--action",
};

/**
 * Layer 2 — single non-blocking compact result ribbon in the table safe zone.
 * Never a dialog; no OK/close.
 */
export default function TableResultRibbon({ event }: TableResultRibbonProps) {
  if (!event) return null;

  return (
    <div
      className="table-result-ribbon-host"
      data-testid="table-result-ribbon-host"
    >
      <div
        key={event.id}
        className={`table-result-ribbon ${TONE_CLASS[event.tone]}`}
        role="status"
        aria-live={event.ariaLive === "off" ? "off" : event.ariaLive}
        aria-atomic="true"
        data-testid="table-result-ribbon"
        data-tone={event.tone}
      >
        <span className="table-result-ribbon-text">{event.ribbonText}</span>
      </div>
    </div>
  );
}
