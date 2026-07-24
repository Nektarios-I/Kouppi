"use client";

import { ToastProvider } from "@/components/game/Toast";
import ConductGate from "@/components/game/ConductGate";
import PwaInstallPrompt from "@/components/game/PwaInstallPrompt";
import { CosmeticsApplicator } from "@/components/rewards/CosmeticsApplicator";
import { RewardsHydrator } from "@/components/rewards/RewardsHydrator";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConductGate>
        <RewardsHydrator />
        <CosmeticsApplicator />
        {children}
        <PwaInstallPrompt />
      </ConductGate>
    </ToastProvider>
  );
}
