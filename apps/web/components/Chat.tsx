"use client";

import { useState, useRef, useEffect } from "react";
import { useRemoteGameStore, ChatMessage } from "@/store/remoteGameStore";

export default function Chat({ collapsed = false }: { collapsed?: boolean }) {
  const { chatMessages, sendChatMessage, fetchChatHistory, playerId, roomId } = useRemoteGameStore();
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(!collapsed);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch chat history when joining a room
  useEffect(() => {
    if (roomId) {
      fetchChatHistory();
    }
  }, [roomId, fetchChatHistory]);

  // Auto-scroll to bottom when new messages arrive
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

  // Collapsed view - just a button to open
  if (!isOpen) {
    const unreadCount = chatMessages.length;
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold transition-all transform hover:scale-105"
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
        }}
      >
        <span className="text-xl">💬</span>
        <span className="text-white">Chat</span>
        {unreadCount > 0 && (
          <span 
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
        maxHeight: "400px",
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(79, 70, 229, 0.1) 100%)",
          borderBottom: "1px solid rgba(99, 102, 241, 0.2)",
        }}
        onClick={() => setIsOpen(false)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <span 
            className="font-bold"
            style={{
              background: "linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Room Chat
          </span>
        </div>
        <button 
          className="text-gray-400 hover:text-white transition-colors text-lg"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ minHeight: "200px", maxHeight: "280px" }}
      >
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <span className="text-3xl mb-2">🎴</span>
            <span className="text-sm">No messages yet</span>
            <span className="text-xs">Be the first to say hi!</span>
          </div>
        ) : (
          chatMessages.map((msg: ChatMessage) => {
            const isOwn = msg.playerId === playerId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className={`text-xs font-medium ${isOwn ? "text-indigo-400" : "text-green-400"}`}>
                    {isOwn ? "You" : msg.playerName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm break-words ${
                    isOwn 
                      ? "rounded-br-sm" 
                      : "rounded-bl-sm"
                  }`}
                  style={{
                    background: isOwn 
                      ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                      : "linear-gradient(135deg, rgba(55, 65, 81, 0.8) 0%, rgba(31, 41, 55, 0.8) 100%)",
                    color: isOwn ? "white" : "#e5e7eb",
                  }}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div 
        className="p-3"
        style={{
          background: "linear-gradient(135deg, rgba(55, 65, 81, 0.3) 0%, rgba(31, 41, 55, 0.3) 100%)",
          borderTop: "1px solid rgba(75, 85, 99, 0.3)",
        }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 bg-gray-800/50 border border-gray-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="p-2 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            style={{
              background: message.trim() 
                ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                : "rgba(99, 102, 241, 0.3)",
            }}
          >
            <span className="text-lg">📤</span>
          </button>
        </div>
      </div>
    </div>
  );
}
