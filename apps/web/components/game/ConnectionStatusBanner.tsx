"use client";

import { useRemoteGameStore } from "@/store/remoteGameStore";

export default function ConnectionStatusBanner() {
  const { connectionStatus, connected } = useRemoteGameStore();

  if (connectionStatus === "connected" && connected) return null;

  const message =
    connectionStatus === "reconnecting"
      ? "Reconnecting to server…"
      : connectionStatus === "connecting"
        ? "Connecting…"
        : "Disconnected — check your network";

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] bg-warning-muted border-b border-warning/40 text-warning text-center py-2 px-4 font-ui text-sm animate-pulse"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
