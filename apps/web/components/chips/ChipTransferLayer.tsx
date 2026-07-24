"use client";

import React, { useEffect, useRef, useState } from "react";
import ChipStack from "@/components/chips/ChipStack";
import { formatChipAmountExact } from "@/lib/chips/formatChipAmount";
import type { ChipTransfer } from "@/lib/chips/types";
import type { TableEffectsLevel } from "@/lib/tableEventFeedback/types";

type Point = { x: number; y: number };

type FlyState = {
  transfer: ChipTransfer;
  from: Point;
  to: Point;
};

function rectCenter(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function isUsablePoint(p: Point): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  if (p.x === 0 && p.y === 0) return false;
  if (typeof window === "undefined") return true;
  // Outside viewport with large margin → skip
  if (p.x < -80 || p.y < -80) return false;
  if (p.x > window.innerWidth + 80 || p.y > window.innerHeight + 80) return false;
  return true;
}

function querySeat(root: HTMLElement | null, playerId: string): Element | null {
  if (!root || !playerId) return null;
  const safe = playerId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return (
    root.querySelector(`[data-bankroll-anchor="${safe}"]`) ||
    root.querySelector(`[data-seat-id="${safe}"]`) ||
    document.querySelector(`[data-bankroll-anchor="${safe}"]`) ||
    document.querySelector(`[data-seat-id="${safe}"]`)
  );
}

function queryPot(root: HTMLElement | null): Element | null {
  if (!root) return null;
  return (
    root.querySelector(`[data-pot-anchor="true"]`) ||
    document.querySelector(`[data-pot-anchor="true"]`)
  );
}

function resolveAnchor(
  root: HTMLElement | null,
  anchor: ChipTransfer["from"]
): Element | null {
  if (anchor.type === "pot") return queryPot(root);
  return querySeat(root, anchor.playerId);
}

export type ChipTransferLayerProps = {
  transfers: ChipTransfer[];
  tableSurfaceRef: React.RefObject<HTMLElement | null>;
  visualLevel: TableEffectsLevel;
  onTransferComplete?: (transferId: string) => void;
};

/**
 * Travelling chip stacks for seat↔pot transfers.
 * Skips safely when anchors missing; respects reduced / off effects.
 */
export default function ChipTransferLayer({
  transfers,
  tableSurfaceRef,
  visualLevel,
  onTransferComplete,
}: ChipTransferLayerProps) {
  const [flies, setFlies] = useState<FlyState[]>([]);
  const handled = useRef(new Set<string>());
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
      transfers.forEach((t) => onTransferComplete?.(t.id));
      return;
    }

    const reduced = visualLevel === "reduced";
    const root = tableSurfaceRef.current;

    for (const transfer of transfers) {
      if (handled.current.has(transfer.id)) continue;
      handled.current.add(transfer.id);
      if (handled.current.size > 80) {
        handled.current.clear();
        handled.current.add(transfer.id);
      }

      if (reduced) {
        // Fade / instant — no travel path
        schedule(() => onTransferComplete?.(transfer.id), 120);
        continue;
      }

      const fromEl = resolveAnchor(root, transfer.from);
      const toEl = resolveAnchor(root, transfer.to);
      if (!fromEl || !toEl) {
        schedule(() => onTransferComplete?.(transfer.id), 0);
        continue;
      }

      const from = rectCenter(fromEl);
      const to = rectCenter(toEl);
      if (!isUsablePoint(from) || !isUsablePoint(to)) {
        schedule(() => onTransferComplete?.(transfer.id), 0);
        continue;
      }

      setFlies((prev) => [
        ...prev.filter((f) => f.transfer.id !== transfer.id),
        { transfer, from, to },
      ]);

      const dur = Math.min(Math.max(transfer.durationMs, 350), 750);
      schedule(() => {
        setFlies((prev) => prev.filter((f) => f.transfer.id !== transfer.id));
        onTransferComplete?.(transfer.id);
      }, dur + 40);
    }
  }, [transfers, visualLevel, tableSurfaceRef, onTransferComplete]);

  if (visualLevel === "off" || visualLevel === "reduced") return null;
  if (flies.length === 0) return null;

  return (
    <div
      className="chip-transfer-layer table-physical-feedback pointer-events-none fixed inset-0 z-[18]"
      aria-hidden="true"
      data-testid="chip-transfer-layer"
    >
      {flies.map(({ transfer, from, to }) => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dur = Math.min(Math.max(transfer.durationMs, 350), 750);
        return (
          <div
            key={transfer.id}
            className="table-chip-travel absolute flex flex-col items-center"
            style={
              {
                left: from.x,
                top: from.y,
                ["--chip-dx" as string]: `${dx}px`,
                ["--chip-dy" as string]: `${dy}px`,
                ["--chip-dur" as string]: `${dur}ms`,
              } as React.CSSProperties
            }
            data-transfer-id={transfer.id}
            data-transfer-kind={transfer.kind}
            data-transfer-amount={transfer.amount}
          >
            <ChipStack
              amount={transfer.amount}
              context="transfer"
              size="xs"
              dense
              ariaLabel={`Transfer ${formatChipAmountExact(transfer.amount)}`}
            />
            <span className="mt-0.5 rounded bg-black/55 px-1 py-0.5 font-ui text-[9px] tabular-nums text-white/90">
              {formatChipAmountExact(transfer.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
