"use client";

import React, { useEffect, useId, useRef } from "react";
import { PreGameCard } from "./LobbyUI";
import { HudButton } from "./HudButton";

export interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "success" | "bet" | "primary" | "kouppi" | "shistri" | "ghost";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-confirm-cancel]")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm grid place-items-center z-[60] p-4 safe-area-padding"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <PreGameCard title={title} subtitle={message}>
        <span id={titleId} className="sr-only">{title}</span>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-5">
          <HudButton data-confirm-cancel variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </HudButton>
          <HudButton variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </HudButton>
        </div>
      </PreGameCard>
    </div>
  );
}
