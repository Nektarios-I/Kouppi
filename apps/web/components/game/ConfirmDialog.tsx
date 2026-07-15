"use client";

import React from "react";
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
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm grid place-items-center z-[60] p-4 safe-area-padding">
      <PreGameCard title={title} subtitle={message}>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-5">
          <HudButton variant="ghost" onClick={onCancel}>
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
