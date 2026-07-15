"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRemoteGameStore, getPersistedActiveRoom } from "@/store/remoteGameStore";
import ConnectionStatusBanner from "@/components/game/ConnectionStatusBanner";
import CreateRoomDialog from "../../components/CreateRoomDialog";
import { useToast } from "@/components/game/Toast";
import { useAuthStore } from "@/store/authStore";
import { HudButton } from "@/components/game/HudButton";
import {
  LobbyShell,
  LobbyHeader,
  LobbyCard,
  LobbyInput,
  LobbyField,
  RoomRow,
  LobbyEmpty,
  LobbyAlert,
  LobbyFooterLink,
  PreGameCard,
} from "@/components/game/LobbyUI";
import FriendsPanel from "@/components/FriendsPanel";

type RoomFilter = "all" | "waiting" | "live" | "seats";
type RoomSort = "players" | "newest";

export default function LobbyPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, isLoggedIn } = useAuthStore();
  const {
    connect,
    connected,
    rooms,
    listRooms,
    playerId,
    playerName,
    setIdentity,
    joinRoom,
    joinAsSpectator,
    lastError,
    clearError,
    resumeActiveRoom,
    roomId: activeRoomId,
  } = useRemoteGameStore();

  const [joinRoomId, setJoinRoomId] = useState("");
  const [persistedRoom, setPersistedRoom] = useState<{ code: string; roomId: string } | null>(null);
  const [resuming, setResuming] = useState(false);
  const [spectateSearch, setSpectateSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [localName, setLocalName] = useState("");
  const [joining, setJoining] = useState(false);
  const [spectating, setSpectating] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordModalRoomId, setPasswordModalRoomId] = useState("");
  const [passwordModalMode, setPasswordModalMode] = useState<"join" | "spectate">("join");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState<RoomFilter>("all");
  const [roomSort, setRoomSort] = useState<RoomSort>("players");
  const [casualStats, setCasualStats] = useState<{ gamesPlayed: number; mvpCount: number } | null>(null);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!isLoggedIn() || !user) {
      setCasualStats(null);
      return;
    }
    const token = useAuthStore.getState().token;
    if (!token) return;
    const apiBase = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";
    fetch(`${apiBase}/api/casual/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data.stats) {
          setCasualStats({ gamesPlayed: data.stats.gamesPlayed, mvpCount: data.stats.mvpCount });
        }
      })
      .catch(() => setCasualStats(null));
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (!connected) return;
    listRooms();
    const interval = setInterval(listRooms, 3000);
    return () => clearInterval(interval);
  }, [connected, listRooms]);

  useEffect(() => {
    if (isLoggedIn() && user) {
      setIdentity(user.id, user.username);
      setLocalName(user.username);
      return;
    }
    const savedId = sessionStorage.getItem("kouppi_player_id");
    const savedName = sessionStorage.getItem("kouppi_player_name");
    if (savedId && savedName) {
      setIdentity(savedId, savedName);
      setLocalName(savedName);
    }
  }, [setIdentity, isLoggedIn, user]);

  const handleSetName = () => {
    if (!localName.trim()) return;
    const id = playerId || `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setIdentity(id, localName.trim());
    sessionStorage.setItem("kouppi_player_id", id);
    sessionStorage.setItem("kouppi_player_name", localName.trim());
  };

  useEffect(() => {
    setPersistedRoom(getPersistedActiveRoom());
  }, [activeRoomId]);

  const handleJoinRoom = async (roomIdOrCode: string, password?: string) => {
    if (!playerId || !playerName) {
      showToast("Please set your name first", "warning");
      return;
    }

    const normalized = roomIdOrCode.trim();
    const targetRoom =
      rooms.find((r) => r.id === normalized || r.code === normalized.toUpperCase()) ||
      rooms.find((r) => r.code.toUpperCase() === normalized.toUpperCase());
    if (targetRoom?.isPrivate && !password) {
      setPasswordModalMode("join");
      setPasswordModalRoomId(normalized);
      setPasswordInput("");
      setPasswordError(null);
      setPasswordModalOpen(true);
      return;
    }

    setJoining(true);
    clearError();
    const joinTarget = targetRoom?.code || normalized;
    const result = await joinRoom(joinTarget, password);
    setJoining(false);

    if (result.success) {
      setPasswordModalOpen(false);
      router.push(`/room/${encodeURIComponent(joinTarget)}`);
    } else {
      if (
        (result as { code?: string }).code === "wrong_password" ||
        result.error?.toLowerCase().includes("password")
      ) {
        if (passwordModalOpen) {
          setPasswordError("Incorrect password");
        } else {
          setPasswordModalRoomId(roomIdOrCode);
          setPasswordInput("");
          setPasswordError("This room requires a password");
          setPasswordModalOpen(true);
        }
      } else {
        showToast(`Failed to join: ${result.error}`, "error");
      }
    }
  };

  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) {
      setPasswordError("Please enter a password");
      return;
    }
    if (passwordModalMode === "spectate") {
      handleSpectateRoom(passwordModalRoomId, passwordInput.trim());
    } else {
      handleJoinRoom(passwordModalRoomId, passwordInput.trim());
    }
  };

  const handleCreateRoom = () => {
    if (!playerId || !playerName) {
      showToast("Please set your name first", "warning");
      return;
    }
    setShowCreateDialog(true);
  };

  const handleSpectateRoom = async (roomId: string, password?: string) => {
    if (!playerId || !playerName) {
      showToast("Please set your name first", "warning");
      return;
    }

    const targetRoom = rooms.find((r) => r.id === roomId);
    if (targetRoom?.isPrivate && !password) {
      setPasswordModalMode("spectate");
      setPasswordModalRoomId(roomId);
      setPasswordInput("");
      setPasswordError(null);
      setPasswordModalOpen(true);
      return;
    }

    setSpectating(true);
    clearError();
    const result = await joinAsSpectator(roomId, password);
    setSpectating(false);
    if (result.success) {
      setPasswordModalOpen(false);
      router.push(`/room/${encodeURIComponent(roomId)}`);
    } else {
      if (
        result.code === "wrong_password" ||
        result.error?.toLowerCase().includes("password")
      ) {
        setPasswordModalMode("spectate");
        setPasswordModalRoomId(roomId);
        setPasswordError("Incorrect password");
        setPasswordModalOpen(true);
      } else {
        showToast(`Failed to spectate: ${result.error}`, "error");
      }
    }
  };

  const waitingRooms = useMemo(() => {
    if (roomFilter === "live") return [];
    let list = rooms.filter((r) => !r.started);
    if (roomFilter === "seats") list = list.filter((r) => (r.seatsOpen ?? r.playerCount < r.maxPlayers));
    if (roomSort === "newest") {
      list = [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    } else {
      list = [...list].sort((a, b) => b.playerCount - a.playerCount);
    }
    return list;
  }, [rooms, roomFilter, roomSort]);

  const spectatorRooms = useMemo(() => {
    let list = rooms.filter((r) => r.started && r.spectatorsAllowed && r.playerCount > 0);
    if (roomFilter === "live") list = list;
    if (roomSort === "newest") {
      list = [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    } else {
      list = [...list].sort((a, b) => b.playerCount - a.playerCount);
    }
    return list;
  }, [rooms, roomFilter, roomSort]);

  const filteredSpectatorRooms = spectateSearch.trim()
    ? spectatorRooms.filter((r) =>
        r.id.toLowerCase().includes(spectateSearch.toLowerCase())
      )
    : spectatorRooms;

  return (
    <LobbyShell>
      <ConnectionStatusBanner />
      <LobbyHeader
        subtitle="The Ultimate Card Game Experience"
        connected={connected}
        onRefresh={() => listRooms()}
      />

      <LobbyCard title="Your Identity" icon="◎">
        {playerName ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="avatar-display w-14 h-14 text-2xl bg-felt-dark border-2 border-gold/40 text-gold-light font-display">
                {playerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-ui font-semibold text-white">{playerName}</div>
                <div className="text-sm text-gray-400">Ready to play</div>
              </div>
            </div>
            <HudButton
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem("kouppi_player_id");
                sessionStorage.removeItem("kouppi_player_name");
                sessionStorage.removeItem("kouppi_player_avatar");
                setIdentity("", "");
                setLocalName("");
              }}
            >
              Change Name
            </HudButton>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
            <LobbyField label="Display name">
              <LobbyInput
                placeholder="Enter your name to join…"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              />
            </LobbyField>
            </div>
            <HudButton variant="success" onClick={handleSetName} disabled={!localName.trim()}>
              Set Name
            </HudButton>
          </div>
        )}
      </LobbyCard>

      {isLoggedIn() && (
        <LobbyCard title="Friends Stats" icon="📊">
          <p className="text-sm text-gray-400 font-ui mb-3">
            {casualStats && casualStats.gamesPlayed > 0 ? (
              <>
                <strong className="text-gold-light">{casualStats.gamesPlayed}</strong> friends games played
                {casualStats.mvpCount > 0 && (
                  <>
                    {" "}
                    · <strong className="text-gold-light">{casualStats.mvpCount}</strong> MVP tables
                  </>
                )}
              </>
            ) : (
              <>Track your casual games with logged-in friends.</>
            )}
          </p>
          <Link href="/friends/stats" className="text-sm text-gold-light font-ui underline hover:text-gold">
            View full history →
          </Link>
        </LobbyCard>
      )}

      {isLoggedIn() && <FriendsPanel />}

      {persistedRoom && !activeRoomId && playerName && (
        <LobbyCard title="Resume Game" icon="↻">
          <p className="text-sm text-gray-400 font-ui mb-3">
            You were in room <strong className="text-gold-light">{persistedRoom.code}</strong>
          </p>
          <HudButton
            variant="success"
            disabled={resuming}
            onClick={async () => {
              setResuming(true);
              const result = await resumeActiveRoom();
              setResuming(false);
              if (result.success) {
                router.push(`/room/${encodeURIComponent(persistedRoom.code)}`);
              } else {
                showToast(result.error || "Could not rejoin room", "error");
                setPersistedRoom(null);
              }
            }}
          >
            {resuming ? "Rejoining…" : "Rejoin Room"}
          </HudButton>
        </LobbyCard>
      )}

      <LobbyCard title="Quick Actions" icon="♠">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          <HudButton
            variant="success"
            size="lg"
            onClick={handleCreateRoom}
            disabled={!playerName}
            className="lg:shrink-0"
          >
            Create Room
          </HudButton>
          <span className="text-gray-500 text-sm font-ui text-center hidden lg:block">or</span>
          <div className="flex flex-1 flex-col sm:flex-row gap-3 min-w-0">
            <LobbyInput
              placeholder="Enter room code to join…"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && joinRoomId.trim() && handleJoinRoom(joinRoomId)
              }
              className="flex-1"
            />
            <HudButton
              variant="bet"
              onClick={() => handleJoinRoom(joinRoomId)}
              disabled={!joinRoomId.trim() || !playerName || joining}
              className="sm:shrink-0"
            >
              {joining ? "Joining…" : "Join"}
            </HudButton>
          </div>
        </div>
      </LobbyCard>

      {lastError && (
        <LobbyAlert variant="error" onDismiss={clearError}>
          {lastError}
        </LobbyAlert>
      )}

      <LobbyCard
        title="Available Rooms"
        icon="♣"
        badge={
          <span className="hud-badge">
            {waitingRooms.length} room{waitingRooms.length !== 1 ? "s" : ""}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              ["all", "All waiting"],
              ["seats", "Seats open"],
            ] as const
          ).map(([id, label]) => (
            <HudButton
              key={id}
              variant={roomFilter === id ? "bet" : "ghost"}
              size="sm"
              onClick={() => setRoomFilter(id)}
            >
              {label}
            </HudButton>
          ))}
          <span className="w-px h-6 bg-white/10 hidden sm:block" />
          {(
            [
              ["players", "Most players"],
              ["newest", "Newest"],
            ] as const
          ).map(([id, label]) => (
            <HudButton
              key={id}
              variant={roomSort === id ? "bet" : "ghost"}
              size="sm"
              onClick={() => setRoomSort(id)}
            >
              {label}
            </HudButton>
          ))}
        </div>
        {waitingRooms.length === 0 ? (
          <LobbyEmpty icon="♠" title="No rooms available" hint="Create a room to start playing!" />
        ) : (
          <div className="space-y-2">
            {waitingRooms.map((room) => (
              <RoomRow
                key={room.id}
                room={{
                  id: room.id,
                  code: room.code,
                  playerCount: room.playerCount,
                  maxPlayers: room.maxPlayers,
                  isPrivate: room.isPrivate,
                  hostId: room.hostId,
                  presetLabel: room.presetLabel,
                }}
                actionLabel="Join"
                actionVariant="bet"
                loading={joining}
                disabled={!playerName}
                onAction={() => handleJoinRoom(room.code || room.id)}
              />
            ))}
          </div>
        )}
      </LobbyCard>

      <LobbyCard
        title="Watch Games"
        icon="👁"
        badge={
          <span className="hud-badge hud-badge-live">
            {spectatorRooms.length} live
          </span>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          <HudButton
            variant={roomFilter === "live" ? "bet" : "ghost"}
            size="sm"
            onClick={() => setRoomFilter(roomFilter === "live" ? "all" : "live")}
          >
            In progress only
          </HudButton>
        </div>
        <p className="text-gray-400 text-sm font-ui mb-4">
          Watch ongoing games as a spectator. Learn strategies and enjoy the action!
        </p>
        <LobbyInput
          placeholder="Search for a room to spectate…"
          value={spectateSearch}
          onChange={(e) => setSpectateSearch(e.target.value)}
          className="mb-4"
        />
        {filteredSpectatorRooms.length === 0 ? (
          <LobbyEmpty
            icon="◎"
            title={
              spectateSearch.trim() ? "No matching games found" : "No games available to spectate"
            }
            hint="Games with spectators enabled appear here when in progress"
          />
        ) : (
          <div className="space-y-2">
            {filteredSpectatorRooms.map((room) => (
              <RoomRow
                key={room.id}
                room={{
                  id: room.id,
                  code: room.code,
                  playerCount: room.playerCount,
                  maxPlayers: room.maxPlayers,
                  isPrivate: room.isPrivate,
                  spectatorCount: room.spectatorCount,
                  live: true,
                }}
                actionLabel={spectating ? "…" : "Watch"}
                actionVariant="kouppi"
                disabled={!playerName || spectating}
                onAction={() => handleSpectateRoom(room.id)}
              />
            ))}
          </div>
        )}
      </LobbyCard>

      <LobbyFooterLink href="/">← Back to Home</LobbyFooterLink>

      <CreateRoomDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} />

      {passwordModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm grid place-items-center z-50 p-4">
          <PreGameCard
            title="Private Room"
            subtitle={
              passwordModalMode === "spectate"
                ? `Enter the password to watch ${passwordModalRoomId}.`
                : `Room ${passwordModalRoomId} is password protected.`
            }
          >
            {passwordError && (
              <LobbyAlert variant="error">{passwordError}</LobbyAlert>
            )}
            <LobbyField label="Password">
              <LobbyInput
                type="password"
                placeholder="Room password…"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                autoFocus
              />
            </LobbyField>
            <div className="flex justify-end gap-3 mt-5">
              <HudButton
                variant="ghost"
                onClick={() => {
                  setPasswordModalOpen(false);
                  setPasswordInput("");
                  setPasswordError(null);
                }}
                disabled={joining}
              >
                Cancel
              </HudButton>
              <HudButton
                variant="bet"
                onClick={handlePasswordSubmit}
                disabled={joining || spectating || !passwordInput.trim()}
              >
                {passwordModalMode === "spectate"
                  ? spectating
                    ? "Joining…"
                    : "Watch"
                  : joining
                    ? "Joining…"
                    : "Join Room"}
              </HudButton>
            </div>
          </PreGameCard>
        </div>
      )}
    </LobbyShell>
  );
}
