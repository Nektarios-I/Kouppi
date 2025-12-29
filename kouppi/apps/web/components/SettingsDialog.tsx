"use client";
import { useState } from "react";

export type TableSettings = {
  numberBots: number;                       // 0..7
  botMode: "deterministic" | "stochastic";
  botDifficulty: "easy" | "normal" | "hard";
  startingBankroll: number;                 // >= 1
  ante: number;                             // >= 1
  shistri: boolean;
};

export default function SettingsDialog({
  open,
  initial,
  onStart,
}: {
  open: boolean;
  initial?: Partial<TableSettings>;
  onStart: (s: TableSettings) => void;
}) {
  const [settings, setSettings] = useState<TableSettings>({
    numberBots: initial?.numberBots ?? 1,
    botMode: initial?.botMode ?? "deterministic",
    botDifficulty: initial?.botDifficulty ?? "normal",
    startingBankroll: initial?.startingBankroll ?? 100,
    ante: initial?.ante ?? 10,
    shistri: initial?.shistri ?? true,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50">
      <div className="w-full max-w-xl card text-white">
        <h2 className="text-2xl font-semibold mb-4">Table Settings</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Number of bots</span>
            <input
              type="number"
              className="text-black rounded px-2 py-1"
              min={0}
              max={7}
              value={settings.numberBots}
              onChange={(e) => setSettings(s => ({ ...s, numberBots: Math.max(0, Math.min(7, Number(e.target.value||0))) }))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Bot category</span>
            <select
              className="text-black rounded px-2 py-1"
              value={settings.botMode}
              onChange={(e) => setSettings(s => ({ ...s, botMode: e.target.value as any }))}
            >
              <option value="deterministic">Deterministic</option>
              <option value="stochastic">Stochastic</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Bot difficulty</span>
            <select
              className="text-black rounded px-2 py-1"
              value={settings.botDifficulty}
              onChange={(e) => setSettings(s => ({ ...s, botDifficulty: e.target.value as any }))}
            >
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Starting bankroll (all players)</span>
            <input
              type="number"
              className="text-black rounded px-2 py-1"
              min={1}
              value={settings.startingBankroll}
              onChange={(e) => setSettings(s => ({ ...s, startingBankroll: Math.max(1, Number(e.target.value||1)) }))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Starting ante</span>
            <input
              type="number"
              className="text-black rounded px-2 py-1"
              min={1}
              value={settings.ante}
              onChange={(e) => setSettings(s => ({ ...s, ante: Math.max(1, Number(e.target.value||1)) }))}
            />
          </label>

          <label className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={settings.shistri}
              onChange={(e) => setSettings(s => ({ ...s, shistri: e.target.checked }))}
            />
            <span>Enable SHISTRI</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="btn" onClick={() => onStart(settings)}>Start Game</button>
        </div>
      </div>
    </div>
  );
}
