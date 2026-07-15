"use client";

import { ToastProvider } from "@/components/game/Toast";
import ConductGate from "@/components/game/ConductGate";
import PwaInstallPrompt from "@/components/game/PwaInstallPrompt";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConductGate>
        {children}
        <PwaInstallPrompt />
      </ConductGate>
    </ToastProvider>
  );
}
