"use client";

import { useState, useRef, useEffect } from "react";
import { useRemoteGameStore, ChatMessage } from "@/store/remoteGameStore";
import { HudButton, HudIconButton } from "@/components/game/HudButton";

export default function Chat({ collapsed = false }: { collapsed?: boolean }) {
  const { chatMessages, sendChatMessage, fetchChatHistory, playerId, roomId } = useRemoteGameStore();
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(!collapsed);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (roomId) {
      fetchChatHistory();
    }
  }, [roomId, fetchChatHistory]);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
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

  if (!isOpen) {
    const unreadCount = chatMessages.length;
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="chat-fab">
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
            const isOwn = msg.playerId === playerId;
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
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            maxLength={500}
            className="lobby-input flex-1 !py-2 text-sm font-ui"
          />
          <HudButton variant="bet" size="sm" onClick={handleSend} disabled={!message.trim()}>
            Send
          </HudButton>
        </div>
      </div>
    </div>
  );
}
