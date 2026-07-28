"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type InfoTooltipProps = {
  label: string;
  children: ReactNode;
};

const TOOLTIP_GAP = 8;
const TOOLTIP_MAX_WIDTH = 280;

export default function InfoTooltip({ label, children }: InfoTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || typeof window === "undefined") return;

    const trigger = triggerRef.current;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - TOOLTIP_GAP * 2);

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(TOOLTIP_GAP, Math.min(left, window.innerWidth - width - TOOLTIP_GAP));

    let top = rect.bottom + TOOLTIP_GAP;
    const estimatedHeight = 120;
    if (top + estimatedHeight > window.innerHeight - TOOLTIP_GAP) {
      top = Math.max(TOOLTIP_GAP, rect.top - estimatedHeight - TOOLTIP_GAP);
    }

    setTooltipStyle({
      position: "fixed",
      top,
      left,
      width,
      maxWidth: width,
      zIndex: 80,
    });
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/30 text-[11px] font-bold text-gold-light transition-colors hover:border-gold/50 hover:bg-gold/10 focus:outline-none focus:ring-2 focus:ring-gold/40"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>

      {open && portalReady
        ? createPortal(
            <div
              ref={panelRef}
              id={tooltipId}
              role="tooltip"
              style={tooltipStyle}
              className="rounded-xl border border-white/10 bg-black/95 px-3 py-2 text-left text-xs leading-5 text-gray-200 shadow-2xl backdrop-blur-sm"
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
