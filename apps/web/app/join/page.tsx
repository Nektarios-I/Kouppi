"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import { PreGameShell, PreGameCard } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";
import ConnectionStatusBanner from "@/components/game/ConnectionStatusBanner";

function JoinContent() {
  const router = useRouter();
  const params = useSearchParams();
  const code = (params.get("code") || "").trim().toUpperCase();

  const { connect, connected, playerId, playerName, joinRoom, lastError, clearError } =
    useRemoteGameStore();
  const [joining, setJoining] = useState(false);
  const [localName, setLocalName] = useState("");

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    const saved = sessionStorage.getItem("kouppi_player_name");
    if (saved) setLocalName(saved);
  }, []);

  const handleJoin = async () => {
    if (!code) return;
    if (!localName.trim()) return;

    const id =
      playerId || `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    useRemoteGameStore.getState().setIdentity(id, localName.trim());
    sessionStorage.setItem("kouppi_player_id", id);
    sessionStorage.setItem("kouppi_player_name", localName.trim());

    setJoining(true);
    clearError();
    const result = await joinRoom(code);
    setJoining(false);

    if (result.success) {
      router.push(`/room/${encodeURIComponent(code)}`);
    }
  };

  if (!code) {
    return (
      <PreGameShell>
        <PreGameCard title="Invalid invite" subtitle="This link is missing a room code.">
          <HudButton variant="ghost" fullWidth onClick={() => router.push("/lobby")}>
            Go to Lobby
          </HudButton>
        </PreGameCard>
      </PreGameShell>
    );
  }

  return (
    <PreGameShell>
      <ConnectionStatusBanner />
      <PreGameCard
        title={`Join ${code}`}
        subtitle={connected ? "Enter your name to join the table" : "Connecting to server…"}
      >
        <input
          className="lobby-input w-full mb-4 font-ui"
          placeholder="Your name"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          maxLength={24}
        />
        {lastError && (
          <p className="text-error text-sm font-ui mb-3" role="alert">
            {lastError}
          </p>
        )}
        <HudButton
          variant="success"
          fullWidth
          disabled={!connected || !localName.trim() || joining}
          onClick={handleJoin}
        >
          {joining ? "Joining…" : "Join Room"}
        </HudButton>
        <HudButton variant="ghost" fullWidth className="mt-2" onClick={() => router.push("/lobby")}>
          Back to Lobby
        </HudButton>
      </PreGameCard>
    </PreGameShell>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<PreGameShell>Loading…</PreGameShell>}>
      <JoinContent />
    </Suspense>
  );
}
