"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useRemoteGameStore, type AvatarConfig } from "@/store/remoteGameStore";
import { useAuthStore } from "@/store/authStore";
import dynamic from "next/dynamic";
import Chat from "../../../components/Chat";
import SoundControl from "../../../components/SoundControl";
import EmotePanel from "../../../components/EmotePanel";
import { getDefaultAvatar, normalizeAvatarConfig } from "@/lib/avatars";
import { useToast } from "@/components/game/Toast";
import WaitingRoom from "@/components/game/WaitingRoom";
import RoomPasswordModal from "@/components/game/RoomPasswordModal";
import {
  LobbyShell,
  PreGameShell,
  PreGameCard,
  PreGameLoader,
  LobbyInput,
  LobbyAlert,
} from "@/components/game/LobbyUI";
import ConnectionStatusBanner from "@/components/game/ConnectionStatusBanner";
import { HudButton } from "@/components/game/HudButton";
import { getServerUrl } from "@/lib/serverUrl";

const MultiplayerTable = dynamic(
  () => import("../../../components/MultiplayerTableGraphics"),
  { ssr: false }
);

const RECOVERABLE_JOIN_CODES = new Set(["room_full", "game_in_progress"]);

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomIdParam = params.id as string;
  const decodedRoomId = decodeURIComponent(roomIdParam);

  const {
    connect,
    connected,
    roomId,
    hostId,
    isHost,
    isSpectator,
    playersInRoom,
    spectatorsInRoom,
    gameStarted,
    state,
    playerId,
    playerName,
    playerAvatar,
    setIdentity,
    setAvatar,
    joinRoom,
    subscribeToCareerRoom,
    joinAsSpectator,
    leaveSpectator,
    roomCode,
    setReady,
    kickPlayer,
    transferHost,
    closeRoomAsHost,
    startGame,
    leaveRoom,
    lastError,
    clearError,
    chatMessages,
    reportPlayer,
    banPlayer,
    setRoomChatMuted,
    mutePlayerChat,
    chatMutedAll,
    chatMutedPlayerIds,
  } = useRemoteGameStore();

  const [starting, setStarting] = useState(false);
  const [localName, setLocalName] = useState("");
  const [joinAttempted, setJoinAttempted] = useState(false);
  const [joinErrorCode, setJoinErrorCode] = useState<string | null>(null);
  const [showSpectatorOption, setShowSpectatorOption] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalMode, setPasswordModalMode] = useState<"player" | "spectator">("player");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const isCareerGame = roomIdParam?.startsWith("career-game-");
  const { user, isLoggedIn, token } = useAuthStore();
  const { showToast } = useToast();

  const lastSystemChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Array.isArray(chatMessages) || chatMessages.length === 0) return;
    const latest = [...chatMessages].reverse().find((m) => m.isSystem || m.playerId === "system");
    if (!latest || latest.id === lastSystemChatIdRef.current) return;
    lastSystemChatIdRef.current = latest.id;
    showToast(latest.message, "info");
  }, [chatMessages, showToast]);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    setJoinAttempted(false);
    setJoinErrorCode(null);
    setShowSpectatorOption(false);
    setShowPasswordModal(false);
    setPasswordInput("");
    setPasswordError(null);
  }, [roomIdParam]);

  useEffect(() => {
    if (isLoggedIn() && user) {
      setIdentity(user.id, user.username);
      setLocalName(user.username);
      const avatar: AvatarConfig = normalizeAvatarConfig(user.avatarId);
      setAvatar(avatar);
      return;
    }
    const savedId = sessionStorage.getItem("kouppi_player_id");
    const savedName = sessionStorage.getItem("kouppi_player_name");
    const savedAvatar = sessionStorage.getItem("kouppi_player_avatar");
    if (savedId && savedName) {
      setIdentity(savedId, savedName);
      setLocalName(savedName);
    }
    if (savedAvatar) {
      try {
        const avatar = normalizeAvatarConfig(JSON.parse(savedAvatar));
        setAvatar(avatar);
      } catch {
        // ignore invalid JSON
      }
    }
  }, [isLoggedIn, user, setIdentity, setAvatar]);

  const attemptJoin = useCallback(
    async (password?: string) => {
      setJoining(true);
      clearError();
      const result = await joinRoom(decodedRoomId, password);
      setJoining(false);
      setJoinAttempted(true);

      if (result.success) {
        setShowPasswordModal(false);
        setPasswordInput("");
        setPasswordError(null);
        setJoinErrorCode(null);
        setShowSpectatorOption(false);
        return;
      }

      const code = result.code || "join_failed";
      setJoinErrorCode(code);

      if (code === "wrong_password") {
        setPasswordModalMode("player");
        setShowPasswordModal(true);
        setPasswordError("Incorrect password");
        return;
      }

      if (RECOVERABLE_JOIN_CODES.has(code)) {
        setShowSpectatorOption(true);
        clearError();
        return;
      }

      if (code === "room_not_found") {
        router.push("/lobby");
      }
    },
    [joinRoom, decodedRoomId, clearError, router]
  );

  useEffect(() => {
    if (connected && playerId && playerName && !roomId && roomIdParam && !joinAttempted && !isCareerGame) {
      attemptJoin();
    }
  }, [connected, playerId, playerName, roomId, roomIdParam, joinAttempted, isCareerGame, attemptJoin]);

  useEffect(() => {
    if (connected && playerId && playerName && !roomId && roomIdParam && !joinAttempted && isCareerGame) {
      const trySubscribe = async () => {
        const result = await subscribeToCareerRoom(decodedRoomId);
        setJoinAttempted(true);
        if (!result.success) {
          setJoinErrorCode(result.error || "subscribe_failed");
          if (result.error?.includes("not found")) {
            router.push("/lobby");
          }
        }
      };
      trySubscribe();
    }
  }, [connected, playerId, playerName, roomId, roomIdParam, joinAttempted, isCareerGame, subscribeToCareerRoom, decodedRoomId, router]);

  useEffect(() => {
    if (connected && playerId && !roomId && lastError && joinErrorCode === "room_not_found") {
      router.push("/lobby");
    }
  }, [connected, playerId, roomId, lastError, joinErrorCode, router]);

  const handleSetName = () => {
    if (!localName.trim()) return;
    const id = playerId || `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setIdentity(id, localName.trim());
    sessionStorage.setItem("kouppi_player_id", id);
    sessionStorage.setItem("kouppi_player_name", localName.trim());

    if (!playerAvatar) {
      const newAvatar = getDefaultAvatar();
      setAvatar(newAvatar);
      sessionStorage.setItem("kouppi_player_avatar", JSON.stringify(newAvatar));
    }
  };

  const handleAvatarChange = (newAvatar: AvatarConfig) => {
    const normalized = normalizeAvatarConfig(newAvatar);
    setAvatar(normalized);
    sessionStorage.setItem("kouppi_player_avatar", JSON.stringify(normalized));
    if (isLoggedIn() && token) {
      void fetch(`${getServerUrl()}/api/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: { id: normalized.id } }),
      }).catch(() => undefined);
    }
  };

  const handleStartGame = async () => {
    setStarting(true);
    clearError();
    const result = await startGame();
    setStarting(false);
    if (!result.success) {
      showToast(`Failed to start: ${result.error}`, "error");
    }
  };

  const handleLeave = async () => {
    if (isSpectator) {
      leaveSpectator();
      router.push("/lobby");
      return;
    }
    const result = await leaveRoom();
    if (!result.success) {
      showToast(result.error || "Could not leave room", "error");
      return;
    }
    router.push("/lobby");
  };

  const handleJoinAsSpectator = async (password?: string) => {
    setJoining(true);
    clearError();
    const result = await joinAsSpectator(decodedRoomId, password);
    setJoining(false);

    if (result.success) {
      setShowPasswordModal(false);
      setShowSpectatorOption(false);
      setPasswordInput("");
      setPasswordError(null);
      return;
    }

    if (result.code === "wrong_password") {
      setPasswordModalMode("spectator");
      setShowPasswordModal(true);
      setPasswordError("Incorrect password");
      return;
    }

    showToast(`Failed to join as spectator: ${result.error}`, "error");
  };

  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) {
      setPasswordError("Please enter a password");
      return;
    }
    setPasswordError(null);
    if (passwordModalMode === "spectator") {
      handleJoinAsSpectator(passwordInput.trim());
    } else {
      attemptJoin(passwordInput.trim());
    }
  };

  const handleCopyLink = () => {
    const code = roomCode || decodedRoomId;
    const url = `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    showToast("Invite link copied", "success");
  };

  const handleSetReady = async (ready: boolean) => {
    const result = await setReady(ready);
    if (!result.success) {
      showToast(result.error || "Could not update ready state", "error");
    }
  };

  const handleKickPlayer = async (targetId: string) => {
    const result = await kickPlayer(targetId);
    if (!result.success) {
      const message =
        result.code === "cannot_kick_current_player"
          ? "Cannot kick the player whose turn it is"
          : result.error || "Could not kick player";
      showToast(message, "error");
    }
  };

  const handleTransferHost = async (targetId: string) => {
    const result = await transferHost(targetId);
    if (!result.success) {
      showToast(result.error || "Could not transfer host", "error");
    } else {
      showToast("Host transferred", "success");
    }
  };

  const handleCloseRoom = async () => {
    if (!window.confirm("Close this room for everyone?")) return;
    const result = await closeRoomAsHost();
    if (!result.success) {
      showToast(result.error || "Could not close room", "error");
      return;
    }
    router.push("/lobby");
  };

  const handleReportPlayer = async (targetId: string, reason: string) => {
    const result = await reportPlayer(targetId, reason);
    if (result.success) showToast("Report submitted — thank you", "success");
    else showToast(result.error || "Could not submit report", "error");
  };

  const handleBanPlayer = async (targetId: string) => {
    if (!window.confirm("Ban this player from rejoining this room?")) return;
    const result = await banPlayer(targetId);
    if (result.success) showToast("Player banned from room", "warning");
    else showToast(result.error || "Could not ban player", "error");
  };

  const handleMutePlayerChat = async (targetId: string, muted: boolean) => {
    const result = await mutePlayerChat(targetId, muted);
    if (!result.success) showToast(result.error || "Could not update chat mute", "error");
  };

  const handleToggleRoomChatMuted = async (muted: boolean) => {
    const result = await setRoomChatMuted(muted);
    if (result.success) showToast(muted ? "Chat muted for everyone" : "Chat unmuted", "info");
    else showToast(result.error || "Could not update chat mute", "error");
  };

  if (!playerName && !isCareerGame) {
    return (
      <PreGameShell>
        <PreGameCard
          title="Enter Your Name"
          subtitle={<>To join room: <strong className="text-gold-light">{decodedRoomId}</strong></>}
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <LobbyInput
              placeholder="Your name…"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              autoFocus
              className="flex-1"
            />
            <HudButton variant="success" onClick={handleSetName} disabled={!localName.trim()}>
              Join
            </HudButton>
          </div>
        </PreGameCard>
      </PreGameShell>
    );
  }

  if (isCareerGame && (!connected || !state)) {
    return (
      <PreGameShell>
        <PreGameLoader message="Connecting to career game…" />
        {lastError && (
          <p className="mt-4 text-center text-error text-sm font-ui">{lastError}</p>
        )}
      </PreGameShell>
    );
  }

  if (gameStarted && state) {
    return (
      <>
        <MultiplayerTable />
        <Chat />
        <SoundControl />
        {!isSpectator && <EmotePanel />}
        {isSpectator && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
            <span className="hud-badge hud-badge-live text-sm px-4 py-2">Spectating</span>
            <HudButton variant="ghost" size="sm" onClick={handleLeave}>
              Leave
            </HudButton>
          </div>
        )}
      </>
    );
  }

  if (showSpectatorOption && !roomId) {
    return (
      <PreGameShell>
        <PreGameCard
          title="Cannot Join as Player"
          subtitle="This room is full or the game is already in progress. Watch as a spectator?"
        >
          {lastError && !RECOVERABLE_JOIN_CODES.has(joinErrorCode || "") && (
            <LobbyAlert variant="error">{lastError}</LobbyAlert>
          )}
          <div className="flex flex-col gap-3">
            <HudButton variant="kouppi" size="lg" fullWidth onClick={() => handleJoinAsSpectator()} disabled={joining}>
              Watch as Spectator
            </HudButton>
            <HudButton variant="ghost" fullWidth onClick={() => router.push("/lobby")}>
              Back to Lobby
            </HudButton>
          </div>
        </PreGameCard>
        {showPasswordModal && (
          <RoomPasswordModal
            roomId={decodedRoomId}
            password={passwordInput}
            error={passwordError}
            loading={joining}
            onPasswordChange={(v) => {
              setPasswordInput(v);
              setPasswordError(null);
            }}
            onSubmit={handlePasswordSubmit}
            onCancel={() => {
              setShowPasswordModal(false);
              setPasswordInput("");
              setPasswordError(null);
            }}
            title="Private Room"
            subtitle={
              passwordModalMode === "spectator"
                ? "Enter the password to watch this private room."
                : undefined
            }
          />
        )}
      </PreGameShell>
    );
  }

  return (
    <LobbyShell>
      <ConnectionStatusBanner />
      <WaitingRoom
        roomCode={roomCode || decodedRoomId}
        hostId={hostId}
        connected={connected}
        isHost={isHost}
        players={playersInRoom}
        spectators={spectatorsInRoom}
        playerId={playerId}
        playerAvatar={playerAvatar}
        starting={starting}
        lastError={lastError}
        onAvatarChange={handleAvatarChange}
        onStartGame={handleStartGame}
        onLeave={handleLeave}
        onCopyLink={handleCopyLink}
        onSetReady={handleSetReady}
        onKickPlayer={handleKickPlayer}
        onTransferHost={handleTransferHost}
        onCloseRoom={handleCloseRoom}
        onClearError={clearError}
        onReportPlayer={handleReportPlayer}
        onBanPlayer={handleBanPlayer}
        onMutePlayerChat={handleMutePlayerChat}
        onToggleRoomChatMuted={handleToggleRoomChatMuted}
        chatMutedAll={chatMutedAll}
        chatMutedPlayerIds={chatMutedPlayerIds}
      />
      <Chat />

      {showPasswordModal && (
        <RoomPasswordModal
          roomId={decodedRoomId}
          password={passwordInput}
          error={passwordError}
          loading={joining}
          onPasswordChange={(v) => {
            setPasswordInput(v);
            setPasswordError(null);
          }}
          onSubmit={handlePasswordSubmit}
          onCancel={() => {
            setShowPasswordModal(false);
            setPasswordInput("");
            setPasswordError(null);
          }}
        />
      )}
    </LobbyShell>
  );
}
