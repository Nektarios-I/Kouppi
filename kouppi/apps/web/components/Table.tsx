"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import type { Upcards } from "@kouppi/game-core";
import {
  botChooseActionWithProfile,
  type BotProfile,
  canShistri,
  shistriBet,
} from "@kouppi/game-core";

function rankStr(r: number) {
  if (r === 1) return "A";
  if (r === 11) return "J";
  if (r === 12) return "Q";
  if (r === 13) return "K";
  return String(r);
}

function CardView({
  rank,
  suit,
  highlight = false,
}: {
  rank: number;
  suit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`w-16 h-24 rounded-lg bg-white text-black grid place-items-center font-bold shadow transition
      ${highlight ? "ring-4 ring-yellow-400 scale-105" : ""}`}
    >
      <div>
        {rankStr(rank)}
        <span className="text-xs ml-1">{suit}</span>
      </div>
    </div>
  );
}

export default function SinglePlayerTable() {
  const { state, dispatch, ready, botProfiles } = useGameStore();
  const [bet, setBet] = useState<number>(10);

  const [botThinking, setBotThinking] = useState(false);
  const [botPlanned, setBotPlanned] = useState<string | null>(null);

  const atRoundEnd = state.phase === "RoundEnd";
  const awaitingNext = !!state.awaitNext;

  const up = state.turn?.upcards as Upcards | undefined;

  const you = state.players[0];
  const canKouppi = you.bankroll >= state.round.pot && state.round.pot > 0;
  const minBet =
    state.config.minBetPolicy.type === "fixed"
      ? Math.min(state.config.minBetPolicy.value, state.round.pot)
      : 1;
  const maxBet = Math.min(you.bankroll, state.round.pot);

  const shistriEligible =
    !!up && state.config.shistri.enabled && canShistri(up);
  const shistriAmount = shistriEligible
    ? Math.min(
        you.bankroll,
        Math.min(
          state.round.pot,
          shistriBet(state.round.pot, state.config.shistri.percent, state.config.shistri.minChip)
        )
      )
    : 0;

  const last = state.lastResolution as
    | {
        kind: "bet" | "kouppi" | "shistri" | "pass";
        playerId: string;
        upcards: Upcards;
        reveal?: { rank: number; suit: string };
        amount?: number;
        win?: boolean;
      }
    | null
    | undefined;

  // AUTO FLOW (respect awaitingNext so it pauses)
  useEffect(() => {
    if (!ready) return;

    if (state.phase === "Lobby") {
      dispatch({ type: "startRound" });
      dispatch({ type: "ante" });
      dispatch({ type: "determineStarter" });
      return;
    }
    if (state.phase === "RoundEnd") return;
    if (awaitingNext) return;

    const turn = state.turn;
    const current = state.players[state.currentIndex];

    if (state.phase === "Round" && (!turn || !turn.upcards)) {
      dispatch({ type: "startTurn" });
      return;
    }

    if (turn && current.isBot) {
      const profile: BotProfile =
        botProfiles[current.id] ?? { mode: "deterministic", difficulty: "normal" };
      const act = botChooseActionWithProfile(state as any, profile);
      const actText =
        act.type === "pass"
          ? "Pass"
          : act.type === "kouppi"
          ? "KOUPPI"
          : act.type === "shistri"
          ? "SHISTRI"
          : `Bet ${act.amount}`;

      setBotThinking(true);
      setBotPlanned(`${current.name}: ${actText}`);

      const t = setTimeout(() => {
        (window as any).dispatch?.(act);
        dispatch(act as any);
        setBotThinking(false);
        const t2 = setTimeout(() => setBotPlanned(null), 600);
        return () => clearTimeout(t2);
      }, 900);

      return () => clearTimeout(t);
    }
  }, [state, dispatch, ready, awaitingNext, botProfiles]);

  useEffect(() => {
    (window as any).dispatch = dispatch;
  }, [dispatch]);

  return (
    <main className="min-h-screen p-4">
      {/* Round End modal */}
      {atRoundEnd && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50">
          <div className="w-full max-w-md card text-white">
            <h2 className="text-2xl font-semibold mb-2">Round complete</h2>
            <p className="opacity-80">
              The pot is empty. Do you want to <strong>refill the pot</strong> and
              continue with the same table settings?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="btn"
                onClick={() => {
                  dispatch({ type: "nextRound" });
                  dispatch({ type: "ante" });
                  dispatch({ type: "startTurn" });
                }}
              >
                Refill & Continue
              </button>
              <button className="btn" onClick={() => (window.location.href = "/")}>
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="card flex items-center justify-between">
          <div>
            <strong>Pot:</strong> {state.round.pot}
          </div>
          <div className="text-sm opacity-70">Phase: {state.phase}</div>
        </div>

        {/* Players */}
        <div className="card grid grid-cols-2 md:grid-cols-3 gap-4">
          {state.players.map((p) => (
            <div key={p.id}>
              <h2 className="font-semibold mb-2">
                {p.name}
                {!p.isBot ? " (You)" : ""}
              </h2>
              <div>Bankroll: {p.bankroll}</div>
            </div>
          ))}
        </div>

        {/* Table view */}
        <div className="card flex flex-col gap-3 items-center">
          <div className="opacity-80 text-sm">
            {awaitingNext
              ? "Review result & proceed"
              : botThinking
              ? "Bot is thinking…"
              : "Your table"}
          </div>

          <div className="flex items-center gap-6 justify-center">
            {awaitingNext && last ? (
              last.kind === "pass" ? (
                <>
                  <CardView rank={last.upcards.a.rank} suit={last.upcards.a.suit} />
                  <div className="w-16 h-24 grid place-items-center">
                    <span className="text-xs font-semibold">PASS</span>
                  </div>
                  <CardView rank={last.upcards.b.rank} suit={last.upcards.b.suit} />
                </>
              ) : (
                <>
                  <CardView rank={last.upcards.a.rank} suit={last.upcards.a.suit} />
                  {/* reveal visible for bet/kouppi/shistri */}
                  {last.reveal ? (
                    <CardView rank={last.reveal.rank} suit={last.reveal.suit} highlight />
                  ) : (
                    <div className="w-16 h-24 grid place-items-center opacity-30">
                      <span className="text-xs">reveal</span>
                    </div>
                  )}
                  <CardView rank={last.upcards.b.rank} suit={last.upcards.b.suit} />
                </>
              )
            ) : up ? (
              <>
                <CardView rank={up.a.rank} suit={up.a.suit} />
                <div className="w-16 h-24 grid place-items-center opacity-30">
                  <span className="text-xs">reveal</span>
                </div>
                <CardView rank={up.b.rank} suit={up.b.suit} />
              </>
            ) : (
              <div className="opacity-70">Waiting for cards…</div>
            )}
          </div>

          {/* Result summary while awaiting next */}
          {awaitingNext && last && (
            <div
              className={`mt-2 text-center font-semibold ${
                last.kind === "pass"
                  ? "text-yellow-300"
                  : last.win
                  ? "text-green-300"
                  : "text-red-300"
              }`}
            >
              {(() => {
                const who =
                  state.players.find((p) => p.id === last.playerId)?.name ?? "Player";
                if (last.kind === "pass") return `${who}: PASS`;
                const s = last.win ? "WIN" : "LOSS";
                const amt = last.amount ?? 0;
                const tag =
                  last.kind === "shistri"
                    ? " (SHISTRI)"
                    : last.kind === "kouppi"
                    ? " (KOUPPI)"
                    : "";
                return `${who}: ${s} ${amt}${tag}`;
              })()}
            </div>
          )}

          {/* Next Turn button */}
          {awaitingNext && state.phase === "Round" && (
            <div className="mt-2">
              <button className="btn" onClick={() => dispatch({ type: "nextPlayer" })}>
                Next Turn
              </button>
            </div>
          )}
        </div>

        {/* Actions (human) */}
        <div className="card flex items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="text-black rounded px-2 py-1 w-24"
              value={bet}
              min={1}
              max={maxBet}
              onChange={(e) => setBet(parseInt(e.target.value || "0", 10))}
              disabled={!ready || state.phase !== "Round" || awaitingNext}
            />
            <button
              className="btn"
              onClick={() => dispatch({ type: "pass" })}
              disabled={!ready || state.phase !== "Round" || awaitingNext}
            >
              Pass
            </button>
            <button
              className="btn"
              onClick={() => dispatch({ type: "bet", amount: bet })}
              disabled={
                !ready ||
                state.phase !== "Round" ||
                awaitingNext ||
                bet <= 0 ||
                bet > maxBet
              }
            >
              Bet
            </button>
            <button
              className="btn"
              onClick={() => dispatch({ type: "kouppi" })}
              disabled={!ready || state.phase !== "Round" || awaitingNext || !canKouppi}
            >
              KOUPPI
            </button>
            <button
              className="btn"
              onClick={() => dispatch({ type: "shistri" })}
              disabled={!ready || state.phase !== "Round" || awaitingNext || !shistriEligible}
              title={shistriEligible ? `Bet ${shistriAmount}` : "Not eligible"}
            >
              SHISTRI{shistriEligible ? ` (${shistriAmount})` : ""}
            </button>
          </div>

          <div className="opacity-70 text-sm">
            Tip: PASS shows between cards; SHISTRI win takes the whole pot.
          </div>
        </div>

        {/* Event Log */}
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Event Log</h3>
            <button
              className="btn"
              onClick={async () => {
                const text = state.history.join("\n");
                try {
                  await navigator.clipboard.writeText(text);
                  alert("Full log copied to clipboard.");
                } catch {
                  const w = window.open("", "_blank");
                  if (w) {
                    w.document.write(`<pre>${text.replace(/</g, "&lt;")}</pre>`);
                    w.document.close();
                  }
                }
              }}
            >
              Copy All
            </button>
          </div>
          <div className="max-h-56 overflow-auto text-sm mt-2 space-y-1">
            {state.history.map((h, i) => (
              <div key={i}>{h}</div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
