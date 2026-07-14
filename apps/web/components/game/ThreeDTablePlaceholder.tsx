"use client";

import type { GameState } from "@kouppi/game-core";
import CenterCards from "./CenterCards";
import { getCenterCardsPresentation } from "./useCenterCardsPresentation";
import { ChipStack } from "@/components/ChipAnimation";
import CasinoBackground from "./CasinoBackground";
import { useTableTheme } from "@/hooks/useTableTheme";

interface ThreeDTablePlaceholderProps {
  state: GameState | null;
  title?: string;
}

/**
 * Scaffold for a future 3D table view — reads GameState but renders a static CSS perspective mock.
 */
export default function ThreeDTablePlaceholder({
  state,
  title = "3D KOUPPI Preview",
}: ThreeDTablePlaceholderProps) {
  const { theme } = useTableTheme();
  const presentation = state
    ? getCenterCardsPresentation({
        awaitingNext: !!state.awaitNext,
        upcards: state.turn?.upcards ?? null,
        reveal: state.turn?.reveal ?? null,
        lastResolution: state.lastResolution
          ? {
              kind: (state.lastResolution as { kind?: string }).kind as
                | "bet"
                | "kouppi"
                | "shistri"
                | "pass",
              upcards: state.lastResolution.upcards,
              reveal: state.lastResolution.reveal,
            }
          : null,
        waitingMessage: "No active hand",
      })
    : { mode: "waiting" as const, message: "Start a game to preview state" };

  return (
    <CasinoBackground className="text-white font-ui p-4 sm:p-8" theme={theme}>
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="font-display text-3xl sm:text-4xl text-gold tracking-wide mb-2">
            {title}
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-lg mx-auto">
            Experimental scaffold for a future 3D table. The standard 2.5D poker view remains the
            default for all game modes.
          </p>
        </header>

        {/* CSS perspective mock */}
        <div className="table-perspective mx-auto max-w-3xl mb-8">
          <div
            className="table-tilt relative aspect-[16/10] rounded-[50%] bg-felt-gradient shadow-rail border-4 border-rail overflow-hidden"
            style={{ boxShadow: "var(--rail) 0 0 0 12px, 0 24px 48px rgba(0,0,0,0.6)" }}
          >
            <div className="absolute inset-0 table-felt-texture opacity-40 pointer-events-none" />

            {/* Pot */}
            <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
              <ChipStack amount={state?.round.pot ?? 0} size="small" animate />
              <span className="font-display text-gold text-xl mt-1">
                {state?.round.pot ?? 0}
              </span>
              <span className="text-[10px] text-gold/60 tracking-widest font-ui">POT</span>
            </div>

            {/* Cards */}
            <div className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 scale-90 sm:scale-100">
              <CenterCards presentation={presentation} size="small" />
            </div>

            {/* Seat placeholders */}
            {state?.players.map((p, i) => {
              const angles = [90, 150, 200, 250, 270, 290, 340, 20];
              const angle = angles[i % angles.length];
              const rad = (angle * Math.PI) / 180;
              const rx = 42 * Math.cos(rad);
              const ry = 38 * Math.sin(rad);
              return (
                <div
                  key={p.id}
                  className="absolute w-14 text-center"
                  style={{
                    left: `calc(50% + ${rx}%)`,
                    top: `calc(50% + ${ry}%)`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="w-8 h-8 mx-auto rounded-full bg-black/50 border border-gold/30 text-sm flex items-center justify-center">
                    {p.isBot ? "🤖" : "👤"}
                  </div>
                  <div className="text-[9px] truncate mt-0.5">{p.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {state && (
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-black/40 border border-white/10 p-3">
              <div className="text-gray-500 text-xs mb-1">Phase</div>
              <div className="font-display text-gold">{state.phase}</div>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 p-3">
              <div className="text-gray-500 text-xs mb-1">Pot</div>
              <div className="font-display text-gold">{state.round.pot}</div>
            </div>
            <div className="rounded-xl bg-black/40 border border-white/10 p-3">
              <div className="text-gray-500 text-xs mb-1">Players</div>
              <div>{state.players.length}</div>
            </div>
          </div>
        )}
      </div>
    </CasinoBackground>
  );
}
