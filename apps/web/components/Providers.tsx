"use client";

import { ToastProvider } from "@/components/game/Toast";
import ConductGate from "@/components/game/ConductGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConductGate>{children}</ConductGate>
    </ToastProvider>
  );
}
