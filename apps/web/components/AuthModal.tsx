"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";

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
  
  if (!isOpen) return null;
  
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
      if (success) {
        onClose();
      }
    } else {
      const success = await login(username, password);
      if (success) {
        onClose();
      }
    }
  };
  
  const displayError = localError || error;
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
          <h2 className="text-2xl font-bold text-white text-center">
            {mode === "login" ? "Welcome Back!" : "Create Account"}
          </h2>
          <p className="text-indigo-200 text-center mt-1">
            {mode === "login" 
              ? "Sign in to continue your career" 
              : "Start your competitive journey"}
          </p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {displayError && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-lg text-sm">
              {displayError}
            </div>
          )}
          
          <div>
            <label className="block text-gray-400 text-sm mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Enter password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>
          
          {mode === "register" && (
            <div>
              <label className="block text-gray-400 text-sm mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Confirm password"
                autoComplete="new-password"
                required
              />
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </span>
            ) : (
              mode === "login" ? "Sign In" : "Create Account"
            )}
          </button>
        </form>
        
        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-gray-500 text-sm">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setLocalError("");
                clearError();
              }}
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
