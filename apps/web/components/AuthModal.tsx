"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { HudButton } from "@/components/game/HudButton";
import { LobbyInput, LobbyField, LobbyAlert } from "@/components/game/LobbyUI";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    clearError();

    if (mode === "register") {
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setLocalError("Password must be at least 6 characters");
        return;
      }
      if (username.length < 3) {
        setLocalError("Username must be at least 3 characters");
        return;
      }

      const success = await register(username, password);
      if (success) onClose();
    } else {
      const success = await login(username, password);
      if (success) onClose();
    }
  };

  const displayError = localError || error;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm grid place-items-center z-50 p-4">
      <div className="game-modal-panel w-full max-w-md relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="game-modal-header !mb-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-gold-light tracking-wide">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-gray-400 text-sm font-ui mt-1">
            {mode === "login"
              ? "Sign in to continue your career"
              : "Start your competitive journey"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError && (
            <LobbyAlert variant="error" onDismiss={() => { setLocalError(""); clearError(); }}>
              {displayError}
            </LobbyAlert>
          )}

          <LobbyField label="Username">
            <LobbyInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </LobbyField>

          <LobbyField label="Password">
            <LobbyInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </LobbyField>

          {mode === "register" && (
            <LobbyField label="Confirm password">
              <LobbyInput
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                required
              />
            </LobbyField>
          )}

          <HudButton type="submit" variant="kouppi" size="lg" fullWidth disabled={isLoading}>
            {isLoading
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </HudButton>
        </form>

        <p className="text-gray-500 text-sm text-center mt-5 font-ui">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setLocalError("");
              clearError();
            }}
            className="text-gold hover:text-gold-light font-medium"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
