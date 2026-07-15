"use client";

import { useState, useRef, useEffect } from "react";
import { useRemoteGameStore, ChatMessage } from "@/store/remoteGameStore";
import { HudButton, HudIconButton } from "@/components/game/HudButton";

export default function Chat({ collapsed = false }: { collapsed?: boolean }) {
  const {
    chatMessages,
    sendChatMessage,
    fetchChatHistory,
    playerId,
    roomId,
    lastError,
    clearError,
    chatMutedAll,
    chatMutedPlayerIds,
    isHost,
  } = useRemoteGameStore();
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [lastReadCount, setLastReadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (roomId) {
      fetchChatHistory();
    }
  }, [roomId, fetchChatHistory]);

  useEffect(() => {
    if (isOpen) {
      setLastReadCount(chatMessages.length);
      if (messagesEndRef.current?.scrollIntoView) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [chatMessages, isOpen]);

  const handleSend = () => {
    if (message.trim()) {
      sendChatMessage(message);
      setMessage("");
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const chatBlocked =
    chatMutedAll && !isHost
      ? true
      : !!playerId && (chatMutedPlayerIds || []).includes(playerId);

  if (!isOpen) {
    const unreadCount = Math.max(0, chatMessages.length - lastReadCount);
    return (
      <button
        type="button"
        onClick={() => {
          setLastReadCount(chatMessages.length);
          setIsOpen(true);
        }}
        className="chat-fab"
      >
        <span className="text-xl">💬</span>
        <span>Chat</span>
        {unreadCount > 0 && (
          <span className="hud-badge hud-badge-gold text-xs py-0.5">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel-header" onClick={() => setIsOpen(false)}>
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <span className="font-bold text-gold-light tracking-wide">Room Chat</span>
        </div>
        <HudIconButton
          className="!w-8 !h-8 text-gray-400 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          ✕
        </HudIconButton>
      </div>

      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 font-ui">
            <span className="text-3xl mb-2 opacity-40">♠</span>
            <span className="text-sm">No messages yet</span>
            <span className="text-xs">Be the first to say hi!</span>
          </div>
        ) : (
          chatMessages.map((msg: ChatMessage) => {
            const isSystem = msg.isSystem || msg.playerId === "system";
            const isOwn = !isSystem && msg.playerId === playerId;
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-1">
                  <span className="text-xs text-gray-400 font-ui italic px-2 py-1 rounded bg-black/20">
                    {msg.message}
                  </span>
                </div>
              );
            }
            return (
              <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-1 mb-0.5 font-ui">
                  <span className={`text-xs font-medium ${isOwn ? "text-gold" : "text-success"}`}>
                    {isOwn ? "You" : msg.playerName}
                  </span>
                  <span className="text-xs text-gray-500">{formatTime(msg.timestamp)}</span>
                </div>
                <div className={`chat-bubble ${isOwn ? "chat-bubble-own" : "chat-bubble-other"}`}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
        {chatMutedAll && (
          <p className="text-xs text-warning font-ui mb-2" role="status">
            The host has muted chat for this room.
          </p>
        )}
        {lastError && (
          <p className="text-xs text-warning font-ui mb-2" role="alert">
            {lastError}
            <button type="button" className="ml-2 underline" onClick={() => clearError()}>
              Dismiss
            </button>
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatBlocked ? "Chat is muted" : "Type a message…"}
            maxLength={500}
            className="lobby-input flex-1 !py-2 text-sm font-ui"
            disabled={chatBlocked}
          />
          <HudButton variant="bet" size="sm" onClick={handleSend} disabled={!message.trim() || chatBlocked}>
            Send
          </HudButton>
        </div>
      </div>
    </div>
  );
}
