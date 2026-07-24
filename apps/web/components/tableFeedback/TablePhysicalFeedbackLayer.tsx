"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ChipTransferLayer from "@/components/chips/ChipTransferLayer";
import {
  chipTransferFromPhysicalIntent,
  type ChipTransfer,
} from "@/lib/chips";
import type { TableEffectsLevel, TableFeedbackEvent } from "@/lib/tableEventFeedback";

type Point = { x: number; y: number };

function rectCenter(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function querySeat(root: HTMLElement | null, playerId: string): Element | null {
  if (!root || !playerId) return null;
  const safe = playerId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return (
    root.querySelector(`[data-seat-id="${safe}"]`) ||
    document.querySelector(`[data-seat-id="${safe}"]`)
  );
}

function queryPot(root: HTMLElement | null): Element | null {
  if (!root) return null;
  return root.querySelector(`[data-pot-anchor="true"]`) || document.querySelector(`[data-pot-anchor="true"]`);
}

type SeatFx = {
  key: string;
  playerId: string;
  mode: "win" | "loss";
  until: number;
};

type ShistriBadge = {
  key: string;
  playerId: string;
  amount?: number;
  until: number;
  pos: Point;
};

export type TablePhysicalFeedbackLayerProps = {
  events: TableFeedbackEvent[];
  tableSurfaceRef: React.RefObject<HTMLElement | null>;
  visualLevel: TableEffectsLevel;
  onEventComplete: (eventId: string) => void;
};

/**
 * Layer 1 physical feedback: chip transfers (official KOUPPI stacks), seat FX, SHISTRI badge.
 */
export default function TablePhysicalFeedbackLayer({
  events,
  tableSurfaceRef,
  visualLevel,
  onEventComplete,
}: TablePhysicalFeedbackLayerProps) {
  const [transfers, setTransfers] = useState<ChipTransfer[]>([]);
  const [seatFx, setSeatFx] = useState<SeatFx[]>([]);
  const [badges, setBadges] = useState<ShistriBadge[]>([]);
  const handledPhysical = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const schedule = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      if (mounted.current) fn();
    }, ms);
    timers.current.push(t);
  };

  useEffect(() => {
    if (visualLevel === "off") {
      events.forEach((e) => onEventComplete(e.id));
      return;
    }

    const root = tableSurfaceRef.current;
    const reduced = visualLevel === "reduced";

    for (const event of events) {
      for (const intent of event.physical) {
        if (handledPhysical.current.has(intent.eventId)) continue;
        handledPhysical.current.add(intent.eventId);
        if (handledPhysical.current.size > 80) {
          handledPhysical.current.clear();
          handledPhysical.current.add(intent.eventId);
        }

        if (intent.kind === "chip_to_pot" || intent.kind === "chip_from_pot") {
          const transfer = chipTransferFromPhysicalIntent({
            kind: intent.kind,
            playerId: intent.playerId,
            amount: intent.amount,
            eventId: intent.eventId,
            resolutionKind: event.physical.some((p) => p.kind === "shistri_badge")
              ? "shistri"
              : undefined,
            win: intent.kind === "chip_from_pot",
          });
          if (transfer) {
            setTransfers((prev) => [
              ...prev.filter((t) => t.id !== transfer.id),
              transfer,
            ]);
          }
        }

        if (intent.kind === "seat_win_highlight" || intent.kind === "seat_loss_dim") {
          const duration = reduced ? Math.min(intent.durationMs, 400) : intent.durationMs;
          const mode = intent.kind === "seat_win_highlight" ? "win" : "loss";
          const key = intent.eventId;
          const until = Date.now() + duration;
          setSeatFx((prev) => [
            ...prev.filter((s) => s.playerId !== intent.playerId),
            { key, playerId: intent.playerId, mode, until },
          ]);
          const seatEl = querySeat(root, intent.playerId);
          if (seatEl instanceof HTMLElement) {
            seatEl.classList.add(
              mode === "win" ? "seat-fx-win" : "seat-fx-loss"
            );
            schedule(() => {
              seatEl.classList.remove("seat-fx-win", "seat-fx-loss");
              setSeatFx((prev) => prev.filter((s) => s.key !== key));
            }, duration);
          }
        }

        if (intent.kind === "shistri_badge") {
          const seatEl = querySeat(root, intent.playerId);
          const potEl = queryPot(root);
          const pos = seatEl
            ? rectCenter(seatEl)
            : potEl
              ? rectCenter(potEl)
              : { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
          const key = intent.eventId;
          const duration = reduced ? 800 : intent.durationMs;
          setBadges((prev) => [
            ...prev.filter((b) => b.key !== key),
            { key, playerId: intent.playerId, amount: intent.amount, until: Date.now() + duration, pos },
          ]);
          schedule(() => {
            setBadges((prev) => prev.filter((b) => b.key !== key));
          }, duration);
        }
      }

      const maxDur = Math.max(
        600,
        ...event.physical.map((p) =>
          "durationMs" in p && typeof p.durationMs === "number" ? p.durationMs : 550
        )
      );
      schedule(() => onEventComplete(event.id), reduced ? 200 : maxDur);
    }
  }, [events, visualLevel, tableSurfaceRef, onEventComplete]);

  const onTransferComplete = useMemo(
    () => (id: string) => {
      setTransfers((prev) => prev.filter((t) => t.id !== id));
    },
    []
  );

  if (visualLevel === "off") return null;

  return (
    <>
      <ChipTransferLayer
        transfers={transfers}
        tableSurfaceRef={tableSurfaceRef}
        visualLevel={visualLevel}
        onTransferComplete={onTransferComplete}
      />
      <div className="table-physical-feedback pointer-events-none fixed inset-0 z-[18]" aria-hidden="true">
        {badges.map((b) => (
          <div
            key={b.key}
            className="table-shistri-badge absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: b.pos.x, top: b.pos.y - 36 }}
          >
            <span className="table-shistri-badge-label">SHISTRI</span>
            {typeof b.amount === "number" ? (
              <span className="table-shistri-badge-amt">{b.amount}</span>
            ) : null}
          </div>
        ))}
        {seatFx.length === 0 ? null : null}
      </div>
    </>
  );
}
