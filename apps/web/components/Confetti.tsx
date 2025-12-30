"use client";

import { useEffect, useState, useCallback } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  size: number;
  animationDuration: number;
  delay: number;
  shape: "square" | "circle" | "star";
}

const CONFETTI_COLORS = [
  "#FFD700", // Gold
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#96CEB4", // Green
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
  "#98D8C8", // Mint
  "#FF69B4", // Pink
  "#00CED1", // Cyan
];

interface ConfettiProps {
  active: boolean;
  duration?: number; // How long confetti lasts in ms
  pieceCount?: number;
  onComplete?: () => void;
}

export default function Confetti({
  active,
  duration = 3000,
  pieceCount = 100,
  onComplete,
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const generateConfetti = useCallback(() => {
    const newPieces: ConfettiPiece[] = [];
    for (let i = 0; i < pieceCount; i++) {
      newPieces.push({
        id: i,
        x: Math.random() * 100, // percentage across screen
        y: -10 - Math.random() * 20, // start above viewport
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        size: 8 + Math.random() * 12,
        animationDuration: 2 + Math.random() * 2,
        delay: Math.random() * 0.5,
        shape: ["square", "circle", "star"][Math.floor(Math.random() * 3)] as any,
      });
    }
    return newPieces;
  }, [pieceCount]);

  useEffect(() => {
    if (active) {
      setPieces(generateConfetti());
      setIsVisible(true);

      // Clean up after duration
      const timer = setTimeout(() => {
        setIsVisible(false);
        setPieces([]);
        if (onComplete) onComplete();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [active, duration, generateConfetti, onComplete]);

  if (!isVisible || pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((piece) => (
        <ConfettiPieceComponent key={piece.id} piece={piece} />
      ))}
    </div>
  );
}

function ConfettiPieceComponent({ piece }: { piece: ConfettiPiece }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${piece.x}%`,
    top: `${piece.y}%`,
    width: piece.size,
    height: piece.size,
    backgroundColor: piece.shape !== "star" ? piece.color : "transparent",
    borderRadius: piece.shape === "circle" ? "50%" : "2px",
    transform: `rotate(${piece.rotation}deg)`,
    animation: `confetti-fall ${piece.animationDuration}s ease-out ${piece.delay}s forwards`,
  };

  if (piece.shape === "star") {
    return (
      <div style={style}>
        <svg viewBox="0 0 24 24" fill={piece.color} width={piece.size} height={piece.size}>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      </div>
    );
  }

  return <div style={style} />;
}

// Celebration burst component - bigger celebration effect
interface CelebrationProps {
  active: boolean;
  type?: "win" | "kouppi" | "shistri";
  onComplete?: () => void;
}

export function Celebration({ active, type = "win", onComplete }: CelebrationProps) {
  const [showBurst, setShowBurst] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (active) {
      setShowBurst(true);
      setShowText(true);

      const timer = setTimeout(() => {
        setShowBurst(false);
        setShowText(false);
        if (onComplete) onComplete();
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      // Reset state when active becomes false
      setShowBurst(false);
      setShowText(false);
    }
  }, [active, onComplete]);

  const getText = () => {
    switch (type) {
      case "kouppi": return "🎰 KOUPPI!";
      case "shistri": return "⭐ SHISTRI!";
      default: return "🎉 WIN!";
    }
  };

  const getColor = () => {
    switch (type) {
      case "kouppi": return "from-purple-500 to-pink-500";
      case "shistri": return "from-orange-500 to-yellow-500";
      default: return "from-green-500 to-emerald-500";
    }
  };

  if (!active && !showBurst) return null;

  return (
    <>
      {/* Confetti */}
      <Confetti active={active} pieceCount={type === "kouppi" ? 150 : 100} />
      
      {/* Center burst text */}
      {showText && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div
            className={`
              text-6xl md:text-8xl font-black text-transparent bg-clip-text
              bg-gradient-to-r ${getColor()}
              animate-win-burst drop-shadow-2xl
            `}
            style={{
              textShadow: "0 0 40px rgba(255,255,255,0.5)",
            }}
          >
            {getText()}
          </div>
        </div>
      )}
    </>
  );
}
