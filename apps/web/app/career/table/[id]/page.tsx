"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import CareerLobby from "@/components/CareerLobby";
import { LobbyShell } from "@/components/game/LobbyUI";

export default function CareerWaitingTablePage() {
  const params = useParams<{ id: string }>();
  const roomId = decodeURIComponent(params.id);

  return (
    <LobbyShell>
      <header className="career-page-header -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/career"
            className="font-display text-xl font-bold text-gold-light tracking-widest no-underline"
          >
            KOUPPI
          </Link>
          <span className="hud-badge">Career Table</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl">
        <CareerLobby expectedRoomId={roomId} />
      </main>
    </LobbyShell>
  );
}
