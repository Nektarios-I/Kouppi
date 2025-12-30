/**
 * Career Lobby Store
 * 
 * Manages client-side state for career mode matchmaking:
 * - Tier data with eligibility
 * - Current room state
 * - Socket connection
 */

import { create } from "zustand";
import { io, Socket } from "socket.io-client";

// Get API URL dynamically at runtime (not module load time)
function getApiUrl() {
  return typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin.replace(':3000', ':4000'))
    : (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000');
}

export interface AnteOption {
  id: string;
  ante: number;
  minBet: number;
  maxBet: number;
  buyIn: number;
  label: string;
  canAfford: boolean;
}

export interface Tier {
  id: string;
  name: string;
  emoji: string;
  minRating: number;
  maxRating: number | null;
  description: string;
  color: string;
  antes: AnteOption[];
  accessible: boolean;
}

export interface RoomPlayer {
  odlayerId?: string;
  odlayerName?: string;
  odlating?: number;
  userId: string;
  username: string;
  rating: number;
  avatarEmoji: string;
  avatarColor: string;
  avatarBorder: string;
}

export interface CareerRoomState {
  roomId: string;
  tierId: string;
  anteId: string;
  ante: number;
  minBet: number;
  maxBet: number;
  players: RoomPlayer[];
  playerCount: number;
  maxPlayers: number;
  status: "waiting" | "starting" | "in-game" | "finished";
  autoStartAt: number | null;
  secondsRemaining: number | null;
}

interface CareerLobbyState {
  // Socket
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  
  // User data
  isAuthenticated: boolean;
  playerRating: number;
  playerBankroll: number;
  
  // Tiers
  tiers: Tier[];
  selectedTierId: string | null;
  isLoadingTiers: boolean;
  
  // Room
  currentRoom: CareerRoomState | null;
  isJoiningRoom: boolean;
  
  // Game transition
  gameRoomId: string | null;
  
  // Errors
  error: string | null;
  
  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  fetchTiers: (token: string) => void;
  selectTier: (tierId: string) => void;
  joinAnte: (token: string, anteId: string) => Promise<boolean>;
  leaveRoom: (token: string) => void;
  clearError: () => void;
  reset: () => void;
}

export const useCareerLobbyStore = create<CareerLobbyState>((set, get) => ({
  // Initial state
  socket: null,
  isConnected: false,
  isConnecting: false,
  isAuthenticated: false,
  playerRating: 0,
  playerBankroll: 0,
  tiers: [],
  selectedTierId: null,
  isLoadingTiers: false,
  currentRoom: null,
  isJoiningRoom: false,
  gameRoomId: null,
  error: null,
  
  connect: (token: string) => {
    const { socket } = get();
    if (socket?.connected) return;
    
    set({ isConnecting: true, error: null });
    
    const newSocket = io(getApiUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    
    newSocket.on("connect", () => {
      console.log("[CareerLobby] Connected to server");
      set({ isConnected: true, isConnecting: false });
      
      // Authenticate
      newSocket.emit("career:auth", { token }, (err: any, data: any) => {
        if (err) {
          console.error("[CareerLobby] Auth failed:", err);
          set({ error: err.message, isAuthenticated: false });
          return;
        }
        
        console.log("[CareerLobby] Authenticated:", data);
        set({ 
          isAuthenticated: true,
          playerRating: data.rating,
          playerBankroll: data.bankroll,
        });
        
        // Auto-fetch tiers after auth
        get().fetchTiers(token);
      });
    });
    
    newSocket.on("disconnect", () => {
      console.log("[CareerLobby] Disconnected");
      set({ isConnected: false, isAuthenticated: false });
    });
    
    newSocket.on("connect_error", (err) => {
      console.error("[CareerLobby] Connection error:", err);
      set({ isConnecting: false, error: "Failed to connect to server" });
    });
    
    // Room updates
    newSocket.on("career:roomUpdate", (data: CareerRoomState) => {
      console.log("[CareerLobby] Room update:", data);
      set({ currentRoom: data });
    });
    
    // Auto-start timer
    newSocket.on("career:autoStartTimer", (data: { roomId: string; startsAt: number; secondsRemaining: number }) => {
      console.log("[CareerLobby] Auto-start timer:", data);
      const { currentRoom } = get();
      if (currentRoom?.roomId === data.roomId) {
        set({ 
          currentRoom: { 
            ...currentRoom, 
            autoStartAt: data.startsAt,
            secondsRemaining: data.secondsRemaining,
          } 
        });
      }
    });
    
    // Game starting
    newSocket.on("career:gameStarting", (data: any) => {
      console.log("[CareerLobby] Game starting:", data);
      set({ currentRoom: { ...get().currentRoom!, status: "starting" } });
    });
    
    // Transition to game
    newSocket.on("career:transitionToGame", (data: { careerRoomId: string; gameRoomId: string; config: any }) => {
      console.log("[CareerLobby] Transitioning to game:", data);
      set({ gameRoomId: data.gameRoomId });
    });
    
    // Game finished
    newSocket.on("career:gameFinished", (data: { roomId: string }) => {
      console.log("[CareerLobby] Game finished:", data);
      set({ currentRoom: null, gameRoomId: null });
    });
    
    // Errors
    newSocket.on("career:error", (err: { code: string; message: string }) => {
      console.error("[CareerLobby] Error:", err);
      set({ error: err.message });
    });
    
    set({ socket: newSocket });
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ 
        socket: null, 
        isConnected: false, 
        isAuthenticated: false,
        currentRoom: null,
        gameRoomId: null,
      });
    }
  },
  
  fetchTiers: (token: string) => {
    const { socket } = get();
    if (!socket?.connected) return;
    
    set({ isLoadingTiers: true, error: null });
    
    socket.emit("career:getTiers", { token }, (err: any, data: any) => {
      if (err) {
        console.error("[CareerLobby] Failed to fetch tiers:", err);
        set({ isLoadingTiers: false, error: err.message });
        return;
      }
      
      console.log("[CareerLobby] Tiers:", data);
      set({ 
        tiers: data.tiers,
        playerRating: data.playerRating,
        playerBankroll: data.playerBankroll,
        isLoadingTiers: false,
      });
    });
  },
  
  selectTier: (tierId: string) => {
    set({ selectedTierId: tierId, error: null });
  },
  
  joinAnte: async (token: string, anteId: string): Promise<boolean> => {
    const { socket } = get();
    if (!socket?.connected) {
      set({ error: "Not connected to server" });
      return false;
    }
    
    set({ isJoiningRoom: true, error: null });
    
    return new Promise((resolve) => {
      socket.emit("career:joinAnte", { token, anteId }, (err: any, data: any) => {
        if (err) {
          console.error("[CareerLobby] Failed to join ante:", err);
          set({ isJoiningRoom: false, error: err.message });
          resolve(false);
          return;
        }
        
        console.log("[CareerLobby] Joined room:", data);
        set({ 
          isJoiningRoom: false,
          currentRoom: data,
        });
        resolve(true);
      });
    });
  },
  
  leaveRoom: (token: string) => {
    const { socket, currentRoom } = get();
    if (!socket?.connected || !currentRoom) return;
    
    socket.emit("career:leaveRoom", { token }, (err: any, data: any) => {
      if (err) {
        console.error("[CareerLobby] Failed to leave room:", err);
        set({ error: err.message });
        return;
      }
      
      console.log("[CareerLobby] Left room");
      set({ currentRoom: null });
    });
  },
  
  clearError: () => {
    set({ error: null });
  },
  
  reset: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    set({
      socket: null,
      isConnected: false,
      isConnecting: false,
      isAuthenticated: false,
      playerRating: 0,
      playerBankroll: 0,
      tiers: [],
      selectedTierId: null,
      isLoadingTiers: false,
      currentRoom: null,
      isJoiningRoom: false,
      gameRoomId: null,
      error: null,
    });
  },
}));
