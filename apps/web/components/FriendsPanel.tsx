"use client";

import React, { useEffect, useState } from "react";
import { useFriendsStore, presenceLabel } from "@/store/friendsStore";
import { useAuthStore } from "@/store/authStore";
import { useRemoteGameStore } from "@/store/remoteGameStore";
import { useToast } from "@/components/game/Toast";
import { useRouter } from "next/navigation";
import { LobbyCard, LobbyInput, LobbyField } from "@/components/game/LobbyUI";
import { HudButton } from "@/components/game/HudButton";

export default function FriendsPanel() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isLoggedIn } = useAuthStore();
  const { roomId, roomCode, connected: gameConnected } = useRemoteGameStore();
  const {
    connected,
    friends,
    presence,
    incomingRequests,
    outgoingRequests,
    pendingInvite,
    searchResults,
    error,
    loading,
    connect,
    disconnect,
    refreshFriends,
    refreshRequests,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    inviteFriend,
    clearPendingInvite,
    clearError,
  } = useFriendsStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"friends" | "add" | "requests">("friends");

  useEffect(() => {
    if (!isLoggedIn()) {
      disconnect();
      return;
    }
    connect();
    refreshFriends();
    refreshRequests();
    return () => disconnect();
  }, [isLoggedIn, connect, disconnect, refreshFriends, refreshRequests]);

  useEffect(() => {
    if (!pendingInvite) return;
    showToast(`${pendingInvite.fromUsername} invited you to play!`, "info");
  }, [pendingInvite, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tab === "add") searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, tab, searchUsers]);

  if (!isLoggedIn()) return null;

  const activeRoomCode = roomCode || undefined;
  const activeRoomId = roomId || undefined;

  return (
    <>
      {pendingInvite && (
        <LobbyCard title="Game Invite" icon="🎮">
          <p className="text-sm text-gray-400 font-ui mb-3">
            <strong className="text-gold-light">{pendingInvite.fromUsername}</strong> invited you to join room{" "}
            <strong className="text-gold-light">{pendingInvite.roomCode}</strong>
          </p>
          <div className="flex gap-2">
            <HudButton
              variant="success"
              onClick={() => {
                clearPendingInvite();
                router.push(`/join?code=${encodeURIComponent(pendingInvite.roomCode)}`);
              }}
            >
              Join Game
            </HudButton>
            <HudButton variant="ghost" onClick={clearPendingInvite}>
              Dismiss
            </HudButton>
          </div>
        </LobbyCard>
      )}

      <LobbyCard title="Friends" icon="👥">
        <div className="flex gap-2 mb-4 flex-wrap">
          {(["friends", "add", "requests"] as const).map((t) => (
            <HudButton
              key={t}
              variant={tab === t ? "primary" : "ghost"}
              size="sm"
              onClick={() => setTab(t)}
            >
              {t === "friends" ? "Friends" : t === "add" ? "Add" : "Requests"}
              {t === "requests" && incomingRequests.length > 0 && (
                <span className="ml-1 text-xs bg-gold text-black rounded-full px-1.5">
                  {incomingRequests.length}
                </span>
              )}
            </HudButton>
          ))}
          {!connected && (
            <span className="text-xs text-gray-500 font-ui self-center">Connecting…</span>
          )}
        </div>

        {error && (
          <p className="text-sm text-error mb-3 font-ui">
            {error}{" "}
            <button type="button" className="underline" onClick={clearError}>
              dismiss
            </button>
          </p>
        )}

        {tab === "friends" && (
          <div className="space-y-2">
            {friends.length === 0 ? (
              <p className="text-sm text-gray-500 font-ui">No friends yet — add someone by username.</p>
            ) : (
              friends.map((friend) => {
                const p = presence[friend.id];
                const online = p && p.status !== "offline";
                return (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-black/30 border border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="text-xl shrink-0 w-9 h-9 flex items-center justify-center rounded-full"
                        style={{ backgroundColor: friend.avatarColor, border: `2px solid ${friend.avatarBorder}` }}
                      >
                        {friend.avatarEmoji}
                      </span>
                      <div className="min-w-0">
                        <p className="font-ui text-sm text-white truncate">{friend.username}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              online ? "bg-success" : "bg-gray-600"
                            }`}
                          />
                          {p ? presenceLabel(p.status) : "Offline"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {activeRoomCode && activeRoomId && gameConnected && (
                        <HudButton
                          variant="success"
                          size="sm"
                          onClick={async () => {
                            const result = await inviteFriend(friend.id, activeRoomCode, activeRoomId);
                            if (result.ok) showToast(`Invite sent to ${friend.username}`, "success");
                            else showToast(result.error || "Could not invite", "error");
                          }}
                        >
                          Invite
                        </HudButton>
                      )}
                      <HudButton
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (!confirm(`Remove ${friend.username} from friends?`)) return;
                          await removeFriend(friend.id);
                        }}
                      >
                        Remove
                      </HudButton>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "add" && (
          <div className="space-y-3">
            <LobbyField label="Search by username">
              <LobbyInput
                placeholder="Type username…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </LobbyField>
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-black/30 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xl w-9 h-9 flex items-center justify-center rounded-full"
                    style={{ backgroundColor: user.avatarColor, border: `2px solid ${user.avatarBorder}` }}
                  >
                    {user.avatarEmoji}
                  </span>
                  <span className="font-ui text-sm">{user.username}</span>
                </div>
                <HudButton
                  variant="success"
                  size="sm"
                  disabled={loading}
                  onClick={async () => {
                    const result = await sendRequest(user.username);
                    if (result.ok) showToast(`Request sent to ${user.username}`, "success");
                    else showToast(result.error || "Could not send request", "error");
                  }}
                >
                  Add
                </HudButton>
              </div>
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div className="space-y-4">
            {incomingRequests.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-ui uppercase tracking-wide mb-2">Incoming</p>
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-black/30 border border-white/10 mb-2"
                  >
                    <span className="font-ui text-sm">{req.fromUsername}</span>
                    <div className="flex gap-2">
                      <HudButton
                        variant="success"
                        size="sm"
                        onClick={async () => {
                          const result = await acceptRequest(req.id);
                          if (result.ok) showToast(`You are now friends with ${req.fromUsername}`, "success");
                        }}
                      >
                        Accept
                      </HudButton>
                      <HudButton variant="ghost" size="sm" onClick={() => declineRequest(req.id)}>
                        Decline
                      </HudButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {outgoingRequests.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-ui uppercase tracking-wide mb-2">Outgoing</p>
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-black/30 border border-white/10 mb-2"
                  >
                    <span className="font-ui text-sm">{req.toUsername}</span>
                    <HudButton variant="ghost" size="sm" onClick={() => cancelRequest(req.id)}>
                      Cancel
                    </HudButton>
                  </div>
                ))}
              </div>
            )}
            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <p className="text-sm text-gray-500 font-ui">No pending requests.</p>
            )}
          </div>
        )}
      </LobbyCard>
    </>
  );
}
