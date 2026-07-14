"use client";

import { useGameStore } from "@/store/gameStore";
import ThreeDTablePlaceholder from "@/components/game/ThreeDTablePlaceholder";
import Link from "next/link";

export default function ThreeDPreviewPage() {
  const state = useGameStore((s) => s.state);
  const ready = useGameStore((s) => s.ready);

  return (
    <div>
      <ThreeDTablePlaceholder
        state={ready ? state : null}
        title="3D KOUPPI Preview"
      />
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-4 font-ui text-sm">
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-black/50 border border-white/20 text-gray-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          ← Home
        </Link>
        <Link
          href="/play/single"
          className="px-4 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Play Single Player
        </Link>
      </div>
    </div>
  );
}
